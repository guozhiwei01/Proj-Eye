# OpsAgent — 产品规格文档 & 开发 TodoList

> **核心理念：以项目为本**
> 项目是第一公民，服务器、数据库、日志、AI 都是项目的属性和工具。
> 用户的心智模型不是"我要连哪台服务器"，而是"我要处理哪个项目"。

---

## 一、产品定位

面向独立开发者 / 小团队的 **AI 运维终端**，替代 Xshell + Navicat + 宝塔的日常工作流。

**解决的核心痛点：**
- 现有工具以"连接/资产"为第一公民，用户必须记住 IP，在多个工具间来回切换
- AI 工具与运维工具完全割裂，排查问题需要手动复制粘贴上下文
- 没有工具能感知"这个项目"的全貌（服务器 + 数据库 + 日志 + 代码路径）

**第一阶段 MVP 目标：**
能替代 Xshell + Navicat 的日常使用，AI 主动辅助排查生产问题。

---

## 二、技术栈

### 框架
- **Tauri 2.x** — Rust + Web 前端，跨平台桌面应用
- **React 18 + TypeScript** — 前端 UI 框架
- **Vite** — 前端构建工具

### 前端依赖
- `xterm.js` + `xterm-addon-fit` + `xterm-addon-web-links` — 终端渲染
- `zustand` — 轻量全局状态管理
- `TailwindCSS` — 样式（只用 utility class，不写 hardcode 颜色）
- CSS 变量主题系统（见主题规范）

### Rust 侧依赖
- `russh` — SSH 连接与管理
- `portable-pty` — PTY 伪终端（终端核心）
- `sqlx` — 数据库连接（MySQL / PostgreSQL）
- `redis` — Redis 连接
- `tokio` — 异步运行时
- `serde` / `serde_json` — 数据序列化
- `keyring` — 系统密钥链，加密存储凭据

### AI 接入
- 直接调用第三方 API（用户自填 Key）
- 前端 fetch，支持流式输出（ReadableStream）
- 抽象为 `AIProvider` 接口，支持多模型切换

---

## 三、主题规范（可扩展）

所有颜色必须通过 CSS 变量管理，禁止 hardcode 任何颜色值。

```css
/* 默认主题：深石板 + 青绿 */
[data-theme="teal"] {
  --bg0: #0f1117;      /* 主背景 */
  --bg1: #141824;      /* 侧边栏 */
  --bg2: #1a2030;      /* 卡片 */
  --bg3: #1e2638;      /* 输入框/hover */
  --bg4: #242e44;      /* 深色元素 */
  --accent: #06d6a0;   /* 主强调色 */
  --accent2: #7c6af7;  /* 副强调色 */
  --red: #ef476f;      /* 错误 */
  --yellow: #ffd166;   /* 警告 */
  --blue: #4f9eff;     /* 信息 */
  --text0: #eef2ff;    /* 主文字 */
  --text1: #9aa5c0;    /* 次文字 */
  --text2: #445070;    /* 辅助文字 */
  --border: #ffffff0d; /* 默认边框 */
  --border2: #ffffff18;/* hover 边框 */
}

/* 预留主题：暖炭灰 + 琥珀 */
[data-theme="amber"] { ... }

/* 预留主题：纯黑 + 电蓝 */
[data-theme="blue"] { ... }
```

---

## 四、核心数据模型

> 所有"类型"字段必须用枚举+接口抽象，禁止在业务代码里出现具体名称字符串。

