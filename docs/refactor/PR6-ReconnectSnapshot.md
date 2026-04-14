# PR6: ReconnectSnapshot 系统

## 概述

实现 ReconnectSnapshot 系统，用于在连接断开时保存项目状态，并在重连时恢复。这是实现无缝重连体验的关键基础设施。

## 动机

当 SSH 连接断开时，用户会丢失：
- 打开的终端标签页和工作目录
- 正在查看的日志源
- AI 对话上下文
- 连接状态和健康度信息

ReconnectSnapshot 系统通过自动保存和恢复这些状态，提供无缝的重连体验。

## 架构设计

### 核心结构

```rust
pub struct ReconnectSnapshot {
    pub project_id: String,
    pub server_id: Option<String>,
    pub database_id: Option<String>,
    pub active_node_ids: Vec<String>,
    pub terminal_tabs: Vec<TerminalTabSnapshot>,
    pub active_log_sources: Vec<String>,
    pub last_ai_prompt: Option<String>,
    pub last_connection_state: String,
    pub captured_at: u64,
    pub reason: SnapshotReason,
}

pub struct TerminalTabSnapshot {
    pub node_id: String,
    pub title: String,
    pub cwd: Option<String>,
    pub last_command: Option<String>,
    pub index: usize,
}

pub enum SnapshotReason {
    Disconnect,
    Error,
    Manual,
    Periodic,
}
```

### SnapshotRegistry

单例注册表管理所有快照：

```rust
pub struct SnapshotRegistry {
    snapshots: Arc<RwLock<HashMap<String, ReconnectSnapshot>>>,
}

impl SnapshotRegistry {
    pub fn save(&self, snapshot: ReconnectSnapshot) -> Result<(), String>
    pub fn get(&self, project_id: &str) -> Result<Option<ReconnectSnapshot>, String>
    pub fn remove(&self, project_id: &str) -> Result<Option<ReconnectSnapshot>, String>
    pub fn cleanup_expired(&self, max_age_ms: u64) -> Result<usize, String>
}
```

## API 接口

### Rust 命令

```rust
// 创建快照
#[tauri::command]
pub fn snapshot_create(
    project_id: String,
    reason: String,
    server_id: Option<String>,
    database_id: Option<String>,
    active_node_ids: Vec<String>,
    terminal_tabs: Vec<Value>,
    active_log_sources: Vec<String>,
    last_ai_prompt: Option<String>,
    last_connection_state: String,
) -> Result<(), String>

// 获取快照
#[tauri::command]
pub fn snapshot_get(project_id: String) -> Result<Option<Value>, String>

// 恢复快照（当前等同于 get，未来可扩展）
#[tauri::command]
pub fn snapshot_restore(project_id: String) -> Result<Option<Value>, String>

// 删除快照
#[tauri::command]
pub fn snapshot_remove(project_id: String) -> Result<Option<Value>, String>

// 按项目列出快照
#[tauri::command]
pub fn snapshot_list_by_project(project_id: String) -> Result<Option<Value>, String>

// 清理过期快照
#[tauri::command]
pub fn snapshot_cleanup_expired(max_age_ms: u64) -> Result<usize, String>
```

### TypeScript API

```typescript
// 保存快照
await snapshotSave(projectId, "disconnect", {
  serverId: "server-1",
  activeNodeIds: ["node-1", "node-2"],
  terminalTabs: [
    { nodeId: "node-1", title: "Terminal 1", cwd: "/home/user", index: 0 }
  ],
  activeLogSources: ["/var/log/app.log"],
  lastAiPrompt: "Analyze errors",
  lastConnectionState: "active"
});

// 获取快照
const snapshot = await snapshotGet(projectId);

// 删除快照
await snapshotRemove(projectId);

// 清理过期快照（1小时）
const count = await snapshotCleanupExpired(3600000);
```

### Zustand Store

```typescript
const snapshotStore = useSnapshotStore();

// 保存快照
await snapshotStore.saveSnapshot(projectId, "disconnect", options);

// 获取快照
const snapshot = await snapshotStore.getSnapshot(projectId);

// 删除快照
await snapshotStore.removeSnapshot(projectId);

// 加载所有快照
await snapshotStore.loadAllSnapshots();

// 清理过期快照
const count = await snapshotStore.cleanupExpired(3600000);

// 辅助方法
const hasSnapshot = snapshotStore.hasSnapshot(projectId);
const age = snapshotStore.getSnapshotAge(projectId);
const isValid = snapshotStore.isSnapshotValid(projectId, 3600000);
```

## 使用场景

