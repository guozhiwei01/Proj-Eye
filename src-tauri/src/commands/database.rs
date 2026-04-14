use serde_json::Value;
use tauri::AppHandle;

use crate::store::runtime;

#[tauri::command]
pub fn database_run_query(
    app: AppHandle,
    database_id: String,
    statement: String,
) -> Result<Value, String> {
    runtime::run_database_query(&app, &database_id, &statement)
}
