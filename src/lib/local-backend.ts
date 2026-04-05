import {
  AlertLevel,
  AuthType,
  CommandRisk,
  CredentialKind,
  DatabaseType,
  Locale,
  ProjectHealth,
  QuerySafety,
  ServerStatus,
  WorkspaceConnectionState,
  defaultSettings,
  emptyConfigBundle,
  type AIMessage,
  type AiCommandSuggestion,
  type AiConversationResponse,
  type AiContextPack,
  type AppBootstrapState,
  type AppConfigBundle,
  type AppHealthSnapshot,
  type AppSettings,
  type DatabaseDraft,
  type DatabaseResource,
  type LogChunk,
  type Project,
  type ProjectDraft,
  type ProviderConfig,
  type ProviderDraft,
  type QueryResult,
  type SecureStoreStatus,
  type Server,
  type ServerDraft,
  type SessionSummary,
  type TerminalTab,
} from "../types/models";
import {
  deleteCredential,
  getCredential,
  getSecureStoreStatus,
  hasCredential,
  initializeVault,
  lockVault,
  saveCredential,
  unlockVault,
} from "./vault";

const CONFIG_KEY = "proj-eye:config:v1";
const runtimeSessions = new Map<string, SessionSummary>();
const runtimeTabs = new Map<string, TerminalTab>();
const HEALTH: AppHealthSnapshot = {
  app: "Proj-Eye",
  stage: "local-preview",
  version: "0.1.0",
  backendReady: true,
};

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function readConfig(): AppConfigBundle {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) {
    return emptyConfigBundle();
  }

  try {
    const parsed = JSON.parse(raw) as AppConfigBundle;
    return {
      ...emptyConfigBundle(),
      ...parsed,
      settings: {
        ...defaultSettings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return emptyConfigBundle();
  }
}

function writeConfig(config: AppConfigBundle): AppConfigBundle {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return config;
}

function setProjectHealth(project: Project): Project {
  if (project.recentIssue?.length) {
    return {
      ...project,
      health: project.recentIssue.toLowerCase().includes("timeout")
        ? ProjectHealth.Error
        : ProjectHealth.Warning,
    };
  }

  return { ...project, health: ProjectHealth.Healthy };
}

function persistProjects(projects: Project[]): Project[] {
  return projects.map(setProjectHealth);
}

function serverCredentialKind(authType: AuthType): CredentialKind {
  return authType === AuthType.PrivateKey
    ? CredentialKind.ServerPrivateKey
    : CredentialKind.ServerPassword;
}

function generateSession(project: Project, title: string, command: string): {
  session: SessionSummary;
  tab: TerminalTab;
} {
  const tabId = createId("tab");
  const sessionId = createId("session");
  const transcript = [
    `Connected to ${project.name}`,
    `cd ${project.rootPath}`,
    command,
    "Environment is ready.",
  ];

  return {
    session: {
      id: sessionId,
      projectId: project.id,
      tabId,
      title,
      cwd: project.rootPath,
      connectionState: WorkspaceConnectionState.Ready,
      transcript,
      startedAt: Date.now(),
    },
    tab: {
      id: tabId,
      projectId: project.id,
      title,
      command,
      active: true,
      sessionId,
    },
  };
}

function persistRuntimeSession(session: SessionSummary, tab: TerminalTab): {
  session: SessionSummary;
  tab: TerminalTab;
} {
  runtimeSessions.set(session.id, session);
  runtimeTabs.set(tab.id, tab);
  return { session, tab };
}

function latestProjectSession(projectId: string): SessionSummary | null {
  return [...runtimeSessions.values()]
    .filter((session) => session.projectId === projectId)
    .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null;
}

function normalizeCwd(currentCwd: string, nextPath: string): string {
  const trimmed = nextPath.trim();
  if (!trimmed || trimmed === ".") {
    return currentCwd;
  }

  if (trimmed === "..") {
    const parts = currentCwd.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 1) {
      return currentCwd;
    }
    const prefix = currentCwd.startsWith("/") ? "/" : "";
    return `${prefix}${parts.slice(0, -1).join("/")}`;
  }

  if (/^(\/|[a-z]:\\)/i.test(trimmed)) {
    return trimmed;
  }

  return `${currentCwd.replace(/[\\/]+$/, "")}/${trimmed}`.replace(/\/{2,}/g, "/");
}

