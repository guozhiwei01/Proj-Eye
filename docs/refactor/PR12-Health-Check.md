# PR12: Connection Health Check System

## 目标
实现全面的连接健康检查系统，主动监控连接状态，及时发现和处理连接问题。

## 核心功能

### 1. Health Check Types
```rust
pub enum HealthCheckType {
    Ping,           // 简单 ping 检查
    Echo,           // Echo 命令检查
    Command,        // 自定义命令检查
    Heartbeat,      // 心跳检查
}

pub struct HealthCheckConfig {
    pub check_type: HealthCheckType,
    pub interval: Duration,
    pub timeout: Duration,
    pub failure_threshold: u32,    // 连续失败多少次标记为不健康
    pub success_threshold: u32,    // 连续成功多少次恢复健康
}
```

### 2. Health Status
```rust
pub enum HealthStatus {
    Healthy,        // 健康
    Degraded,       // 降级（部分功能受影响）
    Unhealthy,      // 不健康
    Unknown,        // 未知（未检查）
}

pub struct HealthCheckResult {
    pub status: HealthStatus,
    pub latency_ms: u64,
    pub checked_at: SystemTime,
    pub error: Option<String>,
    pub consecutive_failures: u32,
    pub consecutive_successes: u32,
}
```

## 实现计划

### Phase 1: 健康检查引擎
- [ ] `src-tauri/src/runtime/health_check.rs`
  - HealthCheckConfig 配置
  - 各种检查类型实现
  - 健康状态评估
  - 检查结果历史

### Phase 2: 自动检查调度
- [ ] HealthCheckScheduler
  - 定期执行健康检查
  - 管理检查任务
  - 并发检查控制
  - 动态调整检查频率

### Phase 3: 健康状态管理
- [ ] HealthStatusManager
  - 跟踪连接健康状态
  - 状态变化通知
  - 健康度评分
  - 历史趋势分析

### Phase 4: Tauri Commands
- [ ] `src-tauri/src/commands/health_check.rs`
  - `health_check_start(session_id, config)`
  - `health_check_stop(session_id)`
  - `health_check_run_once(session_id)`
  - `health_check_get_status(session_id)`
  - `health_check_get_history(session_id, limit)`
  - `health_check_set_config(config)`

### Phase 5: 前端集成
- [ ] `src/lib/backend-health.ts`
  - API 封装
- [ ] `src/hooks/useHealthCheck.ts`
  - 健康检查 Hook
  - 实时状态监控
  - 历史数据查询

### Phase 6: UI 组件
- [ ] 健康状态指示器
- [ ] 延迟图表
- [ ] 健康历史面板
- [ ] 检查配置界面

## 关键特性

### 1. 多种检查方式
```rust
pub async fn perform_health_check(
    session: &Session,
    config: &HealthCheckConfig,
) -> HealthCheckResult {
    let start = Instant::now();
    
    let result = match config.check_type {
        HealthCheckType::Ping => {
            // Simple TCP connection check
            check_tcp_connection(session).await
        }
        HealthCheckType::Echo => {
            // Execute echo command
            execute_command(session, "echo health_check").await
        }
        HealthCheckType::Command => {
            // Custom command
            execute_command(session, &config.command).await
        }
        HealthCheckType::Heartbeat => {
            // Check last activity timestamp
            check_last_activity(session).await
        }
    };
    
    let latency = start.elapsed();
    
    HealthCheckResult {
        status: evaluate_status(&result),
        latency_ms: latency.as_millis() as u64,
        checked_at: SystemTime::now(),
        error: result.err(),
        consecutive_failures: 0,
        consecutive_successes: 0,
    }
}
```

### 2. 智能状态评估
```rust
pub fn evaluate_health_status(
    current: &HealthCheckResult,
    history: &[HealthCheckResult],
    config: &HealthCheckConfig,
) -> HealthStatus {
    // Check consecutive failures
    if current.consecutive_failures >= config.failure_threshold {
        return HealthStatus::Unhealthy;
    }
    
    // Check latency degradation
    let avg_latency = calculate_average_latency(history);
    if current.latency_ms > avg_latency * 2 {
        return HealthStatus::Degraded;
    }
    
    // Check success rate
    let success_rate = calculate_success_rate(history);
    if success_rate < 0.8 {
        return HealthStatus::Degraded;
    } else if success_rate >= 0.95 {
        return HealthStatus::Healthy;
    }
    
    HealthStatus::Unknown
}
```

### 3. 自动响应机制
```rust
pub async fn on_health_status_change(
    session_id: &str,
    old_status: HealthStatus,
    new_status: HealthStatus,
) {
    match new_status {
        HealthStatus::Unhealthy => {
            // Trigger reconnect
            trigger_reconnect(session_id).await;
            
            // Update connection state
            update_connection_state(session_id, ConnectionState::Degraded).await;
        }
        HealthStatus::Degraded => {
            // Increase check frequency
            increase_check_frequency(session_id).await;
            
            // Log warning
            log_health_warning(session_id).await;
        }
        HealthStatus::Healthy => {
            // Restore normal check frequency
            restore_check_frequency(session_id).await;
            
            // Update connection state
            update_connection_state(session_id, ConnectionState::Active).await;
        }
        _ => {}
    }
}
```

