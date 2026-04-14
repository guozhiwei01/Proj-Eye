# 下一步行动计划

## 立即可做（今天/明天）

### 1. 验证已完成的工作

**检查编译：**
```bash
cd src-tauri
cargo check
cargo clippy
```

**检查前端：**
```bash
npm run build
```

**预期结果：**
- ✅ Rust 编译通过
- ✅ TypeScript 类型检查通过
- ✅ 没有 clippy 警告

---

### 2. 快速集成测试

**测试 AI 上下文构建：**
```typescript
// 在浏览器控制台测试
import { buildProjectContext } from "./lib/ai";

const context = buildProjectContext("your-project-id");
console.log("Context:", context);
console.log("Anomalies:", context.anomalySummary);
console.log("Recent commands:", context.recentCommands);
```

**测试 Workspace Node：**
```typescript
import { useWorkspaceNodes } from "./store/workspace-nodes";
import { generateNodeId } from "./lib/workspace-utils";

const nodeId = generateNodeId("terminal", "test-project");
const { registerNode } = useWorkspaceNodes.getState();

registerNode({
  id: nodeId,
  projectId: "test-project",
  kind: "terminal",
  title: "Test Terminal",
  state: "idle",
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
});

console.log("Registered nodes:", useWorkspaceNodes.getState().nodes);
```

---

## 本周内完成

### PR3: 建立 ConnectionRuntime 薄壳

**预计时间：** 2-3 小时

**步骤：**

1. **创建基础结构（30 分钟）**
```bash
mkdir -p src-tauri/src/runtime
touch src-tauri/src/runtime/mod.rs
touch src-tauri/src/runtime/connection_runtime.rs
touch src-tauri/src/runtime/session_registry.rs
```

2. **定义核心类型（30 分钟）**
```rust
// connection_runtime.rs
pub enum ConnectionState {
    Connecting,
    Active,
    Degraded,
    Reconnecting,
    Closed,
}

pub struct ConnectionContext {
    pub project_id: String,
    pub primary_session_id: Option<String>,
    pub state: ConnectionState,
    pub last_error: Option<String>,
    pub last_connected_at: Option<u64>,
}
```

3. **实现 Registry（1 小时）**
```rust
pub struct ConnectionRegistry {
    connections: HashMap<String, ConnectionContext>,
}

impl ConnectionRegistry {
    pub fn register_connection(&mut self, ctx: ConnectionContext) { }
    pub fn get_connection(&self, project_id: &str) -> Option<&ConnectionContext> { }
    pub fn update_state(&mut self, project_id: &str, state: ConnectionState) { }
}
```

4. **添加命令接口（30 分钟）**
```rust
// commands/connection.rs
#[tauri::command]
pub fn connection_get_state(project_id: String) -> Result<String, String> { }

#[tauri::command]
pub fn connection_update_state(project_id: String, state: String) -> Result<(), String> { }
```

5. **前端集成（30 分钟）**
```typescript
// lib/backend.ts
export async function getConnectionState(projectId: string): Promise<string> { }
export async function updateConnectionState(projectId: string, state: string): Promise<void> { }
```

**完成标准：**
- [ ] Rust 编译通过
- [ ] 前端类型检查通过
- [ ] 能够注册和查询连接状态
- [ ] 有基础文档

---

### 实际集成：Terminal 面板迁移到 nodeId

**预计时间：** 3-4 小时

**步骤：**

1. **修改 workspace.ts store（1 小时）**
```typescript
// 在 addTab 中使用 nodeId
addTab: async (projectId: string) => {
  const count = get().terminalTabs.filter(t => t.projectId === projectId).length;
  
  // 使用新的集成函数
  const nodeId = await createTerminalTabWithNode(projectId, count);
  
  // 更新 UI 状态
  // ...
}
```

2. **修改 Terminal 组件（1 小时）**
```typescript
// 组件接收 nodeId 而非 sessionId
interface TerminalPanelProps {
  nodeId: string;  // 改为 nodeId
}

// 内部解析 sessionId
const { getSessionIdByNode } = useWorkspaceNodes();
const sessionId = getSessionIdByNode(nodeId);
```

