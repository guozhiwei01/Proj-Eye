use serde_json::Value;
use tauri::AppHandle;

use crate::store::runtime;

#[tauri::command]
pub fn ssh_connect_project(app: AppHandle, project_id: String) -> Result<Value, String> {
    runtime::connect_project(&app, &project_id)
}

#[tauri::command]
pub fn ssh_create_terminal_tab(
    app: AppHandle,
    project_id: String,
    current_count: usize,
) -> Result<Value, String> {
    runtime::create_terminal_tab(&app, &project_id, current_count)
}

#[tauri::command]
pub fn ssh_execute_session_command(
    app: AppHandle,
    session_id: String,
    command: String,
) -> Result<Value, String> {
    runtime::execute_session_command(&app, &session_id, &command)
}

#[tauri::command]
pub fn ssh_write_session_input(
    app: AppHandle,
    session_id: String,
    input: String,
) -> Result<(), String> {
    runtime::write_session_input(&app, &session_id, &input)
}

#[tauri::command]
pub fn ssh_resize_session(
    app: AppHandle,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    runtime::resize_session(&app, &session_id, cols, rows)
}

#[tauri::command]
pub fn ssh_close_session(app: AppHandle, session_id: String) -> Result<Value, String> {
    runtime::close_session(&app, &session_id)
}

#[tauri::command]
pub fn ssh_reconnect_session(app: AppHandle, session_id: String) -> Result<Value, String> {
    runtime::reconnect_session(&app, &session_id)
}
