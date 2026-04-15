use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// Connection state for a project
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    /// Initial state, no connection attempt yet
    Idle,
    /// Attempting to establish connection
    Connecting,
    /// Connection established and healthy
    Active,
    /// Connection established but experiencing issues
    Degraded,
    /// Connection lost, attempting to reconnect
    Reconnecting,
    /// Connection closed (user initiated or permanent failure)
    Closed,
}

impl ConnectionState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConnectionState::Idle => "idle",
            ConnectionState::Connecting => "connecting",
            ConnectionState::Active => "active",
            ConnectionState::Degraded => "degraded",
            ConnectionState::Reconnecting => "reconnecting",
            ConnectionState::Closed => "closed",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "idle" => Ok(ConnectionState::Idle),
            "connecting" => Ok(ConnectionState::Connecting),
            "active" => Ok(ConnectionState::Active),
            "degraded" => Ok(ConnectionState::Degraded),
            "reconnecting" => Ok(ConnectionState::Reconnecting),
            "closed" => Ok(ConnectionState::Closed),
            _ => Err(format!("Invalid connection state: {}", s)),
        }
    }
}

/// Connection context for a project
///
/// This represents the logical connection to a project, which may be backed
/// by one or more sessions. The UI should query this to understand the
/// overall connection health.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionContext {
    /// Project ID this connection belongs to
    pub project_id: String,

    /// Server ID (if connected via SSH)
    pub server_id: Option<String>,

    /// Database ID (if database connection is active)
    pub database_id: Option<String>,

    /// Primary session ID (if any)
    pub primary_session_id: Option<String>,

    /// All active session IDs for this connection
    pub session_ids: Vec<String>,

    /// Workspace node IDs using this connection
    pub node_ids: Vec<String>,

    /// Current connection state
    pub state: ConnectionState,

    /// Last error message (if any)
    pub last_error: Option<String>,

    /// Timestamp of last successful connection (milliseconds since epoch)
    pub last_connected_at: Option<u64>,

    /// Connection health metrics
    pub health: ConnectionHealth,

    /// Timestamp when this context was created
    pub created_at: u64,

    /// Timestamp of last state update
    pub updated_at: u64,
}

/// Connection health metrics
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHealth {
    /// Number of successful operations since last error
    pub success_count: u32,

    /// Number of failed operations since last success
    pub failure_count: u32,

    /// Average latency in milliseconds (rolling window)
    pub avg_latency_ms: Option<u32>,

    /// Last health check timestamp
    pub last_check_at: Option<u64>,

    /// Is connection considered healthy?
    pub is_healthy: bool,
}

impl Default for ConnectionHealth {
    fn default() -> Self {
        Self {
            success_count: 0,
            failure_count: 0,
            avg_latency_ms: None,
            last_check_at: None,
            is_healthy: true,
        }
    }
}