```typescript
// 服务器
interface Server {
  id: string
  name: string           // 自定义名称，如"阿里云-生产1"
  host: string           // IP 或域名
  port: number           // 默认 22
  username: string
  auth_type: 'password' | 'private_key' | 'agent'  // 可扩展
  credential_ref: string // 引用 keychain 中的凭据 key
  group: string          // 分组：生产/测试/开发
  os_type: 'linux' | 'macos' | 'windows'
  last_status: 'online' | 'offline' | 'warning' | 'unknown'
  last_ping_at: number   // timestamp
  extra: Record<string, any>  // 预留扩展字段
}

// 数据库（独立对象，不从属于服务器）
interface Database {
  id: string
  name: string
  type: 'mysql' | 'redis' | 'postgresql' | 'mongodb'  // 可扩展
  host: string
  port: number
  username?: string
  credential_ref?: string
  default_database?: string
  db_number?: number     // Redis 专用
  readonly_mode: boolean // 默认 true，防止误操作
  group: string
  tags: string[]
  extra: Record<string, any>
}

// 项目（第一公民）
interface Project {
  id: string
  name: string
  server_id: string        // 关联服务器
  root_path: string        // 服务器上的代码路径
  environment: 'production' | 'staging' | 'development'
  database_ids: string[]   // 关联多个数据库
  deploy_type: 'pm2' | 'php-fpm' | 'docker' | 'systemd' | 'custom'  // 可扩展
  log_sources: LogSource[] // 日志源列表
  health_check_command?: string
  tags: string[]
  last_accessed_at: number
  extra: Record<string, any>
}

// 日志源
interface LogSource {
  id: string
  type: 'file' | 'command' | 'docker' | 'pm2' | 'journald'  // 可扩展
  value: string    // 路径或命令
  label: string    // 显示名称
}

// 定时任务
interface CronJob {
  id: string
  project_id: string
  server_id: string
  name: string
  schedule: string   // cron 表达式
  command: string
  log_source?: LogSource
  last_run_status: 'success' | 'failed' | 'running' | 'unknown'
  last_run_at?: number
  last_result?: string
  enabled: boolean
  extra: Record<string, any>
}

// 队列（预留）
interface Queue {
  id: string
  project_id: string
  database_id: string
  driver: 'redis' | 'database' | 'rabbitmq'  // 可扩展
  queue_name: string
  worker_count: number
  last_status: 'healthy' | 'warning' | 'error' | 'unknown'
  extra: Record<string, any>
}

// AI 提供商（可扩展）
interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom'
  model: string
  api_key_ref: string
  base_url?: string        // 支持自定义 endpoint
  enabled: boolean
}
```

---

## 五、信息架构

```
AppShell
├── Sidebar（240px，固定）
│   ├── LogoBar（Logo + 新建按钮）
│   ├── SearchBar（搜索项目名，⌘K）
│   ├── FilterBar（全部 / 异常 / 生产 / 测试 / 按服务器）
│   ├── ProjectList（项目为第一公民）
│   │   ├── 异常分组（置顶）
│   │   ├── 最近使用分组
│   │   └── 全部项目分组
│   └── Footer（用户信息 + 服务器管理 + 设置）
│
├── Workspace（主内容区）
│   ├── WorkspaceHeader（项目名 / IP / 路径 / 数据库标签 / 状态）
│   ├── AlertStrip（AI 主动感知异常，本地检测触发）
│   ├── TerminalTabs（多标签）
│   ├── TerminalPane（xterm.js，绝对主体）
│   └── ShortcutBar（⌘J AI · ⌘L 日志 · ⌘D 数据库 · ⌘K 搜索 · ⌘T 新终端）
│
├── BottomPanel（按需升起）
│   ├── LogPanel（实时日志流）
│   ├── DatabasePanel（SQL 查询 + 结果表格）
│   └── CronPanel（任务列表 + 状态）
│
└── AIOverlay（右侧滑入，320px，按需唤出）
    ├── ContextSummary（当前项目 + 终端输出 + 数据库）
    ├── ConversationArea（诊断 + 建议）
    └── CommandConfirm（建议命令，需用户确认执行）
```

---

## 六、页面清单

