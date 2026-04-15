use crate::runtime::ws_server::{SessionChannels, WsServer};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

/// Terminal session information
#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub cols: u32,
    pub rows: u32,
}

/// Control messages for SSH session
enum SessionControl {
    Resize { cols: u32, rows: u32 },
    Close,
}

/// Internal session state with control channel
struct SessionState {
    info: TerminalSession,
    control_tx: mpsc::UnboundedSender<SessionControl>,
}

/// Terminal manager for handling SSH sessions
pub struct TerminalManager {
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    ws_server: Arc<WsServer>,
}

impl TerminalManager {
    /// Create a new terminal manager
    pub fn new(ws_server: Arc<WsServer>) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            ws_server,
        }
    }

    /// Create a new terminal session
    pub async fn create_session(
        &self,
        host: String,
        port: u16,
        username: String,
        credential: String,
        cols: u32,
        rows: u32,
    ) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();

        // Register with WebSocket server first
        let channels = self.ws_server.register_session(session_id.clone()).await;

        // Create control channel
        let (control_tx, control_rx) = mpsc::unbounded_channel();

        // Store session info
        let session_info = TerminalSession {
            session_id: session_id.clone(),
            host: host.clone(),
            port,
            username: username.clone(),
            cols,
            rows,
        };

        let state = SessionState {
            info: session_info.clone(),
            control_tx,
        };

        self.sessions
            .write()
            .await
            .insert(session_id.clone(), state);

        // Spawn SSH connection task
        let session_id_clone = session_id.clone();
        let sessions_clone = Arc::clone(&self.sessions);

        tokio::task::spawn_blocking(move || {
            if let Err(e) = Self::run_ssh_session(
                session_id_clone.clone(),
                host,
                port,
                username,
                credential,
                cols,
                rows,
                channels,
                control_rx,
            ) {
                eprintln!("SSH session error: {}", e);
            }

            // Remove session on exit
            let sessions = sessions_clone.clone();
            tokio::spawn(async move {
                sessions.write().await.remove(&session_id_clone);
            });
        });

        Ok(session_id)
    }

    /// Run SSH session (blocking I/O)
    fn run_ssh_session(
        session_id: String,
        host: String,
        port: u16,
        username: String,
        credential: String,
        cols: u32,
        rows: u32,
        mut channels: SessionChannels,
        mut control_rx: mpsc::UnboundedReceiver<SessionControl>,
    ) -> Result<(), String> {
        // Connect to SSH server
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| format!("Failed to connect: {}", e))?;

        let mut sess = Session::new().map_err(|e| format!("Failed to create session: {}", e))?;
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        sess.userauth_password(&username, &credential)
            .map_err(|e| format!("Authentication failed: {}", e))?;

        if !sess.authenticated() {
            return Err("Authentication failed".to_string());
        }

        // Request PTY
        let mut channel = sess
            .channel_session()
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        channel
            .request_pty("xterm-256color", None, Some((cols, rows, 0, 0)))
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        channel
            .shell()
            .map_err(|e| format!("Failed to start shell: {}", e))?;

        println!("SSH session started: {}", session_id);

        // Set session to non-blocking mode
        sess.set_blocking(false);

        // I/O loop
        let mut buf = [0u8; 8192];
        loop {
            // Check for control messages
            match control_rx.try_recv() {
                Ok(SessionControl::Resize { cols, rows }) => {
                    println!("Resizing PTY: {}x{}", cols, rows);
                    if let Err(e) = channel.request_pty_size(cols, rows, None, None) {
                        eprintln!("Failed to resize PTY: {}", e);
                    }
                }
                Ok(SessionControl::Close) => {
                    println!("Closing session: {}", session_id);
                    break;
                }
                Err(mpsc::error::TryRecvError::Empty) => {
                    // No control message, continue
                }
                Err(mpsc::error::TryRecvError::Disconnected) => {
                    println!("Control channel disconnected: {}", session_id);
                    break;
                }
            }

            // Read from SSH and send to WebSocket
            match channel.read(&mut buf) {
                Ok(n) if n > 0 => {
                    if let Err(e) = channels.to_client_tx.send(buf[..n].to_vec()) {
                        eprintln!("Failed to send to client: {}", e);
                        break;
                    }
                }
                Ok(_) => {
                    // No data available, continue
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No data available, continue
                }
                Err(e) => {
                    eprintln!("SSH read error: {}", e);
                    break;
                }
            }

            // Read from WebSocket and send to SSH
            match channels.to_terminal_rx.try_recv() {
                Ok(data) => {
                    if let Err(e) = channel.write_all(&data) {
                        eprintln!("SSH write error: {}", e);
                        break;
                    }
                    if let Err(e) = channel.flush() {
                        eprintln!("SSH flush error: {}", e);
                        break;
                    }
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                    // No data available, continue
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                    println!("WebSocket disconnected for session: {}", session_id);
                    break;
                }
            }

            // Check if channel is EOF
            if channel.eof() {
                println!("SSH channel EOF: {}", session_id);
                break;
            }

            // Small sleep to avoid busy loop
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        println!("SSH session ended: {}", session_id);
        Ok(())
    }

    /// Resize a terminal session
    pub async fn resize_session(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        if let Some(state) = sessions.get(session_id) {
            state
                .control_tx
                .send(SessionControl::Resize { cols, rows })
                .map_err(|e| format!("Failed to send resize command: {}", e))?;
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Close a terminal session
    pub async fn close_session(&self, session_id: &str) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        if let Some(state) = sessions.get(session_id) {
            let _ = state.control_tx.send(SessionControl::Close);
        }
        drop(sessions);

        // Remove from sessions map
        self.sessions.write().await.remove(session_id);
        self.ws_server.unregister_session(session_id).await;
        Ok(())
    }

    /// Get session info
    pub async fn get_session(&self, session_id: &str) -> Option<TerminalSession> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| s.info.clone())
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }
}
