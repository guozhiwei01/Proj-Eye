use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Prewarm strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrewarmStrategy {
    /// Enable predictive prewarming based on usage patterns
    pub predictive_enabled: bool,
    /// Enable scheduled prewarming
    pub scheduled_enabled: bool,
    /// Enable prewarming on project open
    pub on_project_open: bool,
    /// Minimum usage count to trigger predictive prewarm
    pub min_usage_count: u32,
    /// Time window for usage pattern analysis (seconds)
    pub pattern_window_secs: u64,
    /// Number of connections to prewarm
    pub prewarm_count: usize,
}

impl Default for PrewarmStrategy {
    fn default() -> Self {
        Self {
            predictive_enabled: true,
            scheduled_enabled: true,
            on_project_open: true,
            min_usage_count: 3,
            pattern_window_secs: 3600, // 1 hour
            prewarm_count: 2,
        }
    }
}

/// Usage pattern for a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsagePattern {
    pub project_id: String,
    pub total_connections: u64,
    pub last_connection_at: u64,
    pub connection_times: Vec<u64>, // Recent connection timestamps
    pub avg_interval_secs: f64,
    pub predicted_next_connection: u64,
}

/// Prewarm schedule entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrewarmSchedule {
    pub project_id: String,
    pub hour: u8,        // 0-23
    pub minute: u8,      // 0-59
    pub weekdays: Vec<u8>, // 0-6 (Sunday-Saturday)
    pub enabled: bool,
}

/// Prewarm manager
pub struct PrewarmManager {
    strategy: Arc<RwLock<PrewarmStrategy>>,
    patterns: Arc<RwLock<HashMap<String, UsagePattern>>>,
    schedules: Arc<RwLock<Vec<PrewarmSchedule>>>,
}