3. **更新相关操作（1 小时）**
```typescript
// writeTerminalInput, resizeTerminal, closeTerminal
// 都改为使用 nodeId
```

4. **测试（1 小时）**
- [ ] 创建 terminal tab
- [ ] 输入命令
- [ ] 调整大小
- [ ] 关闭 tab
- [ ] 切换 tab

**完成标准：**
- [ ] Terminal 面板完全使用 nodeId
- [ ] 所有操作正常工作
- [ ] 没有引入新 bug

---

### 实际集成：AI 面板添加动作按钮

**预计时间：** 2-3 小时

**步骤：**

1. **创建 AIActionPanel 组件（1 小时）**
```typescript
// src/components/AIActionPanel.tsx
import { explainAnomalies, quickHealthCheck } from "../lib/ai";

export function AIActionPanel({ projectId }: { projectId: string }) {
  return (
    <div className="ai-actions">
      <button onClick={() => handleExplainAnomalies()}>
        🔍 解释异常
      </button>
      <button onClick={() => handleHealthCheck()}>
        ❤️ 健康检查
      </button>
    </div>
  );
}
```

2. **集成到现有 AI 面板（30 分钟）**
```typescript
// 在 AIOverlay 或相关组件中添加
<AIActionPanel projectId={projectId} />
```

3. **样式调整（30 分钟）**
```css
.ai-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.ai-actions button {
  /* 样式 */
}
```

4. **测试（30 分钟）**
- [ ] 点击"解释异常"按钮
- [ ] 点击"健康检查"按钮
- [ ] 查看结果显示

**完成标准：**
- [ ] AI 面板有动作按钮
- [ ] 按钮功能正常
- [ ] UI 美观

---

## 下周计划

### 1. 实现自动异常检测通知

**功能：**
- 每 10 秒检查一次日志异常
- 发现新异常时弹出通知
- 点击通知跳转到日志面板

**实现：**
```typescript
// src/hooks/useAnomalyDetection.ts
export function useAnomalyDetection(projectId: string) {
  useEffect(() => {
    const interval = setInterval(async () => {
      const context = buildProjectContext(projectId, {
        includeAnomalies: true,
        maxLogLines: 50,
      });

      if (context.anomalySummary.length > 0) {
        showNotification({
          title: "检测到异常",
          message: `发现 ${context.anomalySummary.length} 个异常`,
          onClick: () => navigateToLogs(),
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [projectId]);
}
```

---

### 2. 实现 ReconnectSnapshot（轻量版）

**功能：**
- 连接断开时保存快照
- 重连后恢复工作区状态

**快照内容：**
```typescript
interface ReconnectSnapshot {
  projectId: string;
  activeNodeIds: string[];
  activeLogSources: string[];
  lastAiPrompt?: string;
  terminalTabs: Array<{
    nodeId: string;
    title: string;
  }>;
  capturedAt: number;
}
```

**实现步骤：**
1. 在连接断开时捕获快照
2. 存储到 localStorage
3. 重连时读取快照
4. 恢复 terminal tabs
5. 恢复 log panels
6. 恢复 AI 上下文

---

### 3. 添加单元测试

**测试覆盖：**

**Context Builder 测试：**
```typescript
describe("buildProjectContext", () => {
  it("should detect anomalies", () => {
    const context = buildProjectContext(mockProjectId);
    expect(context.anomalySummary.length).toBeGreaterThan(0);
  });

  it("should extract recent commands", () => {
    const context = buildProjectContext(mockProjectId);
    expect(context.recentCommands).toContain("npm start");
  });

  it("should count log levels", () => {
    const context = buildProjectContext(mockProjectId);
    expect(context.logErrorCount).toBe(5);
    expect(context.logWarningCount).toBe(12);
  });
});
```

