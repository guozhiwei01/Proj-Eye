use crate::runtime::health_check::{
    HealthCheckConfig, HealthCheckManager, HealthCheckResult, HealthCheckStats, HealthMetrics,
    HealthStatus,
};
use once_cell::sync::Lazy;
use std::sync::Arc;

static HEALTH_CHECK_MANAGER: Lazy<Arc<HealthCheckManager>> =
    Lazy::new(|| Arc::new(HealthCheckManager::new()));

/// Register a session for health checking
#[tauri::command]
pub async fn health_check_register(session_id: String) -> Result<(), String> {
    HEALTH_CHECK_MANAGER.register(session_id).await
}

/// Unregister a session
#[tauri::command]
pub async fn health_check_unregister(session_id: String) -> Result<(), String> {
    HEALTH_CHECK_MANAGER.unregister(&session_id).await
}

/// Record a health check result
#[tauri::command]
pub async fn health_check_record(
    session_id: String,
    success: bool,
    latency_ms: u64,
    error: Option<String>,
    timestamp: u64,
) -> Result<(), String> {
    let result = HealthCheckResult {
        success,
        latency_ms,
        error,
        timestamp,
    };

    HEALTH_CHECK_MANAGER.record_check(&session_id, result).await
}

/// Get health metrics for a session
#[tauri::command]
pub async fn health_check_get_metrics(session_id: String) -> Result<HealthMetrics, String> {
    HEALTH_CHECK_MANAGER.get_metrics(&session_id).await
}

/// Get all health metrics
#[tauri::command]
pub async fn health_check_get_all() -> Result<Vec<HealthMetrics>, String> {
    Ok(HEALTH_CHECK_MANAGER.get_all_metrics().await)
}

/// Get sessions by health status
#[tauri::command]
pub async fn health_check_get_by_status(status: String) -> Result<Vec<HealthMetrics>, String> {
    let health_status = match status.to_lowercase().as_str() {
        "healthy" => HealthStatus::Healthy,
        "degraded" => HealthStatus::Degraded,
        "unhealthy" => HealthStatus::Unhealthy,
        "unknown" => HealthStatus::Unknown,
        _ => return Err(format!("Invalid health status: {}", status)),
    };

    Ok(HEALTH_CHECK_MANAGER.get_by_status(health_status).await)
}

/// Get sessions ready for health check
#[tauri::command]
pub async fn health_check_get_ready() -> Result<Vec<String>, String> {
    Ok(HEALTH_CHECK_MANAGER.get_ready_for_check().await)
}

/// Set health check configuration
#[tauri::command]
pub async fn health_check_set_config(config: HealthCheckConfig) -> Result<(), String> {
    HEALTH_CHECK_MANAGER.set_config(config).await
}

/// Get health check configuration
#[tauri::command]
pub async fn health_check_get_config() -> Result<HealthCheckConfig, String> {
    Ok(HEALTH_CHECK_MANAGER.get_config().await)
}

/// Get health check statistics
#[tauri::command]
pub async fn health_check_get_stats() -> Result<HealthCheckStats, String> {
    Ok(HEALTH_CHECK_MANAGER.get_stats().await)
}

/// Cleanup old health metrics
#[tauri::command]
pub async fn health_check_cleanup() -> Result<usize, String> {
    Ok(HEALTH_CHECK_MANAGER.cleanup().await)
}

/// Perform a manual health check for a session
#[tauri::command]
pub async fn health_check_perform(session_id: String) -> Result<HealthCheckResult, String> {
    use std::time::{SystemTime, UNIX_EPOCH};

    // This is a placeholder - actual implementation would perform real health check
    // For now, we'll simulate a successful check
    let start = SystemTime::now();

    // Simulate health check operation
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    let latency = SystemTime::now()
        .duration_since(start)
        .unwrap()
        .as_millis() as u64;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let result = HealthCheckResult {
        success: true,
        latency_ms: latency,
        error: None,
        timestamp,
    };

    // Record the result
    HEALTH_CHECK_MANAGER
        .record_check(&session_id, result.clone())
        .await?;

    Ok(result)
}
