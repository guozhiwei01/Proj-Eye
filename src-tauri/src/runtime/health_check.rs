use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Health status of a connection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Health check configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckConfig {
    /// Interval between health checks (ms)
    pub interval_ms: u64,
    /// Timeout for each health check (ms)
    pub timeout_ms: u64,
    /// Number of consecutive failures before marking unhealthy
    pub failure_threshold: u32,
    /// Number of consecutive successes before marking healthy
    pub success_threshold: u32,
    /// Enable automatic health checks
    pub enabled: bool,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            interval_ms: 30000,      // 30 seconds
            timeout_ms: 5000,        // 5 seconds
            failure_threshold: 3,    // 3 consecutive failures
            success_threshold: 2,    // 2 consecutive successes
            enabled: true,
        }
    }
}

/// Health metrics for a connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthMetrics {
    pub session_id: String,
    pub status: HealthStatus,
    pub last_check_at: u64,
    pub next_check_at: u64,
    pub consecutive_successes: u32,
    pub consecutive_failures: u32,
    pub total_checks: u64,
    pub total_successes: u64,
    pub total_failures: u64,
    pub avg_latency_ms: f64,
    pub last_error: Option<String>,
}

/// Health check result
#[derive(Debug, Clone)]
pub struct HealthCheckResult {
    pub success: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
    pub timestamp: u64,
}

/// Health check manager
pub struct HealthCheckManager {
    metrics: Arc<RwLock<HashMap<String, HealthMetrics>>>,
    config: Arc<RwLock<HealthCheckConfig>>,
}

