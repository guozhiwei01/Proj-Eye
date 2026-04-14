use serde_json::Value;
use tauri::AppHandle;

use crate::store::diagnostics;

#[tauri::command]
pub fn diag_append_timing_log(app: AppHandle, entry: Value) -> Result<(), String> {
    diagnostics::append_timing_log(&app, entry)
}

#[tauri::command]
pub fn diag_get_timing_log_path(app: AppHandle) -> Result<String, String> {
    diagnostics::timing_log_path(&app)
}
