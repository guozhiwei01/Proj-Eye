# 快速参考指南

## 已完成的 PR 快速查阅

### PR1: Commands 模块化

**位置：** `src-tauri/src/commands/`

**使用：**
```rust
// 所有命令已按领域分类
commands/
  ├── app.rs          // 应用生命周期
  ├── config.rs       // 配置 CRUD
  ├── secure.rs       // 凭证管理
  ├── ssh.rs          // SSH 和终端
  ├── logs.rs         // 日志
  ├── database.rs     // 数据库
  ├── ai.rs           // AI
  ├── diagnostics.rs  // 诊断
  └── workspace.rs    // 工作区节点
```

**添加新命令：**
1. 在对应模块添加函数
2. 在 `commands.rs` 中 re-export
3. 在 `lib.rs` 的 `generate_handler![]` 中注册

---

### PR2: Workspace Node 抽象

**前端使用：**
```typescript
import { useWorkspaceNodes } from "../store/workspace-nodes";
import { generateNodeId } from "../lib/workspace-utils";
import { 
  registerWorkspaceNode, 
  bindNodeToSession 
} from "../lib/backend";

// 1. 生成 nodeId
const nodeId = generateNodeId("terminal", projectId);

// 2. 注册节点
const { registerNode, bindNodeToSession } = useWorkspaceNodes.getState();
registerNode({
  id: nodeId,
  projectId,
  kind: "terminal",
  title: "Terminal 1",
  state: "connecting",
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
});

// 3. 后端注册
await registerWorkspaceNode(nodeId, projectId, "terminal");

// 4. 创建 session 并绑定
const result = await createTerminalTab(projectId, count);
bindNodeToSession(nodeId, result.session.id);
await bindNodeToSession(nodeId, result.session.id);

// 5. 使用 nodeId 操作
const sessionId = getSessionIdByNode(nodeId);
await writeSessionInput(sessionId, "ls\n");
```

**后端使用：**
```rust
use crate::store::workspace_nodes;

// 注册节点
workspace_nodes::register_node(binding)?;

// 绑定 session
workspace_nodes::bind_session(&node_id, &session_id)?;

// 查询
let session_id = workspace_nodes::get_session_by_node(&node_id)?;
let node_id = workspace_nodes::get_node_by_session(&session_id)?;
```

---

### PR4: AI 上下文统一

**基础用法：**
```typescript
import { buildProjectContext, toLegacyContextPack } from "../lib/ai";

// 收集上下文
const context = buildProjectContext(projectId, {
  includeAnomalies: true,
  includeRecentCommands: true,
  maxLogLines: 20,
});

// 查看增强字段
console.log("Anomalies:", context.anomalySummary);
console.log("Recent commands:", context.recentCommands);
console.log("Error count:", context.logErrorCount);

// 调用后端（向后兼容）
const legacyContext = toLegacyContextPack(context);
await analyzeProject(projectId, legacyContext);
```

**动作用法：**
```typescript
import { 
  explainAnomalies, 
  suggestCommand, 
  quickHealthCheck 
} from "../lib/ai";

// 解释异常
const { explanation, suggestion } = await explainAnomalies(projectId);

// 建议命令
const { suggestion, reasoning } = await suggestCommand(
  projectId, 
  "restart nginx"
);

// 健康检查
const { status, summary, details } = await quickHealthCheck(projectId);
```

**UI 集成：**
```typescript
import { AIActionButtons } from "../components/examples/AIActionExamples";

<AIActionButtons projectId={projectId} sessionId={sessionId} />
```

---

## 常见任务速查

### 添加新的 Tauri 命令

1. **在对应模块添加函数**
```rust
// src-tauri/src/commands/ssh.rs
#[tauri::command]
pub fn ssh_new_command(app: AppHandle, param: String) -> Result<Value, String> {
    runtime::new_operation(&app, &param)
}
```

2. **Re-export**
```rust
// src-tauri/src/commands.rs
pub use ssh::*;
```

3. **注册命令**
```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::ssh_new_command
])
```

4. **前端调用**
```typescript
// src/lib/backend.ts
export async function newCommand(param: string): Promise<any> {
  return withBackend("ssh_new_command", { param }, () => 
    localBackend.newCommand(param)
  );
}
```

---

### 添加新的 Workspace Node 类型

1. **更新类型定义**
```typescript
// src/types/workspace.ts
export const WorkspaceNodeKind = {
  Terminal: "terminal",
  Logs: "logs",
  Database: "database",
  AI: "ai",
  NewType: "newtype",  // 新增
} as const;
```

2. **后端支持**
```rust
// src-tauri/src/store/workspace_nodes.rs
pub enum WorkspaceNodeKind {
    Terminal,
    Logs,
    Database,
    AI,
    NewType,  // 新增
}
```

3. **使用**
```typescript
const nodeId = generateNodeId("newtype", projectId);
await registerWorkspaceNode(nodeId, projectId, "newtype");
```

---

### 添加新的 AI 动作

1. **在 actions.ts 添加函数**
```typescript
// src/lib/ai/actions.ts
export async function newAction(projectId: string): Promise<Result> {
  const context = buildProjectContext(projectId);
  const legacyContext = toLegacyContextPack(context);
  
  // 调用后端或处理逻辑
  const response = await analyzeProject(projectId, legacyContext);
  
  return {
    // 返回结果
  };
}
```

