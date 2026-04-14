use serde_json::Value;
use tauri::AppHandle;

use crate::store::workspace_nodes::{self, WorkspaceNodeBinding, WorkspaceNodeKind, WorkspaceNodeState};

#[tauri::command]
pub fn workspace_register_node(
    _app: AppHandle,
    node_id: String,
    project_id: String,
    kind: String,
) -> Result<(), String> {
    let kind = match kind.as_str() {
        "terminal" => WorkspaceNodeKind::Terminal,
        "logs" => WorkspaceNodeKind::Logs,
        "database" => WorkspaceNodeKind::Database,
        "ai" => WorkspaceNodeKind::AI,
        _ => return Err(format!("Invalid node kind: {}", kind)),
    };

    let binding = WorkspaceNodeBinding {
        node_id,
        project_id,
        kind,
        session_id: None,
        state: WorkspaceNodeState::Idle,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
    };

    workspace_nodes::register_node(binding)
}

#[tauri::command]
pub fn workspace_bind_node_session(
    _app: AppHandle,
    node_id: String,
    session_id: String,
) -> Result<(), String> {
    workspace_nodes::bind_session(&node_id, &session_id)
}

#[tauri::command]
pub fn workspace_get_session_by_node(
    _app: AppHandle,
    node_id: String,
) -> Result<Option<String>, String> {
    workspace_nodes::get_session_by_node(&node_id)
}

#[tauri::command]
pub fn workspace_get_node_by_session(
    _app: AppHandle,
    session_id: String,
) -> Result<Option<String>, String> {
    workspace_nodes::get_node_by_session(&session_id)
}

#[tauri::command]
pub fn workspace_update_node_state(
    _app: AppHandle,
    node_id: String,
    state: String,
) -> Result<(), String> {
    let state = match state.as_str() {
        "idle" => WorkspaceNodeState::Idle,
        "connecting" => WorkspaceNodeState::Connecting,
        "active" => WorkspaceNodeState::Active,
        "degraded" => WorkspaceNodeState::Degraded,
        "reconnecting" => WorkspaceNodeState::Reconnecting,
        "closed" => WorkspaceNodeState::Closed,
        _ => return Err(format!("Invalid node state: {}", state)),
    };

    workspace_nodes::update_node_state(&node_id, state)
}
