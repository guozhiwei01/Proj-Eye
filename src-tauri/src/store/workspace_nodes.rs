use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceNodeKind {
    Terminal,
    Logs,
    Database,
    AI,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceNodeState {
    Idle,
    Connecting,
    Active,
    Degraded,
    Reconnecting,
    Closed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceNodeBinding {
    pub node_id: String,
    pub project_id: String,
    pub kind: WorkspaceNodeKind,
    pub session_id: Option<String>,
    pub state: WorkspaceNodeState,
    pub created_at: u64,
}

pub struct NodeRegistry {
    // nodeId -> binding
    nodes: HashMap<String, WorkspaceNodeBinding>,
    // sessionId -> nodeId (reverse lookup)
    session_to_node: HashMap<String, String>,
}

impl NodeRegistry {
    fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            session_to_node: HashMap::new(),
        }
    }

    pub fn register_node(&mut self, binding: WorkspaceNodeBinding) {
        if let Some(session_id) = &binding.session_id {
            self.session_to_node
                .insert(session_id.clone(), binding.node_id.clone());
        }
        self.nodes.insert(binding.node_id.clone(), binding);
    }

    pub fn bind_session(&mut self, node_id: &str, session_id: &str) -> Result<(), String> {
        let binding = self
            .nodes
            .get_mut(node_id)
            .ok_or_else(|| format!("Node not found: {}", node_id))?;

        binding.session_id = Some(session_id.to_string());
        binding.state = WorkspaceNodeState::Active;
        self.session_to_node
            .insert(session_id.to_string(), node_id.to_string());

        Ok(())
    }

    pub fn unbind_session(&mut self, node_id: &str) {
        if let Some(binding) = self.nodes.get_mut(node_id) {
            if let Some(session_id) = &binding.session_id {
                self.session_to_node.remove(session_id);
            }
            binding.session_id = None;
            binding.state = WorkspaceNodeState::Idle;
        }
    }

    pub fn get_session_by_node(&self, node_id: &str) -> Option<String> {
        self.nodes.get(node_id)?.session_id.clone()
    }

    pub fn get_node_by_session(&self, session_id: &str) -> Option<String> {
        self.session_to_node.get(session_id).cloned()
    }

    pub fn update_state(&mut self, node_id: &str, state: WorkspaceNodeState) {
        if let Some(binding) = self.nodes.get_mut(node_id) {
            binding.state = state;
        }
    }

    pub fn remove_node(&mut self, node_id: &str) {
        if let Some(binding) = self.nodes.remove(node_id) {
            if let Some(session_id) = &binding.session_id {
                self.session_to_node.remove(session_id);
            }
        }
    }

    pub fn get_nodes_by_project(&self, project_id: &str) -> Vec<WorkspaceNodeBinding> {
        self.nodes
            .values()
            .filter(|b| b.project_id == project_id)
            .cloned()
            .collect()
    }
}

static NODE_REGISTRY: OnceLock<Mutex<NodeRegistry>> = OnceLock::new();

fn registry() -> &'static Mutex<NodeRegistry> {
    NODE_REGISTRY.get_or_init(|| Mutex::new(NodeRegistry::new()))
}

pub fn register_node(binding: WorkspaceNodeBinding) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.register_node(binding);
    Ok(())
}

pub fn bind_session(node_id: &str, session_id: &str) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.bind_session(node_id, session_id)
}

pub fn get_session_by_node(node_id: &str) -> Result<Option<String>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.get_session_by_node(node_id))
}

pub fn get_node_by_session(session_id: &str) -> Result<Option<String>, String> {
    let reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    Ok(reg.get_node_by_session(session_id))
}

pub fn update_node_state(node_id: &str, state: WorkspaceNodeState) -> Result<(), String> {
    let mut reg = registry()
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?;
    reg.update_state(node_id, state);
    Ok(())
}
