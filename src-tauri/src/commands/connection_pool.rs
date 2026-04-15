/**
 * Connection Pool Commands
 *
 * Tauri 命令接口，用于管理连接池
 */

use crate::runtime::connection_pool::{ConnectionPool, PoolConnectionState};
use once_cell::sync::OnceCell;
use std::sync::{Arc, Mutex};

static POOL: OnceCell<Arc<Mutex<ConnectionPool>>> = OnceCell::new();

fn get_pool() -> Arc<Mutex<ConnectionPool>> {
    POOL.get_or_init(|| Arc::new(Mutex::new(ConnectionPool::new())))
        .clone()
}

#[tauri::command]
pub fn pool_acquire(project_id: String, server_id: String) -> Result<String, String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    pool.acquire(&project_id, &server_id)
}

#[tauri::command]
pub fn pool_release(project_id: String) -> Result<(), String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    pool.release(&project_id)
}

#[tauri::command]
pub fn pool_get_info(project_id: String) -> Result<serde_json::Value, String> {
    let pool = get_pool().lock().map_err(|e| e.to_string())?;

    if let Some(conn) = pool.get(&project_id) {
        Ok(serde_json::json!({
            "projectId": conn.project_id,
            "serverId": conn.server_id,
            "sessionId": conn.session_id,
            "refCount": conn.ref_count,
            "state": format!("{:?}", conn.state),
            "createdAt": conn.created_at,
            "lastUsedAt": conn.last_used_at,
        }))
    } else {
        Err(format!("Connection not found for project: {}", project_id))
    }
}

#[tauri::command]
pub fn pool_cleanup_idle(max_idle_ms: u64) -> Result<usize, String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    Ok(pool.cleanup_idle(max_idle_ms))
}

#[tauri::command]
pub fn pool_list_all() -> Result<Vec<serde_json::Value>, String> {
    let pool = get_pool().lock().map_err(|e| e.to_string())?;

    let connections: Vec<serde_json::Value> = pool
        .list_all()
        .iter()
        .map(|conn| {
            serde_json::json!({
                "projectId": conn.project_id,
                "serverId": conn.server_id,
                "sessionId": conn.session_id,
                "refCount": conn.ref_count,
                "state": format!("{:?}", conn.state),
                "createdAt": conn.created_at,
                "lastUsedAt": conn.last_used_at,
            })
        })
        .collect();

    Ok(connections)
}

#[tauri::command]
pub fn pool_stats() -> Result<serde_json::Value, String> {
    let pool = get_pool().lock().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "total": pool.len(),
        "active": pool.active_count(),
        "idle": pool.idle_count(),
    }))
}

#[tauri::command]
pub fn pool_prewarm(project_id: String, server_id: String) -> Result<(), String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    pool.prewarm(&project_id, &server_id)
}

#[tauri::command]
pub fn pool_health_check(project_id: String) -> Result<bool, String> {
    let pool = get_pool().lock().map_err(|e| e.to_string())?;
    pool.health_check(&project_id)
}
