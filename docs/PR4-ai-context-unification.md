# PR4: 统一 AI 上下文对象 ProjectContextBundle

## 概述

将 AI 上下文收集逻辑从 `ai.ts` store 中抽离，建立统一的 `ProjectContextBundle` 系统。同时将 AI 从"聊天框"模式转变为"动作"模式，提供更直观的工作流。

## 问题

### 当前架构的痛点

1. **上下文收集分散**
   - `buildContext()` 函数内嵌在 `ai.ts` 中
   - 每次调用需要手动传递 `projectName` 和 `databaseSummary`
   - 难以复用和测试

2. **上下文信息不足**
   - 只收集基础的 terminal/logs/database 信息
   - 缺少异常检测
   - 缺少最近命令历史
   - 缺少元数据（错误数、警告数等）

3. **AI 交互模式单一**
   - 只有聊天框界面
   - 用户需要手动描述问题
   - 缺少快捷操作

## 解决方案

### 1. 统一上下文构建器

**新增文件：** `src/lib/ai/context-builder.ts`

**核心类型：**
```typescript
interface ProjectContextBundle extends AiContextPack {
  // 基础字段（兼容旧 AiContextPack）
  projectId: string;
  projectName: string;
  terminalSnippet: string[];
  commandOutputSnippet?: string[];
  logSnippet: string[];
  databaseSummary: string[];
  traceId?: string;

  // 增强字段
  anomalySummary: string[];           // 自动检测的异常
  recentCommands: string[];           // 最近执行的命令
  currentWorkingDirectory?: string;   // 当前工作目录
  connectionState: string;            // 连接状态
  logErrorCount: number;              // 错误日志数量
  logWarningCount: number;            // 警告日志数量
  hasActiveSession: boolean;          // 是否有活跃 session
  contextCollectedAt: number;         // 上下文收集时间戳
}
```

**核心函数：**
```typescript
// 通用上下文构建
buildProjectContext(projectId, options?)

// 命令执行上下文
buildCommandContext(projectId, sessionId, transcriptStartIndex, bufferStartLength)

// 分析上下文
buildAnalysisContext(projectId)

// 转换为旧格式（向后兼容）
toLegacyContextPack(bundle)
```

**特性：**
- ✅ 自动异常检测（基于关键词）
- ✅ 自动提取最近命令
- ✅ 自动统计日志级别
- ✅ 灵活的选项配置
- ✅ 向后兼容旧 API

### 2. AI 动作系统

**新增文件：** `src/lib/ai/actions.ts`

**核心动作：**

```typescript
// 解释当前异常
explainAnomalies(projectId)
  → { explanation, suggestion }

// 根据意图建议命令
suggestCommand(projectId, intent)
  → { suggestion, reasoning }

// 分析命令输出
analyzeCommandOutput(projectId, sessionId, ...)
  → { analysis, hasIssues, nextSteps }

// 快速健康检查
quickHealthCheck(projectId)
  → { status, summary, details }

// 确认并执行命令
confirmAndExecute(projectId, sessionId, suggestion)
  → { executed, message }

// 追问
askFollowup(projectId, history, question)
  → AiConversationResponse
```

### 3. 使用示例

**新增文件：** `src/components/examples/AIActionExamples.tsx`

包含以下示例组件：
- `AIActionButtons` - 动作按钮界面
- `AutoAnomalyDetector` - 自动异常检测
- `SmartCommandInput` - 智能命令输入
- `PostCommandAnalysis` - 命令后自动分析

## 架构变化

### Before（旧架构）

```
src/store/ai.ts
  ├── buildContext() - 内嵌函数
  ├── analyze() - 手动拼接上下文
  └── sendFollowup() - 手动拼接上下文

使用方式：
  const context = buildContext(projectId, projectName, databaseSummary);
  await analyzeProject(projectId, context);
```

### After（新架构）

```
src/lib/ai/
  ├── context-builder.ts - 统一上下文构建
  ├── actions.ts - 动作式 AI 工作流
  ├── index.ts - 模块导出
  └── migration-guide.ts - 迁移指南

src/store/ai.ts
  └── 使用 buildProjectContext()

使用方式：
  const context = buildAnalysisContext(projectId);
  await analyzeProject(projectId, toLegacyContextPack(context));

  // 或直接使用动作
  const result = await explainAnomalies(projectId);
```

## 优势

### 1. 更好的关注点分离
- **Context Builder**: 纯函数，易于测试
- **AI Store**: 专注状态管理
- **Actions**: 封装常见工作流

### 2. 更丰富的上下文
```typescript
// 旧版本
{
  terminalSnippet: [...],
  logSnippet: [...],
  databaseSummary: [...]
}

// 新版本
{
  terminalSnippet: [...],
  logSnippet: [...],
  databaseSummary: [...],
  anomalySummary: ["[error] Connection refused", ...],  // 新增
  recentCommands: ["npm start", "git status"],          // 新增
  logErrorCount: 5,                                     // 新增
  logWarningCount: 12,                                  // 新增
  currentWorkingDirectory: "/app",                      // 新增
  hasActiveSession: true                                // 新增
}
```

### 3. 更直观的 AI 交互

**旧方式（聊天框）：**
```
用户: "帮我看看日志有什么问题"
AI: "请提供日志内容"
用户: [手动复制粘贴]
AI: [分析]
```