2. **导出**
```typescript
// src/lib/ai/index.ts
export { newAction } from "./actions";
```

3. **使用**
```typescript
import { newAction } from "../lib/ai";

const result = await newAction(projectId);
```

---

## 目录结构速查

```
Proj-Eye/
├── src/                          # 前端
│   ├── types/
│   │   ├── models.ts            # 核心类型定义
│   │   └── workspace.ts         # WorkspaceNode 类型 (PR2)
│   ├── store/
│   │   ├── app.ts               # 应用状态
│   │   ├── workspace.ts         # 工作区状态
│   │   ├── workspace-nodes.ts   # Node registry (PR2)
│   │   ├── ai.ts                # AI 状态
│   │   └── panels.ts            # 面板状态
│   ├── lib/
│   │   ├── backend.ts           # Backend API 封装
│   │   ├── workspace-utils.ts   # Node 工具函数 (PR2)
│   │   ├── workspace-node-integration.ts  # Node 集成示例 (PR2)
│   │   └── ai/                  # AI 模块 (PR4)
│   │       ├── context-builder.ts
│   │       ├── actions.ts
│   │       ├── index.ts
│   │       └── migration-guide.ts
│   └── components/
│       └── examples/
│           └── AIActionExamples.tsx  # AI 动作示例 (PR4)
│
├── src-tauri/                    # 后端
│   └── src/
│       ├── commands/             # 命令模块 (PR1)
│       │   ├── mod.rs
│       │   ├── app.rs
│       │   ├── config.rs
│       │   ├── secure.rs
│       │   ├── ssh.rs
│       │   ├── logs.rs
│       │   ├── database.rs
│       │   ├── ai.rs
│       │   ├── diagnostics.rs
│       │   ├── workspace.rs     # (PR2)
│       │   └── README.md
│       ├── store/
│       │   ├── config.rs
│       │   ├── runtime.rs
│       │   ├── secure.rs
│       │   ├── diagnostics.rs
│       │   └── workspace_nodes.rs  # (PR2)
│       ├── commands.rs           # Re-export
│       ├── lib.rs                # 命令注册
│       └── main.rs
│
└── docs/                         # 文档
    ├── PR2-workspace-node-abstraction.md
    ├── PR4-ai-context-unification.md
    └── week1-summary.md
```

---

## 调试技巧

### 查看 Node 绑定状态

```typescript
// 前端
const { nodes, bindings, sessionToNode } = useWorkspaceNodes.getState();
console.log("All nodes:", Array.from(nodes.values()));
console.log("All bindings:", Array.from(bindings.values()));
console.log("Session to node map:", Array.from(sessionToNode.entries()));
```

### 查看 AI 上下文

```typescript
const context = buildProjectContext(projectId);
console.log("Full context:", context);
console.log("Anomalies:", context.anomalySummary);
console.log("Recent commands:", context.recentCommands);
console.log("Stats:", {
  errors: context.logErrorCount,
  warnings: context.logWarningCount,
  hasSession: context.hasActiveSession,
});
```

### 后端日志

```rust
// 在 Rust 代码中添加日志
eprintln!("Debug: node_id = {}, session_id = {}", node_id, session_id);
```

---

## 常见问题

### Q: 如何从 sessionId 迁移到 nodeId？

**A:** 使用 PR2 提供的集成函数：
```typescript
import { 
  createTerminalTabWithNode,
  writeTerminalInputByNode,
  resizeTerminalByNode,
  closeTerminalByNode
} from "../lib/workspace-node-integration";

// 旧方式
await writeSessionInput(sessionId, data);

// 新方式
await writeTerminalInputByNode(nodeId, data);
```

### Q: 如何让 AI 自动检测异常？

**A:** 使用 PR4 提供的组件：
```typescript
import { AutoAnomalyDetector } from "../components/examples/AIActionExamples";

<AutoAnomalyDetector
  projectId={projectId}
  onAnomaliesDetected={(anomalies) => {
    showNotification(`检测到 ${anomalies.length} 个异常`);
  }}
/>
```

### Q: 如何添加新的命令模块？

**A:** 
1. 在 `src-tauri/src/commands/` 创建新文件
2. 在 `commands.rs` 添加 `mod` 和 `pub use`
3. 在 `lib.rs` 注册命令

### Q: 向后兼容如何保证？

**A:** 
- PR2: 旧的 sessionId API 仍然可用
- PR4: `toLegacyContextPack()` 转换为旧格式
- 所有新功能都是增量添加，不破坏现有代码

---

## 下一步参考

### PR3: ConnectionRuntime（待实现）

**目标文件：**
```
src-tauri/src/runtime/
  ├── connection_runtime.rs
  ├── session_registry.rs
  └── mod.rs
```

**核心概念：**
```rust
enum ConnectionState {
    Connecting,
    Active,
    Degraded,
    Reconnecting,
    Closed,
}

struct ConnectionContext {
    project_id: String,
    primary_session_id: Option<String>,
    state: ConnectionState,
    last_error: Option<String>,
}
```

---

## 相关文档

- [PR2 详细文档](./PR2-workspace-node-abstraction.md)
- [PR4 详细文档](./PR4-ai-context-unification.md)
- [第一周总结](./week1-summary.md)
- [Commands README](../src-tauri/src/commands/README.md)