| 页面 | 说明 | 优先级 |
|------|------|--------|
| 空态首页 | 无项目时的引导页 | P0 |
| 有项目首页 | 最近项目 + 异常告警 + 全局概览 | P0 |
| 新建/编辑项目 | 单页三卡片顺序解锁（服务器→数据库→项目信息） | P0 |
| 主工作台·正常 | 终端工作中 | P0 |
| 主工作台·连接中 | SSH 连接 loading 状态 | P0 |
| 主工作台·AI提示条 | 检测到异常时 | P1 |
| 主工作台·日志面板 | BottomPanel 展开 | P1 |
| 主工作台·数据库面板 | BottomPanel 展开 | P1 |
| 主工作台·AI浮层 | AIOverlay 展开 | P1 |
| 设置页 | AI Key / 主题 / 快捷键 | P2 |
| 服务器管理页 | 独立管理服务器列表 | P2 |

---

## 七、核心交互规范

### 7.1 点击项目进入工作台
```
1. 设置 activeProjectId
2. 加载项目配置（server / databases / log_sources）
3. 建立 SSH 连接
4. 创建默认 Terminal Tab
5. 自动执行 cd {project.root_path}
6. 更新 Header 上下文
7. 预备数据库连接（懒加载，按需）
```

### 7.2 AI 异常检测（两步，不直接调用 AI API）
```
第一步：本地规则检测（零延迟）
  检测关键词：ERROR / WARN / Exception / Traceback /
             connection refused / permission denied / OOM
  → 立即显示 AlertStrip（不调用 AI）

第二步：用户点击"开始排查"
  → 调用 AI API
  → 自动注入上下文（项目信息 + 终端片段 + 数据库状态）
  → 打开 AIOverlay 显示分析结果
```

### 7.3 AI 命令执行安全规范
```
Level 1：只分析，不执行（默认）
Level 2：生成命令 → 用户确认 → 执行（MVP 只做这级）
Level 3：白名单命令自动执行（未来版本）

危险命令黑名单（永远拦截）：
DROP / DELETE / TRUNCATE / UPDATE（无 WHERE）/
FLUSHALL / FLUSHDB / rm -rf / shutdown / reboot
```

### 7.4 数据库操作安全规范
```
MySQL 默认只允许：SELECT / SHOW / EXPLAIN / DESCRIBE
Redis 默认只允许：GET / HGET / LRANGE / TTL / EXISTS / KEYS / TYPE / INFO
危险操作需二次确认弹窗，readonly_mode=true 时直接拦截
```

### 7.5 快捷键系统（可配置，不写死）
```
⌘J  → 打开/关闭 AI Overlay
⌘L  → 打开/关闭 Logs Panel
⌘D  → 打开/关闭 Database Panel
⌘T  → 新建终端标签
⌘K  → 全局搜索（项目名）
⌘,  → 设置
ESC → 优先关闭 AI Overlay，再关闭 Bottom Panel
```

---

## 八、状态机定义

### 项目工作台状态机
```
Idle → [选择项目] → Connecting
Connecting → [成功] → Ready
Connecting → [失败] → Failed
Ready → [网络断开] → Reconnecting
Ready → [切换项目] → Connecting
Reconnecting → [成功] → Ready
Reconnecting → [超时] → Failed
Failed → [重试] → Connecting
```

### Bottom Panel 状态机
```
Closed → [⌘L] → Open(Logs)
Closed → [⌘D] → Open(Database)
Open(X) → [切换Tab] → Open(Y)
Open(X) → [再次触发同快捷键 / ESC] → Closed
```

### AI Overlay 状态机
```
Hidden → [⌘J / Alert点击] → Opening
Opening → [上下文就绪] → Ready
Ready → [用户提问] → Analyzing
Analyzing → [成功] → Ready
Analyzing → [失败] → Error
Error → [重试] → Analyzing
Ready / Error → [关闭] → Hidden
```

---

## 九、Rust 模块划分