**新方式（动作按钮）：**
```
用户: [点击 "解释异常" 按钮]
AI: [自动收集上下文并分析]
     "检测到 5 个错误：
      1. Connection refused on port 3306
      2. ..."
```

### 4. 自动化能力

```typescript
// 自动异常检测
<AutoAnomalyDetector
  projectId={projectId}
  onAnomaliesDetected={(anomalies) => {
    // 自动弹出提示
    showNotification(`检测到 ${anomalies.length} 个异常`);
  }}
/>

// 命令后自动分析
<PostCommandAnalysis
  projectId={projectId}
  sessionId={sessionId}
  onAnalysisComplete={({ hasIssues, summary }) => {
    if (hasIssues) {
      showWarning(summary);
    }
  }}
/>
```

## 迁移路径

### 阶段 1：建立基础设施（已完成）
- ✅ 创建 `context-builder.ts`
- ✅ 创建 `actions.ts`
- ✅ 创建示例组件
- ✅ 创建迁移指南

### 阶段 2：迁移 ai.ts store（下一步）
1. 导入新的 builder
2. 替换 `buildContext()` 调用
3. 简化 `analyze()` 函数签名
4. 删除旧的 `buildContext()` 函数

### 阶段 3：UI 集成（后续）
1. 在 AI 面板添加动作按钮
2. 实现自动异常检测
3. 添加智能命令建议
4. 实现命令后自动分析

## 文件清单

### 新增文件
```
src/lib/ai/
  ├── context-builder.ts              (280 行) - 上下文构建器
  ├── actions.ts                      (180 行) - AI 动作
  ├── index.ts                        (20 行)  - 模块导出
  └── migration-guide.ts              (150 行) - 迁移指南

src/components/examples/
  └── AIActionExamples.tsx            (250 行) - 使用示例

docs/
  └── PR4-ai-context-unification.md   (本文档)
```

### 待修改文件
```
src/store/ai.ts
  - 导入 buildProjectContext
  - 替换 buildContext 调用
  - 简化函数签名
  - 删除旧代码
```

## 使用示例

### 基础用法

```typescript
import { buildProjectContext, toLegacyContextPack } from "../lib/ai";

// 简单分析
const context = buildProjectContext(projectId);
console.log("Anomalies:", context.anomalySummary);
console.log("Recent commands:", context.recentCommands);
console.log("Error count:", context.logErrorCount);

// 调用后端 API（向后兼容）
const legacyContext = toLegacyContextPack(context);
await analyzeProject(projectId, legacyContext);
```

### 动作用法

```typescript
import { explainAnomalies, suggestCommand, quickHealthCheck } from "../lib/ai";

// 解释异常
const { explanation, suggestion } = await explainAnomalies(projectId);

// 建议命令
const { suggestion, reasoning } = await suggestCommand(
  projectId,
  "restart the application"
);

// 健康检查
const { status, summary, details } = await quickHealthCheck(projectId);
```

### UI 集成

```typescript
import { AIActionButtons } from "../components/examples/AIActionExamples";

function AIPanel({ projectId }: { projectId: string }) {
  return (
    <div>
      <h2>AI Assistant</h2>
      <AIActionButtons projectId={projectId} />
    </div>
  );
}
```

## 性能考虑

1. **上下文收集开销**
   - 异常检测：O(n) 遍历日志，n 通常 < 50
   - 命令提取：O(n) 遍历 transcript，n 通常 < 20
   - 总体开销：< 10ms

2. **缓存策略**
   - 当前未实现缓存
   - 未来可以添加基于时间的缓存（如 5 秒内复用）

3. **按需加载**
   - 使用 `options` 控制收集范围
   - 不需要的字段可以跳过

## 测试建议

### 单元测试
```typescript
describe("buildProjectContext", () => {
  it("should detect anomalies in logs", () => {
    const context = buildProjectContext(projectId);
    expect(context.anomalySummary.length).toBeGreaterThan(0);
  });

  it("should extract recent commands", () => {
    const context = buildProjectContext(projectId);
    expect(context.recentCommands).toContain("npm start");
  });
});
```

### 集成测试
```typescript
describe("AI Actions", () => {
  it("should explain anomalies", async () => {
    const result = await explainAnomalies(projectId);
    expect(result.explanation).toBeTruthy();
  });
});
```

## 完成标准

- ✅ Context builder 实现完成
- ✅ AI actions 实现完成
- ✅ 示例组件完成
- ✅ 迁移指南完成
- ✅ 文档完成
- ⏳ ai.ts store 迁移（下一步）
- ⏳ UI 集成（后续）
- ⏳ 单元测试（后续）

## 向后兼容性

✅ **完全向后兼容**

- 旧的 `AiContextPack` 类型保持不变
- `toLegacyContextPack()` 转换函数确保兼容
- 后端 API 无需修改
- 现有代码可以继续工作

## 下一步

1. **立即可做**：
   - 在 AI 面板添加"解释异常"按钮
   - 实现自动异常检测通知

2. **本周内**：
   - 迁移 `ai.ts` store 使用新 builder
   - 添加更多动作按钮

3. **后续优化**：
   - 添加上下文缓存
   - 实现更智能的异常检测
   - 添加命令建议的自动补全
