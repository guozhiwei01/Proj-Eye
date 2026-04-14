use serde_json::Value;
use tauri::AppHandle;

use crate::store::runtime;

#[tauri::command]
pub fn logs_refresh_project(app: AppHandle, project_id: String) -> Result<Vec<Value>, String> {
    runtime::refresh_project_logs(&app, &project_id)
}
