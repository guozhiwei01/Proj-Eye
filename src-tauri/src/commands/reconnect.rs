use crate::runtime::reconnect::{ReconnectContext, ReconnectStrategy, ReconnectStats, GracePeriodConfig};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

type ReconnectManagerState = Arc<Mutex<crate::runtime::reconnect::ReconnectManager>>;

/// Start reconnect for a session
#[tauri::command]
pub async fn reconnect_start(
    session_id: String,
    strategy: Option<ReconnectStrategy>,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.start_reconnect(session_id, strategy).await
}

/// Cancel reconnect for a session
#[tauri::command]
pub async fn reconnect_cancel(
    session_id: String,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.cancel_reconnect(&session_id).await
}

/// Get reconnect status
#[tauri::command]
pub async fn reconnect_get_status(
    session_id: String,
    manager: State<'_, ReconnectManagerState>,
) -> Result<Option<ReconnectContext>, String> {
    let manager = manager.lock().await;
    Ok(manager.get_status(&session_id).await)
}

/// List all active reconnects
#[tauri::command]
pub async fn reconnect_list_active(
    manager: State<'_, ReconnectManagerState>,
) -> Result<Vec<ReconnectContext>, String> {
    let manager = manager.lock().await;
    Ok(manager.list_active().await)
}

/// Record reconnect attempt
#[tauri::command]
pub async fn reconnect_record_attempt(
    session_id: String,
    error: Option<String>,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.record_attempt(&session_id, error).await
}

/// Mark reconnect as successful
#[tauri::command]
pub async fn reconnect_mark_success(
    session_id: String,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.mark_success(&session_id).await
}

/// Set default reconnect strategy
#[tauri::command]
pub async fn reconnect_set_strategy(
    strategy: ReconnectStrategy,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().await;
    manager.set_default_strategy(strategy).await;
    Ok(())
}

/// Get default reconnect strategy
#[tauri::command]
pub async fn reconnect_get_strategy(
    manager: State<'_, ReconnectManagerState>,
) -> Result<ReconnectStrategy, String> {
    let manager = manager.lock().await;
    Ok(manager.get_default_strategy().await)
}

/// Check if session should attempt reconnect now
#[tauri::command]
pub async fn reconnect_should_attempt(
    session_id: String,
    manager: State<'_, ReconnectManagerState>,
) -> Result<bool, String> {
    let manager = manager.lock().await;
    Ok(manager.should_attempt_now(&session_id).await)
}

/// Get sessions ready for reconnect
#[tauri::command]
pub async fn reconnect_get_ready(
    manager: State<'_, ReconnectManagerState>,
) -> Result<Vec<String>, String> {
    let manager = manager.lock().await;
    Ok(manager.get_ready_sessions().await)
}

/// Cleanup completed reconnects
#[tauri::command]
pub async fn reconnect_cleanup(
    manager: State<'_, ReconnectManagerState>,
) -> Result<usize, String> {
    let manager = manager.lock().await;
    Ok(manager.cleanup_completed().await)
}

/// Get reconnect statistics
#[tauri::command]
pub async fn reconnect_get_stats(
    manager: State<'_, ReconnectManagerState>,
) -> Result<ReconnectStats, String> {
    let manager = manager.lock().await;
    Ok(manager.get_stats().await)
}

/// Start grace period for a session
#[tauri::command]
pub async fn reconnect_start_grace_period(
    session_id: String,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.start_grace_period(&session_id).await
}

/// Update grace period progress
#[tauri::command]
pub async fn reconnect_update_grace_period(
    session_id: String,
    elapsed: u64,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.update_grace_period_progress(&session_id, elapsed).await
}

/// End grace period
#[tauri::command]
pub async fn reconnect_end_grace_period(
    session_id: String,
    success: bool,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let manager = manager.lock().await;
    manager.end_grace_period(&session_id, success).await
}

/// Set grace period config in strategy
#[tauri::command]
pub async fn reconnect_set_grace_period_config(
    config: GracePeriodConfig,
    manager: State<'_, ReconnectManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().await;
    let mut strategy = manager.get_default_strategy().await;
    strategy.grace_period = config;
    manager.set_default_strategy(strategy).await;
    Ok(())
}

/// Get grace period config from strategy
#[tauri::command]
pub async fn reconnect_get_grace_period_config(
    manager: State<'_, ReconnectManagerState>,
) -> Result<GracePeriodConfig, String> {
    let manager = manager.lock().await;
    let strategy = manager.get_default_strategy().await;
    Ok(strategy.grace_period)
}