function buildPreviewCommandLines(session: SessionSummary, command: string, project: Project): {
  lines: string[];
  cwd: string;
} {
  const trimmed = command.trim();
  const nextLines = [`$ ${trimmed}`];
  let cwd = session.cwd;

  if (/^cd(?:\s+.+)?$/i.test(trimmed)) {
    const target = trimmed.slice(2).trim();
    cwd = normalizeCwd(session.cwd, target || project.rootPath);
    nextLines.push(cwd);
    return { lines: nextLines, cwd };
  }

  if (/^(pwd|Get-Location)$/i.test(trimmed)) {
    nextLines.push(session.cwd);
    return { lines: nextLines, cwd };
  }

  if (/^(ls|dir|Get-ChildItem)\b/i.test(trimmed)) {
    nextLines.push("app/");
    nextLines.push("logs/");
    nextLines.push("config/");
    return { lines: nextLines, cwd };
  }

  if (/(tail|Get-Content|pm2 logs|docker logs|journalctl)/i.test(trimmed)) {
    buildLogLines(project).slice(-4).forEach((entry) => nextLines.push(entry.line));
    return { lines: nextLines, cwd };
  }

  nextLines.push("Preview command executed in local mode.");
  return { lines: nextLines, cwd };
}

function isBlockedCommand(command: string): boolean {
  return /rm\s+-rf\s+\/|mkfs|shutdown|reboot|halt|poweroff|:\(\)\{:\|:&\};:/i.test(command);
}

function buildLogLines(project: Project): LogChunk[] {
  const primarySource = project.logSources[0];
  const lines = project.recentIssue
    ? [
        "[INFO] worker heartbeat ok",
        "[WARN] upstream latency rising",
        `[ERROR] ${project.recentIssue}`,
      ]
    : [
        "[INFO] project booted",
        "[INFO] health checks passed",
        "[INFO] waiting for next deployment window",
      ];

  return lines.map((line, index) => ({
    id: createId("log"),
    projectId: project.id,
    sourceId: primarySource?.id ?? "default-log",
    line,
    level: line.includes("ERROR")
      ? AlertLevel.Error
      : line.includes("WARN")
        ? AlertLevel.Warning
        : "info",
    createdAt: Date.now() - (lines.length - index) * 12_000,
  }));
}

function mysqlReadonlyAllowed(statement: string): boolean {
  return /^(select|show|describe|desc|explain)\b/i.test(statement.trim());
}

function redisReadonlyAllowed(statement: string): boolean {
  return /^(get|hget|lrange|ttl|exists|keys|type|info)\b/i.test(statement.trim());
}

function buildMysqlResult(databaseId: string): QueryResult {
  return {
    databaseId,
    engine: DatabaseType.Mysql,
    safety: QuerySafety.Allowed,
    columns: ["job_name", "queued", "failed_jobs"],
    rows: [
      { job_name: "billing-reconcile", queued: 17, failed_jobs: 0 },
      { job_name: "notify-timeouts", queued: 5, failed_jobs: 1 },
      { job_name: "cleanup-temp", queued: 2, failed_jobs: 0 },
    ],
    notice: "Local preview data returned from the browser fallback.",
  };
}

function buildRedisResult(databaseId: string, statement: string): QueryResult {
  return {
    databaseId,
    engine: DatabaseType.Redis,
    safety: QuerySafety.Allowed,
    columns: ["command", "result"],
    rows: [
      {
        command: statement.trim().split(/\s+/)[0].toUpperCase(),
        result: "OK (preview)",
      },
    ],
    notice: "Redis whitelist command accepted in preview mode.",
  };
}

