use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;

/// Session state in the lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionState {
    Created,
    Active,
    Idle,
    Paused,
    Hibernated,
    Destroyed,
}

/// Lifecycle policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecyclePolicy {
    pub idle_timeout: Duration,
    pub hibernate_timeout: Duration,
    pub destroy_timeout: Duration,
    pub max_session_age: Duration,
    pub keep_alive_interval: Duration,
}

impl Default for LifecyclePolicy {
    fn default() -> Self {
        Self {
            idle_timeout: Duration::from_secs(5 * 60),        // 5 minutes
            hibernate_timeout: Duration::from_secs(15 * 60),  // 15 minutes
            destroy_timeout: Duration::from_secs(60 * 60),    // 1 hour
            max_session_age: Duration::from_secs(24 * 60 * 60), // 24 hours
            keep_alive_interval: Duration::from_secs(30),     // 30 seconds
        }
    }
}

/// Session lifecycle tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLifecycle {
    pub session_id: String,
    pub state: SessionState,
    pub created_at: SystemTime,
    pub last_active_at: SystemTime,
    pub idle_since: Option<SystemTime>,
    pub hibernated_at: Option<SystemTime>,
    pub paused_at: Option<SystemTime>,
    pub activity_count: u64,
    pub total_active_duration: Duration,
    pub policy: LifecyclePolicy,
}

impl SessionLifecycle {
    pub fn new(session_id: String, policy: LifecyclePolicy) -> Self {
        let now = SystemTime::now();
        Self {
            session_id,
            state: SessionState::Created,
            created_at: now,
            last_active_at: now,
            idle_since: None,
            hibernated_at: None,
            paused_at: None,
            activity_count: 0,
            total_active_duration: Duration::ZERO,
            policy,
        }
    }

    /// Record user activity
    pub fn record_activity(&mut self) {
        self.last_active_at = SystemTime::now();
        self.activity_count += 1;

        // Clear idle state if was idle
        if self.state == SessionState::Idle {
            self.idle_since = None;
            self.state = SessionState::Active;
        }
    }

    /// Check if session should transition to idle
    pub fn should_idle(&self) -> bool {
        if self.state != SessionState::Active {
            return false;
        }

        if let Ok(elapsed) = self.last_active_at.elapsed() {
            elapsed >= self.policy.idle_timeout
        } else {
            false
        }
    }

    /// Check if session should hibernate
    pub fn should_hibernate(&self) -> bool {
        if self.state != SessionState::Idle {
            return false;
        }

        if let Some(idle_since) = self.idle_since {
            if let Ok(elapsed) = idle_since.elapsed() {
                return elapsed >= self.policy.hibernate_timeout;
            }
        }

        false
    }

    /// Check if session should be destroyed
    pub fn should_destroy(&self) -> bool {
        // Check max age
        if let Ok(age) = self.created_at.elapsed() {
            if age >= self.policy.max_session_age {
                return true;
            }
        }

        // Check hibernation timeout
        if self.state == SessionState::Hibernated {
            if let Some(hibernated_at) = self.hibernated_at {
                if let Ok(elapsed) = hibernated_at.elapsed() {
                    return elapsed >= self.policy.destroy_timeout;
                }
            }
        }

        false
    }

    /// Get duration in current state
    pub fn get_state_duration(&self) -> Duration {
        let reference_time = match self.state {
            SessionState::Idle => self.idle_since.unwrap_or(self.last_active_at),
            SessionState::Hibernated => self.hibernated_at.unwrap_or(self.last_active_at),
            SessionState::Paused => self.paused_at.unwrap_or(self.last_active_at),
            _ => self.last_active_at,
        };

        reference_time.elapsed().unwrap_or(Duration::ZERO)
    }

