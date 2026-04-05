export const ThemeMode = {
  Teal: "teal",
  Amber: "amber",
  Blue: "blue",
} as const;

export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export const Locale = {
  ZhCN: "zh-CN",
  EnUS: "en-US",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const AppView = {
  Workspace: "workspace",
  Manage: "manage",
  Settings: "settings",
} as const;

export type AppView = (typeof AppView)[keyof typeof AppView];

export const ManagementSection = {
  Projects: "projects",
  Servers: "servers",
  Databases: "databases",
  Providers: "providers",
} as const;

export type ManagementSection =
  (typeof ManagementSection)[keyof typeof ManagementSection];

export const Environment = {
  Production: "production",
  Staging: "staging",
  Development: "development",
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export const AuthType = {
  Password: "password",
  PrivateKey: "private_key",
  Agent: "agent",
} as const;

export type AuthType = (typeof AuthType)[keyof typeof AuthType];

export const OSType = {
  Linux: "linux",
  Macos: "macos",
  Windows: "windows",
} as const;

export type OSType = (typeof OSType)[keyof typeof OSType];

export const ServerStatus = {
  Online: "online",
  Offline: "offline",
  Warning: "warning",
  Unknown: "unknown",
} as const;

export type ServerStatus = (typeof ServerStatus)[keyof typeof ServerStatus];

export const DatabaseType = {
  Mysql: "mysql",
  Redis: "redis",
  Postgresql: "postgresql",
  Mongodb: "mongodb",
} as const;

export type DatabaseType = (typeof DatabaseType)[keyof typeof DatabaseType];

export const DeployType = {
  Pm2: "pm2",
  PhpFpm: "php-fpm",
  Docker: "docker",
  Systemd: "systemd",
  Custom: "custom",
} as const;

export type DeployType = (typeof DeployType)[keyof typeof DeployType];

export const LogSourceType = {
  File: "file",
  Command: "command",
  Docker: "docker",
  Pm2: "pm2",
  Journald: "journald",
} as const;

export type LogSourceType = (typeof LogSourceType)[keyof typeof LogSourceType];

export const ProjectHealth = {
  Healthy: "healthy",
  Warning: "warning",
  Error: "error",
} as const;

export type ProjectHealth = (typeof ProjectHealth)[keyof typeof ProjectHealth];

export const WorkspaceConnectionState = {
  Idle: "idle",
  Connecting: "connecting",
  Ready: "ready",
  Reconnecting: "reconnecting",
  Failed: "failed",
} as const;

export type WorkspaceConnectionState =
  (typeof WorkspaceConnectionState)[keyof typeof WorkspaceConnectionState];

export const BottomPanelKey = {
  Logs: "logs",
  Database: "database",
  Cron: "cron",
} as const;

export type BottomPanelKey = (typeof BottomPanelKey)[keyof typeof BottomPanelKey];

export const AIStatus = {
  Ready: "ready",
  Analyzing: "analyzing",
  Error: "error",
} as const;

export type AIStatus = (typeof AIStatus)[keyof typeof AIStatus];

export const FilterMode = {
  All: "all",
  Alerting: "alerting",
  Production: "production",
  Staging: "staging",
  Development: "development",
} as const;

export type FilterMode = (typeof FilterMode)[keyof typeof FilterMode];

export const AlertLevel = {
  Warning: "warning",
  Error: "error",
} as const;

export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];

export const ProviderType = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Gemini: "gemini",
  Ollama: "ollama",
  Custom: "custom",
} as const;

export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const CredentialKind = {
  ServerPassword: "server_password",
  ServerPrivateKey: "server_private_key",
  DatabasePassword: "database_password",
  ProviderApiKey: "provider_api_key",
} as const;

export type CredentialKind =
  (typeof CredentialKind)[keyof typeof CredentialKind];

export const SecureStoreStrategy = {
  Keyring: "keyring",
  FallbackVault: "fallback_vault",
} as const;

export type SecureStoreStrategy =
  (typeof SecureStoreStrategy)[keyof typeof SecureStoreStrategy];

export const QuerySafety = {
  Allowed: "allowed",
  ReadonlyOnly: "readonly_only",
  Blocked: "blocked",
  Unsupported: "unsupported",
} as const;

export type QuerySafety = (typeof QuerySafety)[keyof typeof QuerySafety];

export const CommandRisk = {
  Safe: "safe",
  Caution: "caution",
  Blocked: "blocked",
} as const;

export type CommandRisk = (typeof CommandRisk)[keyof typeof CommandRisk];

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  credentialRef: string;
  group: string;
  osType: OSType;
  lastStatus: ServerStatus;
  lastPingAt: number;
  extra: Record<string, unknown>;
}

