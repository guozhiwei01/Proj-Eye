import { useAppStore } from "../store/app";
import {
  AIStatus,
  AuthType,
  CommandRisk,
  DatabaseType,
  DeployType,
  Environment,
  FilterMode,
  Locale,
  LogSourceType,
  ManagementSection,
  OSType,
  ProviderType,
  SecureStoreStrategy,
  ThemeMode,
  WorkspaceConnectionState,
  type Locale as LocaleValue,
} from "../types/models";

type TranslationParams = Record<string, string | number>;
type TranslationKey = string;

const translations: Record<LocaleValue, Record<string, string>> = {
  [Locale.ZhCN]: {
    "app.bootstrapping": "正在启动 Proj-Eye...",
    "settings.title": "设置",
    "settings.heading": "应用与 Provider 默认项",
    "settings.description": "主题、语言、快捷键修饰键、默认 Provider 路由和安全存储控制都在这里。",
    "settings.theme": "主题",
    "settings.locale": "语言",
    "settings.locale.zh-CN": "简体中文",
    "settings.locale.en-US": "English",
    "settings.shortcutModifier": "快捷键修饰键",
    "settings.shortcut.meta": "Cmd（macOS）",
    "settings.shortcut.ctrl": "Ctrl（Windows/Linux）",
    "settings.defaultProvider": "默认 AI Provider",
    "settings.noDefaultProvider": "不设置默认 Provider",
    "settings.preferredModel": "偏好模型标签",
    "settings.preferredModelPlaceholder": "gpt-4.1、claude-sonnet、gemini-2.5-pro...",
    "settings.save": "保存设置",
    "settings.providers": "已配置 Provider",
    "settings.providers.empty": "还没有配置任何 AI Provider。",
    "settings.providers.validate": "校验",
    "settings.providers.checking": "校验中...",
    "settings.providers.valid": "{name} 已配置完成，可用于预览分析。",
    "settings.providers.missingKey": "{name} 缺少 API Key。",
    "settings.secureStore": "安全存储",
    "settings.secureStore.keyring": "系统 keyring 已启用，凭据会优先存入操作系统凭据管理器。",
    "settings.secureStore.fallback": "当前使用回退 vault，离开工位前建议先锁定。",
    "settings.secureStore.lock": "锁定 vault",
    "settings.secureStore.ready": "keyring 已就绪",
    "sidebar.tag": "Proj-Eye",
    "sidebar.heading": "项目优先运维驾驶舱",
    "sidebar.new": "新建",
    "sidebar.servers": "{count} 台服务器",
    "sidebar.databases": "{count} 个数据库",
    "sidebar.alerts": "{count} 条告警",
    "sidebar.workspace": "工作区",
    "sidebar.manage": "管理",
    "sidebar.settings": "设置",
    "sidebar.alerting": "告警中",
    "sidebar.recent": "最近使用",
    "sidebar.allProjects": "全部项目",
    "sidebar.empty.alerting": "本地异常检测暂时没有发现项目级问题。",
    "sidebar.empty.recent": "开始连接后，最近使用的项目会显示在这里。",
    "sidebar.empty.allProjects": "先创建服务器，绑定数据库，再填写项目根目录即可开始。",
    "sidebar.theme": "主题",
    "sidebar.themeDescription": "颜色令牌从一开始就固定在 CSS 变量中。",
    "sidebar.secureStore": "安全存储",
    "sidebar.secureStore.ready": "就绪",
    "sidebar.secureStore.locked": "已锁定",
    "sidebar.secureStore.unlocked": "已解锁",
    "sidebar.searchPlaceholder": "搜索项目、标签或问题",
    "sidebar.searchLabel": "搜索",
    "sidebar.emptyTitle": "这里还没有内容",
    "createProject.tag": "控制中心",
    "createProject.heading": "配置与身份管理",
    "createProject.description": "在一个地方创建服务器、数据库、项目和 AI Provider。凭据不会明文写入 JSON 配置。",
    "createProject.projects": "项目",
    "createProject.servers": "服务器",
    "createProject.databases": "数据库",
    "createProject.providers": "Providers",
    "workspace.title": "工作区",
    "workspace.serverContext": "服务器上下文",
    "workspace.tauriBridge": "Tauri 桥接",
    "workspace.frontendPreview": "仅前端预览",
    "workspace.connecting": "连接中",
    "workspace.alertStrip": "告警条",
    "workspace.startTriage": "开始排查",
    "workspace.awaitingSession": "等待实时 SSH 会话开始推流。",
    "workspace.run": "运行",
    "workspace.running": "运行中...",
    "workspace.commandPlaceholder": "输入远程命令后回车执行",
    "workspace.remoteCommand": "远程命令",
    "workspace.newTab": "+ 标签页",
    "workspace.metrics": "cpu {cpu}% / 内存 {memory}% / 日志 {logs}/m",
    "workspace.cwd": "当前目录 {cwd}",
    "shortcut.ai": "AI",
    "shortcut.logs": "日志",
    "shortcut.database": "数据库",
    "shortcut.search": "搜索",
    "shortcut.newTab": "新标签页",
    "shortcut.toggleAi": "切换 AI",
    "shortcut.openLogs": "日志",
    "shortcut.openDatabase": "数据库",
    "shortcut.newTerminal": "新终端",
    "bottom.logs": "日志",
    "bottom.database": "数据库",
    "bottom.cron": "定时任务",
    "logs.title": "实时日志流",
    "logs.description": "file、command、docker、pm2 和 journald 都会汇总到同一个项目视图。",
    "logs.refresh": "刷新日志",
    "logs.refreshing": "刷新中...",
    "logs.waiting": "[INFO] 正在等待日志订阅数据",
    "logs.noSignal": "[INFO] 暂未检测到异常标记",
    "logs.unknownSource": "日志源",
    "logs.refreshError": "无法刷新日志。",
    "database.title": "只读查询工作区",
    "database.description": "MySQL 和 Redis 会在原生后端执行；PostgreSQL 当前只保留可见占位。",
    "database.boundResource": "绑定资源",
    "database.run": "运行查询",
    "database.results": "结果",
    "database.safePrompt": "执行一条安全查询后，这里会显示结构化结果。",
    "database.postgresDisabled": "PostgreSQL 当前只保留配置入口，MVP 中不执行真实查询。",
    "database.placeholder.mysql": "SELECT job_name, queued, failed_jobs FROM worker_health LIMIT 5;",
    "database.placeholder.redis": "INFO",
    "database.placeholder.postgres": "PostgreSQL 暂未启用真实查询。",
    "cron.title": "计划任务",
    "cron.description": "Cron 和队列状态会直接进入项目工作区，而不是散落在其他工具里。",
    "cron.reconcile": "{project}：修复失败任务",
    "cron.cleanup": "清理临时负载",
    "cron.success": "成功",
    "cron.delayed": "延迟",
    "ai.overlay": "AI 面板",
    "ai.heading": "辅助排查",
    "ai.analyze": "分析",
    "ai.close": "关闭",
    "ai.contextSummary": "上下文摘要",
    "ai.currentSignal": "当前信号",
    "ai.waitingSignal": "等待你触发一次排查。",
    "ai.conversation": "对话",
    "ai.noAnalysis": "还没有运行任何 AI 分析。",
    "ai.commandConfirm": "命令确认",
    "ai.confirm": "确认执行",
    "ai.emptySuggestion": "先运行 AI 分析，再生成建议命令。",
    "ai.status.ready": "就绪",
    "ai.status.analyzing": "分析中",
    "ai.status.error": "错误",
    "risk.safe": "安全",
    "risk.caution": "谨慎",
    "risk.blocked": "已阻止",
    "vault.title": "安全 Vault",
    "vault.createHeading": "创建主密码",
    "vault.unlockHeading": "解锁回退 vault",
    "vault.password": "主密码",
    "vault.createPlaceholder": "设置新的主密码",
    "vault.unlockPlaceholder": "输入你的主密码",
    "vault.working": "处理中...",
    "vault.create": "创建 vault",
    "vault.unlock": "解锁",
    "vault.error": "无法解锁安全存储。",
    "error.vaultLockedBeforeSavingCredentials": "请先解锁 vault，再保存凭据。",
    "error.initializeOrUnlockVaultToStoreSecret": "请先初始化或解锁 vault，再将凭据保存到本地。",
    "error.masterPasswordEmpty": "主密码不能为空。",
    "error.masterPasswordIncorrect": "主密码不正确。",
    "error.vaultAlreadyInitialized": "fallback vault 已经初始化。",
    "error.vaultNotInitialized": "fallback vault 尚未初始化。",
    "error.commandBlocked": "该命令被 Proj-Eye 安全策略拦截。",
    "secure.message.keyring": "系统 keyring 已启用，凭据会优先存入操作系统凭据管理器。",
    "secure.message.fallback.locked": "系统 keyring 不可用。请使用主密码解锁回退 vault。",
    "secure.message.fallback.unlocked": "系统 keyring 不可用。回退 vault 当前已解锁。",
    "secure.message.fallback.uninitialized": "系统 keyring 不可用。请创建主密码来初始化回退 vault。",
    "management.edit": "编辑",
    "management.delete": "删除",
    "management.reset": "重置",
    "management.name": "名称",
    "management.host": "主机",
    "management.port": "端口",
    "management.username": "用户名",
    "management.group": "分组",
    "management.authType": "认证方式",
    "management.osType": "系统类型",
    "management.privateKey": "私钥",
    "management.password": "密码",
    "management.keepSecret": "留空则继续使用当前已保存的密钥。",
    "management.saveServer": "保存服务器",
    "management.serverDeleted": "服务器已删除。",
    "management.serverSaved": "服务器 {name} 已保存。",
    "management.serverError": "无法完成服务器操作。",
    "management.databaseType": "类型",
    "management.defaultDatabase": "默认数据库",
    "management.redisDbNumber": "Redis DB 编号",
    "management.credential": "凭据",
    "management.keepPassword": "留空则继续使用已保存的密码。",
    "management.readonlyMode": "只读模式",
    "management.tags": "标签",
    "management.tagsPlaceholder": "orders, cache, queue",
    "management.postgresNotice": "PostgreSQL 可以保存配置，但本版 MVP 不执行真实查询。",
    "management.saveDatabase": "保存数据库",
    "management.databaseDeleted": "数据库已删除。",
    "management.databaseSaved": "数据库 {name} 已保存。",
    "management.databaseError": "无法完成数据库操作。",
    "management.projectName": "项目名称",
    "management.server": "服务器",
    "management.selectServer": "请选择服务器",
    "management.rootPath": "根目录",
    "management.environment": "环境",
    "management.deployType": "部署方式",
    "management.databases": "数据库",
    "management.primaryLogType": "主日志类型",
    "management.primaryLogLabel": "主日志标签",
    "management.primaryLogValue": "主日志路径 / 命令",
    "management.healthCheck": "健康检查命令",
    "management.projectTagsPlaceholder": "billing, critical",
    "management.saveProject": "保存项目",
    "management.projectDeleted": "项目已删除。",
    "management.projectSaved": "项目 {name} 已保存。",
    "management.projectError": "无法完成项目操作。",
    "management.providerType": "Provider 类型",
    "management.model": "模型",
    "management.baseUrl": "Base URL",
    "management.baseUrlPlaceholder": "可选的自定义端点",
    "management.apiKey": "API Key",
    "management.keepApiKey": "留空则继续使用已保存的 API Key。",
    "management.providerEnabled": "启用于 AI 分析",
    "management.saveProvider": "保存 Provider",
    "management.providerDeleted": "Provider 已删除。",
    "management.providerSaved": "Provider {name} 已保存。",
    "management.providerError": "无法完成 Provider 操作。",
    "status.enabled": "已启用",
    "status.disabled": "已禁用",
    "status.success": "成功",
    "status.delayed": "延迟",
    "project.noIncident": "当前没有活跃故障，可以开始下一次 shell 会话。",
    "project.anomaly": "最近日志中检测到异常信号",
    "project.anomalyDesc": "最近日志包含 warning / error 标记。",
    "common.validate": "校验",
    "common.checking": "检查中...",
  },
  [Locale.EnUS]: {
    "app.bootstrapping": "Bootstrapping Proj-Eye...",
    "settings.title": "Settings",
    "settings.heading": "App and provider defaults",
    "settings.description": "Theme, language, shortcut modifier, default provider routing, and secure-store controls live here.",
    "settings.theme": "Theme",
    "settings.locale": "Language",
    "settings.locale.zh-CN": "Simplified Chinese",
    "settings.locale.en-US": "English",
    "settings.shortcutModifier": "Shortcut modifier",
    "settings.shortcut.meta": "Cmd (macOS)",
    "settings.shortcut.ctrl": "Ctrl (Windows/Linux)",
    "settings.defaultProvider": "Default AI provider",
    "settings.noDefaultProvider": "No default provider",
    "settings.preferredModel": "Preferred model label",
    "settings.preferredModelPlaceholder": "gpt-4.1, claude-sonnet, gemini-2.5-pro...",
    "settings.save": "Save settings",
    "settings.providers": "Configured providers",
    "settings.providers.empty": "No AI providers configured yet.",
    "settings.providers.validate": "Validate",
    "settings.providers.checking": "Checking...",
    "settings.providers.valid": "{name} is configured and ready for preview analysis.",
    "settings.providers.missingKey": "{name} is missing an API key.",
    "settings.secureStore": "Secure store",
    "settings.secureStore.keyring": "System keyring is active. Secrets are stored in the OS credential manager first.",
    "settings.secureStore.fallback": "Fallback vault is active. Lock it before stepping away from the workstation.",
    "settings.secureStore.lock": "Lock vault",
    "settings.secureStore.ready": "keyring ready",
    "sidebar.tag": "Proj-Eye",
    "sidebar.heading": "Project-first ops cockpit",
    "sidebar.new": "New",
    "sidebar.servers": "{count} servers",
    "sidebar.databases": "{count} databases",
    "sidebar.alerts": "{count} alerts",
    "sidebar.workspace": "Workspace",
    "sidebar.manage": "Manage",
    "sidebar.settings": "Settings",
    "sidebar.alerting": "Alerting",
    "sidebar.recent": "Recent",
    "sidebar.allProjects": "All Projects",
    "sidebar.empty.alerting": "Local anomaly detection has not surfaced any project-level issues.",
    "sidebar.empty.recent": "Recent project activity will show up here once you start connecting.",
    "sidebar.empty.allProjects": "Create a server, wire a database, and add a project root path to begin.",
    "sidebar.theme": "Theme",
    "sidebar.themeDescription": "Color tokens stay in CSS variables from day one.",
    "sidebar.secureStore": "Secure Store",
    "sidebar.secureStore.ready": "Ready",
    "sidebar.secureStore.locked": "Locked",
    "sidebar.secureStore.unlocked": "Unlocked",
    "sidebar.searchPlaceholder": "Search projects, tags, or issues",
    "sidebar.searchLabel": "Search",
    "sidebar.emptyTitle": "Nothing here yet",
    "createProject.tag": "Control Center",
    "createProject.heading": "Configuration and identity",
    "createProject.description": "Create servers, databases, projects, and AI providers from one place. Credentials stay outside the plain JSON config.",
    "createProject.projects": "Projects",
    "createProject.servers": "Servers",
    "createProject.databases": "Databases",
    "createProject.providers": "Providers",
    "workspace.title": "Workspace",
    "workspace.serverContext": "Server Context",
    "workspace.tauriBridge": "Tauri Bridge",
    "workspace.frontendPreview": "Frontend-only preview",
    "workspace.connecting": "Connecting",
    "workspace.alertStrip": "Alert Strip",
    "workspace.startTriage": "Start triage",
    "workspace.awaitingSession": "Awaiting a live SSH session to start streaming.",
    "workspace.run": "Run",
    "workspace.running": "Running...",
    "workspace.commandPlaceholder": "Type a remote command, then press Enter",
    "workspace.remoteCommand": "Remote command",
    "workspace.newTab": "+ tab",
    "workspace.metrics": "cpu {cpu}% / mem {memory}% / logs {logs}/m",
    "workspace.cwd": "cwd {cwd}",
    "shortcut.ai": "AI",
    "shortcut.logs": "Logs",
    "shortcut.database": "Database",
    "shortcut.search": "Search",
    "shortcut.newTab": "New Tab",
    "shortcut.toggleAi": "Toggle AI",
    "shortcut.openLogs": "Logs",
    "shortcut.openDatabase": "Database",
    "shortcut.newTerminal": "New Terminal",
    "bottom.logs": "Logs",
    "bottom.database": "Database",
    "bottom.cron": "Cron",
    "logs.title": "Live log stream",
    "logs.description": "File, command, docker, pm2, and journald sources all funnel into the same project view.",
    "logs.refresh": "Refresh logs",
    "logs.refreshing": "Refreshing...",
    "logs.waiting": "[INFO] waiting for log subscription data",
    "logs.noSignal": "[INFO] no anomaly markers detected yet",
    "logs.unknownSource": "log source",
    "logs.refreshError": "Unable to refresh logs.",
    "database.title": "Readonly query workspace",
    "database.description": "MySQL and Redis run through the native backend when available. PostgreSQL stays as a visible but disabled placeholder.",
    "database.boundResource": "Bound Resource",
    "database.run": "Run query",
    "database.results": "Results",
    "database.safePrompt": "Run a safe query to see structured results here.",
    "database.postgresDisabled": "PostgreSQL is visible in config but intentionally disabled for this MVP.",
    "database.placeholder.mysql": "SELECT job_name, queued, failed_jobs FROM worker_health LIMIT 5;",
    "database.placeholder.redis": "INFO",
    "database.placeholder.postgres": "PostgreSQL is reserved for future implementation.",
    "cron.title": "Scheduled tasks",
    "cron.description": "Cron and queue visibility are part of the project workspace instead of being hidden in separate tools.",
    "cron.reconcile": "{project}: reconcile failed jobs",
    "cron.cleanup": "cleanup temp payloads",
    "cron.success": "success",
    "cron.delayed": "delayed",
    "ai.overlay": "AI Overlay",
    "ai.heading": "Assisted triage",
    "ai.analyze": "Analyze",
    "ai.close": "Close",
    "ai.contextSummary": "Context Summary",
    "ai.currentSignal": "Current signal",
    "ai.waitingSignal": "Waiting for the user to trigger investigation.",
    "ai.conversation": "Conversation",
    "ai.noAnalysis": "No AI analysis has been run yet.",
    "ai.commandConfirm": "Command Confirm",
    "ai.confirm": "Confirm command",
    "ai.emptySuggestion": "Run an AI analysis to generate a reviewed command suggestion.",
    "ai.status.ready": "ready",
    "ai.status.analyzing": "analyzing",
    "ai.status.error": "error",
    "risk.safe": "safe",
    "risk.caution": "caution",
    "risk.blocked": "blocked",
    "vault.title": "Secure Vault",
    "vault.createHeading": "Create a master password",
    "vault.unlockHeading": "Unlock the fallback vault",
    "vault.password": "Master password",
    "vault.createPlaceholder": "Set a new master password",
    "vault.unlockPlaceholder": "Enter your master password",
    "vault.working": "Working...",
    "vault.create": "Create vault",
    "vault.unlock": "Unlock",
    "vault.error": "Unable to unlock the secure store.",
    "error.vaultLockedBeforeSavingCredentials": "Unlock the vault before saving credentials.",
    "error.initializeOrUnlockVaultToStoreSecret": "Initialize or unlock the vault before storing secrets locally.",
    "error.masterPasswordEmpty": "Master password cannot be empty.",
    "error.masterPasswordIncorrect": "Master password is incorrect.",
    "error.vaultAlreadyInitialized": "Fallback vault is already initialized.",
    "error.vaultNotInitialized": "Fallback vault is not initialized yet.",
    "error.commandBlocked": "This command is blocked by the Proj-Eye safety policy.",
    "secure.message.keyring": "System keyring is active. Secrets are stored in the OS credential manager first.",
    "secure.message.fallback.locked": "System keyring is unavailable. Unlock the fallback vault with the master password.",
    "secure.message.fallback.unlocked": "System keyring is unavailable. The fallback vault is unlocked.",
    "secure.message.fallback.uninitialized": "System keyring is unavailable. Create a master password to initialize the fallback vault.",
    "management.edit": "Edit",
    "management.delete": "Delete",
    "management.reset": "Reset",
    "management.name": "Name",
    "management.host": "Host",
    "management.port": "Port",
    "management.username": "Username",
    "management.group": "Group",
    "management.authType": "Auth type",
    "management.osType": "OS type",
    "management.privateKey": "Private key",
    "management.password": "Password",
    "management.keepSecret": "Leave empty to keep the currently stored secret.",
    "management.saveServer": "Save server",
    "management.serverDeleted": "Server deleted.",
    "management.serverSaved": "Server {name} saved.",
    "management.serverError": "Unable to complete the server action.",
    "management.databaseType": "Type",
    "management.defaultDatabase": "Default database",
    "management.redisDbNumber": "Redis DB number",
    "management.credential": "Credential",
    "management.keepPassword": "Leave empty to keep the stored password.",
    "management.readonlyMode": "Readonly mode",
    "management.tags": "Tags",
    "management.tagsPlaceholder": "orders, cache, queue",
    "management.postgresNotice": "PostgreSQL is accepted in config, but query execution stays disabled in this MVP.",
    "management.saveDatabase": "Save database",
    "management.databaseDeleted": "Database deleted.",
    "management.databaseSaved": "Database {name} saved.",
    "management.databaseError": "Unable to complete the database action.",
    "management.projectName": "Project name",
    "management.server": "Server",
    "management.selectServer": "Select a server",
    "management.rootPath": "Root path",
    "management.environment": "Environment",
    "management.deployType": "Deploy type",
    "management.databases": "Databases",
    "management.primaryLogType": "Primary log type",
    "management.primaryLogLabel": "Primary log label",
    "management.primaryLogValue": "Primary log path / command",
    "management.healthCheck": "Health check command",
    "management.projectTagsPlaceholder": "billing, critical",
    "management.saveProject": "Save project",
    "management.projectDeleted": "Project deleted.",
    "management.projectSaved": "Project {name} saved.",
    "management.projectError": "Unable to complete the project action.",
    "management.providerType": "Provider type",
    "management.model": "Model",
    "management.baseUrl": "Base URL",
    "management.baseUrlPlaceholder": "Optional custom endpoint",
    "management.apiKey": "API key",
    "management.keepApiKey": "Leave empty to keep the stored API key.",
    "management.providerEnabled": "Enabled for AI analysis",
    "management.saveProvider": "Save provider",
    "management.providerDeleted": "Provider deleted.",
    "management.providerSaved": "Provider {name} saved.",
    "management.providerError": "Unable to complete the provider action.",
    "status.enabled": "enabled",
    "status.disabled": "disabled",
    "status.success": "success",
    "status.delayed": "delayed",
    "project.noIncident": "No active incidents. Ready for the next shell session.",
    "project.anomaly": "Anomaly detected in recent logs",
    "project.anomalyDesc": "Recent log lines contain warning / error markers.",
    "common.validate": "Validate",
    "common.checking": "Checking...",
  },
};

