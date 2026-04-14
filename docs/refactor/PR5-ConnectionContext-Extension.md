# PR5: 引入 ConnectionContext 扩展

## 概述

扩展 ConnectionContext 以支持更复杂的连接管理场景，包括多节点共享连接、连接健康度监控、服务器/数据库关联等功能。

**设计原则：向后兼容，渐进增强**
- 保持现有 API 不变
- 新增字段都是可选的
- 新增方法不影响现有功能
- 可以逐步采用新功能

## 变更内容

### 后端 (Rust)

#### 1. 扩展 ConnectionContext 结构

**新增字段：**

```rust
pub struct ConnectionContext {
    pub project_id: String,
    
    // 新增：服务器和数据库关联
    pub server_id: Option<String>,
    pub database_id: Option<String>,
    
    // 扩展：支持多个 session
    pub primary_session_id: Option<String>,
    pub session_ids: Vec<String>,  // 新增
    
    // 新增：workspace nodes 关联
    pub node_ids: Vec<String>,
    
    pub state: ConnectionState,
    pub last_error: Option<String>,
    pub last_connected_at: Option<u64>,
    
    // 新增：健康度指标
    pub health: ConnectionHealth,
    
    pub created_at: u64,
    pub updated_at: u64,
}
```

**新增健康度结构：**

```rust
pub struct ConnectionHealth {
    pub success_count: u32,
    pub failure_count: u32,
    pub avg_latency_ms: Option<u32>,
    pub last_check_at: Option<u64>,
    pub is_healthy: bool,
}
```

#### 2. 新增 ConnectionContext 方法

```rust
// 构建器方法
pub fn with_server(mut self, server_id: String) -> Self
pub fn with_database(mut self, database_id: String) -> Self

// 健康度管理
pub fn record_success(&mut self, latency_ms: Option<u32>)
pub fn update_health_check(&mut self)

// Session 管理（支持多个）
pub fn bind_session(&mut self, session_id: String)
pub fn unbind_session(&mut self, session_id: &str)

// Node 管理
pub fn add_node(&mut self, node_id: String)
pub fn remove_node(&mut self, node_id: &str)
pub fn has_active_nodes(&self) -> bool
pub fn has_active_sessions(&self) -> bool
```

#### 3. 新增 ConnectionRegistry 方法

```rust
// Node 管理
pub fn add_node(&mut self, project_id: &str, node_id: String) -> Result<(), String>
pub fn remove_node(&mut self, project_id: &str, node_id: &str) -> Result<(), String>

// 健康度管理
pub fn record_success(&mut self, project_id: &str, latency_ms: Option<u32>) -> Result<(), String>
pub fn update_health_check(&mut self, project_id: &str) -> Result<(), String>

// 查询方法
pub fn with_active_nodes(&self) -> Vec<&ConnectionContext>
pub fn by_server(&self, server_id: &str) -> Vec<&ConnectionContext>
```

#### 4. 新增 Tauri Commands

```rust
// Node 管理
connection_add_node(project_id, node_id)
connection_remove_node(project_id, node_id)

// 健康度管理
connection_record_success(project_id, latency_ms)
connection_update_health_check(project_id)

// 查询
connection_list_with_active_nodes()
connection_list_by_server(server_id)
```

**修改的命令：**
```rust
// 之前：connection_unbind_session(project_id)
// 现在：connection_unbind_session(project_id, session_id)
// 支持解绑特定 session 而不是清空所有
```

### 前端 (TypeScript/React)

#### 1. 扩展类型定义 (types/connection.ts)

```typescript
export interface ConnectionHealth {
  successCount: number;
  failureCount: number;
  avgLatencyMs?: number;
  lastCheckAt?: number;
  isHealthy: boolean;
}

export interface ConnectionContext {
  projectId: string;
  serverId?: string;
  databaseId?: string;
  primarySessionId?: string;
  sessionIds: string[];
  nodeIds: string[];
  state: ConnectionState;
  lastError?: string;
  lastConnectedAt?: number;
  health: ConnectionHealth;
  createdAt: number;
  updatedAt: number;
}
```

#### 2. 新增 Backend API (lib/backend.ts)

