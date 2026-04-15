# PR11: Automatic Reconnection Mechanism

## 目标
实现智能的自动重连机制，在连接断开时自动尝试恢复，支持指数退避、重连策略和状态恢复。

## 核心功能

### 1. Reconnect Strategy
```rust
pub struct ReconnectStrategy {
    pub max_attempts: u32,           // 最大重连次数
    pub initial_delay: Duration,     // 初始延迟
    pub max_delay: Duration,         // 最大延迟
    pub backoff_multiplier: f64,     // 退避倍数
    pub jitter: bool,                // 是否添加随机抖动
}
```

### 2. Reconnect State
```rust
pub enum ReconnectState {
    Idle,           // 未在重连
    Attempting,     // 正在尝试重连
    Backoff,        // 退避等待中
    Success,        // 重连成功
    Failed,         // 重连失败（达到最大次数）
}

pub struct ReconnectContext {
    pub session_id: String,
    pub state: ReconnectState,
    pub attempt_count: u32,
    pub last_attempt_at: Option<SystemTime>,
    pub next_attempt_at: Option<SystemTime>,
    pub strategy: ReconnectStrategy,
    pub error_history: Vec<String>,
}
```

## 实现计划

### Phase 1: 重连策略引擎
- [ ] `src-tauri/src/runtime/reconnect.rs`
  - ReconnectStrategy 配置
  - 指数退避算法
  - 随机抖动（jitter）
  - 重连状态机

### Phase 2: 自动重连管理器
- [ ] ReconnectManager
  - 监听连接断开事件
  - 自动触发重连
  - 管理重连队列
  - 并发重连控制

### Phase 3: 状态恢复
- [ ] 重连成功后恢复会话状态
- [ ] 从快照恢复终端状态
- [ ] 重新订阅日志流
- [ ] 恢复工作区节点绑定

### Phase 4: Tauri Commands
- [ ] `src-tauri/src/commands/reconnect.rs`
  - `reconnect_start(session_id, strategy)`
  - `reconnect_cancel(session_id)`
  - `reconnect_get_status(session_id)`
  - `reconnect_set_strategy(strategy)`
  - `reconnect_list_active()`

### Phase 5: 前端集成
- [ ] `src/lib/backend-reconnect.ts`
  - API 封装
- [ ] `src/hooks/useAutoReconnect.ts`
  - 自动重连 Hook
  - 重连状态监控
  - 手动重连触发

### Phase 6: UI 组件
- [ ] 重连状态指示器
- [ ] 重连进度显示
- [ ] 手动重连按钮
- [ ] 重连策略配置

## 关键特性

### 1. 指数退避算法
```rust
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
```

### 2. 智能重连触发
```rust
// 监听连接状态变化
pub async fn on_connection_state_change(
    session_id: &str,
    old_state: ConnectionState,
    new_state: ConnectionState,
) {
    if new_state == ConnectionState::Closed || new_state == ConnectionState::Failed {
        // 自动触发重连
        start_reconnect(session_id).await;
    }
}
```

### 3. 状态恢复
```rust
pub async fn restore_after_reconnect(session_id: &str) -> Result<()> {
    // 1. 获取快照
    let snapshot = get_snapshot(session_id).await?;
    
    // 2. 恢复终端状态
    restore_terminal_state(session_id, &snapshot.terminal_state).await?;
    
    // 3. 重新订阅日志
    resubscribe_logs(session_id, &snapshot.log_sources).await?;
    
    // 4. 更新连接状态
    update_connection_state(session_id, ConnectionState::Active).await?;
    
    Ok(())
}
```

### 4. 并发控制
```rust
pub struct ReconnectManager {
    active_reconnects: Arc<RwLock<HashMap<String, ReconnectContext>>>,
    max_concurrent: usize,
}

impl ReconnectManager {
    pub async fn start_reconnect(&self, session_id: String) -> Result<()> {
        let active_count = self.active_reconnects.read().await.len();
        if active_count >= self.max_concurrent {
            return Err("Too many concurrent reconnects".into());
        }
        
        // Start reconnect task
        self.spawn_reconnect_task(session_id).await
    }
}
```

## 数据结构

### ReconnectContext
```rust
pub struct ReconnectContext {
    pub session_id: String,
    pub state: ReconnectState,
    pub attempt_count: u32,
    pub last_attempt_at: Option<SystemTime>,
    pub next_attempt_at: Option<SystemTime>,
    pub strategy: ReconnectStrategy,
    pub error_history: Vec<String>,
    pub started_at: SystemTime,
}

impl ReconnectContext {
    pub fn should_retry(&self) -> bool {
        self.attempt_count < self.strategy.max_attempts
    }
    
    pub fn calculate_next_delay(&self) -> Duration {
        calculate_next_delay(
            self.attempt_count,
            self.strategy.initial_delay,
            self.strategy.max_delay,
            self.strategy.backoff_multiplier,
            self.strategy.jitter,
        )
    }
    
    pub fn record_attempt(&mut self, error: Option<String>) {
        self.attempt_count += 1;
        self.last_attempt_at = Some(SystemTime::now());
        
        if let Some(err) = error {
            self.error_history.push(err);
        }
        
        if self.should_retry() {
            let delay = self.calculate_next_delay();
            self.next_attempt_at = Some(SystemTime::now() + delay);
            self.state = ReconnectState::Backoff;
        } else {
            self.state = ReconnectState::Failed;
        }
    }
}
```

## 测试场景

1. **网络断开恢复**
   - 模拟网络断开
   - 自动触发重连
   - 验证指数退避
   - 验证状态恢复

2. **服务器重启**
   - SSH 服务重启
   - 自动重连
   - 恢复会话状态

3. **并发重连**
   - 多个会话同时断开
   - 并发重连控制
   - 资源管理

4. **重连失败**
   - 达到最大重连次数
   - 正确标记为失败
   - 通知用户

5. **手动取消**
   - 用户取消重连
   - 清理重连状态

## 性能目标

- 重连触发延迟: < 100ms
- 首次重连尝试: < 1s
- 状态恢复时间: < 500ms
- 内存占用: < 500KB per reconnect context
- 并发重连数: 最多 10 个

## 配置示例

```typescript
const reconnectStrategy = {
  maxAttempts: 5,
  initialDelay: 1000,      // 1 second
  maxDelay: 30000,         // 30 seconds
  backoffMultiplier: 2.0,  // 1s, 2s, 4s, 8s, 16s, 30s
  jitter: true,            // Add random jitter
};

// Delays: 1s, 2s, 4s, 8s, 16s (with ±25% jitter)
```

## 集成点

### 与 PR9 (Connection Pool) 集成
- 重连时从池获取新连接
- 失败时释放连接回池

### 与 PR10 (Lifecycle) 集成
- 重连中标记为 Reconnecting 状态
- 重连成功恢复为 Active
- 重连失败转为 Hibernated

### 与 PR12 (Health Check) 集成
- 健康检查失败触发重连
- 重连成功后重新开始健康检查

## 监控指标

- 重连触发次数
- 重连成功率
- 平均重连时间
- 重连失败原因分布
- 并发重连数

## 下一步

完成 PR11 后，继续 PR12: 健康检查系统