function previewText(locale: string, zh: string, en: string): string {
  return locale === Locale.ZhCN ? zh : en;
}

function buildPreviewSuggestion(
  project: Project,
  context: AiContextPack,
  locale: string,
  prompt?: string,
): AiCommandSuggestion {
  const combinedSignal = [prompt ?? "", ...context.logSnippet, ...context.terminalSnippet].join(" ").toLowerCase();
  const prefersLogs = /log|tail|error|trace|warn|timeout|日志|报错|异常/.test(combinedSignal);
  const prefersHealthCheck = /health|status|check|检查|状态/.test(combinedSignal);

  let command = project.logSources[0]
    ? `tail -n 200 ${project.logSources[0].value}`
    : `cd ${project.rootPath} && ls -la`;
  let reason = previewText(
    locale,
    "先看最新一段只读信号，确认问题是否还在持续出现。",
    "Start with the freshest readonly signal to confirm whether the issue is still active.",
  );

  if (prefersHealthCheck && project.healthCheckCommand) {
    command = project.healthCheckCommand;
    reason = previewText(
      locale,
      "先跑项目已配置的健康检查，再决定是否继续深挖。",
      "Run the project's configured health check before going deeper.",
    );
  } else if (prefersLogs && project.logSources[0]) {
    reason = previewText(
      locale,
      "先查看最新日志窗口，确认错误模式和时间点。",
      "Inspect the newest log window first to confirm the error pattern and timing.",
    );
  }

  return {
    id: createId("cmd"),
    command,
    reason,
    risk: CommandRisk.Safe,
    requiresConfirmation: true,
    blocked: false,
  };
}

function buildPreviewAssistantMessage(
  _project: Project,
  context: AiContextPack,
  history: AIMessage[],
  locale: string,
  prompt?: string,
): string {
  const warningSource = [...context.logSnippet, ...context.terminalSnippet].join(" ").toLowerCase();
  const timeoutDetected = warningSource.includes("timeout") || warningSource.includes("error");
  const nextPrompt = prompt?.trim().toLowerCase() ?? "";
  const lastAssistant = [...history].reverse().find((message) => message.speaker === "assistant");

  if (!nextPrompt) {
    return timeoutDetected
      ? previewText(
          locale,
          "我先看到的是超时或错误信号。先确认最近一波日志、重试次数和依赖服务延迟，再决定是否需要动服务。",
          "The strongest signal is a timeout or error pattern. I would confirm the latest log burst, retry behavior, and dependency latency before touching the service.",
        )
      : previewText(
          locale,
          "当前没有看到单点硬故障特征。我会先核对最新日志窗口和当前部署足迹，再继续缩小范围。",
          "I do not see a single hard-failure signature yet. I would check the latest log window and the current deployment footprint before narrowing further.",
        );
  }

  if (/restart|reboot|rollback|重启|回滚/.test(nextPrompt)) {
    return previewText(
      locale,
      "我不建议现在先重启。先把最新日志、健康检查和依赖状态确认清楚，再决定是否需要变更运行态。",
      "I would not restart yet. Confirm the latest logs, health checks, and dependency status first, then decide whether a runtime change is justified.",
    );
  }

  if (/why|原因|为什么/.test(nextPrompt)) {
    return timeoutDetected
      ? previewText(
          locale,
          "因为上下文里已经出现 timeout 或 error 线索，而且这类问题通常先要确认爆发时间点和依赖延迟，直接操作服务风险更高。",
          "Because the current context already contains timeout or error clues, and those incidents usually need timing and dependency checks before any service change.",
        )
      : previewText(
          locale,
          "因为当前信号还不够集中。我更倾向先补一轮只读检查，把范围收窄到日志、部署或依赖中的某一层。",
          "Because the signal is still diffuse. I would add another readonly check first and narrow the scope to logs, deployment state, or dependencies.",
        );
  }

  if (/log|日志|trace|error|报错/.test(nextPrompt)) {
    return previewText(
      locale,
      "这一轮最值得追的是最新日志窗口。先确认错误是否持续、是否集中在同一个组件，以及时间点是否和最近变更重合。",
      "The best next move is the latest log window. Confirm whether the errors are still active, whether they cluster around one component, and whether the timing lines up with recent changes.",
    );
  }

  if (/database|mysql|redis|postgres|数据库/.test(nextPrompt)) {
    return timeoutDetected
      ? previewText(
          locale,
          "可以把数据库作为下一层排查对象，但我会先用日志确认是否已经出现连接、超时或重试放大的证据。",
          "The database is a valid next layer to inspect, but I would first verify that the logs actually show connection, timeout, or retry amplification evidence.",
        )
      : previewText(
          locale,
          "当前上下文还没有直接指向数据库故障。我会先补日志和健康检查，再决定要不要继续查数据库侧。",
          "The current context does not point directly at a database failure yet. I would extend the log and health-check pass before drilling into the database side.",
        );
  }

  return previewText(
    locale,
    lastAssistant
      ? `我会沿着上一轮结论继续收缩范围，先做一条安全的只读检查，再根据新结果决定下一步。`
      : `我会继续沿着当前信号追下去，先做一条安全的只读检查，再根据结果决定下一步。`,
    lastAssistant
      ? "I would continue from the last finding and use one safe readonly check to narrow the scope before taking the next step."
      : "I would keep following the current signal and use one safe readonly check to narrow the scope before taking the next step.",
  );
}