Object.assign(translations[Locale.ZhCN], {
  "ai.followUp": "\u7ee7\u7eed\u8ffd\u95ee",
  "ai.askPlaceholder": "\u7ee7\u7eed\u8be2\u95ee\u5f53\u524d\u9879\u76ee\u3001\u65e5\u5fd7\u6216\u5efa\u8bae\u547d\u4ee4\u2026",
  "ai.send": "\u53d1\u9001",
  "ai.sending": "\u601d\u8003\u4e2d\u2026",
  "ai.sendHint": "Enter \u53d1\u9001\uff0cShift+Enter \u6362\u884c",
  "ai.assistant": "AI",
  "ai.user": "\u4f60",
  "ai.system": "\u7cfb\u7edf",
  "ai.requestFailed": "AI \u56de\u590d\u672a\u80fd\u5b8c\u6210\u3002",
  "ai.commandFailed": "\u5efa\u8bae\u547d\u4ee4\u672a\u80fd\u6267\u884c\u3002",
});

Object.assign(translations[Locale.EnUS], {
  "ai.followUp": "Follow-up",
  "ai.askPlaceholder": "Ask about the current project, logs, or the suggested command...",
  "ai.send": "Send",
  "ai.sending": "Thinking...",
  "ai.sendHint": "Enter sends, Shift+Enter adds a new line",
  "ai.assistant": "AI",
  "ai.user": "You",
  "ai.system": "System",
  "ai.requestFailed": "The AI response could not be completed.",
  "ai.commandFailed": "The suggested command could not be executed.",
});

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}

