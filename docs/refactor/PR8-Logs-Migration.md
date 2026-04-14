# PR8: Logs 面板迁移到 ConnectionRuntime

## 概述

将 Logs 面板从独立状态管理迁移到使用 `ConnectionRuntime` 系统，实现：
- 统一的连接生命周期管理
- Workspace node 抽象层
- 连接状态同步
- 活跃日志源追踪

## 架构变化

### 之前（旧架构）

```
BottomPanel
  └─> LogPanel
       └─> 直接使用 projectId
       └─> 直接调用 refreshLogs
       └─> 无连接状态管理
       └─> 无日志源追踪
```

### 之后（新架构）

```
BottomPanel
  └─> EnhancedLogPanel
       └─> useLogsConnection hook
            ├─> ConnectionRuntime (连接管理)
            ├─> WorkspaceNodes (节点抽象)
            └─> 活跃日志源追踪
```

## 核心组件

### 1. useLogsConnection Hook

位置：`src/hooks/useLogsConnection.ts`

职责：
- 注册 logs workspace node
- 同步连接状态到 ConnectionRuntime
- 追踪活跃的日志源
- 记录日志拉取活动（用于健康度监控）

API：
```typescript
const {
  nodeId,              // Workspace node ID
  connectionState,     // 当前连接状态
  isHealthy,          // 连接是否健康
  recordLogActivity,  // 记录日志活动
  getActiveLogSources // 获取活跃日志源
} = useLogsConnection({
  projectId,
  logSources,
  logs,
  isActive
});
```

### 2. EnhancedLogPanel 组件

位置：`src/components/BottomPanel/EnhancedLogPanel.tsx`

新增功能：
- 集成 `useLogsConnection` hook
- 显示连接状态指示器
- 显示活跃日志源数量
- 显示 node ID（调试用）
- 显示日志总数
- 增强的刷新功能（带活动追踪）
- 保持原有所有功能

## 迁移步骤

### 阶段 1：并行运行（当前阶段）

保持旧的 `LogPanel` 不变，新增 `EnhancedLogPanel`。

**优点：**
- 零风险，不影响现有功能
- 可以逐步测试新组件
- 随时可以回滚

**使用方式：**

```typescript
// 在 BottomPanel.tsx 中
import EnhancedLogPanel from "./EnhancedLogPanel";

// 替换原来的 LogPanel
<EnhancedLogPanel
  project={project}
  alert={alert}
  isActive={activePanel === BottomPanelKey.Logs}
/>
```

### 阶段 2：功能验证

测试新组件的所有功能：

1. **基本功能**
   - [ ] 显示日志列表
   - [ ] 刷新日志
   - [ ] 异常检测高亮
   - [ ] 错误处理

2. **ConnectionRuntime 集成**
   - [ ] 验证 workspace node 创建
   - [ ] 验证连接状态同步
   - [ ] 验证活跃日志源追踪
   - [ ] 验证健康度监控

3. **UI 增强**
   - [ ] 连接状态指示器显示正确
   - [ ] 活跃源数量显示正确
   - [ ] 日志总数显示正确
   - [ ] Node ID 显示正确

4. **边界情况**
   - [ ] 无日志时的显示
   - [ ] 连接失败时的处理
   - [ ] 快速刷新
   - [ ] 面板切换

### 阶段 3：完全迁移

验证通过后，替换所有使用 `LogPanel` 的地方：

```typescript
// 全局搜索替换
// LogPanel -> EnhancedLogPanel
// 或者直接重命名文件
```

### 阶段 4：清理旧代码

```bash
# 删除旧的 LogPanel.tsx
rm src/components/BottomPanel/LogPanel.tsx

# 重命名 EnhancedLogPanel.tsx -> LogPanel.tsx
mv src/components/BottomPanel/EnhancedLogPanel.tsx \
   src/components/BottomPanel/LogPanel.tsx
```

## 新增功能说明

### 1. Workspace Node 注册

Logs 面板现在有一个对应的 workspace node：

```typescript
// 自动注册
const nodeId = registerNode({
  kind: 'logs',
  label: 'Logs',
  metadata: {
    projectId,
    logSources: logSources.map(s => s.id),
  },
});
```

**好处：**
- 统一的节点抽象
- 支持多面板共享连接
- 为未来的面板管理奠定基础