export interface DatabaseResource {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username?: string;
  credentialRef?: string;
  defaultDatabase?: string;
  dbNumber?: number;
  readonlyMode: boolean;
  group: string;
  tags: string[];
  extra: Record<string, unknown>;
}

export interface LogSource {
  id: string;
  type: LogSourceType;
  value: string;
  label: string;
}

export interface Project {
  id: string;
  name: string;
  serverId: string;
  rootPath: string;
  environment: Environment;
  databaseIds: string[];
  deployType: DeployType;
  logSources: LogSource[];
  healthCheckCommand?: string;
  tags: string[];
  lastAccessedAt: number;
  health: ProjectHealth;
  recentIssue?: string;
  extra: Record<string, unknown>;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  apiKeyRef: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  locale: Locale;
  shortcutModifier: "meta" | "ctrl";
  defaultAiProviderId: string | null;
  preferredModel: string;
}

export interface AppConfigBundle {
  servers: Server[];
  databases: DatabaseResource[];
  projects: Project[];
  providers: ProviderConfig[];
  settings: AppSettings;
}

export interface AlertItem {
  id: string;
  projectId: string;
  level: AlertLevel;
  title: string;
  description: string;
  source: string;
  createdAt: number;
}

export interface TerminalTab {
  id: string;
  projectId: string;
  title: string;
  command: string;
  active: boolean;
  sessionId: string;
}

export interface SessionSummary {
  id: string;
  projectId: string;
  tabId: string;
  title: string;
  cwd: string;
  connectionState: WorkspaceConnectionState;
  transcript: string[];
  startedAt: number;
}

export interface LogChunk {
  id: string;
  projectId: string;
  sourceId: string;
  line: string;
  level: AlertLevel | "info";
  createdAt: number;
}

export interface QueryRequest {
  databaseId: string;
  statement: string;
}

export interface QueryResult {
  databaseId: string;
  engine: DatabaseType;
  safety: QuerySafety;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  notice?: string;
}

export interface AiContextPack {
  projectId: string;
  projectName: string;
  terminalSnippet: string[];
  logSnippet: string[];
  databaseSummary: string[];
}

export interface AiCommandSuggestion {
  id: string;
  command: string;
  reason: string;
  risk: CommandRisk;
  requiresConfirmation: boolean;
  blocked: boolean;
}

export interface AIMessage {
  id: string;
  speaker: "assistant" | "system" | "user";
  content: string;
  createdAt: number;
}

export interface AiConversationResponse {
  messages: AIMessage[];
  suggestion: AiCommandSuggestion | null;
}

export interface HealthMetrics {
  cpu: number;
  memory: number;
  logRate: number;
  dbLatency: number;
}

export interface AppHealthSnapshot {
  app: string;
  stage: string;
  version: string;
  backendReady: boolean;
}

export interface SecureStoreStatus {
  strategy: SecureStoreStrategy;
  initialized: boolean;
  locked: boolean;
  keyringAvailable: boolean;
  message: string;
}

export interface CredentialSecretInput {
  ref: string;
  kind: CredentialKind;
  label: string;
  secret: string;
}

export interface ServerDraft {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  group: string;
  osType: OSType;
  credentialRef?: string;
  credentialValue?: string;
}

export interface DatabaseDraft {
  id?: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username?: string;
  defaultDatabase?: string;
  dbNumber?: number;
  readonlyMode: boolean;
  group: string;
  tags: string[];
  credentialRef?: string;
  credentialValue?: string;
}

export interface ProjectDraft {
  id?: string;
  name: string;
  serverId: string;
  rootPath: string;
  environment: Environment;
  databaseIds: string[];
  deployType: DeployType;
  logSources: LogSource[];
  healthCheckCommand?: string;
  tags: string[];
  extra?: Record<string, unknown>;
}

export interface ProviderDraft {
  id?: string;
  name: string;
  type: ProviderType;
  model: string;
  baseUrl?: string;
  enabled: boolean;
  apiKeyRef?: string;
  apiKeyValue?: string;
}

export interface AppBootstrapState {
  health: AppHealthSnapshot;
  config: AppConfigBundle;
  secureStatus: SecureStoreStatus;
  backendMode: "tauri" | "local";
}

export const defaultSettings: AppSettings = {
  theme: ThemeMode.Teal,
  locale: Locale.ZhCN,
  shortcutModifier: navigator.userAgent.toLowerCase().includes("mac") ? "meta" : "ctrl",
  defaultAiProviderId: null,
  preferredModel: "",
};

export const emptyConfigBundle = (): AppConfigBundle => ({
  servers: [],
  databases: [],
  projects: [],
  providers: [],
  settings: defaultSettings,
});
