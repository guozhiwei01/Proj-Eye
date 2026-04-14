use serde_json::Value;
use tauri::AppHandle;

use crate::store::runtime;

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