impl HealthCheckManager {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(HealthCheckConfig::default())),
        }
    }

    /// Register a session for health checking
    pub async fn register(&self, session_id: String) -> Result<(), String> {
        let mut metrics = self.metrics.write().await;
        let config = self.config.read().await;

        let now = Self::current_timestamp();
        let next_check = now + config.interval_ms;

        metrics.insert(
            session_id.clone(),
            HealthMetrics {
                session_id,
                status: HealthStatus::Unknown,
                last_check_at: 0,
                next_check_at: next_check,
                consecutive_successes: 0,
                consecutive_failures: 0,
                total_checks: 0,
                total_successes: 0,
                total_failures: 0,
                avg_latency_ms: 0.0,
                last_error: None,
            },
        );

        Ok(())
    }

    /// Unregister a session
    pub async fn unregister(&self, session_id: &str) -> Result<(), String> {
        let mut metrics = self.metrics.write().await;
        metrics.remove(session_id);
        Ok(())
    }

    /// Record a health check result
    pub async fn record_check(
        &self,
        session_id: &str,
        result: HealthCheckResult,
    ) -> Result<(), String> {
        let mut metrics = self.metrics.write().await;
        let config = self.config.read().await;

        let metric = metrics
            .get_mut(session_id)
            .ok_or_else(|| format!("Session {} not registered", session_id))?;

        let now = result.timestamp;
        metric.last_check_at = now;
        metric.next_check_at = now + config.interval_ms;
        metric.total_checks += 1;

        if result.success {
            metric.total_successes += 1;
            metric.consecutive_successes += 1;
            metric.consecutive_failures = 0;
            metric.last_error = None;

            // Update average latency
            let total_latency = metric.avg_latency_ms * (metric.total_successes - 1) as f64;
            metric.avg_latency_ms =
                (total_latency + result.latency_ms as f64) / metric.total_successes as f64;

            // Update status based on consecutive successes
            if metric.consecutive_successes >= config.success_threshold {
                metric.status = HealthStatus::Healthy;
            } else if metric.status == HealthStatus::Unhealthy {
                metric.status = HealthStatus::Degraded;
            }
        } else {
            metric.total_failures += 1;
            metric.consecutive_failures += 1;
            metric.consecutive_successes = 0;
            metric.last_error = result.error;

            // Update status based on consecutive failures
            if metric.consecutive_failures >= config.failure_threshold {
                metric.status = HealthStatus::Unhealthy;
            } else if metric.status == HealthStatus::Healthy {
                metric.status = HealthStatus::Degraded;
            }
        }

        Ok(())
    }

    /// Get health metrics for a session
    pub async fn get_metrics(&self, session_id: &str) -> Result<HealthMetrics, String> {
        let metrics = self.metrics.read().await;
        metrics
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("Session {} not found", session_id))
    }

    /// Get all health metrics
    pub async fn get_all_metrics(&self) -> Vec<HealthMetrics> {
        let metrics = self.metrics.read().await;
        metrics.values().cloned().collect()
    }

    /// Get sessions by health status
    pub async fn get_by_status(&self, status: HealthStatus) -> Vec<HealthMetrics> {
        let metrics = self.metrics.read().await;
        metrics
            .values()
            .filter(|m| m.status == status)
            .cloned()
            .collect()
    }

    /// Get sessions ready for health check
    pub async fn get_ready_for_check(&self) -> Vec<String> {
        let metrics = self.metrics.read().await;
        let now = Self::current_timestamp();

        metrics
            .values()
            .filter(|m| m.next_check_at <= now)
            .map(|m| m.session_id.clone())
            .collect()
    }

    /// Update health check configuration
    pub async fn set_config(&self, config: HealthCheckConfig) -> Result<(), String> {
        let mut current_config = self.config.write().await;
        *current_config = config;
        Ok(())
    }

    /// Get health check configuration
    pub async fn get_config(&self) -> HealthCheckConfig {
        let config = self.config.read().await;
        config.clone()
    }

    /// Get health check statistics
    pub async fn get_stats(&self) -> HealthCheckStats {
        let metrics = self.metrics.read().await;

        let mut stats = HealthCheckStats {
            total_sessions: metrics.len(),
            healthy: 0,
            degraded: 0,
            unhealthy: 0,
            unknown: 0,
            total_checks: 0,
            total_successes: 0,
            total_failures: 0,
            avg_success_rate: 0.0,
        };

        for metric in metrics.values() {
            match metric.status {
                HealthStatus::Healthy => stats.healthy += 1,
                HealthStatus::Degraded => stats.degraded += 1,
                HealthStatus::Unhealthy => stats.unhealthy += 1,
                HealthStatus::Unknown => stats.unknown += 1,
            }

            stats.total_checks += metric.total_checks;
            stats.total_successes += metric.total_successes;
            stats.total_failures += metric.total_failures;
        }

        if stats.total_checks > 0 {
            stats.avg_success_rate =
                (stats.total_successes as f64 / stats.total_checks as f64) * 100.0;
        }

        stats
    }

    /// Cleanup metrics for removed sessions
    pub async fn cleanup(&self) -> usize {
        let mut metrics = self.metrics.write().await;
        let initial_count = metrics.len();

        // Remove metrics that haven't been checked in 24 hours
        let now = Self::current_timestamp();
        let cutoff = now - 24 * 60 * 60 * 1000; // 24 hours

        metrics.retain(|_, m| m.last_check_at > cutoff || m.last_check_at == 0);

        initial_count - metrics.len()
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

/// Health check statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckStats {
    pub total_sessions: usize,
    pub healthy: usize,
    pub degraded: usize,
    pub unhealthy: usize,
    pub unknown: usize,
    pub total_checks: u64,
    pub total_successes: u64,
    pub total_failures: u64,
    pub avg_success_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check_lifecycle() {
        let manager = HealthCheckManager::new();

        // Register session
        manager.register("session1".to_string()).await.unwrap();

        // Record successful check
        let result = HealthCheckResult {
            success: true,
            latency_ms: 100,
            error: None,
            timestamp: HealthCheckManager::current_timestamp(),
        };
        manager.record_check("session1", result).await.unwrap();

        // Get metrics
        let metrics = manager.get_metrics("session1").await.unwrap();
        assert_eq!(metrics.total_checks, 1);
        assert_eq!(metrics.total_successes, 1);
        assert_eq!(metrics.consecutive_successes, 1);

        // Unregister
        manager.unregister("session1").await.unwrap();
        assert!(manager.get_metrics("session1").await.is_err());
    }

    #[tokio::test]
    async fn test_health_status_transitions() {
        let manager = HealthCheckManager::new();
        manager.register("session1".to_string()).await.unwrap();

        // Initial status is Unknown
        let metrics = manager.get_metrics("session1").await.unwrap();
        assert_eq!(metrics.status, HealthStatus::Unknown);

        // Record 2 successes -> Healthy
        for _ in 0..2 {
            let result = HealthCheckResult {
                success: true,
                latency_ms: 100,
                error: None,
                timestamp: HealthCheckManager::current_timestamp(),
            };
            manager.record_check("session1", result).await.unwrap();
        }

        let metrics = manager.get_metrics("session1").await.unwrap();
        assert_eq!(metrics.status, HealthStatus::Healthy);

        // Record 1 failure -> Degraded
        let result = HealthCheckResult {
            success: false,
            latency_ms: 0,
            error: Some("Connection timeout".to_string()),
            timestamp: HealthCheckManager::current_timestamp(),
        };
        manager.record_check("session1", result).await.unwrap();

        let metrics = manager.get_metrics("session1").await.unwrap();
        assert_eq!(metrics.status, HealthStatus::Degraded);

        // Record 2 more failures -> Unhealthy
        for _ in 0..2 {
            let result = HealthCheckResult {
                success: false,
                latency_ms: 0,
                error: Some("Connection timeout".to_string()),
                timestamp: HealthCheckManager::current_timestamp(),
            };
            manager.record_check("session1", result).await.unwrap();
        }

        let metrics = manager.get_metrics("session1").await.unwrap();
        assert_eq!(metrics.status, HealthStatus::Unhealthy);
        assert_eq!(metrics.consecutive_failures, 3);
    }
}