export function translate(locale: LocaleValue, key: TranslationKey, params?: TranslationParams): string {
  const bundle = translations[locale] ?? translations[Locale.ZhCN];
  return interpolate(bundle[key] ?? translations[Locale.EnUS][key] ?? key, params);
}

const backendErrorKeyMap: Array<{
  key: TranslationKey;
  test: (message: string) => boolean;
}> = [
  {
    key: "error.vaultLockedBeforeSavingCredentials",
    test: (message) =>
      message.includes("Unlock the fallback vault before saving credentials.") ||
      message.includes("Unlock the vault before saving credentials."),
  },
  {
    key: "error.initializeOrUnlockVaultToStoreSecret",
    test: (message) =>
      message.includes("Initialize or unlock the fallback vault to store this secret locally.") ||
      message.includes("Initialize or unlock the vault to store this secret locally."),
  },
  {
    key: "error.masterPasswordEmpty",
    test: (message) => message.includes("Master password cannot be empty."),
  },
  {
    key: "error.masterPasswordIncorrect",
    test: (message) => message.includes("Master password is incorrect."),
  },
  {
    key: "error.vaultAlreadyInitialized",
    test: (message) => message.includes("Fallback vault is already initialized."),
  },
  {
    key: "error.vaultNotInitialized",
    test: (message) => message.includes("Fallback vault is not initialized yet."),
  },
  {
    key: "error.commandBlocked",
    test: (message) => message.includes("This command is blocked by the Proj-Eye safety policy."),
  },
];

