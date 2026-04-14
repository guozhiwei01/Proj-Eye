use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// Snapshot of workspace state for reconnection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconnectSnapshot {
    /// Project ID this snapshot belongs to
    pub project_id: String,

    /// Server ID (if connected via SSH)
    pub server_id: Option<String>,

    /// Database ID (if database connection was active)
    pub database_id: Option<String>,

    /// Active workspace node IDs
    pub active_node_ids: Vec<String>,

    /// Terminal tabs state
    pub terminal_tabs: Vec<TerminalTabSnapshot>,

    /// Active log sources
    pub active_log_sources: Vec<String>,

    /// Last AI prompt (for context restoration)
    pub last_ai_prompt: Option<String>,

    /// Connection state before disconnect
    pub last_connection_state: String,

    /// Timestamp when snapshot was captured
    pub captured_at: u64,

    /// Reason for snapshot (disconnect, error, manual)
    pub reason: SnapshotReason,
}

/// Terminal tab state for reconnection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalTabSnapshot {
    /// Node ID of the terminal
    pub node_id: String,

    /// Tab title
    pub title: String,

    /// Current working directory (if available)
    pub cwd: Option<String>,

    /// Last command executed
    pub last_command: Option<String>,

    /// Tab order/index
    pub index: usize,
}

/// Reason for creating a snapshot
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SnapshotReason {
    /// Connection lost unexpectedly
    Disconnect,
    /// Connection error occurred
    Error,
    /// User manually triggered snapshot
    Manual,
    /// Automatic periodic snapshot
    Periodic,
}

impl SnapshotReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            SnapshotReason::Disconnect => "disconnect",
            SnapshotReason::Error => "error",
            SnapshotReason::Manual => "manual",
            SnapshotReason::Periodic => "periodic",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "disconnect" => Ok(SnapshotReason::Disconnect),
            "error" => Ok(SnapshotReason::Error),
            "manual" => Ok(SnapshotReason::Manual),
            "periodic" => Ok(SnapshotReason::Periodic),
            _ => Err(format!("Invalid snapshot reason: {}", s)),
        }
    }
}

impl ReconnectSnapshot {
    pub fn new(project_id: String, reason: SnapshotReason) -> Self {
        Self {
            project_id,
            server_id: None,
            database_id: None,
            active_node_ids: Vec::new(),
            terminal_tabs: Vec::new(),
            active_log_sources: Vec::new(),
            last_ai_prompt: None,
            last_connection_state: "unknown".to_string(),
            captured_at: current_timestamp_ms(),
            reason,
        }
    }

    pub fn with_server(mut self, server_id: String) -> Self {
        self.server_id = Some(server_id);
        self
    }

    pub fn with_database(mut self, database_id: String) -> Self {
        self.database_id = Some(database_id);
        self
    }

    pub fn with_nodes(mut self, node_ids: Vec<String>) -> Self {
        self.active_node_ids = node_ids;
        self
    }

    pub fn with_terminal_tabs(mut self, tabs: Vec<TerminalTabSnapshot>) -> Self {
        self.terminal_tabs = tabs;
        self
    }

    pub fn with_log_sources(mut self, sources: Vec<String>) -> Self {
        self.active_log_sources = sources;
        self
    }

    pub fn with_ai_prompt(mut self, prompt: String) -> Self {
        self.last_ai_prompt = Some(prompt);
        self
    }

    pub fn with_connection_state(mut self, state: String) -> Self {
        self.last_connection_state = state;
        self
    }

    /// Check if snapshot is still valid (not too old)
    pub fn is_valid(&self, max_age_ms: u64) -> bool {
        let now = current_timestamp_ms();
        now - self.captured_at < max_age_ms
    }

    /// Get age of snapshot in milliseconds
    pub fn age_ms(&self) -> u64 {
        let now = current_timestamp_ms();
        now - self.captured_at
    }
}

/// Snapshot registry managing all project snapshots
pub struct SnapshotRegistry {
    // projectId -> snapshot
    snapshots: HashMap<String, ReconnectSnapshot>,
}

impl SnapshotRegistry {
    fn new() -> Self {
        Self {
            snapshots: HashMap::new(),
        }
    }

    /// Save a snapshot
    pub fn save(&mut self, snapshot: ReconnectSnapshot) {
        self.snapshots.insert(snapshot.project_id.clone(), snapshot);
    }

    /// Get snapshot for a project
    pub fn get(&self, project_id: &str) -> Option<&ReconnectSnapshot> {
        self.snapshots.get(project_id)
    }

    /// Remove snapshot for a project
    pub fn remove(&mut self, project_id: &str) -> Option<ReconnectSnapshot> {
        self.snapshots.remove(project_id)
    }

    /// Get all snapshots
    pub fn all(&self) -> Vec<&ReconnectSnapshot> {
        self.snapshots.values().collect()
    }

    /// Get valid snapshots (not expired)
    pub fn valid_snapshots(&self, max_age_ms: u64) -> Vec<&ReconnectSnapshot> {
        self.snapshots
            .values()
            .filter(|s| s.is_valid(max_age_ms))
            .collect()
    }

    /// Clean up expired snapshots
    pub fn cleanup_expired(&mut self, max_age_ms: u64) -> usize {
        let expired: Vec<String> = self
            .snapshots
            .iter()
            .filter(|(_, s)| !s.is_valid(max_age_ms))
            .map(|(id, _)| id.clone())
            .collect();

        let count = expired.len();
        for id in expired {
            self.snapshots.remove(&id);
        }
        count
    }
}

// Global registry instance
static REGISTRY: OnceLock<Mutex<SnapshotRegistry>> = OnceLock::new();

fn registry() -> &'static Mutex<SnapshotRegistry> {
    REGISTRY.get_or_init(|| Mutex::new(SnapshotRegistry::new()))
}

fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// Public API

/// Save a reconnect snapshot
pub fn save_snapshot(snapshot: ReconnectSnapshot) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.save(snapshot);
    Ok(())
}

/// Get snapshot for a project
pub fn get_snapshot(project_id: &str) -> Result<Option<ReconnectSnapshot>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.get(project_id).cloned())
}

/// Remove snapshot for a project
pub fn remove_snapshot(project_id: &str) -> Result<Option<ReconnectSnapshot>, String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.remove(project_id))
}

/// Get all snapshots
pub fn all_snapshots() -> Result<Vec<ReconnectSnapshot>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.all().into_iter().cloned().collect())
}

/// Get valid snapshots (not expired)
pub fn valid_snapshots(max_age_ms: u64) -> Result<Vec<ReconnectSnapshot>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.valid_snapshots(max_age_ms).into_iter().cloned().collect())
}

/// Clean up expired snapshots
pub fn cleanup_expired_snapshots(max_age_ms: u64) -> Result<usize, String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.cleanup_expired(max_age_ms))
}