### 4. 动态检查频率
```rust
pub struct AdaptiveHealthCheck {
    base_interval: Duration,
    current_interval: Duration,
    min_interval: Duration,
    max_interval: Duration,
}

impl AdaptiveHealthCheck {
    pub fn adjust_interval(&mut self, status: HealthStatus) {
        match status {
            HealthStatus::Healthy => {
                // Decrease frequency (increase interval)
                self.current_interval = (self.current_interval * 2)
                    .min(self.max_interval);
            }
            HealthStatus::Degraded | HealthStatus::Unhealthy => {
                // Increase frequency (decrease interval)
                self.current_interval = (self.current_interval / 2)
                    .max(self.min_interval);
            }
            _ => {}
        }
    }
}
```

## 数据结构

### HealthCheckContext
```rust
pub struct HealthCheckContext {
    pub session_id: String,
    pub config: HealthCheckConfig,
    pub current_status: HealthStatus,
    pub last_check: Option<HealthCheckResult>,
    pub check_history: VecDeque<HealthCheckResult>,
    pub consecutive_failures: u32,
    pub consecutive_successes: u32,
    pub total_checks: u64,
    pub total_failures: u64,
    pub started_at: SystemTime,
}

impl HealthCheckContext {
    pub fn record_result(&mut self, result: HealthCheckResult) {
        // Update consecutive counters
        if result.error.is_some() {
            self.consecutive_failures += 1;
            self.consecutive_successes = 0;
            self.total_failures += 1;
        } else {
            self.consecutive_successes += 1;
            self.consecutive_failures = 0;
        }
        
        self.total_checks += 1;
        
        // Add to history (keep last 100)
        self.check_history.push_back(result.clone());
        if self.check_history.len() > 100 {
            self.check_history.pop_front();
        }
        
        self.last_check = Some(result);
        
        // Evaluate new status
        let new_status = self.evaluate_status();
        if new_status != self.current_status {
            self.on_status_change(new_status);
        }
    }
    
    pub fn evaluate_status(&self) -> HealthStatus {
        if self.consecutive_failures >= self.config.failure_threshold {
            HealthStatus::Unhealthy
        } else if self.consecutive_successes >= self.config.success_threshold {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded
        }
    }
    
    pub fn get_success_rate(&self) -> f64 {
        if self.total_checks == 0 {
            return 1.0;
        }
        1.0 - (self.total_failures as f64 / self.total_checks as f64)
    }
    
    pub fn get_average_latency(&self) -> u64 {
        if self.check_history.is_empty() {
            return 0;
        }
        
        let sum: u64 = self.check_history.iter()
            .map(|r| r.latency_ms)
            .sum();
        sum / self.check_history.len() as u64
    }
}
```

## 测试场景

1. **正常健康检查**
   - 定期执行检查
   - 记录延迟
   - 保持健康状态

2. **网络延迟**
   - 模拟高延迟
   - 标记为 Degraded
   - 增加检查频率

3. **连接失败**
   - 连续失败达到阈值
   - 标记为 Unhealthy
   - 触发重连

4. **恢复健康**
   - 连续成功达到阈值
   - 恢复 Healthy 状态
   - 降低检查频率

5. **并发检查**
   - 多个会话同时检查
   - 资源控制
   - 性能影响

## 性能目标

- 检查执行时间: < 100ms (Ping/Echo)
- 检查开销: < 1% CPU
- 内存占用: < 1MB per session
- 历史记录: 最多 100 条
- 并发检查: 最多 20 个

## 配置示例

```typescript
const healthCheckConfig = {
  checkType: 'echo',
  interval: 30000,           // 30 seconds
  timeout: 5000,             // 5 seconds
  failureThreshold: 3,       // 3 consecutive failures → Unhealthy
  successThreshold: 2,       // 2 consecutive successes → Healthy
};

// Adaptive intervals
const adaptiveConfig = {
  baseInterval: 30000,       // 30 seconds
  minInterval: 5000,         // 5 seconds (when unhealthy)
  maxInterval: 300000,       // 5 minutes (when healthy)
};
```

## 集成点

### 与 PR9 (Connection Pool) 集成
- 健康检查失败时释放连接
- 健康检查成功时保持连接

### 与 PR10 (Lifecycle) 集成
- 不健康的会话自动休眠
- 健康检查更新 last_active_at

### 与 PR11 (Reconnect) 集成
- 健康检查失败触发重连
- 重连成功后恢复健康检查

## 监控指标

- 健康检查成功率
- 平均延迟
- 状态分布（Healthy/Degraded/Unhealthy）
- 检查频率
- 失败原因分布

## UI 展示

### 健康状态指示器
```typescript
<HealthIndicator status={healthStatus}>
  {status === 'healthy' && <CheckCircle className="text-green-500" />}
  {status === 'degraded' && <AlertTriangle className="text-yellow-500" />}
  {status === 'unhealthy' && <XCircle className="text-red-500" />}
</HealthIndicator>
```

### 延迟图表
```typescript
<LatencyChart
  data={healthHistory}
  showAverage
  showThreshold
/>
```

## 下一步

完成 PR9-12 后，所有底层架构改造完成，可以开始上层功能开发。