impl ConnectionContext {
    pub fn new(project_id: String) -> Self {
        let now = current_timestamp_ms();
        Self {
            project_id,
            server_id: None,
            database_id: None,
            primary_session_id: None,
            session_ids: Vec::new(),
            node_ids: Vec::new(),
            state: ConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            health: ConnectionHealth::default(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn with_session(mut self, session_id: String) -> Self {
        self.primary_session_id = Some(session_id.clone());
        self.session_ids.push(session_id);
        self
    }

    pub fn with_state(mut self, state: ConnectionState) -> Self {
        self.state = state;
        self.updated_at = current_timestamp_ms();
        self
    }

    pub fn with_server(mut self, server_id: String) -> Self {
        self.server_id = Some(server_id);
        self
    }

    pub fn with_database(mut self, database_id: String) -> Self {
        self.database_id = Some(database_id);
        self
    }

    pub fn update_state(&mut self, state: ConnectionState) {
        self.state = state.clone();
        self.updated_at = current_timestamp_ms();

        if state == ConnectionState::Active {
            self.last_connected_at = Some(current_timestamp_ms());
            self.last_error = None;
            self.health.is_healthy = true;
        } else if state == ConnectionState::Closed {
            self.health.is_healthy = false;
        }
    }

    pub fn set_error(&mut self, error: String) {
        self.last_error = Some(error);
        self.updated_at = current_timestamp_ms();
        self.health.failure_count += 1;
        self.health.success_count = 0;

        // Mark as unhealthy if too many failures
        if self.health.failure_count >= 3 {
            self.health.is_healthy = false;
        }
    }

    pub fn record_success(&mut self, latency_ms: Option<u32>) {
        self.health.success_count += 1;
        self.health.failure_count = 0;
        self.health.is_healthy = true;

        if let Some(latency) = latency_ms {
            // Simple moving average
            self.health.avg_latency_ms = Some(
                if let Some(avg) = self.health.avg_latency_ms {
                    (avg * 3 + latency) / 4  // Weighted average
                } else {
                    latency
                }
            );
        }
    }

    pub fn update_health_check(&mut self) {
        self.health.last_check_at = Some(current_timestamp_ms());
    }

    pub fn bind_session(&mut self, session_id: String) {
        if !self.session_ids.contains(&session_id) {
            self.session_ids.push(session_id.clone());
        }
        self.primary_session_id = Some(session_id);
        self.updated_at = current_timestamp_ms();
    }

    pub fn unbind_session(&mut self, session_id: &str) {
        self.session_ids.retain(|id| id != session_id);

        // If removing primary session, pick another one
        if self.primary_session_id.as_deref() == Some(session_id) {
            self.primary_session_id = self.session_ids.first().cloned();
        }

        self.updated_at = current_timestamp_ms();
    }

    pub fn add_node(&mut self, node_id: String) {
        if !self.node_ids.contains(&node_id) {
            self.node_ids.push(node_id);
            self.updated_at = current_timestamp_ms();
        }
    }

    pub fn remove_node(&mut self, node_id: &str) {
        self.node_ids.retain(|id| id != node_id);
        self.updated_at = current_timestamp_ms();
    }

    pub fn has_active_nodes(&self) -> bool {
        !self.node_ids.is_empty()
    }

    pub fn has_active_sessions(&self) -> bool {
        !self.session_ids.is_empty()
    }
}

/// Connection registry managing all project connections
pub struct ConnectionRegistry {
    connections: HashMap<String, ConnectionContext>,
}

impl ConnectionRegistry {
    fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    /// Register or update a connection context
    pub fn register(&mut self, context: ConnectionContext) {
        self.connections.insert(context.project_id.clone(), context);
    }

    /// Get connection context for a project
    pub fn get(&self, project_id: &str) -> Option<&ConnectionContext> {
        self.connections.get(project_id)
    }

    /// Get mutable connection context for a project
    pub fn get_mut(&mut self, project_id: &str) -> Option<&mut ConnectionContext> {
        self.connections.get_mut(project_id)
    }

    /// Update connection state
    pub fn update_state(&mut self, project_id: &str, state: ConnectionState) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.update_state(state);
        Ok(())
    }

    /// Set error for a connection
    pub fn set_error(&mut self, project_id: &str, error: String) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.set_error(error);
        Ok(())
    }

    /// Bind a session to a connection
    pub fn bind_session(&mut self, project_id: &str, session_id: String) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.bind_session(session_id);
        Ok(())
    }

