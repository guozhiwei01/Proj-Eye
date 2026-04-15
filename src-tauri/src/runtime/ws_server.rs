use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};

type SessionId = String;

/// Channel for sending data from terminal to WebSocket client
pub type ToClientTx = mpsc::UnboundedSender<Vec<u8>>;
pub type ToClientRx = mpsc::UnboundedReceiver<Vec<u8>>;

/// Channel for sending data from WebSocket client to terminal
pub type ToTerminalTx = mpsc::UnboundedSender<Vec<u8>>;
pub type ToTerminalRx = mpsc::UnboundedReceiver<Vec<u8>>;

/// Session channels returned when registering a session
pub struct SessionChannels {
    pub to_terminal_rx: ToTerminalRx,
    pub to_client_tx: ToClientTx,
}

/// WebSocket server for terminal data plane
pub struct WsServer {
    addr: SocketAddr,
    port: u16,
    // Store the to_client_rx for each session so WebSocket can read from it
    pending_sessions: Arc<RwLock<HashMap<SessionId, ToClientRx>>>,
    // Store the to_terminal_tx for each session so WebSocket can write to it
    active_sessions: Arc<RwLock<HashMap<SessionId, ToTerminalTx>>>,
}

impl WsServer {
    /// Create a new WebSocket server
    pub fn new(port: u16) -> Self {
        let addr = format!("127.0.0.1:{}", port)
            .parse()
            .expect("Invalid address");

        Self {
            addr,
            port,
            pending_sessions: Arc::new(RwLock::new(HashMap::new())),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get the server port
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Start the WebSocket server
    pub async fn start(self: Arc<Self>) -> Result<(), String> {
        let listener = TcpListener::bind(self.addr)
            .await
            .map_err(|e| format!("Failed to bind WebSocket server: {}", e))?;

        println!("WebSocket server listening on {}", self.addr);

        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    println!("New WebSocket connection from {}", addr);
                    let server = Arc::clone(&self);
                    tokio::spawn(async move {
                        if let Err(e) = server.handle_connection(stream).await {
                            eprintln!("WebSocket connection error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Failed to accept connection: {}", e);
                }
            }
        }
    }

    /// Handle a WebSocket connection
    async fn handle_connection(&self, stream: TcpStream) -> Result<(), String> {
        let ws_stream = accept_async(stream)
            .await
            .map_err(|e| format!("WebSocket handshake failed: {}", e))?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Wait for first message to determine session ID
        let session_id = match ws_receiver.next().await {
            Some(Ok(Message::Binary(data))) => {
                if data.is_empty() {
                    return Err("Empty first frame".to_string());
                }

                let session_id_len = data[0] as usize;
                if data.len() < 1 + session_id_len {
                    return Err("Invalid first frame: too short".to_string());
                }

                let session_id = String::from_utf8_lossy(&data[1..1 + session_id_len]).to_string();
                let payload = &data[1 + session_id_len..];

                // Send payload to terminal if any
                if !payload.is_empty() {
                    let sessions = self.active_sessions.read().await;
                    if let Some(tx) = sessions.get(&session_id) {
                        let _ = tx.send(payload.to_vec());
                    }
                }

                session_id
            }
            Some(Ok(Message::Close(_))) => {
                return Ok(());
            }
            Some(Ok(_)) => {
                return Err("Expected binary frame".to_string());
            }
            Some(Err(e)) => {
                return Err(format!("WebSocket error: {}", e));
            }
            None => {
                return Ok(());
            }
        };

        println!("WebSocket connected to session: {}", session_id);

        // Get the to_client_rx for this session
        let mut to_client_rx = {
            let mut pending = self.pending_sessions.write().await;
            pending.remove(&session_id)
        };

        if to_client_rx.is_none() {
            return Err(format!("Session not found: {}", session_id));
        }

        let mut to_client_rx = to_client_rx.unwrap();

        // Get the to_terminal_tx for this session
        let to_terminal_tx = {
            let sessions = self.active_sessions.read().await;
            sessions.get(&session_id).cloned()
        };

        if to_terminal_tx.is_none() {
            return Err(format!("Session not active: {}", session_id));
        }

        let to_terminal_tx = to_terminal_tx.unwrap();

        // Bidirectional communication loop
        loop {
            tokio::select! {
                // Receive data from WebSocket client (input from user)
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Binary(data))) => {
                            // Parse frame: [session_id_len(1)][session_id][payload]
                            if data.is_empty() {
                                continue;
                            }

                            let session_id_len = data[0] as usize;
                            if data.len() < 1 + session_id_len {
                                eprintln!("Invalid frame: too short");
                                continue;
                            }

                            let payload = &data[1 + session_id_len..];

                            // Send to terminal
                            if let Err(e) = to_terminal_tx.send(payload.to_vec()) {
                                eprintln!("Failed to send to terminal: {}", e);
                                break;
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            println!("WebSocket connection closed for session: {}", session_id);
                            break;
                        }
                        Some(Ok(Message::Ping(data))) => {
                            if let Err(e) = ws_sender.send(Message::Pong(data)).await {
                                eprintln!("Failed to send pong: {}", e);
                                break;
                            }
                        }
                        Some(Ok(_)) => {
                            // Ignore text and other message types
                        }
                        Some(Err(e)) => {
                            eprintln!("WebSocket error: {}", e);
                            break;
                        }
                        None => {
                            break;
                        }
                    }
                }

                // Send data to WebSocket client (output from terminal)
                data = to_client_rx.recv() => {
                    match data {
                        Some(data) => {
                            // Build frame: [session_id_len(1)][session_id][payload]
                            let session_id_bytes = session_id.as_bytes();
                            let session_id_len = session_id_bytes.len() as u8;

                            let mut frame = Vec::with_capacity(1 + session_id_bytes.len() + data.len());
                            frame.push(session_id_len);
                            frame.extend_from_slice(session_id_bytes);
                            frame.extend_from_slice(&data);

                            if let Err(e) = ws_sender.send(Message::Binary(frame)).await {
                                eprintln!("Failed to send to WebSocket: {}", e);
                                break;
                            }
                        }
                        None => {
                            // Channel closed, terminal session ended
                            println!("Terminal session ended: {}", session_id);
                            break;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Register a terminal session and return channels
    pub async fn register_session(&self, session_id: String) -> SessionChannels {
        let (to_terminal_tx, to_terminal_rx) = mpsc::unbounded_channel();
        let (to_client_tx, to_client_rx) = mpsc::unbounded_channel();

        // Store channels
        self.pending_sessions.write().await.insert(session_id.clone(), to_client_rx);
        self.active_sessions.write().await.insert(session_id.clone(), to_terminal_tx);

        println!("Registered session: {}", session_id);

        SessionChannels {
            to_terminal_rx,
            to_client_tx,
        }
    }

    /// Unregister a terminal session
    pub async fn unregister_session(&self, session_id: &str) {
        self.pending_sessions.write().await.remove(session_id);
        self.active_sessions.write().await.remove(session_id);
        println!("Unregistered session: {}", session_id);
    }
}