function buildAiResponse(
  project: Project,
  context: AiContextPack,
  locale: string,
  history: AIMessage[],
  prompt?: string,
): AiConversationResponse {
  const suggestion = buildPreviewSuggestion(project, context, locale, prompt);

  return {
    messages: [
      {
        id: createId("msg"),
        speaker: "assistant",
        content: buildPreviewAssistantMessage(project, context, history, locale, prompt),
        createdAt: Date.now(),
      },
    ],
    suggestion,
  };
}

async function buildAiPreviewResponse(
  projectId: string,
  context: AiContextPack,
  history: AIMessage[],
  prompt?: string,
): Promise<AiConversationResponse> {
  const config = readConfig();
  const project = config.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const locale = config.settings.locale ?? Locale.ZhCN;

  return buildAiResponse(project, context, locale, history, prompt);
}

async function upsertServer(draft: ServerDraft): Promise<Server> {
  const config = readConfig();
  const current = config.servers.find((server) => server.id === draft.id);
  let credentialRef = current?.credentialRef ?? draft.credentialRef ?? "";

  if (draft.authType !== AuthType.Agent) {
    credentialRef ||= createId("cred");

    if (draft.credentialValue?.trim()) {
      await saveCredential({
        ref: credentialRef,
        kind: serverCredentialKind(draft.authType),
        label: `${draft.name} ${draft.authType}`,
        secret: draft.credentialValue,
      });
    }
  } else {
    credentialRef = "";
  }

  const server: Server = {
    id: draft.id ?? createId("server"),
    name: draft.name.trim(),
    host: draft.host.trim(),
    port: draft.port,
    username: draft.username.trim(),
    authType: draft.authType,
    credentialRef,
    group: draft.group.trim() || "default",
    osType: draft.osType,
    lastStatus: current?.lastStatus ?? ServerStatus.Unknown,
    lastPingAt: current?.lastPingAt ?? Date.now(),
    extra: current?.extra ?? {},
  };

  const servers = current
    ? config.servers.map((item) => (item.id === server.id ? server : item))
    : [...config.servers, server];

  writeConfig({ ...config, servers });
  return server;
}