impl PrewarmManager {
    pub fn new() -> Self {
        Self {
            strategy: Arc::new(RwLock::new(PrewarmStrategy::default())),
            patterns: Arc::new(RwLock::new(HashMap::new())),
            schedules: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Record a connection usage
    pub async fn record_usage(&self, project_id: String) -> Result<(), String> {
        let mut patterns = self.patterns.write().await;
        let now = Self::current_timestamp();

        let pattern = patterns.entry(project_id.clone()).or_insert(UsagePattern {
            project_id: project_id.clone(),
            total_connections: 0,
            last_connection_at: now,
            connection_times: Vec::new(),
            avg_interval_secs: 0.0,
            predicted_next_connection: 0,
        });

        pattern.total_connections += 1;
        pattern.connection_times.push(now);
        pattern.last_connection_at = now;

        // Keep only recent connection times (within pattern window)
        let strategy = self.strategy.read().await;
        let cutoff = now - (strategy.pattern_window_secs * 1000);
        pattern.connection_times.retain(|&t| t > cutoff);

        // Calculate average interval
        if pattern.connection_times.len() >= 2 {
            let intervals: Vec<u64> = pattern
                .connection_times
                .windows(2)
                .map(|w| w[1] - w[0])
                .collect();

            let sum: u64 = intervals.iter().sum();
            pattern.avg_interval_secs = (sum as f64 / intervals.len() as f64) / 1000.0;

            // Predict next connection
            pattern.predicted_next_connection =
                now + (pattern.avg_interval_secs * 1000.0) as u64;
        }

        Ok(())
    }

    /// Get projects that should be prewarmed now
    pub async fn get_prewarm_candidates(&self) -> Result<Vec<String>, String> {
        let strategy = self.strategy.read().await;
        let patterns = self.patterns.read().await;
        let schedules = self.schedules.read().await;
        let now = Self::current_timestamp();

        let mut candidates = Vec::new();

        // Predictive prewarming
        if strategy.predictive_enabled {
            for pattern in patterns.values() {
                if pattern.total_connections >= strategy.min_usage_count as u64 {
                    // Check if predicted time is near
                    if pattern.predicted_next_connection > 0 {
                        let time_until = pattern.predicted_next_connection.saturating_sub(now);
                        // Prewarm 5 minutes before predicted time
                        if time_until < 300000 && time_until > 0 {
                            candidates.push(pattern.project_id.clone());
                        }
                    }
                }
            }
        }

        // Scheduled prewarming
        if strategy.scheduled_enabled {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            let datetime = chrono::DateTime::<chrono::Utc>::from_timestamp(current_time as i64, 0)
                .ok_or("Invalid timestamp")?;

            let current_hour = datetime.hour() as u8;
            let current_minute = datetime.minute() as u8;
            let current_weekday = datetime.weekday().num_days_from_sunday() as u8;

            for schedule in schedules.iter() {
                if !schedule.enabled {
                    continue;
                }

                if schedule.weekdays.contains(&current_weekday)
                    && schedule.hour == current_hour
                    && schedule.minute == current_minute
                {
                    candidates.push(schedule.project_id.clone());
                }
            }
        }

        // Remove duplicates
        candidates.sort();
        candidates.dedup();

        Ok(candidates)
    }

    /// Get usage pattern for a project
    pub async fn get_pattern(&self, project_id: &str) -> Result<UsagePattern, String> {
        let patterns = self.patterns.read().await;
        patterns
            .get(project_id)
            .cloned()
            .ok_or_else(|| format!("No pattern found for project {}", project_id))
    }

    /// Get all usage patterns
    pub async fn get_all_patterns(&self) -> Vec<UsagePattern> {
        let patterns = self.patterns.read().await;
        patterns.values().cloned().collect()
    }

    /// Add a prewarm schedule
    pub async fn add_schedule(&self, schedule: PrewarmSchedule) -> Result<(), String> {
        let mut schedules = self.schedules.write().await;
        schedules.push(schedule);
        Ok(())
    }

    /// Remove a prewarm schedule
    pub async fn remove_schedule(&self, project_id: &str) -> Result<(), String> {
        let mut schedules = self.schedules.write().await;
        schedules.retain(|s| s.project_id != project_id);
        Ok(())
    }

    /// Get all schedules
    pub async fn get_schedules(&self) -> Vec<PrewarmSchedule> {
        let schedules = self.schedules.read().await;
        schedules.clone()
    }

    /// Update prewarm strategy
    pub async fn set_strategy(&self, strategy: PrewarmStrategy) -> Result<(), String> {
        let mut current = self.strategy.write().await;
        *current = strategy;
        Ok(())
    }

    /// Get prewarm strategy
    pub async fn get_strategy(&self) -> PrewarmStrategy {
        let strategy = self.strategy.read().await;
        strategy.clone()
    }

    /// Clear usage patterns
    pub async fn clear_patterns(&self) -> usize {
        let mut patterns = self.patterns.write().await;
        let count = patterns.len();
        patterns.clear();
        count
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_usage_pattern_tracking() {
        let manager = PrewarmManager::new();

        // Record multiple usages
        for _ in 0..5 {
            manager.record_usage("project1".to_string()).await.unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        let pattern = manager.get_pattern("project1").await.unwrap();
        assert_eq!(pattern.total_connections, 5);
        assert!(pattern.avg_interval_secs > 0.0);
    }

    #[tokio::test]
    async fn test_schedule_management() {
        let manager = PrewarmManager::new();

        let schedule = PrewarmSchedule {
            project_id: "project1".to_string(),
            hour: 9,
            minute: 0,
            weekdays: vec![1, 2, 3, 4, 5], // Monday-Friday
            enabled: true,
        };

        manager.add_schedule(schedule).await.unwrap();

        let schedules = manager.get_schedules().await;
        assert_eq!(schedules.len(), 1);
        assert_eq!(schedules[0].project_id, "project1");

        manager.remove_schedule("project1").await.unwrap();
        let schedules = manager.get_schedules().await;
        assert_eq!(schedules.len(), 0);
    }
}