```typescript
// Node 管理
export async function connectionAddNode(projectId: string, nodeId: string): Promise<void>
export async function connectionRemoveNode(projectId: string, nodeId: string): Promise<void>

// 健康度管理
export async function connectionRecordSuccess(projectId: string, latencyMs?: number): Promise<void>
export async function connectionUpdateHealthCheck(projectId: string): Promise<void>

// 查询
export async function connectionListWithActiveNodes(): Promise<ConnectionContext[]>
export async function connectionListByServer(serverId: string): Promise<ConnectionContext[]>
```

**修改的 API：**
```typescript
// 之前：connectionUnbindSession(projectId: string)
// 现在：connectionUnbindSession(projectId: string, sessionId: string)
```

#### 3. 扩展 Zustand Store (store/connection-runtime.ts)

```typescript
interface ConnectionRuntimeStore {
  // 新增方法
  addNode: (projectId: string, nodeId: string) => Promise<void>;
  removeNode: (projectId: string, nodeId: string) => Promise<void>;
  recordSuccess: (projectId: string, latencyMs?: number) => Promise<void>;
  updateHealthCheck: (projectId: string) => Promise<void>;
  listWithActiveNodes: () => Promise<ConnectionContext[]>;
  listByServer: (serverId: string) => Promise<ConnectionContext[]>;
  
  // 修改的方法
  unbindSession: (projectId: string, sessionId: string) => Promise<void>;
}
```

#### 4. 示例组件 (components/examples/ConnectionContextExample.tsx)

演示新功能的使用：
- 添加/移除 workspace nodes
- 记录成功操作和延迟
- 健康度检查
- 显示健康度指标

## 使用示例

### 多节点共享连接

```typescript
const connectionRuntime = useConnectionRuntime();

// 1. 注册连接
const context = await connectionRuntime.register(projectId);

// 2. 添加多个 workspace nodes
await connectionRuntime.addNode(projectId, "terminal-1");
await connectionRuntime.addNode(projectId, "terminal-2");
await connectionRuntime.addNode(projectId, "logs-1");

// 3. 所有 nodes 共享同一个连接
const connection = await connectionRuntime.get(projectId);
console.log("Active nodes:", connection.nodeIds);
// ["terminal-1", "terminal-2", "logs-1"]
```

### 健康度监控

```typescript
// 记录成功操作
await connectionRuntime.recordSuccess(projectId, 45); // 45ms 延迟

// 多次记录后，自动计算平均延迟
const connection = await connectionRuntime.get(projectId);
console.log("Health:", connection.health);
// {
//   successCount: 5,
//   failureCount: 0,
//   avgLatencyMs: 42,
//   isHealthy: true
// }

// 记录错误
await connectionRuntime.setError(projectId, "Connection timeout");

// 健康度自动更新
const updated = await connectionRuntime.get(projectId);
console.log("Health:", updated.health);
// {
//   successCount: 0,
//   failureCount: 1,
//   isHealthy: true  // 需要 3 次失败才标记为 unhealthy
// }
```

### 按服务器查询连接

```typescript
// 查询特定服务器的所有连接
const connections = await connectionRuntime.listByServer("server-123");

// 查询有活跃 nodes 的连接
const activeConnections = await connectionRuntime.listWithActiveNodes();
```

### 多 Session 支持

```typescript
// 绑定多个 sessions
await connectionRuntime.bindSession(projectId, "session-1");
await connectionRuntime.bindSession(projectId, "session-2");

const connection = await connectionRuntime.get(projectId);
console.log("Sessions:", connection.sessionIds);
// ["session-1", "session-2"]
console.log("Primary:", connection.primarySessionId);
// "session-2" (最后绑定的)

// 解绑特定 session
await connectionRuntime.unbindSession(projectId, "session-1");

// 如果解绑的是 primary session，自动选择另一个
const updated = await connectionRuntime.get(projectId);
console.log("Primary:", updated.primarySessionId);
// "session-2"
```

## 文件清单

### 修改文件

**后端：**
- `src-tauri/src/runtime/connection_runtime.rs` (+150 行)
  * 新增 ConnectionHealth 结构
  * 扩展 ConnectionContext 字段和方法
  * 新增 ConnectionRegistry 方法
  * 新增公共 API 函数

- `src-tauri/src/runtime/mod.rs` (+6 个导出)
- `src-tauri/src/commands/connection.rs` (+60 行，7 个新命令)
- `src-tauri/src/lib.rs` (+6 个命令注册)

**前端：**
- `src/types/connection.ts` (+20 行)
  * 新增 ConnectionHealth 接口
  * 扩展 ConnectionContext 接口
  * 新增 ConnectionState 常量