```
src-tauri/src/
├── ssh/
│   ├── manager.rs      // SSH 连接池管理
│   ├── executor.rs     // 命令执行
│   └── sftp.rs         // 文件传输（预留）
│
├── terminal/
│   └── bridge.rs       // xterm ↔ PTY 数据流桥接
│
├── metrics/
│   └── collector.rs    // SSH 采集 CPU/内存/磁盘（10s 刷新）
│
├── log_stream/
│   └── streamer.rs     // tail 文件 / 执行日志命令
│
├── database/
│   ├── driver.rs       // DatabaseDriver trait（可扩展）
│   ├── mysql.rs        // MySQL 实现
│   ├── redis.rs        // Redis 实现
│   └── postgres.rs     // PostgreSQL 预留
│
├── ai/
│   ├── provider.rs     // AIProvider trait
│   ├── context.rs      // 上下文拼装
│   ├── guard.rs        // 危险指令拦截
│   └── detector.rs     // 本地异常关键词检测
│
├── store/
│   ├── config.rs       // 项目/服务器/数据库配置读写
│   └── secure.rs       // keychain 加密凭据存储
│
└── commands.rs         // Tauri IPC 命令注册
```

---

## 十、React 组件树

```
src/
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── SearchBar.tsx
│   │   ├── FilterBar.tsx
│   │   ├── ProjectList.tsx
│   │   └── ProjectItem.tsx
│   │
│   ├── Workspace/
│   │   ├── Workspace.tsx
│   │   ├── WorkspaceHeader.tsx
│   │   ├── AlertStrip.tsx
│   │   ├── TerminalTabs.tsx
│   │   ├── TerminalPane.tsx
│   │   └── ShortcutBar.tsx
│   │
│   ├── BottomPanel/
│   │   ├── BottomPanel.tsx
│   │   ├── LogPanel.tsx
│   │   ├── DatabasePanel.tsx
│   │   └── CronPanel.tsx
│   │
│   ├── AIOverlay/
│   │   ├── AIOverlay.tsx
│   │   ├── ContextSummary.tsx
│   │   ├── ConversationArea.tsx
│   │   └── CommandConfirm.tsx
│   │
│   └── shared/
│       ├── StatusDot.tsx
│       ├── Badge.tsx
│       └── EmptyState.tsx
│
├── pages/
│   ├── Home.tsx           // 首页（空态 / 有项目）
│   ├── CreateProject.tsx  // 新建项目
│   └── Settings.tsx       // 设置
│
├── store/
│   ├── app.ts             // 全局 AppState
│   ├── workspace.ts       // 工作台状态
│   ├── ai.ts              // AI 状态
│   └── panels.ts          // 面板状态
│
├── hooks/
│   ├── useTerminal.ts
│   ├── useSSH.ts
│   ├── useDatabase.ts
│   └── useAI.ts
│
├── themes/
│   ├── teal.css           // 默认主题
│   ├── amber.css          // 预留
│   └── blue.css           // 预留
│
└── lib/
    ├── tauri.ts           // Tauri IPC 封装
    ├── ai.ts              // AI API 调用
    └── detector.ts        // 本地异常检测规则
```

---

## 十一、开发 TodoList

### Phase 0 — 项目初始化
- [ ] `npm create tauri-app` 初始化项目（React + TypeScript 模板）
- [ ] 配置 TailwindCSS
- [ ] 建立 CSS 变量主题系统，默认 teal 主题
- [ ] 配置 zustand store 基础结构
- [ ] 建立 Tauri IPC 命令基础结构

### Phase 1 — 数据模型与配置（P0）
- [ ] 实现 `secure_store`：keychain 加密存储凭据
- [ ] 实现 `project_config`：本地 JSON 配置读写
- [ ] Server CRUD（增删改查）
- [ ] Database CRUD
- [ ] Project CRUD（关联 Server + Database）
- [ ] 新建项目页面（单页三卡片顺序解锁）
- [ ] 空态首页
- [ ] 有项目首页（最近项目 + 异常告警）

