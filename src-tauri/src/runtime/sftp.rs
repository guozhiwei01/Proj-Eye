use serde::{Deserialize, Serialize};
use ssh2::{Session, Sftp};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

static SFTP_MANAGER: OnceLock<Arc<Mutex<SftpManager>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpSession {
    pub session_id: String,
    pub server_id: String,
    pub connection_id: String,
    pub current_remote_path: String,
    pub created_at: u64,
    pub last_activity: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub permissions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    pub transfer_id: String,
    pub operation: TransferOperation,
    pub local_path: String,
    pub remote_path: String,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub status: TransferStatus,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferOperation {
    Upload,
    Download,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

struct SftpSessionInternal {
    metadata: SftpSession,
    session: Session,
    sftp: Sftp,
}

pub struct SftpManager {
    sessions: HashMap<String, SftpSessionInternal>,
    transfers: HashMap<String, TransferProgress>,
}

impl SftpManager {
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            transfers: HashMap::new(),
        }
    }

    pub fn global() -> Arc<Mutex<Self>> {
        SFTP_MANAGER
            .get_or_init(|| Arc::new(Mutex::new(Self::new())))
            .clone()
    }

    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    pub fn create_session(
        &mut self,
        server_id: String,
        host: String,
        port: u16,
        username: String,
        password: Option<String>,
    ) -> Result<SftpSession, String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let connection_id = format!("sftp-{}", session_id);

        // Connect to SSH server
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| format!("Failed to connect: {}", e))?;

        let mut session = Session::new().map_err(|e| format!("Failed to create session: {}", e))?;
        session.set_tcp_stream(tcp);
        session.handshake().map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        if let Some(pwd) = password {
            session
                .userauth_password(&username, &pwd)
                .map_err(|e| format!("Authentication failed: {}", e))?;
        } else {
            session
                .userauth_agent(&username)
                .map_err(|e| format!("Agent authentication failed: {}", e))?;
        }

        if !session.authenticated() {
            return Err("Authentication failed".to_string());
        }

        // Create SFTP channel
        let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP channel: {}", e))?;

        let now = Self::now();
        let metadata = SftpSession {
            session_id: session_id.clone(),
            server_id,
            connection_id,
            current_remote_path: "/".to_string(),
            created_at: now,
            last_activity: now,
        };

        let internal = SftpSessionInternal {
            metadata: metadata.clone(),
            session,
            sftp,
        };

        self.sessions.insert(session_id.clone(), internal);

        Ok(metadata)
    }

    pub fn close_session(&mut self, session_id: &str) -> Result<(), String> {
        self.sessions
            .remove(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        Ok(())
    }

    pub fn get_session(&self, session_id: &str) -> Option<SftpSession> {
        self.sessions.get(session_id).map(|s| s.metadata.clone())
    }

    pub fn list_dir(&mut self, session_id: &str, path: &str) -> Result<Vec<FileEntry>, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        let entries = session
            .sftp
            .readdir(Path::new(path))
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        let mut result = Vec::new();
        for (path, stat) in entries {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let is_dir = stat.is_dir();
            let size = stat.size.unwrap_or(0);
            let modified = stat.mtime.unwrap_or(0);
            let permissions = format!("{:o}", stat.perm.unwrap_or(0));

            result.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                size,
                modified,
                permissions,
            });
        }

        Ok(result)
    }

    pub fn create_dir(&mut self, session_id: &str, path: &str) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        session
            .sftp
            .mkdir(Path::new(path), 0o755)
            .map_err(|e| format!("Failed to create directory: {}", e))?;

        Ok(())
    }

    pub fn delete(&mut self, session_id: &str, path: &str) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        let stat = session
            .sftp
            .stat(Path::new(path))
            .map_err(|e| format!("Failed to stat path: {}", e))?;

        if stat.is_dir() {
            session
                .sftp
                .rmdir(Path::new(path))
                .map_err(|e| format!("Failed to remove directory: {}", e))?;
        } else {
            session
                .sftp
                .unlink(Path::new(path))
                .map_err(|e| format!("Failed to remove file: {}", e))?;
        }

        Ok(())
    }

    pub fn rename(&mut self, session_id: &str, old_path: &str, new_path: &str) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        session
            .sftp
            .rename(Path::new(old_path), Path::new(new_path), None)
            .map_err(|e| format!("Failed to rename: {}", e))?;

        Ok(())
    }

    pub fn upload(
        &mut self,
        session_id: &str,
        local_path: &str,
        remote_path: &str,
    ) -> Result<String, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        let transfer_id = uuid::Uuid::new_v4().to_string();

        // Read local file
        let local_data = fs::read(local_path)
            .map_err(|e| format!("Failed to read local file: {}", e))?;

        let total_bytes = local_data.len() as u64;

        // Create progress entry
        let progress = TransferProgress {
            transfer_id: transfer_id.clone(),
            operation: TransferOperation::Upload,
            local_path: local_path.to_string(),
            remote_path: remote_path.to_string(),
            total_bytes,
            transferred_bytes: 0,
            status: TransferStatus::InProgress,
            error: None,
        };

        self.transfers.insert(transfer_id.clone(), progress);

        // Write to remote file
        let mut remote_file = session
            .sftp
            .create(Path::new(remote_path))
            .map_err(|e| format!("Failed to create remote file: {}", e))?;

        remote_file
            .write_all(&local_data)
            .map_err(|e| format!("Failed to write remote file: {}", e))?;

        // Update progress
        if let Some(progress) = self.transfers.get_mut(&transfer_id) {
            progress.transferred_bytes = total_bytes;
            progress.status = TransferStatus::Completed;
        }

        Ok(transfer_id)
    }

    pub fn download(
        &mut self,
        session_id: &str,
        remote_path: &str,
        local_path: &str,
    ) -> Result<String, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        let transfer_id = uuid::Uuid::new_v4().to_string();

        // Get remote file size
        let stat = session
            .sftp
            .stat(Path::new(remote_path))
            .map_err(|e| format!("Failed to stat remote file: {}", e))?;

        let total_bytes = stat.size.unwrap_or(0);

        // Create progress entry
        let progress = TransferProgress {
            transfer_id: transfer_id.clone(),
            operation: TransferOperation::Download,
            local_path: local_path.to_string(),
            remote_path: remote_path.to_string(),
            total_bytes,
            transferred_bytes: 0,
            status: TransferStatus::InProgress,
            error: None,
        };

        self.transfers.insert(transfer_id.clone(), progress);

        // Read remote file
        let mut remote_file = session
            .sftp
            .open(Path::new(remote_path))
            .map_err(|e| format!("Failed to open remote file: {}", e))?;

        let mut buffer = Vec::new();
        remote_file
            .read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read remote file: {}", e))?;

        // Write to local file
        fs::write(local_path, &buffer)
            .map_err(|e| format!("Failed to write local file: {}", e))?;

        // Update progress
        if let Some(progress) = self.transfers.get_mut(&transfer_id) {
            progress.transferred_bytes = total_bytes;
            progress.status = TransferStatus::Completed;
        }

        Ok(transfer_id)
    }

    pub fn get_transfer_progress(&self, transfer_id: &str) -> Option<TransferProgress> {
        self.transfers.get(transfer_id).cloned()
    }

    pub fn cancel_transfer(&mut self, transfer_id: &str) -> Result<(), String> {
        let progress = self
            .transfers
            .get_mut(transfer_id)
            .ok_or_else(|| format!("Transfer not found: {}", transfer_id))?;

        progress.status = TransferStatus::Cancelled;
        Ok(())
    }

    pub fn read_file(
        &mut self,
        session_id: &str,
        path: &str,
        max_bytes: Option<u64>,
    ) -> Result<Vec<u8>, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        let mut remote_file = session
            .sftp
            .open(Path::new(path))
            .map_err(|e| format!("Failed to open remote file: {}", e))?;

        let mut buffer = Vec::new();

        if let Some(max) = max_bytes {
            let mut limited = remote_file.take(max);
            limited
                .read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read remote file: {}", e))?;
        } else {
            remote_file
                .read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read remote file: {}", e))?;
        }

        Ok(buffer)
    }

    pub fn stat(&mut self, session_id: &str, path: &str) -> Result<FileEntry, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.metadata.last_activity = Self::now();

        let stat = session
            .sftp
            .stat(Path::new(path))
            .map_err(|e| format!("Failed to stat path: {}", e))?;

        let name = Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        Ok(FileEntry {
            name,
            path: path.to_string(),
            is_dir: stat.is_dir(),
            size: stat.size.unwrap_or(0),
            modified: stat.mtime.unwrap_or(0),
            permissions: format!("{:o}", stat.perm.unwrap_or(0)),
        })
    }
}