- `src/lib/backend.ts` (+30 行，7 个新 API)
- `src/store/connection-runtime.ts` (+80 行，7 个新方法)

### 新增文件

**前端：**
- `src/components/examples/ConnectionContextExample.tsx` (180 行)

## 向后兼容性

✅ **完全兼容**

### 字段兼容性
- 所有新增字段都是可选的或有默认值
- 现有字段保持不变
- 旧代码可以继续使用 `primarySessionId`

### API 兼容性
- 所有新增 API 都是新函数，不影响现有 API
- `connectionUnbindSession` 签名变化，但向后兼容：
  * 旧代码：`unbindSession(projectId)` - 清空 primary session
  * 新代码：`unbindSession(projectId, sessionId)` - 解绑特定 session
  * 迁移：需要更新调用代码传入 sessionId

### 数据兼容性
- 新字段在序列化时自动处理
- 旧数据加载时新字段使用默认值
- 不需要数据迁移

## 破坏性变更

⚠️ **一个 API 签名变化**

```typescript
// 之前
connectionUnbindSession(projectId: string): Promise<void>

// 现在
connectionUnbindSession(projectId: string, sessionId: string): Promise<void>
```

**迁移方法：**

```typescript
// 旧代码
await connectionRuntime.unbindSession(projectId);

// 新代码
const connection = await connectionRuntime.get(projectId);
if (connection.primarySessionId) {
  await connectionRuntime.unbindSession(projectId, connection.primarySessionId);
}
```

## 设计决策

### 为什么支持多个 sessions？

1. **连接池准备**
   - 一个项目可能有多个 SSH 连接
   - 不同的 terminal tabs 可能使用不同的 session
   - 为后续连接池功能奠定基础

2. **灵活性**
   - 可以选择性地关闭某个 session
   - 不影响其他 sessions
   - 支持 session 迁移

### 为什么添加健康度指标？

1. **主动监控**
   - 实时了解连接质量
   - 提前发现问题
   - 自动降级或重连

2. **用户体验**
   - 显示连接延迟
   - 显示连接稳定性
   - 提供重连建议

3. **调试支持**
   - 记录成功/失败次数
   - 追踪性能变化
   - 辅助问题诊断

### 为什么支持 node 管理？

1. **资源共享**
   - 多个 workspace nodes 共享一个连接
   - 减少连接数量
   - 提高资源利用率

2. **生命周期管理**
   - 知道哪些 nodes 在使用连接
   - 所有 nodes 关闭时可以安全关闭连接
   - 避免过早关闭连接

3. **状态同步**
   - 连接状态变化时通知所有 nodes
   - 统一的错误处理
   - 一致的用户体验

## 后续工作

### 立即可做

1. **迁移现有代码**
   - 更新 Terminal 面板使用 node 管理
   - 更新 Logs 面板使用 node 管理
   - 显示连接健康度指标

2. **添加健康度监控 UI**
   - 在状态栏显示连接健康度
   - 延迟过高时显示警告
   - 提供手动健康检查按钮

3. **优化连接管理**
   - 根据健康度自动重连
   - 健康度低时降级功能
   - 记录健康度历史

### 需要后续 PR

1. **PR6: ReconnectSnapshot**
   - 保存重连所需的状态
   - 使用健康度指标决定是否重连

2. **PR9-12: 连接池**
   - 使用 `sessionIds` 管理连接池
   - 使用 `nodeIds` 分配连接
   - 使用健康度指标选择最佳连接

## 测试建议

1. **单元测试**
   - ConnectionHealth 计算逻辑
   - 多 session 管理
   - Node 添加/移除

2. **集成测试**
   - 多 nodes 共享连接
   - 健康度自动更新
   - Session 自动切换

3. **手动测试**
   - 使用示例组件验证功能
   - 测试健康度指标准确性
   - 验证多 session 场景

## 总结

PR5 扩展了 ConnectionContext，为更复杂的连接管理场景提供支持：

1. ✅ **多节点支持** - 多个 workspace nodes 可以共享一个连接
2. ✅ **健康度监控** - 实时追踪连接质量和性能
3. ✅ **多 session 支持** - 为连接池功能奠定基础
4. ✅ **服务器关联** - 支持按服务器查询和管理连接
5. ✅ **向后兼容** - 只有一个 API 签名变化，其他完全兼容

这些扩展为后续的连接池、自动重连、智能降级等功能提供了坚实的基础。