export function localizeErrorMessage(
  locale: LocaleValue,
  error: unknown,
  fallbackKey?: TranslationKey,
): string {
  const fallback = fallbackKey ? translate(locale, fallbackKey) : "Unknown error";

  if (error instanceof Error) {
    const match = backendErrorKeyMap.find((item) => item.test(error.message));
    return match ? translate(locale, match.key) : error.message || fallback;
  }

  if (typeof error === "string") {
    const match = backendErrorKeyMap.find((item) => item.test(error));
    return match ? translate(locale, match.key) : error || fallback;
  }

  return fallback;
}

export function themeLabel(locale: LocaleValue, theme: ThemeMode): string {
  const labels = {
    [ThemeMode.Teal]: locale === Locale.ZhCN ? "青绿" : "Teal",
    [ThemeMode.Amber]: locale === Locale.ZhCN ? "琥珀" : "Amber",
    [ThemeMode.Blue]: locale === Locale.ZhCN ? "蓝色" : "Blue",
  };
  return labels[theme];
}

export function environmentLabel(locale: LocaleValue, value: Environment): string {
  const labels = {
    [Environment.Production]: locale === Locale.ZhCN ? "生产" : "production",
    [Environment.Staging]: locale === Locale.ZhCN ? "预发" : "staging",
    [Environment.Development]: locale === Locale.ZhCN ? "开发" : "development",
  };
  return labels[value];
}