    /// Unbind session from a connection
    pub fn unbind_session(&mut self, project_id: &str, session_id: &str) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.unbind_session(session_id);
        Ok(())
    }

    /// Add a workspace node to a connection
    pub fn add_node(&mut self, project_id: &str, node_id: String) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.add_node(node_id);
        Ok(())
    }

    /// Remove a workspace node from a connection
    pub fn remove_node(&mut self, project_id: &str, node_id: &str) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.remove_node(node_id);
        Ok(())
    }

    /// Record a successful operation
    pub fn record_success(&mut self, project_id: &str, latency_ms: Option<u32>) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.record_success(latency_ms);
        Ok(())
    }

    /// Update health check timestamp
    pub fn update_health_check(&mut self, project_id: &str) -> Result<(), String> {
        let context = self
            .connections
            .get_mut(project_id)
            .ok_or_else(|| format!("Connection not found for project: {}", project_id))?;

        context.update_health_check();
        Ok(())
    }

    /// Get connections with active nodes
    pub fn with_active_nodes(&self) -> Vec<&ConnectionContext> {
        self.connections
            .values()
            .filter(|ctx| ctx.has_active_nodes())
            .collect()
    }

    /// Get connections by server
    pub fn by_server(&self, server_id: &str) -> Vec<&ConnectionContext> {
        self.connections
            .values()
            .filter(|ctx| ctx.server_id.as_deref() == Some(server_id))
            .collect()
    }

    /// Remove a connection
    pub fn remove(&mut self, project_id: &str) -> Option<ConnectionContext> {
        self.connections.remove(project_id)
    }

    /// Get all connections
    pub fn all(&self) -> Vec<&ConnectionContext> {
        self.connections.values().collect()
    }

    /// Get connections by state
    pub fn by_state(&self, state: ConnectionState) -> Vec<&ConnectionContext> {
        self.connections
            .values()
            .filter(|ctx| ctx.state == state)
            .collect()
    }
}

// Global registry instance
static REGISTRY: OnceLock<Mutex<ConnectionRegistry>> = OnceLock::new();

fn registry() -> &'static Mutex<ConnectionRegistry> {
    REGISTRY.get_or_init(|| Mutex::new(ConnectionRegistry::new()))
}

fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// Public API

/// Register a new connection context
pub fn register_connection(context: ConnectionContext) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.register(context);
    Ok(())
}

/// Get connection context for a project
pub fn get_connection(project_id: &str) -> Result<Option<ConnectionContext>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.get(project_id).cloned())
}

/// Update connection state
pub fn update_state(project_id: &str, state: ConnectionState) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.update_state(project_id, state)
}

/// Set error for a connection
pub fn set_error(project_id: &str, error: String) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.set_error(project_id, error)
}

/// Bind a session to a connection
pub fn bind_session(project_id: &str, session_id: String) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.bind_session(project_id, session_id)
}

/// Unbind session from a connection
pub fn unbind_session(project_id: &str, session_id: &str) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.unbind_session(project_id, session_id)
}

/// Add a workspace node to a connection
pub fn add_node(project_id: &str, node_id: String) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.add_node(project_id, node_id)
}

/// Remove a workspace node from a connection
pub fn remove_node(project_id: &str, node_id: &str) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.remove_node(project_id, node_id)
}

/// Record a successful operation
pub fn record_success(project_id: &str, latency_ms: Option<u32>) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.record_success(project_id, latency_ms)
}

/// Update health check timestamp
pub fn update_health_check(project_id: &str) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.update_health_check(project_id)
}

/// Get connections with active nodes
pub fn connections_with_active_nodes() -> Result<Vec<ConnectionContext>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.with_active_nodes().into_iter().cloned().collect())
}

/// Get connections by server
pub fn connections_by_server(server_id: &str) -> Result<Vec<ConnectionContext>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.by_server(server_id).into_iter().cloned().collect())
}

/// Remove a connection
pub fn remove_connection(project_id: &str) -> Result<Option<ConnectionContext>, String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.remove(project_id))
}

/// Get all connections
pub fn all_connections() -> Result<Vec<ConnectionContext>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.all().into_iter().cloned().collect())
}

/// Get connections by state
pub fn connections_by_state(state: ConnectionState) -> Result<Vec<ConnectionContext>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.by_state(state).into_iter().cloned().collect())
}
