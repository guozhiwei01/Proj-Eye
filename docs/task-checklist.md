# 重构任务清单

## ✅ 已完成（第一周）

### PR1: 拆分 commands.rs
- [x] 创建 commands/ 目录结构
- [x] 拆分为 8 个领域模块
- [x] 更新 lib.rs 注册命令
- [x] 编写 README 文档
- [x] 验证编译通过

**成果：** 236 行 → 8 个模块（10-56 行/模块）

---

### PR2: 引入 workspaceNodeId
- [x] 定义 WorkspaceNode 类型（前端）
- [x] 实现 workspace-nodes store（Zustand）
- [x] 实现 workspace_nodes.rs（Rust）
- [x] 添加 5 个 backend API
- [x] 创建集成示例代码
- [x] 编写完整文档

**成果：** UI 从 sessionId 解耦，为重连奠定基础

---

### PR4: 统一 AI 上下文
- [x] 创建 context-builder.ts
- [x] 实现 ProjectContextBundle
- [x] 创建 AI actions 系统
- [x] 编写示例组件
- [x] 编写迁移指南
- [x] 编写完整文档

**成果：** AI 上下文集中化，支持自动异常检测

---

## ⏳ 待开始（本周）

### PR3: 建立 ConnectionRuntime
- [ ] 创建 runtime/ 目录结构
- [ ] 定义 ConnectionState 枚举
- [ ] 定义 ConnectionContext 结构
- [ ] 实现 ConnectionRegistry
- [ ] 添加命令接口
- [ ] 前端集成
- [ ] 编写文档

**预计时间：** 2-3 小时

---

### Terminal 面板迁移
- [ ] 修改 workspace.ts 的 addTab()
- [ ] 修改 Terminal 组件接收 nodeId
- [ ] 更新 writeTerminalInput 使用 nodeId
- [ ] 更新 resizeTerminal 使用 nodeId
- [ ] 更新 closeTerminal 使用 nodeId
- [ ] 测试所有操作
- [ ] 验证没有引入 bug

**预计时间：** 3-4 小时

---

### AI 面板添加动作按钮
- [ ] 创建 AIActionPanel 组件
- [ ] 实现"解释异常"按钮
- [ ] 实现"健康检查"按钮
- [ ] 集成到现有 AI 面板
- [ ] 样式调整
- [ ] 测试功能

**预计时间：** 2-3 小时

---

## 📊 总体进度

```
第一周目标：    4 个 PR
已完成：        3 个 PR (75%)
剩余：          1 个 PR

代码行数：
  新增：        ~2,000 行
  重构：        ~500 行
  
文档：
  新增：        6 个完整文档
  示例：        4 个组件
```

---

**最后更新：** 2026-04-14  
**当前阶段：** 第一周（75% 完成）  
**下一个任务：** PR3: ConnectionRuntime
