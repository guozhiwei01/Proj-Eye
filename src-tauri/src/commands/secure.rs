use tauri::AppHandle;

use crate::store::secure;

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
