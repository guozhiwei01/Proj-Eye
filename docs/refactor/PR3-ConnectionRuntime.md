# PR3: 建立 ConnectionRuntime 薄壳

## 概述

建立 ConnectionRuntime 和 SessionRegistry 的基础架构，为统一的连接管理和会话生命周期管理奠定基础。

**设计原则：先立薄壳，再迁逻辑**
- 不立即迁移现有代码
- 建立完整的类型系统和 API
- 提供示例代码供后续迁移参考
- 新旧代码可以共存

## 变更内容

### 后端 (Rust)

#### 1. Runtime 模块结构

```
src-tauri/src/runtime/
├── mod.rs                      # 模块入口
├── connection_runtime.rs       # 连接运行时核心
└── session_registry.rs         # Session 注册表
```

#### 2. ConnectionRuntime (connection_runtime.rs)

**核心类型：**

```rust
pub enum ConnectionState {
    Idle,           // 未连接
    Connecting,     // 连接中
    Active,         // 活跃
    Degraded,       // 降级（有错误但未断开）
    Reconnecting,   // 重连中
    Closed,         // 已关闭
}

pub struct ConnectionContext {
    pub project_id: String,
    pub server_id: Option<String>,
    pub primary_session_id: Option<String>,
    pub state: ConnectionState,
    pub active_node_ids: Vec<String>,
    pub last_error: Option<String>,
    pub last_connected_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}
```

**核心方法：**

- `register(project_id)` - 注册新连接
- `get(project_id)` - 获取连接上下文
- `update_state(project_id, state)` - 更新连接状态
- `set_error(project_id, error)` - 设置错误信息
- `bind_session(project_id, session_id)` - 绑定主 session
- `unbind_session(project_id)` - 解绑 session
- `remove(project_id)` - 移除连接
- `list_all()` - 列出所有连接
- `list_by_state(state)` - 按状态筛选连接

#### 3. SessionRegistry (session_registry.rs)

**核心类型：**

```rust
pub struct SessionInfo {
    pub session_id: String,
    pub project_id: String,
    pub created_at: i64,
    pub last_active_at: i64,
}
```

**核心方法：**

- `register(session_id, project_id)` - 注册 session
- `get(session_id)` - 获取 session 信息
- `touch(session_id)` - 更新活跃时间
- `list_by_project(project_id)` - 列出项目的所有 session
- `remove(session_id)` - 移除 session
- `remove_by_project(project_id)` - 移除项目的所有 session
- `count_by_project(project_id)` - 统计项目的 session 数量

#### 4. Tauri Commands (commands/connection.rs)

新增 13 个命令：

**ConnectionRuntime 相关：**
- `connection_register`
- `connection_get`
- `connection_update_state`
- `connection_set_error`
- `connection_bind_session`
- `connection_unbind_session`
- `connection_remove`
- `connection_list_all`
- `connection_list_by_state`

**SessionRegistry 相关：**
- `session_register`
- `session_get`
- `session_touch`
- `session_list_by_project`
- `session_remove`
- `session_remove_by_project`
- `session_count_by_project`

### 前端 (TypeScript/React)

#### 1. 类型定义 (types/connection.ts)

```typescript
export type ConnectionState =
  | "idle"
  | "connecting"
  | "active"
  | "degraded"
  | "reconnecting"
  | "closed";

export interface ConnectionContext {
  projectId: string;
  primarySessionId?: string;
  state: ConnectionState;
  lastError?: string;
  lastConnectedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMetadata {
  sessionId: string;
  projectId: string;
  createdAt: number;
  lastActiveAt: number;
}
```

#### 2. Backend API (lib/backend.ts)

新增 13 个 API 函数，与后端命令一一对应：

```typescript
// ConnectionRuntime API
export async function connectionRegister(projectId: string): Promise<ConnectionContext>
export async function connectionGet(projectId: string): Promise<ConnectionContext | null>
export async function connectionUpdateState(projectId: string, state: ConnectionState): Promise<void>
// ... 其他 API

// SessionRegistry API
export async function sessionRegister(sessionId: string, projectId: string): Promise<void>
export async function sessionGet(sessionId: string): Promise<SessionMetadata | null>
// ... 其他 API
```

#### 3. Zustand Store (store/connection-runtime.ts)

```typescript
interface ConnectionRuntimeStore {
  connections: Map<string, ConnectionContext>;
  loading: boolean;
  error: string | null;
  
  register: (projectId: string) => Promise<ConnectionContext>;
  get: (projectId: string) => Promise<ConnectionContext | null>;
  updateState: (projectId: string, state: ConnectionState) => Promise<void>;
  // ... 其他方法
}

export const useConnectionRuntime = create<ConnectionRuntimeStore>(...)
```

#### 4. Session Registry Store (store/session-registry.ts)

```typescript
interface SessionRegistryStore {
  sessions: Map<string, SessionMetadata>;
  loading: boolean;
  error: string | null;
  
  register: (sessionId: string, projectId: string) => Promise<void>;
  get: (sessionId: string) => Promise<SessionMetadata | null>;
  // ... 其他方法
}

export const useSessionRegistry = create<SessionRegistryStore>(...)
```

#### 5. 示例组件 (components/examples/ConnectionRuntimeExample.tsx)

