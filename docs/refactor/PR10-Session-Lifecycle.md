# PR10: Session Lifecycle Management

## 目标
实现完整的会话生命周期管理，包括创建、激活、休眠、恢复和销毁。

## 核心功能

### 1. Session State Machine
```
Created → Active → Idle → Hibernated → Destroyed
                ↓         ↑
              Paused → Resumed
```

### 2. 状态定义
```rust
pub enum SessionState {
    Created,      // 刚创建，未激活
    Active,       // 活跃使用中
    Idle,         // 空闲但保持连接
    Paused,       // 用户暂停
    Hibernated,   // 休眠（释放资源）
    Destroyed,    // 已销毁
}

pub struct SessionLifecycle {
    pub session_id: String,
    pub state: SessionState,
    pub created_at: SystemTime,
    pub last_active_at: SystemTime,
    pub idle_since: Option<SystemTime>,
    pub hibernated_at: Option<SystemTime>,
    pub activity_count: u64,
    pub total_active_duration: Duration,
}
```

### 3. 生命周期策略
```rust
pub struct LifecyclePolicy {
    pub idle_timeout: Duration,        // 空闲多久后进入 Idle
    pub hibernate_timeout: Duration,   // Idle 多久后休眠
    pub destroy_timeout: Duration,     // 休眠多久后销毁
    pub max_session_age: Duration,     // 最大会话年龄
    pub keep_alive_interval: Duration, // 保活间隔
}
```

## 实现计划

### Phase 1: 后端状态机
- [ ] `src-tauri/src/runtime/session_lifecycle.rs`
  - SessionState 枚举
  - SessionLifecycle 结构
  - 状态转换逻辑
  - 生命周期策略

### Phase 2: 自动化管理
- [ ] 后台任务监控会话活动
- [ ] 自动 idle 检测
- [ ] 自动休眠和唤醒
- [ ] 自动清理过期会话

### Phase 3: Tauri Commands
- [ ] `src-tauri/src/commands/session_lifecycle.rs`
  - `session_pause(session_id)`
  - `session_resume(session_id)`
  - `session_hibernate(session_id)`
  - `session_wake(session_id)`
  - `session_get_lifecycle(session_id)`
  - `session_set_policy(policy)`

### Phase 4: 前端集成
- [ ] `src/lib/backend-lifecycle.ts`
  - API 封装
- [ ] `src/hooks/useSessionLifecycle.ts`
  - 生命周期状态管理
  - 自动保活
  - 状态监控

### Phase 5: UI 组件
- [ ] 会话状态指示器
- [ ] 暂停/恢复按钮
- [ ] 生命周期配置面板

## 关键特性

### 1. 自动 Idle 检测
```rust
// 监控用户活动
if last_activity_elapsed > idle_timeout {
    transition_to_idle(session_id);
}
```

### 2. 智能休眠
```rust
// 休眠时保存状态
if idle_elapsed > hibernate_timeout {
    save_snapshot(session_id);
    release_resources(session_id);
    transition_to_hibernated(session_id);
}
```

### 3. 快速唤醒
```rust
// 从休眠恢复
pub async fn wake_session(session_id: &str) -> Result<()> {
    let snapshot = load_snapshot(session_id)?;
    restore_resources(session_id, snapshot)?;
    transition_to_active(session_id);
    Ok(())
}
```

### 4. 保活机制
```rust
// 定期发送保活信号
pub async fn keep_alive(session_id: &str) -> Result<()> {
    update_last_active(session_id);
    check_connection_health(session_id)?;
    Ok(())
}
```

## 数据结构

### SessionLifecycle
```rust
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
    pub fn new(session_id: String, policy: LifecyclePolicy) -> Self;
    pub fn transition_to(&mut self, new_state: SessionState) -> Result<()>;
    pub fn record_activity(&mut self);
    pub fn should_idle(&self) -> bool;
    pub fn should_hibernate(&self) -> bool;
    pub fn should_destroy(&self) -> bool;
    pub fn get_state_duration(&self) -> Duration;
}
```

## 测试场景

1. **正常流程**
   - Created → Active → Idle → Hibernated → Destroyed

2. **用户交互**
   - Active → Paused → Resumed → Active

3. **快速唤醒**
   - Hibernated → Active (< 100ms)

4. **保活机制**
   - Active 状态下定期更新 last_active_at

5. **策略配置**
   - 动态调整超时时间
   - 不同项目不同策略

## 性能目标

- 状态转换延迟: < 10ms
- 休眠操作: < 500ms
- 唤醒操作: < 100ms
- 保活开销: < 1ms
- 内存占用: < 1KB per session

## 集成点

### 与 PR9 (Connection Pool) 集成
- 休眠时释放连接回池
- 唤醒时从池获取连接

### 与 PR11 (Reconnect) 集成
- 连接断开时自动进入 Idle
- 重连成功后恢复 Active

### 与 PR12 (Health Check) 集成
- 健康检查失败时触发状态转换
- 不健康的会话自动休眠

## 配置示例

```typescript
const lifecyclePolicy = {
  idleTimeout: 5 * 60 * 1000,        // 5分钟无活动 → Idle
  hibernateTimeout: 15 * 60 * 1000,  // Idle 15分钟 → Hibernated
  destroyTimeout: 60 * 60 * 1000,    // 休眠1小时 → Destroyed
  maxSessionAge: 24 * 60 * 60 * 1000, // 最大24小时
  keepAliveInterval: 30 * 1000,      // 30秒保活
};
```

## 监控指标

- 活跃会话数
- 空闲会话数
- 休眠会话数
- 平均会话寿命
- 状态转换频率
- 唤醒成功率

## 下一步

完成 PR10 后，继续：
- PR11: 自动重连机制
- PR12: 健康检查系统