export function filterLabel(locale: LocaleValue, value: FilterMode): string {
  const labels = {
    [FilterMode.All]: locale === Locale.ZhCN ? "全部" : "All",
    [FilterMode.Alerting]: locale === Locale.ZhCN ? "告警" : "Alerting",
    [FilterMode.Production]: locale === Locale.ZhCN ? "生产" : "Prod",
    [FilterMode.Staging]: locale === Locale.ZhCN ? "预发" : "Staging",
    [FilterMode.Development]: locale === Locale.ZhCN ? "开发" : "Dev",
  };
  return labels[value];
}

export function managementSectionLabel(locale: LocaleValue, value: ManagementSection): string {
  const labels = {
    [ManagementSection.Projects]: translate(locale, "createProject.projects"),
    [ManagementSection.Servers]: translate(locale, "createProject.servers"),
    [ManagementSection.Databases]: translate(locale, "createProject.databases"),
    [ManagementSection.Providers]: translate(locale, "createProject.providers"),
  };
  return labels[value];
}

export function aiStatusLabel(locale: LocaleValue, value: AIStatus): string {
  return translate(locale, `ai.status.${value}`);
}

export function commandRiskLabel(locale: LocaleValue, value: CommandRisk): string {
  return translate(locale, `risk.${value}`);
}

