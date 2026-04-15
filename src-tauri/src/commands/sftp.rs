use crate::runtime::sftp::{FileEntry, SftpManager, SftpSession, TransferProgress};

#[tauri::command]
pub fn sftp_create_session(
    server_id: String,
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
) -> Result<SftpSession, String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.create_session(server_id, host, port, username, password)
}

#[tauri::command]
pub fn sftp_close_session(session_id: String) -> Result<(), String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.close_session(&session_id)
}

#[tauri::command]
pub fn sftp_get_session(session_id: String) -> Result<Option<SftpSession>, String> {
    let manager = SftpManager::global();
    let mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(mgr.get_session(&session_id))
}

#[tauri::command]
pub fn sftp_list_dir(session_id: String, path: String) -> Result<Vec<FileEntry>, String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.list_dir(&session_id, &path)
}

#[tauri::command]
pub fn sftp_create_dir(session_id: String, path: String) -> Result<(), String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.create_dir(&session_id, &path)
}

#[tauri::command]
pub fn sftp_delete(session_id: String, path: String) -> Result<(), String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.delete(&session_id, &path)
}

#[tauri::command]
pub fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.rename(&session_id, &old_path, &new_path)
}

#[tauri::command]
pub fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.upload(&session_id, &local_path, &remote_path)
}

#[tauri::command]
pub fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.download(&session_id, &remote_path, &local_path)
}

#[tauri::command]
pub fn sftp_get_transfer_progress(
    transfer_id: String,
) -> Result<Option<TransferProgress>, String> {
    let manager = SftpManager::global();
    let mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(mgr.get_transfer_progress(&transfer_id))
}

#[tauri::command]
pub fn sftp_cancel_transfer(transfer_id: String) -> Result<(), String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.cancel_transfer(&transfer_id)
}

#[tauri::command]
pub fn sftp_read_file(
    session_id: String,
    path: String,
    max_bytes: Option<u64>,
) -> Result<Vec<u8>, String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.read_file(&session_id, &path, max_bytes)
}

#[tauri::command]
pub fn sftp_stat(session_id: String, path: String) -> Result<FileEntry, String> {
    let manager = SftpManager::global();
    let mut mgr = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    mgr.stat(&session_id, &path)
}
