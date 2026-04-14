use serde_json::Value;
use tauri::AppHandle;

use crate::store::config;

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
