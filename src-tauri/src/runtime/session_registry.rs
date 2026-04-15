use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// Session metadata for tracking active sessions
#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionMetadata {
    pub session_id: String,
    pub project_id: String,
    pub created_at: u64,
    pub last_active_at: u64,
}

impl SessionMetadata {
    pub fn new(session_id: String, project_id: String) -> Self {
        let now = current_timestamp_ms();
        Self {
            session_id,
            project_id,
            created_at: now,
            last_active_at: now,
        }
    }

    pub fn touch(&mut self) {
        self.last_active_at = current_timestamp_ms();
    }
}

/// Session registry for tracking all active sessions
pub struct SessionRegistry {
    // sessionId -> metadata
    sessions: HashMap<String, SessionMetadata>,
    // projectId -> Vec<sessionId>
    project_sessions: HashMap<String, Vec<String>>,
}

impl SessionRegistry {
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            project_sessions: HashMap::new(),
        }
    }

    /// Register a new session
    pub fn register(&mut self, metadata: SessionMetadata) {
        let session_id = metadata.session_id.clone();
        let project_id = metadata.project_id.clone();

        // Add to sessions map
        self.sessions.insert(session_id.clone(), metadata);

        // Add to project sessions
        self.project_sessions
            .entry(project_id)
            .or_insert_with(Vec::new)
            .push(session_id);
    }

    /// Get session metadata
    pub fn get(&self, session_id: &str) -> Option<&SessionMetadata> {
        self.sessions.get(session_id)
    }

    /// Get mutable session metadata
    pub fn get_mut(&mut self, session_id: &str) -> Option<&mut SessionMetadata> {
        self.sessions.get_mut(session_id)
    }

    /// Touch a session (update last_active_at)
    pub fn touch(&mut self, session_id: &str) -> Result<(), String> {
        let metadata = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        metadata.touch();
        Ok(())
    }

    /// Get all sessions for a project
    pub fn get_project_sessions(&self, project_id: &str) -> Vec<&SessionMetadata> {
        if let Some(session_ids) = self.project_sessions.get(project_id) {
            session_ids
                .iter()
                .filter_map(|id| self.sessions.get(id))
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Remove a session
    pub fn remove(&mut self, session_id: &str) -> Option<SessionMetadata> {
        if let Some(metadata) = self.sessions.remove(session_id) {
            // Remove from project sessions
            if let Some(session_ids) = self.project_sessions.get_mut(&metadata.project_id) {
                session_ids.retain(|id| id != session_id);
                if session_ids.is_empty() {
                    self.project_sessions.remove(&metadata.project_id);
                }
            }
            Some(metadata)
        } else {
            None
        }
    }

    /// Remove all sessions for a project
    pub fn remove_project_sessions(&mut self, project_id: &str) -> Vec<SessionMetadata> {
        let mut removed = Vec::new();

        if let Some(session_ids) = self.project_sessions.remove(project_id) {
            for session_id in session_ids {
                if let Some(metadata) = self.sessions.remove(&session_id) {
                    removed.push(metadata);
                }
            }
        }

        removed
    }

    /// Get all sessions
    pub fn all(&self) -> Vec<&SessionMetadata> {
        self.sessions.values().collect()
    }

    /// Count sessions for a project
    pub fn count_project_sessions(&self, project_id: &str) -> usize {
        self.project_sessions
            .get(project_id)
            .map(|v| v.len())
            .unwrap_or(0)
    }
}

// Global registry instance
static REGISTRY: OnceLock<Mutex<SessionRegistry>> = OnceLock::new();

fn registry() -> &'static Mutex<SessionRegistry> {
    REGISTRY.get_or_init(|| Mutex::new(SessionRegistry::new()))
}

fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// Public API

/// Register a new session
pub fn register_session(session_id: String, project_id: String) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;

    let metadata = SessionMetadata::new(session_id, project_id);
    reg.register(metadata);
    Ok(())
}

/// Get session metadata
pub fn get_session(session_id: &str) -> Result<Option<SessionMetadata>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.get(session_id).cloned())
}

/// Touch a session (update last_active_at)
pub fn touch_session(session_id: &str) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.touch(session_id)
}

/// Get all sessions for a project
pub fn get_project_sessions(project_id: &str) -> Result<Vec<SessionMetadata>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.get_project_sessions(project_id).into_iter().cloned().collect())
}

/// Remove a session
pub fn remove_session(session_id: &str) -> Result<Option<SessionMetadata>, String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.remove(session_id))
}

/// Remove all sessions for a project
pub fn remove_project_sessions(project_id: &str) -> Result<Vec<SessionMetadata>, String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.remove_project_sessions(project_id))
}

/// Get all sessions
pub fn all_sessions() -> Result<Vec<SessionMetadata>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.all().into_iter().cloned().collect())
}

/// Count sessions for a project
pub fn count_project_sessions(project_id: &str) -> Result<usize, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.count_project_sessions(project_id))
}
