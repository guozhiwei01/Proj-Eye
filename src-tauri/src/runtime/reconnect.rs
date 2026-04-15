use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

/// Reconnect state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReconnectState {
    Idle,
    GracePeriod,
    Attempting,
    Backoff,
    Success,
    Failed,
}

/// Grace period configuration for connection recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GracePeriodConfig {
    pub enabled: bool,
    pub duration_secs: u64,
    pub probe_interval_secs: u64,
}

impl Default for GracePeriodConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration_secs: 30,
            probe_interval_secs: 2,
        }
    }
}

/// Reconnect strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconnectStrategy {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
    pub jitter: bool,
    pub grace_period: GracePeriodConfig,
}

impl Default for ReconnectStrategy {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
            jitter: true,
            grace_period: GracePeriodConfig::default(),
        }
    }
}

/// Reconnect context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconnectContext {
    pub session_id: String,
    pub state: ReconnectState,
    pub attempt_count: u32,
    pub last_attempt_at: Option<u64>,
    pub next_attempt_at: Option<u64>,
    pub strategy: ReconnectStrategy,
    pub error_history: Vec<String>,
    pub started_at: u64,
    pub grace_period_elapsed: Option<u64>,
    pub grace_period_total: Option<u64>,
}

impl ReconnectContext {
    pub fn new(session_id: String, strategy: ReconnectStrategy) -> Self {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            session_id,
            state: ReconnectState::Idle,
            attempt_count: 0,
            last_attempt_at: None,
            next_attempt_at: None,
            strategy,
            error_history: Vec::new(),
            started_at: now,
            grace_period_elapsed: None,
            grace_period_total: None,
        }
    }

    pub fn start_grace_period(&mut self) {
        self.state = ReconnectState::GracePeriod;
        self.grace_period_elapsed = Some(0);
        self.grace_period_total = Some(self.strategy.grace_period.duration_secs);
    }

    pub fn update_grace_period(&mut self, elapsed: u64) {
        self.grace_period_elapsed = Some(elapsed);
    }

    pub fn end_grace_period(&mut self, success: bool) {
        if success {
            self.state = ReconnectState::Success;
        } else {
            self.state = ReconnectState::Attempting;
        }
        self.grace_period_elapsed = None;
        self.grace_period_total = None;
    }

    pub fn should_retry(&self) -> bool {
        self.attempt_count < self.strategy.max_attempts
    }

    pub fn calculate_next_delay(&self) -> Duration {
        calculate_next_delay(
            self.attempt_count,
            Duration::from_millis(self.strategy.initial_delay_ms),
            Duration::from_millis(self.strategy.max_delay_ms),
            self.strategy.backoff_multiplier,
            self.strategy.jitter,
        )
    }

    pub fn record_attempt(&mut self, error: Option<String>) {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.attempt_count += 1;
        self.last_attempt_at = Some(now);

        if let Some(err) = error {
            self.error_history.push(err);
            if self.error_history.len() > 10 {
                self.error_history.remove(0);
            }
        }

        if self.should_retry() {
            let delay = self.calculate_next_delay();
            self.next_attempt_at = Some(now + delay.as_millis() as u64);
            self.state = ReconnectState::Backoff;
        } else {
            self.state = ReconnectState::Failed;
            self.next_attempt_at = None;
        }
    }

    pub fn mark_success(&mut self) {
        self.state = ReconnectState::Success;
        self.next_attempt_at = None;
    }

    pub fn reset(&mut self) {
        self.state = ReconnectState::Idle;
        self.attempt_count = 0;
        self.last_attempt_at = None;
        self.next_attempt_at = None;
        self.error_history.clear();
    }
}