### 1. 自动保存（连接断开时）

```typescript
// 在 ConnectionRuntime 中集成
connectionRuntime.on("disconnect", async (projectId) => {
  const context = await connectionRuntime.getContext(projectId);
  const terminalTabs = await getActiveTerminalTabs(projectId);
  const logSources = await getActiveLogSources(projectId);
  
  await snapshotStore.saveSnapshot(projectId, "disconnect", {
    serverId: context.serverId,
    activeNodeIds: context.nodeIds,
    terminalTabs,
    activeLogSources: logSources,
    lastConnectionState: context.state,
  });
});
```

### 2. 手动恢复（重连时）

```typescript
// 在重连流程中
async function reconnectProject(projectId: string) {
  const snapshot = await snapshotStore.getSnapshot(projectId);
  
  if (snapshot) {
    // 恢复终端标签页
    for (const tab of snapshot.terminalTabs) {
      await createTerminalTab({
        nodeId: tab.nodeId,
        title: tab.title,
        cwd: tab.cwd,
      });
    }
    
    // 恢复日志源
    for (const source of snapshot.activeLogSources) {
      await addLogSource(source);
    }
    
    // 恢复 AI 上下文
    if (snapshot.lastAiPrompt) {
      await restoreAiContext(snapshot.lastAiPrompt);
    }
  }
  
  // 建立新连接
  await connectionRuntime.connect(projectId);
}
```

### 3. 定期清理

```typescript
// 每小时清理一次过期快照（保留1小时内的）
setInterval(async () => {
  const count = await snapshotStore.cleanupExpired(3600000);
  console.log(`Cleaned up ${count} expired snapshots`);
}, 3600000);
```

## 集成点

### ConnectionRuntime

- 在 `state` 变为 `Closed` 时自动保存快照
- 在 `connect()` 时检查是否有可恢复的快照

### Terminal 面板

- 从快照恢复终端标签页
- 恢复工作目录和最后执行的命令

### Logs 面板

- 从快照恢复日志源
- 恢复滚动位置（未来扩展）

### AI 上下文

- 从快照恢复最后的 AI 提示
- 恢复对话历史（未来扩展）

## 文件清单

### 后端 (Rust)

- `src-tauri/src/runtime/reconnect_snapshot.rs` - 快照结构和注册表
- `src-tauri/src/commands/snapshot.rs` - Tauri 命令
- `src-tauri/src/runtime/mod.rs` - 导出快照函数
- `src-tauri/src/commands/mod.rs` - 导出快照命令
- `src-tauri/src/lib.rs` - 注册命令

### 前端 (TypeScript)

- `src/types/snapshot.ts` - 类型定义
- `src/lib/backend.ts` - Backend API
- `src/store/snapshot.ts` - Zustand store
- `src/components/examples/ReconnectSnapshotExample.tsx` - 示例组件

### 文档

- `docs/refactor/PR6-ReconnectSnapshot.md` - 本文档

## 向后兼容性

✅ 完全向后兼容
- 新增功能，不影响现有代码
- 所有快照操作都是可选的
- 不使用快照系统时，行为与之前完全一致

## 测试建议

1. **基本功能测试**
   - 创建快照并验证数据完整性
   - 获取快照并验证字段正确
   - 删除快照并验证已移除

2. **过期清理测试**
   - 创建不同时间的快照
   - 运行清理并验证只删除过期的

3. **集成测试**
   - 模拟连接断开，验证快照自动保存
   - 模拟重连，验证状态正确恢复
   - 验证终端、日志、AI 上下文都能恢复

4. **边界情况**
   - 项目不存在时获取快照
   - 重复保存同一项目的快照
   - 快照数据为空时的处理

## 未来扩展

1. **持久化存储**
   - 当前快照只存在内存中
   - 可扩展为持久化到磁盘（SQLite）

2. **快照历史**
   - 支持保存多个历史快照
   - 允许用户选择恢复哪个版本

3. **增量快照**
   - 只保存变化的部分
   - 减少内存占用

4. **快照压缩**
   - 对大型快照进行压缩
   - 优化存储空间

5. **快照加密**
   - 对敏感信息加密存储
   - 提高安全性

## 总结

PR6 建立了 ReconnectSnapshot 系统的完整基础设施：

✅ 后端实现完整的快照管理
✅ 前端提供类型安全的 API
✅ Zustand store 简化状态管理
✅ 示例组件展示使用方法
✅ 完整文档说明架构和集成

下一步（PR7-8）将在 Terminal 和 Logs 面板中集成快照恢复功能。
