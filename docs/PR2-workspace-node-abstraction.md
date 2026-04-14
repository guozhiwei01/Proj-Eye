# PR2: Workspace Node Abstraction Layer

## 概述

引入 `workspaceNodeId` 抽象层，将 UI 从直接依赖 `sessionId` 中解耦。这为后续的重连、连接池等功能奠定基础。

## 核心概念

### WorkspaceNode

一个稳定的 UI 实体，可能由一个或多个 session 支撑。UI 绑定到 `nodeId` 而非 `sessionId`，允许后端在重连时透明地切换 session。

```typescript
interface WorkspaceNode {
  id: WorkspaceNodeId;           // 稳定的节点 ID
  projectId: string;              // 所属项目
  kind: "terminal" | "logs" | "database" | "ai";
  title: string;
  state: "idle" | "connecting" | "active" | "degraded" | "reconnecting" | "closed";
  backingSessionId?: string;      // 可选的底层 session（重连时可能为空）
  createdAt: number;
  lastActiveAt: number;
}
```

## 架构变化

### 前端

**新增文件：**
- `src/types/workspace.ts` - WorkspaceNode 类型定义
- `src/store/workspace-nodes.ts` - WorkspaceNode 状态管理（Zustand store）
- `src/lib/workspace-utils.ts` - 工具函数（生成 nodeId、解析等）
- `src/lib/workspace-node-integration.ts` - 集成示例和辅助函数

**核心 Store：**
```typescript
useWorkspaceNodes
  - nodes: Map<nodeId, WorkspaceNode>
  - bindings: Map<nodeId, NodeSessionBinding>
  - sessionToNode: Map<sessionId, nodeId>  // 反向查找
```

**新增 API（backend.ts）：**
- `registerWorkspaceNode(nodeId, projectId, kind)`
- `bindNodeToSession(nodeId, sessionId)`
- `getSessionByNode(nodeId)`
- `getNodeBySession(sessionId)`
- `updateNodeState(nodeId, state)`

### 后端

**新增文件：**
- `src-tauri/src/store/workspace_nodes.rs` - Node registry 实现
- `src-tauri/src/commands/workspace.rs` - Workspace node 命令

**核心结构：**
```rust
struct NodeRegistry {
    nodes: HashMap<String, WorkspaceNodeBinding>,
    session_to_node: HashMap<String, String>,
}
```

**新增命令：**
- `workspace_register_node`
- `workspace_bind_node_session`
- `workspace_get_session_by_node`
- `workspace_get_node_by_session`
- `workspace_update_node_state`

## 迁移路径

### 阶段 1：建立基础设施（已完成）
- ✅ 定义 WorkspaceNode 类型
- ✅ 实现前端 store
- ✅ 实现后端 registry
- ✅ 添加 backend API

### 阶段 2：Terminal 面板迁移（下一步）
将 terminal 面板从 `sessionId` 迁移到 `nodeId`：

**Before:**
```typescript
const result = await createTerminalTab(projectId, count);
const sessionId = result.session.id;
// UI 直接使用 sessionId
```

**After:**
```typescript
const nodeId = await createTerminalTabWithNode(projectId, count);
// UI 使用 nodeId，backend 内部映射到 sessionId
```

### 阶段 3：其他面板迁移
- Logs 面板
- Database 面板
- AI 面板

## 使用示例

### 创建 Terminal Tab
```typescript
import { createTerminalTabWithNode } from "../lib/workspace-node-integration";

const nodeId = await createTerminalTabWithNode(projectId, currentCount);
// nodeId 是稳定的，即使底层 session 重连也不变
```

### 写入 Terminal 输入
```typescript
import { writeTerminalInputByNode } from "../lib/workspace-node-integration";

await writeTerminalInputByNode(nodeId, "ls -la\n");
// 内部自动解析 nodeId -> sessionId
```

### 监听 Node 状态变化
```typescript
const { nodes } = useWorkspaceNodes();
const node = nodes.get(nodeId);

if (node?.state === "reconnecting") {
  // 显示重连 UI
}
```

## 优势

1. **重连友好**：UI 不需要知道底层 session 切换
2. **连接池支持**：未来可以实现多个 session 共享同一个连接
3. **状态管理清晰**：node 状态独立于 session 状态
4. **向后兼容**：旧的 sessionId API 仍然可用

## 下一步

1. 在 `workspace.ts` store 中集成 `useWorkspaceNodes`
2. 修改 `addTab()` 使用 `createTerminalTabWithNode()`
3. 修改 terminal 组件使用 `nodeId` 而非 `sessionId`
4. 更新 `writeTerminalInput`、`resizeTerminal` 等方法支持 nodeId

## 文件清单

### 前端新增
- `src/types/workspace.ts` (62 行)
- `src/store/workspace-nodes.ts` (177 行)
- `src/lib/workspace-utils.ts` (27 行)
- `src/lib/workspace-node-integration.ts` (123 行)
- `src/lib/backend.ts` (+90 行)

### 后端新增
- `src-tauri/src/store/workspace_nodes.rs` (165 行)
- `src-tauri/src/commands/workspace.rs` (72 行)
- `src-tauri/src/store/mod.rs` (+1 行)
- `src-tauri/src/commands.rs` (+2 行)
- `src-tauri/src/lib.rs` (+5 命令)

### 修改
- `src/types/models.ts` - SessionSummary 添加 `nodeId?` 字段

## 完成标准

- ✅ WorkspaceNode 类型定义完成
- ✅ 前端 store 实现完成
- ✅ 后端 registry 实现完成
- ✅ Backend API 添加完成
- ✅ 集成示例代码完成
- ⏳ Terminal 面板实际迁移（留待后续 PR）
- ⏳ 其他面板迁移（留待后续 PR）

## 注意事项

1. **渐进式迁移**：不要一次性改所有代码，先让 terminal 走通
2. **保持兼容**：旧的 sessionId API 保留，新旧代码可以共存
3. **测试重点**：node 创建、绑定、解绑、状态更新
4. **性能考虑**：Map 查找是 O(1)，不会影响性能