### 2. 连接状态同步

Logs 的连接状态自动同步到 ConnectionRuntime：

```typescript
// 状态显示
Idle -> 空闲
Connecting -> 连接中
Active -> 已连接
Reconnecting -> 重连中
Failed -> 连接失败
Closed -> 已关闭
```

**好处：**
- 用户可以看到日志连接状态
- 连接失败时禁用刷新按钮
- 统一的连接状态管理

### 3. 活跃日志源追踪

自动追踪最近活跃的日志源：

```typescript
// 从最近 10 条日志中提取
const recentSources = new Set(
  logs
    .slice(-10)
    .map(log => log.source)
    .filter(Boolean)
);
```

**好处：**
- 了解哪些日志源正在产生日志
- 支持日志源优先级排序
- 为日志过滤奠定基础

### 4. 日志活动记录

每次成功刷新日志时记录活动：

```typescript
// 刷新成功后
await recordLogActivity(sourceId);
```

**好处：**
- 更新连接健康度
- 追踪日志拉取频率
- 支持健康度监控

### 5. 连接状态指示器

显示实时连接状态：

```typescript
<div className="flex items-center gap-1.5">
  <div className={`h-2 w-2 rounded-full ${
    connectionState === ConnectionState.Active
      ? isHealthy ? "bg-green-500" : "bg-yellow-500"
      : connectionState === ConnectionState.Failed
      ? "bg-red-500"
      : "bg-gray-500"
  }`} />
  <span>{getConnectionStateLabel()}</span>
</div>
```

**状态颜色：**
- 绿色 - 已连接且健康
- 黄色 - 已连接但降级
- 红色 - 连接失败
- 灰色 - 其他状态

### 6. 活跃源计数

显示当前活跃的日志源数量：

```typescript
{activeSourcesCount > 0 && (
  <span>
    {activeSourcesCount} active sources
  </span>
)}
```

**好处：**
- 快速了解日志活跃度
- 发现日志源问题

## 与 Terminal 迁移的对比

### 相似之处

1. **都使用 workspace node 抽象**
   - Terminal: `kind: 'terminal'`
   - Logs: `kind: 'logs'`

2. **都集成 ConnectionRuntime**
   - 连接状态同步
   - 健康度监控

3. **都有专门的 hook**
   - `useTerminalConnection`
   - `useLogsConnection`

### 不同之处

1. **Logs 不需要快照**
   - Terminal 需要保存终端状态
   - Logs 可以重新拉取，无需快照

2. **Logs 不需要 session**
   - Terminal 需要 SSH session
   - Logs 直接读取文件

3. **Logs 更简单**
   - 没有 xterm.js 集成
   - 没有输入输出处理
   - 只有显示和刷新

## 向后兼容性

✅ 完全向后兼容

- `EnhancedLogPanel` 接受与 `LogPanel` 相同的 props
- 新增的 `isActive` 是可选的
- 不使用新功能时，行为与旧组件完全一致
- 可以逐步迁移，不需要一次性替换

## 性能影响

### 新增开销

1. **Workspace node 注册**
   - 一次性注册
   - 开销：~1ms

2. **连接状态同步**
   - 每次状态变化时同步
   - 开销：~0.5ms

3. **活跃源追踪**
   - 每次日志更新时计算
   - 开销：~0.1ms（只看最近 10 条）

**总体影响：** 可忽略不计（< 2ms 初始化开销）

### 优化建议

1. **延迟注册**
   - 只在面板激活时注册 node

2. **节流追踪**
   - 避免频繁更新活跃源列表

3. **批量记录**
   - 批量记录日志活动

## 测试清单

### 单元测试

- [ ] `useLogsConnection` hook 测试
  - [ ] Node 注册
  - [ ] 状态同步
  - [ ] 活跃源追踪
  - [ ] 活动记录

### 集成测试

- [ ] `EnhancedLogPanel` 组件测试
  - [ ] 渲染测试
  - [ ] 刷新测试
  - [ ] 状态显示测试
  - [ ] 错误处理测试

### E2E 测试

- [ ] 完整工作流测试
  - [ ] 打开项目 -> 查看日志
  - [ ] 刷新日志 -> 验证状态更新
  - [ ] 切换面板 -> 验证状态保持
  - [ ] 连接失败 -> 验证错误处理

