use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use crate::store::{config, runtime, secure};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealth {
    pub app: &'static str,
    pub stage: &'static str,
    pub version: &'static str,
    pub backend_ready: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBootstrap {
    pub health: AppHealth,
    pub config: Value,
    pub secure_status: secure::SecureStatus,
    pub backend_mode: &'static str,
}

#[tauri::command]
pub fn app_health() -> AppHealth {
    AppHealth {
        app: "Proj-Eye",
        stage: "native-mvp",
        version: env!("CARGO_PKG_VERSION"),
        backend_ready: true,
    }
}

#[tauri::command]
pub fn app_bootstrap(app: AppHandle) -> Result<AppBootstrap, String> {
    Ok(AppBootstrap {
        health: app_health(),
        config: config::refresh(&app)?,
        secure_status: secure::status(&app)?,
        backend_mode: "tauri",
    })
}

#[tauri::command]
pub fn config_refresh(app: AppHandle) -> Result<Value, String> {
    config::refresh(&app)
}

#[tauri::command]
pub fn secure_status(app: AppHandle) -> Result<secure::SecureStatus, String> {
    secure::status(&app)
}

#[tauri::command]
pub fn secure_initialize_vault(
    app: AppHandle,
    password: String,
) -> Result<secure::SecureStatus, String> {
    secure::initialize_vault(&app, &password)
}

#[tauri::command]
pub fn secure_unlock_vault(
    app: AppHandle,
    password: String,
) -> Result<secure::SecureStatus, String> {
    secure::unlock_vault(&app, &password)
}

#[tauri::command]
pub fn secure_lock_vault(app: AppHandle) -> Result<secure::SecureStatus, String> {
    secure::lock_vault(&app)
}

#[tauri::command]
pub fn secure_inspect_credential(reference: Option<String>) -> Result<bool, String> {
    secure::inspect_credential(reference)
}

#[tauri::command]
pub fn config_save_settings(app: AppHandle, settings: Value) -> Result<Value, String> {
    config::save_settings(&app, settings)
}

#[tauri::command]
pub fn config_save_server(app: AppHandle, draft: Value) -> Result<Value, String> {
    config::save_server(&app, draft)
}

#[tauri::command]
pub fn config_delete_server(app: AppHandle, server_id: String) -> Result<(), String> {
    config::delete_server(&app, &server_id)
}

#[tauri::command]
pub fn config_save_database(app: AppHandle, draft: Value) -> Result<Value, String> {
    config::save_database(&app, draft)
}

#[tauri::command]
pub fn config_delete_database(app: AppHandle, database_id: String) -> Result<(), String> {
    config::delete_database(&app, &database_id)
}

#[tauri::command]
pub fn config_save_project(app: AppHandle, draft: Value) -> Result<Value, String> {
    config::save_project(&app, draft)
}

#[tauri::command]
pub fn config_delete_project(app: AppHandle, project_id: String) -> Result<(), String> {
    config::delete_project(&app, &project_id)
}

#[tauri::command]
pub fn config_save_provider(app: AppHandle, draft: Value) -> Result<Value, String> {
    config::save_provider(&app, draft)
}

#[tauri::command]
pub fn config_delete_provider(app: AppHandle, provider_id: String) -> Result<(), String> {
    config::delete_provider(&app, &provider_id)
}

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
pub fn logs_refresh_project(app: AppHandle, project_id: String) -> Result<Vec<Value>, String> {
    runtime::refresh_project_logs(&app, &project_id)
}

#[tauri::command]
pub fn database_run_query(
    app: AppHandle,
    database_id: String,
    statement: String,
) -> Result<Value, String> {
    runtime::run_database_query(&app, &database_id, &statement)
}

#[tauri::command]
pub fn ai_analyze_project(
    app: AppHandle,
    project_id: String,
    context: Value,
) -> Result<Value, String> {
    runtime::analyze_project(&app, &project_id, context)
}

#[tauri::command]
pub fn ai_send_followup(
    app: AppHandle,
    project_id: String,
    context: Value,
    history: Value,
    prompt: String,
) -> Result<Value, String> {
    runtime::send_ai_followup(&app, &project_id, context, history, &prompt)
}

#[tauri::command]
pub fn ai_confirm_suggested_command(
    app: AppHandle,
    project_id: String,
    session_id: Option<String>,
    suggestion: Value,
) -> Result<Value, String> {
    runtime::confirm_suggested_command(&app, &project_id, session_id, suggestion)
}

#[tauri::command]
pub fn ai_validate_provider(app: AppHandle, provider_id: String) -> Result<Value, String> {
    runtime::validate_provider(&app, &provider_id)
}
