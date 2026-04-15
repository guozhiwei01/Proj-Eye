use crate::runtime::session_lifecycle::{
    LifecycleManager, LifecyclePolicy, LifecycleStats, SessionLifecycle, SessionState,
};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub struct LifecycleState {
    pub manager: Arc<LifecycleManager>,
}

impl LifecycleState {
    pub fn new(default_policy: LifecyclePolicy) -> Self {
        Self {
            manager: Arc::new(LifecycleManager::new(default_policy)),
        }
    }
}

#[tauri::command]
pub async fn lifecycle_create_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<SessionLifecycle, String> {
    let lifecycle_state = state.read().await;
    Ok(lifecycle_state.manager.create_session(session_id).await)
}

#[tauri::command]
pub async fn lifecycle_get_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<Option<SessionLifecycle>, String> {
    let lifecycle_state = state.read().await;
    Ok(lifecycle_state.manager.get_session(&session_id).await)
}

#[tauri::command]
pub async fn lifecycle_record_activity(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    let lifecycle_state = state.read().await;
    lifecycle_state.manager.record_activity(&session_id).await
}

#[tauri::command]
pub async fn lifecycle_pause_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    let lifecycle_state = state.read().await;
    lifecycle_state.manager.pause_session(&session_id).await
}

#[tauri::command]
pub async fn lifecycle_resume_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    let lifecycle_state = state.read().await;
    lifecycle_state.manager.resume_session(&session_id).await
}

#[tauri::command]
pub async fn lifecycle_hibernate_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    let lifecycle_state = state.read().await;
    lifecycle_state.manager.hibernate_session(&session_id).await
}

#[tauri::command]
pub async fn lifecycle_wake_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    let lifecycle_state = state.read().await;
    lifecycle_state.manager.wake_session(&session_id).await
}

#[tauri::command]
pub async fn lifecycle_destroy_session(
    session_id: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    let lifecycle_state = state.read().await;
    lifecycle_state.manager.destroy_session(&session_id).await
}

#[tauri::command]
pub async fn lifecycle_get_sessions_by_state(
    state_filter: String,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<Vec<SessionLifecycle>, String> {
    let lifecycle_state = state.read().await;

    let session_state = match state_filter.as_str() {
        "created" => SessionState::Created,
        "active" => SessionState::Active,
        "idle" => SessionState::Idle,
        "paused" => SessionState::Paused,
        "hibernated" => SessionState::Hibernated,
        "destroyed" => SessionState::Destroyed,
        _ => return Err(format!("Invalid state: {}", state_filter)),
    };

    Ok(lifecycle_state.manager.get_sessions_by_state(session_state).await)
}

#[tauri::command]
pub async fn lifecycle_get_stats(
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<LifecycleStats, String> {
    let lifecycle_state = state.read().await;
    Ok(lifecycle_state.manager.get_stats().await)
}

#[tauri::command]
pub async fn lifecycle_check_transitions(
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<Vec<(String, String, String)>, String> {
    let lifecycle_state = state.read().await;
    let transitions = lifecycle_state.manager.check_automatic_transitions().await;

    // Convert SessionState to string for JSON serialization
    Ok(transitions
        .into_iter()
        .map(|(id, old, new)| (id, format!("{:?}", old), format!("{:?}", new)))
        .collect())
}

#[tauri::command]
pub async fn lifecycle_set_policy(
    idle_timeout_secs: u64,
    hibernate_timeout_secs: u64,
    destroy_timeout_secs: u64,
    max_session_age_secs: u64,
    keep_alive_interval_secs: u64,
    state: State<'_, Arc<RwLock<LifecycleState>>>,
) -> Result<(), String> {
    use std::time::Duration;

    let new_policy = LifecyclePolicy {
        idle_timeout: Duration::from_secs(idle_timeout_secs),
        hibernate_timeout: Duration::from_secs(hibernate_timeout_secs),
        destroy_timeout: Duration::from_secs(destroy_timeout_secs),
        max_session_age: Duration::from_secs(max_session_age_secs),
        keep_alive_interval: Duration::from_secs(keep_alive_interval_secs),
    };

    let mut lifecycle_state = state.write().await;
    lifecycle_state.manager = Arc::new(LifecycleManager::new(new_policy));

    Ok(())
}