/// Calculate next delay with exponential backoff and optional jitter
pub fn calculate_next_delay(
    attempt: u32,
    initial_delay: Duration,
    max_delay: Duration,
    multiplier: f64,
    jitter: bool,
) -> Duration {
    let base_delay = initial_delay.as_millis() as f64 * multiplier.powi(attempt as i32);
    let capped_delay = base_delay.min(max_delay.as_millis() as f64);

    if jitter {
        // Add ±25% random jitter
        let jitter_range = capped_delay * 0.25;
        let random_jitter = (rand::random::<f64>() - 0.5) * 2.0 * jitter_range;
        Duration::from_millis((capped_delay + random_jitter).max(0.0) as u64)
    } else {
        Duration::from_millis(capped_delay as u64)
    }
}

/// Reconnect manager
pub struct ReconnectManager {
    contexts: Arc<RwLock<HashMap<String, ReconnectContext>>>,
    max_concurrent: usize,
    default_strategy: ReconnectStrategy,
}

impl ReconnectManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            contexts: Arc::new(RwLock::new(HashMap::new())),
            max_concurrent,
            default_strategy: ReconnectStrategy::default(),
        }
    }

    /// Start reconnect for a session
    pub async fn start_reconnect(
        &self,
        session_id: String,
        strategy: Option<ReconnectStrategy>,
    ) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;

        // Check concurrent limit
        let active_count = contexts
            .values()
            .filter(|ctx| {
                matches!(
                    ctx.state,
                    ReconnectState::GracePeriod | ReconnectState::Attempting | ReconnectState::Backoff
                )
            })
            .count();

        if active_count >= self.max_concurrent {
            return Err("Too many concurrent reconnects".to_string());
        }

        // Create or update context
        let strategy = strategy.unwrap_or_else(|| self.default_strategy.clone());
        let context = ReconnectContext::new(session_id.clone(), strategy);
        contexts.insert(session_id, context);

        Ok(())
    }

    /// Cancel reconnect for a session
    pub async fn cancel_reconnect(&self, session_id: &str) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;
        contexts.remove(session_id);
        Ok(())
    }

    /// Get reconnect status
    pub async fn get_status(&self, session_id: &str) -> Option<ReconnectContext> {
        let contexts = self.contexts.read().await;
        contexts.get(session_id).cloned()
    }

    /// List all active reconnects
    pub async fn list_active(&self) -> Vec<ReconnectContext> {
        let contexts = self.contexts.read().await;
        contexts
            .values()
            .filter(|ctx| {
                matches!(
                    ctx.state,
                    ReconnectState::GracePeriod | ReconnectState::Attempting | ReconnectState::Backoff
                )
            })
            .cloned()
            .collect()
    }

    /// Update grace period progress
    pub async fn update_grace_period_progress(
        &self,
        session_id: &str,
        elapsed: u64,
    ) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;
        if let Some(context) = contexts.get_mut(session_id) {
            context.update_grace_period(elapsed);
            Ok(())
        } else {
            Err("Reconnect context not found".to_string())
        }
    }

    /// End grace period
    pub async fn end_grace_period(
        &self,
        session_id: &str,
        success: bool,
    ) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;
        if let Some(context) = contexts.get_mut(session_id) {
            context.end_grace_period(success);
            Ok(())
        } else {
            Err("Reconnect context not found".to_string())
        }
    }

    /// Start grace period for a session
    pub async fn start_grace_period(&self, session_id: &str) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;
        if let Some(context) = contexts.get_mut(session_id) {
            context.start_grace_period();
            Ok(())
        } else {
            Err("Reconnect context not found".to_string())
        }
    }

    /// Record reconnect attempt
    pub async fn record_attempt(
        &self,
        session_id: &str,
        error: Option<String>,
    ) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;
        if let Some(context) = contexts.get_mut(session_id) {
            context.record_attempt(error);
            Ok(())
        } else {
            Err("Reconnect context not found".to_string())
        }
    }

    /// Mark reconnect as successful
    pub async fn mark_success(&self, session_id: &str) -> Result<(), String> {
        let mut contexts = self.contexts.write().await;
        if let Some(context) = contexts.get_mut(session_id) {
            context.mark_success();
            Ok(())
        } else {
            Err("Reconnect context not found".to_string())
        }
    }

    /// Set default strategy
    pub async fn set_default_strategy(&mut self, strategy: ReconnectStrategy) {
        self.default_strategy = strategy;
    }

    /// Get default strategy
    pub async fn get_default_strategy(&self) -> ReconnectStrategy {
        self.default_strategy.clone()
    }

    /// Check if session should attempt reconnect now
    pub async fn should_attempt_now(&self, session_id: &str) -> bool {
        let contexts = self.contexts.read().await;
        if let Some(context) = contexts.get(session_id) {
            if context.state != ReconnectState::Backoff {
                return false;
            }

            if let Some(next_attempt_at) = context.next_attempt_at {
                let now = SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                return now >= next_attempt_at;
            }
        }
        false
    }

    /// Get sessions ready for reconnect
    pub async fn get_ready_sessions(&self) -> Vec<String> {
        let contexts = self.contexts.read().await;
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        contexts
            .values()
            .filter(|ctx| {
                ctx.state == ReconnectState::Backoff
                    && ctx
                        .next_attempt_at
                        .map(|next| now >= next)
                        .unwrap_or(false)
            })
            .map(|ctx| ctx.session_id.clone())
            .collect()
    }

    /// Cleanup completed reconnects
    pub async fn cleanup_completed(&self) -> usize {
        let mut contexts = self.contexts.write().await;
        let before_count = contexts.len();

        contexts.retain(|_, ctx| {
            !matches!(ctx.state, ReconnectState::Success | ReconnectState::Failed)
        });

        before_count - contexts.len()
    }

    /// Get statistics
    pub async fn get_stats(&self) -> ReconnectStats {
        let contexts = self.contexts.read().await;

        let mut stats = ReconnectStats {
            total_contexts: contexts.len(),
            idle: 0,
            attempting: 0,
            backoff: 0,
            success: 0,
            failed: 0,
        };

        for context in contexts.values() {
            match context.state {
                ReconnectState::Idle => stats.idle += 1,
                ReconnectState::GracePeriod => stats.idle += 1,
                ReconnectState::Attempting => stats.attempting += 1,
                ReconnectState::Backoff => stats.backoff += 1,
                ReconnectState::Success => stats.success += 1,
                ReconnectState::Failed => stats.failed += 1,
            }
        }

        stats
    }
}

