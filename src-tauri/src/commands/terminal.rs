use crate::runtime::{TerminalManager, TerminalSession};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

/// Terminal manager state
pub struct TerminalState {
    pub manager: Arc<TerminalManager>,
}

/// Create a new terminal session
#[tauri::command]
pub async fn create_terminal_session(
    host: String,
    port: u16,
    username: String,
    credential: String,
    cols: u32,
    rows: u32,
    state: State<'_, Arc<RwLock<TerminalState>>>,
) -> Result<String, String> {
    let state = state.read().await;
    state
        .manager
        .create_session(host, port, username, credential, cols, rows)
        .await
}

/// Resize a terminal session
#[tauri::command]
pub async fn resize_terminal_session(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, Arc<RwLock<TerminalState>>>,
) -> Result<(), String> {
    let state = state.read().await;
    state.manager.resize_session(&session_id, cols, rows).await
}

/// Close a terminal session
#[tauri::command]
pub async fn close_terminal_session(
    session_id: String,
    state: State<'_, Arc<RwLock<TerminalState>>>,
) -> Result<(), String> {
    let state = state.read().await;
    state.manager.close_session(&session_id).await
}

/// Get terminal session info
#[tauri::command]
pub async fn get_terminal_session(
    session_id: String,
    state: State<'_, Arc<RwLock<TerminalState>>>,
) -> Result<Option<TerminalSession>, String> {
    let state = state.read().await;
    Ok(state.manager.get_session(&session_id).await)
}

/// List all terminal sessions
#[tauri::command]
pub async fn list_terminal_sessions(
    state: State<'_, Arc<RwLock<TerminalState>>>,
) -> Result<Vec<String>, String> {
    let state = state.read().await;
    Ok(state.manager.list_sessions().await)
}

/// Get WebSocket server port
#[tauri::command]
pub async fn get_ws_port(
    _state: State<'_, Arc<RwLock<TerminalState>>>,
) -> Result<u16, String> {
    // Return the default port
    Ok(9527)
}
