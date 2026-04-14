use serde_json::Value;
use tauri::AppHandle;

use crate::runtime::{
    self, ConnectionContext, ConnectionState,
};

#[tauri::command]
pub fn connection_register(
    _app: AppHandle,
    project_id: String,
) -> Result<Value, String> {
    let context = ConnectionContext::new(project_id);
    runtime::register_connection(context.clone())?;

    Ok(serde_json::to_value(context).unwrap())
}

#[tauri::command]
pub fn connection_get(
    _app: AppHandle,
    project_id: String,
) -> Result<Option<Value>, String> {
    let context = runtime::get_connection(&project_id)?;
    Ok(context.map(|c| serde_json::to_value(c).unwrap()))
}

#[tauri::command]
pub fn connection_update_state(
    _app: AppHandle,
    project_id: String,
    state: String,
) -> Result<(), String> {
    let state = ConnectionState::from_str(&state)?;
    runtime::update_connection_state(&project_id, state)
}

#[tauri::command]
pub fn connection_set_error(
    _app: AppHandle,
    project_id: String,
    error: String,
) -> Result<(), String> {
    runtime::set_connection_error(&project_id, error)
}

#[tauri::command]
pub fn connection_bind_session(
    _app: AppHandle,
    project_id: String,
    session_id: String,
) -> Result<(), String> {
    runtime::bind_connection_session(&project_id, session_id)
}

#[tauri::command]
pub fn connection_unbind_session(
    _app: AppHandle,
    project_id: String,
    session_id: String,
) -> Result<(), String> {
    runtime::unbind_connection_session(&project_id, &session_id)
}

#[tauri::command]
pub fn connection_add_node(
    _app: AppHandle,
    project_id: String,
    node_id: String,
) -> Result<(), String> {
    runtime::add_node(&project_id, node_id)
}

#[tauri::command]
pub fn connection_remove_node(
    _app: AppHandle,
    project_id: String,
    node_id: String,
) -> Result<(), String> {
    runtime::remove_node(&project_id, &node_id)
}

#[tauri::command]
pub fn connection_record_success(
    _app: AppHandle,
    project_id: String,
    latency_ms: Option<u32>,
) -> Result<(), String> {
    runtime::record_success(&project_id, latency_ms)
}

#[tauri::command]
pub fn connection_update_health_check(
    _app: AppHandle,
    project_id: String,
) -> Result<(), String> {
    runtime::update_health_check(&project_id)
}

#[tauri::command]
pub fn connection_list_with_active_nodes(
    _app: AppHandle,
) -> Result<Vec<Value>, String> {
    let connections = runtime::connections_with_active_nodes()?;
    Ok(connections
        .into_iter()
        .map(|c| serde_json::to_value(c).unwrap())
        .collect())
}

#[tauri::command]
pub fn connection_list_by_server(
    _app: AppHandle,
    server_id: String,
) -> Result<Vec<Value>, String> {
    let connections = runtime::connections_by_server(&server_id)?;
    Ok(connections
        .into_iter()
        .map(|c| serde_json::to_value(c).unwrap())
        .collect())
}

#[tauri::command]
pub fn connection_remove(
    _app: AppHandle,
    project_id: String,
) -> Result<Option<Value>, String> {
    let context = runtime::remove_connection(&project_id)?;
    Ok(context.map(|c| serde_json::to_value(c).unwrap()))
}

#[tauri::command]
pub fn connection_list_all(
    _app: AppHandle,
) -> Result<Vec<Value>, String> {
    let connections = runtime::all_connections()?;
    Ok(connections
        .into_iter()
        .map(|c| serde_json::to_value(c).unwrap())
        .collect())
}

#[tauri::command]
pub fn connection_list_by_state(
    _app: AppHandle,
    state: String,
) -> Result<Vec<Value>, String> {
    let state = ConnectionState::from_str(&state)?;
    let connections = runtime::connections_by_state(state)?;
    Ok(connections
        .into_iter()
        .map(|c| serde_json::to_value(c).unwrap())
        .collect())
}

#[tauri::command]
pub fn session_register(
    _app: AppHandle,
    session_id: String,
    project_id: String,
) -> Result<(), String> {
    runtime::register_session(session_id, project_id)
}

#[tauri::command]
pub fn session_get(
    _app: AppHandle,
    session_id: String,
) -> Result<Option<Value>, String> {
    let metadata = runtime::get_session(&session_id)?;
    Ok(metadata.map(|m| serde_json::to_value(m).unwrap()))
}

#[tauri::command]
pub fn session_touch(
    _app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    runtime::touch_session(&session_id)
}

#[tauri::command]
pub fn session_list_by_project(
    _app: AppHandle,
    project_id: String,
) -> Result<Vec<Value>, String> {
    let sessions = runtime::get_project_sessions(&project_id)?;
    Ok(sessions
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap())
        .collect())
}

#[tauri::command]
pub fn session_remove(
    _app: AppHandle,
    session_id: String,
) -> Result<Option<Value>, String> {
    let metadata = runtime::remove_session(&session_id)?;
    Ok(metadata.map(|m| serde_json::to_value(m).unwrap()))
}

#[tauri::command]
pub fn session_remove_by_project(
    _app: AppHandle,
    project_id: String,
) -> Result<Vec<Value>, String> {
    let sessions = runtime::remove_project_sessions(&project_id)?;
    Ok(sessions
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap())
        .collect())
}

#[tauri::command]
pub fn session_count_by_project(
    _app: AppHandle,
    project_id: String,
) -> Result<usize, String> {
    runtime::count_project_sessions(&project_id)
}