    /// Transition to a new state
    pub fn transition_to(&mut self, new_state: SessionState) -> Result<(), String> {
        // Validate state transition
        let valid = match (self.state, new_state) {
            // From Created
            (SessionState::Created, SessionState::Active) => true,
            (SessionState::Created, SessionState::Destroyed) => true,

            // From Active
            (SessionState::Active, SessionState::Idle) => true,
            (SessionState::Active, SessionState::Paused) => true,
            (SessionState::Active, SessionState::Destroyed) => true,

            // From Idle
            (SessionState::Idle, SessionState::Active) => true,
            (SessionState::Idle, SessionState::Hibernated) => true,
            (SessionState::Idle, SessionState::Destroyed) => true,

            // From Paused
            (SessionState::Paused, SessionState::Active) => true,
            (SessionState::Paused, SessionState::Destroyed) => true,

            // From Hibernated
            (SessionState::Hibernated, SessionState::Active) => true,
            (SessionState::Hibernated, SessionState::Destroyed) => true,

            // Same state is always valid
            (old, new) if old == new => true,

            // All other transitions are invalid
            _ => false,
        };

        if !valid {
            return Err(format!(
                "Invalid state transition from {:?} to {:?}",
                self.state, new_state
            ));
        }

        // Update state-specific timestamps
        let now = SystemTime::now();
        match new_state {
            SessionState::Idle => {
                self.idle_since = Some(now);
            }
            SessionState::Hibernated => {
                self.hibernated_at = Some(now);
            }
            SessionState::Paused => {
                self.paused_at = Some(now);
            }
            SessionState::Active => {
                // Clear all pause/idle/hibernate timestamps
                self.idle_since = None;
                self.hibernated_at = None;
                self.paused_at = None;
                self.last_active_at = now;
            }
            _ => {}
        }

        self.state = new_state;
        Ok(())
    }
}

/// Lifecycle manager
pub struct LifecycleManager {
    sessions: Arc<RwLock<HashMap<String, SessionLifecycle>>>,
    default_policy: LifecyclePolicy,
}