export function authTypeLabel(locale: LocaleValue, value: AuthType): string {
  const labels = {
    [AuthType.Password]: locale === Locale.ZhCN ? "密码" : "password",
    [AuthType.PrivateKey]: locale === Locale.ZhCN ? "私钥" : "private_key",
    [AuthType.Agent]: locale === Locale.ZhCN ? "Agent" : "agent",
  };
  return labels[value];
}

export function osTypeLabel(_locale: LocaleValue, value: OSType): string {
  const labels = {
    [OSType.Linux]: "Linux",
    [OSType.Macos]: "macOS",
    [OSType.Windows]: "Windows",
  };
  return labels[value];
}

export function secureStoreStrategyLabel(locale: LocaleValue, value: SecureStoreStrategy): string {
  const labels = {
    [SecureStoreStrategy.Keyring]: locale === Locale.ZhCN ? "系统 keyring" : "System keyring",
    [SecureStoreStrategy.FallbackVault]: locale === Locale.ZhCN ? "回退 vault" : "Fallback vault",
  };
  return labels[value];
}

export function secureStoreStateLabel(
  locale: LocaleValue,
  strategy: SecureStoreStrategy,
  locked: boolean,
): string {
  if (strategy === SecureStoreStrategy.Keyring) {
    return translate(locale, "sidebar.secureStore.ready");
  }

  return locked
    ? translate(locale, "sidebar.secureStore.locked")
    : translate(locale, "sidebar.secureStore.unlocked");
}