async function upsertDatabase(draft: DatabaseDraft): Promise<DatabaseResource> {
  const config = readConfig();
  const current = config.databases.find((database) => database.id === draft.id);
  let credentialRef = current?.credentialRef ?? draft.credentialRef;

  if (draft.credentialValue?.trim()) {
    credentialRef ||= createId("cred");
    await saveCredential({
      ref: credentialRef,
      kind: CredentialKind.DatabasePassword,
      label: `${draft.name} database credential`,
      secret: draft.credentialValue,
    });
  }

  const database: DatabaseResource = {
    id: draft.id ?? createId("db"),
    name: draft.name.trim(),
    type: draft.type,
    host: draft.host.trim(),
    port: draft.port,
    username: draft.username?.trim() || undefined,
    credentialRef,
    defaultDatabase: draft.defaultDatabase?.trim() || undefined,
    dbNumber: typeof draft.dbNumber === "number" ? draft.dbNumber : undefined,
    readonlyMode: draft.readonlyMode,
    group: draft.group.trim() || "default",
    tags: draft.tags,
    extra: current?.extra ?? {},
  };

  const databases = current
    ? config.databases.map((item) => (item.id === database.id ? database : item))
    : [...config.databases, database];

  writeConfig({ ...config, databases });
  return database;
}

async function upsertProject(draft: ProjectDraft): Promise<Project> {
  const config = readConfig();
  const current = config.projects.find((project) => project.id === draft.id);
  const project: Project = setProjectHealth({
    id: draft.id ?? createId("project"),
    name: draft.name.trim(),
    serverId: draft.serverId,
    rootPath: draft.rootPath.trim(),
    environment: draft.environment,
    databaseIds: draft.databaseIds,
    deployType: draft.deployType,
    logSources: draft.logSources,
    healthCheckCommand: draft.healthCheckCommand?.trim() || undefined,
    tags: draft.tags,
    lastAccessedAt: current?.lastAccessedAt ?? Date.now(),
    health: current?.health ?? ProjectHealth.Healthy,
    recentIssue: current?.recentIssue,
    extra: draft.extra ?? current?.extra ?? {},
  });

  const projects = current
    ? config.projects.map((item) => (item.id === project.id ? project : item))
    : [...config.projects, project];

  writeConfig({ ...config, projects: persistProjects(projects) });
  return project;
}

async function upsertProvider(draft: ProviderDraft): Promise<ProviderConfig> {
  const config = readConfig();
  const current = config.providers.find((provider) => provider.id === draft.id);
  let apiKeyRef = current?.apiKeyRef ?? draft.apiKeyRef ?? createId("cred");

  if (draft.apiKeyValue?.trim()) {
    await saveCredential({
      ref: apiKeyRef,
      kind: CredentialKind.ProviderApiKey,
      label: `${draft.name} API key`,
      secret: draft.apiKeyValue,
    });
  }

  const provider: ProviderConfig = {
    id: draft.id ?? createId("provider"),
    name: draft.name.trim(),
    type: draft.type,
    model: draft.model.trim(),
    apiKeyRef,
    baseUrl: draft.baseUrl?.trim() || undefined,
    enabled: draft.enabled,
  };

  const providers = current
    ? config.providers.map((item) => (item.id === provider.id ? provider : item))
    : [...config.providers, provider];

  writeConfig({ ...config, providers });
  return provider;
}