/// Reconnect statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconnectStats {
    pub total_contexts: usize,
    pub idle: usize,
    pub attempting: usize,
    pub backoff: usize,
    pub success: usize,
    pub failed: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exponential_backoff() {
        let delays = (0..5)
            .map(|i| {
                calculate_next_delay(
                    i,
                    Duration::from_millis(1000),
                    Duration::from_millis(30000),
                    2.0,
                    false,
                )
            })
            .collect::<Vec<_>>();

        assert_eq!(delays[0].as_millis(), 1000);
        assert_eq!(delays[1].as_millis(), 2000);
        assert_eq!(delays[2].as_millis(), 4000);
        assert_eq!(delays[3].as_millis(), 8000);
        assert_eq!(delays[4].as_millis(), 16000);
    }

    #[test]
    fn test_max_delay_cap() {
        let delay = calculate_next_delay(
            10,
            Duration::from_millis(1000),
            Duration::from_millis(30000),
            2.0,
            false,
        );

        assert_eq!(delay.as_millis(), 30000);
    }

    #[tokio::test]
    async fn test_reconnect_context() {
        let strategy = ReconnectStrategy::default();
        let mut context = ReconnectContext::new("test-session".to_string(), strategy);

        assert_eq!(context.state, ReconnectState::Idle);
        assert_eq!(context.attempt_count, 0);

        context.record_attempt(Some("Connection failed".to_string()));
        assert_eq!(context.state, ReconnectState::Backoff);
        assert_eq!(context.attempt_count, 1);
        assert!(context.next_attempt_at.is_some());

        context.mark_success();
        assert_eq!(context.state, ReconnectState::Success);
        assert!(context.next_attempt_at.is_none());
    }
}