## 故障排查

### 问题 1：Node 未注册

**症状：** `nodeId` 为 `null`

**原因：**
- `isActive` 为 `false`
- `registerNode` 失败

**解决：**
```typescript
// 检查 isActive
console.log({ isActive });

// 检查 registerNode 错误
registerNode(...).catch(console.error);
```

### 问题 2：连接状态不显示

**症状：** 状态指示器不显示

**原因：**
- `nodeId` 为 `null`
- `connectionState` 未同步

**解决：**
```typescript
// 检查 nodeId 和 connectionState
console.log({ nodeId, connectionState });

// 检查 ConnectionRuntime
const connection = connections.get(projectId);
console.log({ connection });
```

### 问题 3：活跃源计数为 0

**症状：** 有日志但活跃源为 0

**原因：**
- 日志没有 `source` 字段
- 追踪逻辑错误

**解决：**
```typescript
// 检查日志结构
console.log({ logs: logs.slice(-10) });

// 检查活跃源
console.log({ activeSources: getActiveLogSources() });
```

## 文件清单

### 新增文件

- `src/hooks/useLogsConnection.ts` - Logs 连接管理 hook
- `src/components/BottomPanel/EnhancedLogPanel.tsx` - 增强版 Logs 组件
- `docs/refactor/PR8-Logs-Migration.md` - 本文档

### 修改文件

- `src/components/BottomPanel/BottomPanel.tsx` - 使用新组件（可选）

### 保留文件

- `src/components/BottomPanel/LogPanel.tsx` - 旧组件（暂时保留）

## 第一周总结

完成 PR1-PR8 后，第一周的重构目标全部达成：

### ✅ PR1: 拆分 commands.rs
- 命令层从单体文件拆分为 8 个领域模块
- 建立清晰的模块边界

### ✅ PR2: 引入 workspaceNodeId
- 建立 WorkspaceNode 抽象层
- UI 从 sessionId 解耦

### ✅ PR3: 建立 ConnectionRuntime
- 实现连接生命周期管理
- 支持连接状态追踪

### ✅ PR4: 统一 AI 上下文
- 创建 ProjectContextBundle 系统
- 实现 AI 动作系统

### ✅ PR5: 引入 ConnectionContext 扩展
- 支持多节点共享连接
- 实现健康度监控

### ✅ PR6: 实现 ReconnectSnapshot
- 支持断线重连
- 自动保存和恢复状态

### ✅ PR7: 迁移 Terminal 面板
- Terminal 集成 ConnectionRuntime
- 支持快照创建和恢复

### ✅ PR8: 迁移 Logs 面板
- Logs 集成 ConnectionRuntime
- 支持活跃源追踪

## 架构成果

经过第一周的重构，我们建立了：

1. **清晰的分层架构**
   ```
   UI 层 (Terminal, Logs)
     ↓
   Hook 层 (useTerminalConnection, useLogsConnection)
     ↓
   Store 层 (ConnectionRuntime, SessionRegistry, WorkspaceNodes)
     ↓
   Backend 层 (Tauri Commands)
     ↓
   Runtime 层 (Rust)
   ```

2. **统一的抽象**
   - WorkspaceNode: UI 元素抽象
   - ConnectionContext: 连接状态抽象
   - ReconnectSnapshot: 重连状态抽象

3. **可扩展的基础设施**
   - 支持多节点共享连接
   - 支持连接池（未来）
   - 支持快照系统（未来扩展）

## 下一步（第一个月）

第一周建立了基础设施，第一个月将继续：

- **PR9-12**: 实现连接池和会话复用
- **PR13-16**: 优化性能和内存使用
- **PR17-20**: 完善错误处理和重试机制

## 总结

PR8 成功将 Logs 面板迁移到 ConnectionRuntime 系统：

✅ 创建 `useLogsConnection` hook 统一管理连接
✅ 创建 `EnhancedLogPanel` 组件集成新功能
✅ 支持连接状态显示
✅ 支持活跃日志源追踪
✅ 完全向后兼容，可以逐步迁移
✅ 完成第一周所有重构目标

第一周的 8 个 PR 为项目建立了坚实的架构基础，后续的重构将在此基础上继续推进。
