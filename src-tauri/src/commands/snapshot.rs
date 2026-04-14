use serde_json::Value;
use tauri::AppHandle;

use crate::runtime::{self, ReconnectSnapshot, SnapshotReason, TerminalTabSnapshot};

#[tauri::command]
pub fn snapshot_create(
    _app: AppHandle,
    project_id: String,
    reason: String,
    server_id: Option<String>,
    database_id: Option<String>,
    active_node_ids: Vec<String>,
    terminal_tabs: Vec<Value>,
    active_log_sources: Vec<String>,
    last_ai_prompt: Option<String>,
    last_connection_state: String,
) -> Result<(), String> {
    let reason = SnapshotReason::from_str(&reason)?;

    // Parse terminal tabs
    let tabs: Vec<TerminalTabSnapshot> = terminal_tabs
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();

    let mut snapshot = ReconnectSnapshot::new(project_id, reason)
        .with_nodes(active_node_ids)
        .with_terminal_tabs(tabs)
        .with_log_sources(active_log_sources)
        .with_connection_state(last_connection_state);

    if let Some(sid) = server_id {
        snapshot = snapshot.with_server(sid);
    }

    if let Some(did) = database_id {
        snapshot = snapshot.with_database(did);
    }

    if let Some(prompt) = last_ai_prompt {
        snapshot = snapshot.with_ai_prompt(prompt);
    }

    runtime::save_snapshot(snapshot)
}

#[tauri::command]
pub fn snapshot_get(
    _app: AppHandle,
    project_id: String,
) -> Result<Option<Value>, String> {
    let snapshot = runtime::get_snapshot(&project_id)?;
    Ok(snapshot.map(|s| serde_json::to_value(s).unwrap()))
}

#[tauri::command]
pub fn snapshot_restore(
    _app: AppHandle,
    project_id: String,
) -> Result<Option<Value>, String> {
    // For now, restore is the same as get
    // In the future, this could trigger additional restoration logic
    snapshot_get(_app, project_id)
}

#[tauri::command]
pub fn snapshot_remove(
    _app: AppHandle,
    project_id: String,
) -> Result<Option<Value>, String> {
    let snapshot = runtime::remove_snapshot(&project_id)?;
    Ok(snapshot.map(|s| serde_json::to_value(s).unwrap()))
}

#[tauri::command]
pub fn snapshot_list_by_project(
    _app: AppHandle,
    project_id: String,
) -> Result<Option<Value>, String> {
    // Get single snapshot for a project
    snapshot_get(_app, project_id)
}

#[tauri::command]
pub fn snapshot_cleanup_expired(
    _app: AppHandle,
    max_age_ms: u64,
) -> Result<usize, String> {
    runtime::cleanup_expired_snapshots(max_age_ms)
}