export const localBackend = {
  importConfigSnapshot(config: AppConfigBundle): void {
    writeConfig(config);
  },

  async bootstrap(): Promise<AppBootstrapState> {
    return {
      health: HEALTH,
      config: readConfig(),
      secureStatus: getSecureStoreStatus(),
      backendMode: "local",
    };
  },

  async getSecureStatus(): Promise<SecureStoreStatus> {
    return getSecureStoreStatus();
  },

  async initializeVault(password: string): Promise<SecureStoreStatus> {
    return initializeVault(password);
  },

  async unlockVault(password: string): Promise<SecureStoreStatus> {
    return unlockVault(password);
  },

  async lockVault(): Promise<SecureStoreStatus> {
    return lockVault();
  },

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const config = readConfig();
    writeConfig({
      ...config,
      settings,
    });
    return settings;
  },

  async saveServer(draft: ServerDraft): Promise<Server> {
    return upsertServer(draft);
  },

  async deleteServer(serverId: string): Promise<void> {
    const config = readConfig();
    if (config.projects.some((project) => project.serverId === serverId)) {
      throw new Error("Remove or reassign projects before deleting this server.");
    }

    writeConfig({
      ...config,
      servers: config.servers.filter((server) => server.id !== serverId),
    });
  },

  async saveDatabase(draft: DatabaseDraft): Promise<DatabaseResource> {
    return upsertDatabase(draft);
  },

  async deleteDatabase(databaseId: string): Promise<void> {
    const config = readConfig();
    if (config.projects.some((project) => project.databaseIds.includes(databaseId))) {
      throw new Error("Remove this database from all projects before deleting it.");
    }

    writeConfig({
      ...config,
      databases: config.databases.filter((database) => database.id !== databaseId),
    });
  },

  async saveProject(draft: ProjectDraft): Promise<Project> {
    return upsertProject(draft);
  },

  async deleteProject(projectId: string): Promise<void> {
    const config = readConfig();
    writeConfig({
      ...config,
      projects: config.projects.filter((project) => project.id !== projectId),
    });
  },

  async saveProvider(draft: ProviderDraft): Promise<ProviderConfig> {
    return upsertProvider(draft);
  },

  async deleteProvider(providerId: string): Promise<void> {
    const config = readConfig();
    const provider = config.providers.find((item) => item.id === providerId);
    if (provider?.apiKeyRef && hasCredential(provider.apiKeyRef)) {
      await deleteCredential(provider.apiKeyRef);
    }

    writeConfig({
      ...config,
      providers: config.providers.filter((providerItem) => providerItem.id !== providerId),
      settings: {
        ...config.settings,
        defaultAiProviderId:
          config.settings.defaultAiProviderId === providerId
            ? null
            : config.settings.defaultAiProviderId,
      },
    });
  },

  async connectProject(projectId: string): Promise<{
    session: SessionSummary;
    tab: TerminalTab;
    logs: LogChunk[];
  }> {
    const config = readConfig();
    const project = config.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const server = config.servers.find((item) => item.id === project.serverId);
    if (!server) {
      throw new Error("Server configuration is missing.");
    }

    const previewCredentialMissing =
      server.authType !== AuthType.Agent && !hasCredential(server.credentialRef);
    const transcriptCommand =
      server.authType === AuthType.Agent
        ? "ssh-agent session ready"
        : `ssh ${server.username}@${server.host}`;

    const generated = generateSession(project, "shell", transcriptCommand);
    if (previewCredentialMissing) {
      generated.session.transcript.splice(
        3,
        0,
        "Credential lookup stayed in preview mode. Unlock the native vault or resave the secret if you need validation.",
      );
    }

    const persisted = persistRuntimeSession(generated.session, generated.tab);
    return {
      ...persisted,
      logs: buildLogLines(project),
    };
  },

  async createTerminalTab(projectId: string, currentCount: number): Promise<{
    session: SessionSummary;
    tab: TerminalTab;
  }> {
    const config = readConfig();
    const project = config.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const generated = generateSession(project, `shell-${currentCount + 1}`, `cd ${project.rootPath}`);
    return persistRuntimeSession(generated.session, generated.tab);
  },

  async executeSessionCommand(
    sessionId: string,
    command: string,
  ): Promise<{ session: SessionSummary; lines: string[] }> {
    const session = runtimeSessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal session not found.");
    }

    const config = readConfig();
    const project = config.projects.find((item) => item.id === session.projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const preview = buildPreviewCommandLines(session, command, project);
    const updated: SessionSummary = {
      ...session,
      cwd: preview.cwd,
      transcript: [...session.transcript, ...preview.lines],
    };
    runtimeSessions.set(sessionId, updated);
    return {
      session: updated,
      lines: preview.lines,
    };
  },

  async refreshProjectLogs(projectId: string): Promise<LogChunk[]> {
    const config = readConfig();
    const project = config.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    return buildLogLines(project);
  },

  async runDatabaseQuery(databaseId: string, statement: string): Promise<QueryResult> {
    const config = readConfig();
    const database = config.databases.find((item) => item.id === databaseId);
    if (!database) {
      throw new Error("Database not found.");
    }

    if (database.type === DatabaseType.Postgresql) {
      return {
        databaseId,
        engine: DatabaseType.Postgresql,
        safety: QuerySafety.Unsupported,
        columns: [],
        rows: [],
        notice: "PostgreSQL is reserved for future implementation in this MVP.",
      };
    }

    if (database.type === DatabaseType.Mysql) {
      if (!mysqlReadonlyAllowed(statement)) {
        return {
          databaseId,
          engine: DatabaseType.Mysql,
          safety: QuerySafety.ReadonlyOnly,
          columns: [],
          rows: [],
          notice: "Only SELECT / SHOW / DESCRIBE / EXPLAIN queries are allowed.",
        };
      }
      return buildMysqlResult(databaseId);
    }

    if (database.type === DatabaseType.Redis) {
      if (!redisReadonlyAllowed(statement)) {
        return {
          databaseId,
          engine: DatabaseType.Redis,
          safety: QuerySafety.Blocked,
          columns: [],
          rows: [],
          notice: "The Redis command is blocked by the MVP whitelist.",
        };
      }
      return buildRedisResult(databaseId, statement);
    }

    return {
      databaseId,
      engine: database.type,
      safety: QuerySafety.Unsupported,
      columns: [],
      rows: [],
      notice: "This database type is not supported in the current preview.",
    };
  },

  async analyzeProject(projectId: string, context: AiContextPack): Promise<AiConversationResponse> {
    return buildAiPreviewResponse(projectId, context, []);
  },

  async sendAiFollowup(
    projectId: string,
    context: AiContextPack,
    history: AIMessage[],
    prompt: string,
  ): Promise<AiConversationResponse> {
    return buildAiPreviewResponse(projectId, context, history, prompt);
  },

  async confirmSuggestedCommand(
    projectId: string,
    sessionId: string | undefined,
    suggestion: AiCommandSuggestion,
  ): Promise<{ session: SessionSummary; lines: string[] }> {
    if (suggestion.blocked || isBlockedCommand(suggestion.command)) {
      throw new Error("This command is blocked by the Proj-Eye safety policy.");
    }

    const session = sessionId
      ? runtimeSessions.get(sessionId) ?? null
      : latestProjectSession(projectId);
    if (!session) {
      throw new Error("Open a terminal tab before confirming AI commands.");
    }

    return localBackend.executeSessionCommand(session.id, suggestion.command);
  },

  async refreshConfig(): Promise<AppConfigBundle> {
    return readConfig();
  },

  async validateProvider(providerId: string): Promise<{ ok: boolean; message: string }> {
    const config = readConfig();
    const provider = config.providers.find((item) => item.id === providerId);
    if (!provider) {
      return { ok: false, message: "Provider configuration not found." };
    }

    const hasApiKey = Boolean(getCredential(provider.apiKeyRef));
    return {
      ok: hasApiKey,
      message: hasApiKey
        ? `${provider.name} is configured and ready for preview analysis.`
        : `${provider.name} is missing an API key in the secure vault.`,
    };
  },

  async inspectCredentialRef(ref?: string | null): Promise<boolean> {
    return hasCredential(ref);
  },
};