### Phase 2 — 终端核心链路（P0）
- [ ] `ssh/manager.rs`：SSH 连接池
- [ ] `terminal/bridge.rs`：PTY ↔ xterm 数据流桥接
- [ ] xterm.js 集成，渲染终端
- [ ] 点击项目 → 自动 SSH → 自动 cd 到项目目录
- [ ] 多标签页支持
- [ ] WorkspaceHeader 上下文显示
- [ ] SSH 连接状态机（Connecting / Ready / Reconnecting / Failed）
- [ ] 连接失败重试逻辑

### Phase 3 — 日志与数据库面板（P1）
- [ ] `log_stream/streamer.rs`：tail 文件 / 执行日志命令
- [ ] LogPanel：实时日志流，ERROR/WARN 高亮
- [ ] `database/driver.rs`：DatabaseDriver trait 抽象
- [ ] `database/mysql.rs`：MySQL 查询实现（只读模式）
- [ ] `database/redis.rs`：Redis 查询实现（安全命令白名单）
- [ ] DatabasePanel：SQL 输入 + 结果表格
- [ ] BottomPanel 升起/收起动画
- [ ] 危险命令拦截弹窗

### Phase 4 — AI 排障助手（P1）
- [ ] `ai/detector.rs`：本地异常关键词检测
- [ ] AlertStrip：本地检测触发，显示异常摘要
- [ ] `ai/provider.rs`：AIProvider trait 抽象
- [ ] 实现 OpenAI / Claude / Gemini Provider
- [ ] `ai/context.rs`：自动拼装项目上下文
- [ ] `ai/guard.rs`：危险指令拦截
- [ ] AIOverlay：右侧滑入，流式输出
- [ ] CommandConfirm：建议命令二次确认执行
- [ ] 设置页：AI Key 配置 + 模型选择

### Phase 5 — 系统完善（P2）
- [ ] `metrics/collector.rs`：SSH 采集服务器指标（10s 刷新）
- [ ] 侧边栏服务器指标显示
- [ ] CronPanel：任务列表 + 上次执行状态
- [ ] 搜索：实时过滤项目名（⌘K）
- [ ] 筛选：异常 / 生产 / 测试 / 按服务器
- [ ] 快捷键系统（可配置，读配置文件）
- [ ] 会话恢复（重启后恢复上次连接）
- [ ] 主题切换（teal / amber / blue）
- [ ] 动效打磨（面板升起 / AI 浮层滑入）

---

## 十二、MVP 边界

### ✅ 第一版包含
- 项目 / 服务器 / 数据库 配置管理
- SSH 终端（点项目直接连入，多标签）
- 日志实时查看（文件 tail / 自定义命令）
- MySQL 查询（只读）+ Redis 基础查询
- AI 异常感知（本地检测 + 按需调用）
- AI 建议命令（需用户确认执行）
- 多 AI 提供商支持（用户自填 Key）

### ❌ 第一版不做
- 多人协作 / 权限管理
- 部署流水线
- 本地代码编辑
- AI 自动执行命令
- 告警推送（邮件/钉钉/微信）
- 多环境自动切换
- AI 长期记忆
- 可视化监控大盘

---

## 十三、扩展性约定（开发必读）

1. **所有类型字段用枚举**，禁止在业务代码里出现 `"mysql"` 这样的裸字符串
2. **数据库驱动用 trait 抽象**，新增数据库类型只需实现 `DatabaseDriver` trait
3. **AI 提供商用 trait 抽象**，新增模型只需实现 `AIProvider` trait
4. **日志源用 type 字段区分**，新增来源只需扩展枚举
5. **所有颜色走 CSS 变量**，禁止在组件里 hardcode 任何颜色值
6. **快捷键走配置文件**，禁止在代码里 hardcode 快捷键
7. **每个数据模型预留 `extra: Record<string, any>` 字段**，扩展属性不改表结构
8. **Tauri IPC 命令统一在 `commands.rs` 注册**，按模块分组注释

---

*文档版本：v1.0 · 2024年1月*