**Workspace Nodes 测试：**
```typescript
describe("useWorkspaceNodes", () => {
  it("should register node", () => {
    const { registerNode, nodes } = useWorkspaceNodes.getState();
    registerNode(mockNode);
    expect(nodes.get(mockNode.id)).toBeDefined();
  });

  it("should bind node to session", () => {
    const { bindNodeToSession, getSessionIdByNode } = useWorkspaceNodes.getState();
    bindNodeToSession(nodeId, sessionId);
    expect(getSessionIdByNode(nodeId)).toBe(sessionId);
  });
});
```

---

## 一个月内完成

### 1. 引入 ConnectionContext

**目标：**
- 所有工作区模块共享同一个连接上下文
- 切换项目时整个 workspace 跟着切

**实现：**
```typescript
interface ConnectionContext {
  projectId: string;
  serverId?: string;
  state: "connecting" | "active" | "degraded" | "reconnecting" | "closed";
  activeNodeIds: string[];
  lastConnectedAt?: number;
}
```

---

### 2. 完整的重连流程

**流程：**
1. 检测连接断开
2. 捕获快照
3. 尝试重连
4. 恢复 terminal tabs
5. 恢复 log panels
6. 恢复 AI 上下文
7. 标记验证完成

---

### 3. 文档和 README 收口

**更新内容：**
- 产品名统一为 `Proj-Eye`
- 更新架构图
- 更新技术选型说明
- 添加开发指南
- 添加贡献指南

---

## 优先级排序

### P0（必须做）
1. ✅ 验证已完成工作编译通过
2. ⏳ PR3: ConnectionRuntime
3. ⏳ Terminal 面板迁移到 nodeId

### P1（应该做）
1. ⏳ AI 面板添加动作按钮
2. ⏳ 自动异常检测通知
3. ⏳ 基础单元测试

### P2（可以做）
1. ⏳ ReconnectSnapshot
2. ⏳ ConnectionContext
3. ⏳ 文档收口

---

## 风险和注意事项

### 风险

1. **Terminal 面板迁移可能影响现有功能**
   - 缓解：充分测试，保持向后兼容
   - 回滚：保留旧代码路径

2. **自动异常检测可能产生噪音**
   - 缓解：添加频率限制和去重
   - 调整：可配置的检测间隔

3. **性能影响未知**
   - 缓解：添加性能监控
   - 优化：按需加载，懒计算

### 注意事项

1. **保持向后兼容**
   - 所有改动都要考虑兼容性
   - 新旧代码可以共存

2. **小步快跑**
   - 每个功能独立完成
   - 快速验证，快速迭代

3. **文档同步**
   - 代码改动同步更新文档
   - 保持文档和代码一致

---

## 成功标准

### 本周
- [ ] PR3 完成
- [ ] Terminal 面板迁移完成
- [ ] AI 动作按钮可用
- [ ] 没有引入新 bug

### 下周
- [ ] 自动异常检测工作
- [ ] 基础测试覆盖
- [ ] ReconnectSnapshot 原型

### 一个月
- [ ] 所有核心功能迁移完成
- [ ] 重连流程稳定
- [ ] 文档完善
- [ ] 测试覆盖 > 60%

---

## 资源

### 文档
- [快速参考](./quick-reference.md)
- [PR2 文档](./PR2-workspace-node-abstraction.md)
- [PR4 文档](./PR4-ai-context-unification.md)
- [第一周总结](./week1-summary.md)

### 示例代码
- `src/lib/workspace-node-integration.ts`
- `src/components/examples/AIActionExamples.tsx`
- `src/lib/ai/migration-guide.ts`

### 工具
- `cargo check` - Rust 编译检查
- `cargo clippy` - Rust lint
- `npm run build` - 前端构建
- `npm run dev` - 开发服务器

---

## 联系和反馈

如果遇到问题或需要帮助：
1. 查看快速参考文档
2. 查看相关 PR 文档
3. 查看示例代码
4. 提出具体问题

祝重构顺利！🚀