impl LifecycleManager {
    pub fn new(default_policy: LifecyclePolicy) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            default_policy,
        }
    }

    /// Create a new session lifecycle
    pub async fn create_session(&self, session_id: String) -> SessionLifecycle {
        let lifecycle = SessionLifecycle::new(session_id.clone(), self.default_policy.clone());
        self.sessions.write().await.insert(session_id, lifecycle.clone());
        lifecycle
    }

    /// Get session lifecycle
    pub async fn get_session(&self, session_id: &str) -> Option<SessionLifecycle> {
        self.sessions.read().await.get(session_id).cloned()
    }

    /// Record activity for a session
    pub async fn record_activity(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        if let Some(lifecycle) = sessions.get_mut(session_id) {
            lifecycle.record_activity();
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Transition session state
    pub async fn transition_state(
        &self,
        session_id: &str,
        new_state: SessionState,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        if let Some(lifecycle) = sessions.get_mut(session_id) {
            lifecycle.transition_to(new_state)
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Pause a session
    pub async fn pause_session(&self, session_id: &str) -> Result<(), String> {
        self.transition_state(session_id, SessionState::Paused).await
    }

    /// Resume a session
    pub async fn resume_session(&self, session_id: &str) -> Result<(), String> {
        self.transition_state(session_id, SessionState::Active).await
    }

    /// Hibernate a session
    pub async fn hibernate_session(&self, session_id: &str) -> Result<(), String> {
        self.transition_state(session_id, SessionState::Hibernated).await
    }

    /// Wake a hibernated session
    pub async fn wake_session(&self, session_id: &str) -> Result<(), String> {
        self.transition_state(session_id, SessionState::Active).await
    }

    /// Destroy a session
    pub async fn destroy_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        if let Some(mut lifecycle) = sessions.remove(session_id) {
            lifecycle.transition_to(SessionState::Destroyed)?;
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Check and apply automatic state transitions
    pub async fn check_automatic_transitions(&self) -> Vec<(String, SessionState, SessionState)> {
        let mut transitions = Vec::new();
        let mut sessions = self.sessions.write().await;

        for (session_id, lifecycle) in sessions.iter_mut() {
            let old_state = lifecycle.state;
            let mut new_state = None;

            // Check for automatic transitions
            if lifecycle.should_destroy() {
                new_state = Some(SessionState::Destroyed);
            } else if lifecycle.should_hibernate() {
                new_state = Some(SessionState::Hibernated);
            } else if lifecycle.should_idle() {
                new_state = Some(SessionState::Idle);
            }

            if let Some(state) = new_state {
                if lifecycle.transition_to(state).is_ok() {
                    transitions.push((session_id.clone(), old_state, state));
                }
            }
        }

        // Remove destroyed sessions
        sessions.retain(|_, lifecycle| lifecycle.state != SessionState::Destroyed);

        transitions
    }

    /// Get all sessions in a specific state
    pub async fn get_sessions_by_state(&self, state: SessionState) -> Vec<SessionLifecycle> {
        self.sessions
            .read()
            .await
            .values()
            .filter(|lifecycle| lifecycle.state == state)
            .cloned()
            .collect()
    }

    /// Get lifecycle statistics
    pub async fn get_stats(&self) -> LifecycleStats {
        let sessions = self.sessions.read().await;
        let mut stats = LifecycleStats::default();

        for lifecycle in sessions.values() {
            stats.total_sessions += 1;
            match lifecycle.state {
                SessionState::Created => stats.created_count += 1,
                SessionState::Active => stats.active_count += 1,
                SessionState::Idle => stats.idle_count += 1,
                SessionState::Paused => stats.paused_count += 1,
                SessionState::Hibernated => stats.hibernated_count += 1,
                SessionState::Destroyed => stats.destroyed_count += 1,
            }

            stats.total_activity_count += lifecycle.activity_count;
        }

        stats
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct LifecycleStats {
    pub total_sessions: usize,
    pub created_count: usize,
    pub active_count: usize,
    pub idle_count: usize,
    pub paused_count: usize,
    pub hibernated_count: usize,
    pub destroyed_count: usize,
    pub total_activity_count: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lifecycle_creation() {
        let policy = LifecyclePolicy::default();
        let lifecycle = SessionLifecycle::new("test-session".to_string(), policy);
        assert_eq!(lifecycle.state, SessionState::Created);
        assert_eq!(lifecycle.activity_count, 0);
    }

    #[test]
    fn test_state_transitions() {
        let policy = LifecyclePolicy::default();
        let mut lifecycle = SessionLifecycle::new("test-session".to_string(), policy);

        // Created -> Active
        assert!(lifecycle.transition_to(SessionState::Active).is_ok());
        assert_eq!(lifecycle.state, SessionState::Active);

        // Active -> Idle
        assert!(lifecycle.transition_to(SessionState::Idle).is_ok());
        assert_eq!(lifecycle.state, SessionState::Idle);

        // Idle -> Hibernated
        assert!(lifecycle.transition_to(SessionState::Hibernated).is_ok());
        assert_eq!(lifecycle.state, SessionState::Hibernated);

        // Hibernated -> Active
        assert!(lifecycle.transition_to(SessionState::Active).is_ok());
        assert_eq!(lifecycle.state, SessionState::Active);
    }

    #[test]
    fn test_invalid_transitions() {
        let policy = LifecyclePolicy::default();
        let mut lifecycle = SessionLifecycle::new("test-session".to_string(), policy);

        // Created -> Hibernated (invalid)
        assert!(lifecycle.transition_to(SessionState::Hibernated).is_err());

        // Created -> Idle (invalid)
        assert!(lifecycle.transition_to(SessionState::Idle).is_err());
    }

    #[test]
    fn test_activity_recording() {
        let policy = LifecyclePolicy::default();
        let mut lifecycle = SessionLifecycle::new("test-session".to_string(), policy);

        lifecycle.transition_to(SessionState::Active).unwrap();
        lifecycle.record_activity();
        assert_eq!(lifecycle.activity_count, 1);

        lifecycle.record_activity();
        assert_eq!(lifecycle.activity_count, 2);
    }
}