演示如何使用 ConnectionRuntime 和 SessionRegistry：

- 连接建立流程
- 状态更新
- Session 绑定
- 重连处理
- 连接关闭

## 使用示例

### 建立连接

```typescript
const connectionRuntime = useConnectionRuntime();
const sessionRegistry = useSessionRegistry();

// 1. 注册连接上下文
const context = await connectionRuntime.register(projectId);

// 2. 更新状态为 Connecting
await connectionRuntime.updateState(projectId, "connecting");

// 3. 创建 SSH session
const sessionId = await createSSHSession(projectId);
await sessionRegistry.register(sessionId, projectId);

// 4. 绑定 session 到连接
await connectionRuntime.bindSession(projectId, sessionId);

// 5. 更新状态为 Active
await connectionRuntime.updateState(projectId, "active");
```

### 处理重连

```typescript
// 1. 更新状态为 Reconnecting
await connectionRuntime.updateState(projectId, "reconnecting");

// 2. 创建新 session
const newSessionId = await createSSHSession(projectId);
await sessionRegistry.register(newSessionId, projectId);

// 3. 绑定新 session
await connectionRuntime.bindSession(projectId, newSessionId);

// 4. 更新状态为 Active
await connectionRuntime.updateState(projectId, "active");
```

### 关闭连接

```typescript
// 1. 解绑 session
await connectionRuntime.unbindSession(projectId);

// 2. 更新状态为 Closed
await connectionRuntime.updateState(projectId, "closed");

// 3. 移除连接上下文
await connectionRuntime.remove(projectId);
```

## 文件清单

### 新增文件

**后端：**
- `src-tauri/src/runtime/mod.rs` (3 行)
- `src-tauri/src/runtime/connection_runtime.rs` (220 行)
- `src-tauri/src/runtime/session_registry.rs` (180 行)
- `src-tauri/src/commands/connection.rs` (280 行)

**前端：**
- `src/types/connection.ts` (25 行)
- `src/store/connection-runtime.ts` (180 行)
- `src/store/session-registry.ts` (150 行)
- `src/components/examples/ConnectionRuntimeExample.tsx` (150 行)

### 修改文件

**后端：**
- `src-tauri/src/lib.rs` (+1 行 mod runtime, +13 行命令注册)
- `src-tauri/src/commands/mod.rs` (+2 行)
- `src-tauri/src/commands.rs` (+2 行)

**前端：**
- `src/lib/backend.ts` (+1 行 import, +90 行 API 函数)

## 向后兼容性

✅ **完全兼容**

- 不修改任何现有代码
- 不影响现有的 SSH/Logs/AI 功能
- 新旧代码可以共存
- 可以逐步迁移

## 测试建议

1. **单元测试**
   - ConnectionRuntime 状态转换
   - SessionRegistry 注册和查询
   - 错误处理

2. **集成测试**
   - 连接建立流程
   - 重连流程
   - 多 session 管理

3. **手动测试**
   - 使用示例组件验证功能
   - 检查状态同步
   - 验证错误处理

## 后续工作

### 立即可做（不依赖其他 PR）

1. **迁移 Terminal 面板**
   - 使用 ConnectionRuntime 管理连接状态
   - 使用 SessionRegistry 注册 session
   - 显示连接状态指示器

2. **迁移 Logs 面板**
   - 使用 ConnectionRuntime 获取连接状态
   - 根据状态显示不同的 UI

3. **添加连接状态监控**
   - 实时显示所有项目的连接状态
   - 提供手动重连按钮

### 需要后续 PR 支持

1. **PR5: 引入 ConnectionContext**
   - 扩展 ConnectionContext 包含更多上下文信息
   - 支持多 node 共享同一连接

2. **PR6: 实现 ReconnectSnapshot**
   - 保存重连所需的状态
   - 实现自动重连逻辑

## 设计决策

### 为什么是"薄壳"？

1. **降低风险**
   - 不立即迁移现有代码
   - 可以独立验证新架构
   - 出问题容易回滚

2. **渐进式迁移**
   - 新旧代码可以共存
   - 可以一个模块一个模块迁移
   - 每次迁移都是独立的 PR

3. **快速验证**
   - 可以快速验证 API 设计
   - 可以快速收集反馈
   - 可以快速调整

### 为什么分离 ConnectionRuntime 和 SessionRegistry？

1. **职责分离**
   - ConnectionRuntime 管理连接生命周期
   - SessionRegistry 管理 session 元数据
   - 两者可以独立演化

2. **灵活性**
   - 一个连接可以有多个 session
   - 一个 session 可以在不同连接间迁移
   - 支持更复杂的场景

3. **可测试性**
   - 可以独立测试每个组件
   - 可以 mock 其中一个组件
   - 更容易编写单元测试

## 总结

PR3 建立了 ConnectionRuntime 和 SessionRegistry 的完整基础架构，包括：

- ✅ 完整的类型系统
- ✅ 完整的 API 接口
- ✅ 前后端同步实现
- ✅ Zustand store 集成
- ✅ 示例代码和文档
- ✅ 向后兼容

这个"薄壳"为后续的迁移工作提供了坚实的基础，同时保持了系统的稳定性和可回滚性。
