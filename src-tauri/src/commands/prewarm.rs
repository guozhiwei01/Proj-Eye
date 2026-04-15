use crate::runtime::prewarm::{
    PrewarmManager, PrewarmSchedule, PrewarmStrategy, UsagePattern,
};
use once_cell::sync::Lazy;
use std::sync::Arc;

static PREWARM_MANAGER: Lazy<Arc<PrewarmManager>> =
    Lazy::new(|| Arc::new(PrewarmManager::new()));

/// Record connection usage for predictive prewarming
#[tauri::command]
pub async fn prewarm_record_usage(project_id: String) -> Result<(), String> {
    PREWARM_MANAGER.record_usage(project_id).await
}

/// Get projects that should be prewarmed now
#[tauri::command]
pub async fn prewarm_get_candidates() -> Result<Vec<String>, String> {
    PREWARM_MANAGER.get_prewarm_candidates().await
}

/// Get usage pattern for a project
#[tauri::command]
pub async fn prewarm_get_pattern(project_id: String) -> Result<UsagePattern, String> {
    PREWARM_MANAGER.get_pattern(&project_id).await
}

/// Get all usage patterns
#[tauri::command]
pub async fn prewarm_get_all_patterns() -> Result<Vec<UsagePattern>, String> {
    Ok(PREWARM_MANAGER.get_all_patterns().await)
}

/// Add a prewarm schedule
#[tauri::command]
pub async fn prewarm_add_schedule(schedule: PrewarmSchedule) -> Result<(), String> {
    PREWARM_MANAGER.add_schedule(schedule).await
}

/// Remove a prewarm schedule
#[tauri::command]
pub async fn prewarm_remove_schedule(project_id: String) -> Result<(), String> {
    PREWARM_MANAGER.remove_schedule(&project_id).await
}

/// Get all prewarm schedules
#[tauri::command]
pub async fn prewarm_get_schedules() -> Result<Vec<PrewarmSchedule>, String> {
    Ok(PREWARM_MANAGER.get_schedules().await)
}

/// Set prewarm strategy
#[tauri::command]
pub async fn prewarm_set_strategy(strategy: PrewarmStrategy) -> Result<(), String> {
    PREWARM_MANAGER.set_strategy(strategy).await
}

/// Get prewarm strategy
#[tauri::command]
pub async fn prewarm_get_strategy() -> Result<PrewarmStrategy, String> {
    Ok(PREWARM_MANAGER.get_strategy().await)
}

/// Clear all usage patterns
#[tauri::command]
pub async fn prewarm_clear_patterns() -> Result<usize, String> {
    Ok(PREWARM_MANAGER.clear_patterns().await)
}