export function secureStoreMessage(
  locale: LocaleValue,
  status: {
    strategy: SecureStoreStrategy;
    initialized: boolean;
    locked: boolean;
  },
): string {
  if (status.strategy === SecureStoreStrategy.Keyring) {
    return translate(locale, "secure.message.keyring");
  }

  if (!status.initialized) {
    return translate(locale, "secure.message.fallback.uninitialized");
  }

  return status.locked
    ? translate(locale, "secure.message.fallback.locked")
    : translate(locale, "secure.message.fallback.unlocked");
}

export function deployTypeLabel(locale: LocaleValue, value: DeployType): string {
  const labels = {
    [DeployType.Pm2]: "pm2",
    [DeployType.PhpFpm]: "php-fpm",
    [DeployType.Docker]: "docker",
    [DeployType.Systemd]: "systemd",
    [DeployType.Custom]: locale === Locale.ZhCN ? "自定义" : "custom",
  };
  return labels[value];
}

export function logSourceTypeLabel(locale: LocaleValue, value: LogSourceType): string {
  const labels = {
    [LogSourceType.File]: locale === Locale.ZhCN ? "文件" : "file",
    [LogSourceType.Command]: locale === Locale.ZhCN ? "命令" : "command",
    [LogSourceType.Docker]: "docker",
    [LogSourceType.Pm2]: "pm2",
    [LogSourceType.Journald]: "journald",
  };
  return labels[value];
}

export function databaseTypeLabel(_locale: LocaleValue, value: DatabaseType): string {
  return value;
}

export function providerTypeLabel(_locale: LocaleValue, value: ProviderType): string {
  return value;
}

export function connectionStateLabel(locale: LocaleValue, value: WorkspaceConnectionState): string {
  const labels = {
    [WorkspaceConnectionState.Idle]: locale === Locale.ZhCN ? "空闲" : "idle",
    [WorkspaceConnectionState.Connecting]: locale === Locale.ZhCN ? "连接中" : "connecting",
    [WorkspaceConnectionState.Ready]: locale === Locale.ZhCN ? "就绪" : "ready",
    [WorkspaceConnectionState.Reconnecting]: locale === Locale.ZhCN ? "重连中" : "reconnecting",
    [WorkspaceConnectionState.Failed]: locale === Locale.ZhCN ? "失败" : "failed",
  };
  return labels[value];
}

export function useI18n() {
  const locale = useAppStore((state) => state.config.settings.locale ?? Locale.ZhCN);

  return {
    locale,
    t: (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params),
  };
}
