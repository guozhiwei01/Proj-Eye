import { invoke } from "@tauri-apps/api/core";
import type {
  AIMessage,
  AiCommandSuggestion,
  AiConversationResponse,
  AiContextPack,
  AppBootstrapState,
  AppConfigBundle,
  AppSettings,
  DatabaseDraft,
  DatabaseResource,
  LogChunk,
  Project,
  ProjectDraft,
  ProviderConfig,
  ProviderDraft,
  QueryResult,
  SecureStoreStatus,
  Server,
  ServerDraft,
  SessionSummary,
  TerminalTab,
} from "../types/models";
import { localBackend } from "./local-backend";

let backendMode: "unknown" | "tauri" | "local" = "unknown";

function mirrorConfigSnapshot(config: AppConfigBundle): AppConfigBundle {
  localBackend.importConfigSnapshot(config);
  return config;
}

async function syncLocalConfigFromTauri(): Promise<void> {
  try {
    const config = await callTauri<AppConfigBundle>("config_refresh");
    localBackend.importConfigSnapshot(config);
  } catch {
    // Keep the local preview mirror best-effort so a successful native write does not fail the UI.
  }
}

async function fallback<T>(factory: () => Promise<T>): Promise<T> {
  backendMode = "local";
  return factory();
}

async function callTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

async function withBackend<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  localFactory: () => Promise<T>,
): Promise<T> {
  if (backendMode === "local") {
    return localFactory();
  }

  try {
    const result = await callTauri<T>(command, args);
    backendMode = "tauri";
    return result;
  } catch {
    return fallback(localFactory);
  }
}

export async function bootstrapApp(): Promise<AppBootstrapState> {
  if (backendMode === "local") {
    return localBackend.bootstrap();
  }

  try {
    const result = await callTauri<AppBootstrapState>("app_bootstrap");
    backendMode = "tauri";
    mirrorConfigSnapshot(result.config);
    return result;
  } catch {
    return fallback(() => localBackend.bootstrap());
  }
}

export async function refreshConfig(): Promise<AppConfigBundle> {
  if (backendMode === "local") {
    return localBackend.refreshConfig();
  }

  try {
    const config = await callTauri<AppConfigBundle>("config_refresh");
    backendMode = "tauri";
    return mirrorConfigSnapshot(config);
  } catch {
    return fallback(() => localBackend.refreshConfig());
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  if (backendMode === "local") {
    return localBackend.saveSettings(settings);
  }

  try {
    const result = await callTauri<AppSettings>("config_save_settings", { settings });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
    return result;
  } catch {
    return fallback(() => localBackend.saveSettings(settings));
  }
}

export async function getSecureStatus(): Promise<SecureStoreStatus> {
  return withBackend("secure_status", undefined, () => localBackend.getSecureStatus());
}

export async function initializeMasterPassword(password: string): Promise<SecureStoreStatus> {
  return withBackend("secure_initialize_vault", { password }, () => localBackend.initializeVault(password));
}

export async function unlockSecureStore(password: string): Promise<SecureStoreStatus> {
  return withBackend("secure_unlock_vault", { password }, () => localBackend.unlockVault(password));
}

export async function lockSecureStore(): Promise<SecureStoreStatus> {
  return withBackend("secure_lock_vault", undefined, () => localBackend.lockVault());
}

export async function saveServer(draft: ServerDraft): Promise<Server> {
  if (backendMode === "local") {
    return localBackend.saveServer(draft);
  }

  try {
    const result = await callTauri<Server>("config_save_server", { draft });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
    return result;
  } catch {
    return fallback(() => localBackend.saveServer(draft));
  }
}

export async function deleteServer(serverId: string): Promise<void> {
  if (backendMode === "local") {
    return localBackend.deleteServer(serverId);
  }

  try {
    await callTauri<void>("config_delete_server", { serverId });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
  } catch {
    return fallback(() => localBackend.deleteServer(serverId));
  }
}

export async function saveDatabase(draft: DatabaseDraft): Promise<DatabaseResource> {
  if (backendMode === "local") {
    return localBackend.saveDatabase(draft);
  }

  try {
    const result = await callTauri<DatabaseResource>("config_save_database", { draft });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
    return result;
  } catch {
    return fallback(() => localBackend.saveDatabase(draft));
  }
}

export async function deleteDatabase(databaseId: string): Promise<void> {
  if (backendMode === "local") {
    return localBackend.deleteDatabase(databaseId);
  }

  try {
    await callTauri<void>("config_delete_database", { databaseId });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
  } catch {
    return fallback(() => localBackend.deleteDatabase(databaseId));
  }
}

export async function saveProject(draft: ProjectDraft): Promise<Project> {
  if (backendMode === "local") {
    return localBackend.saveProject(draft);
  }

  try {
    const result = await callTauri<Project>("config_save_project", { draft });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
    return result;
  } catch {
    return fallback(() => localBackend.saveProject(draft));
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  if (backendMode === "local") {
    return localBackend.deleteProject(projectId);
  }

  try {
    await callTauri<void>("config_delete_project", { projectId });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
  } catch {
    return fallback(() => localBackend.deleteProject(projectId));
  }
}

export async function saveProvider(draft: ProviderDraft): Promise<ProviderConfig> {
  if (backendMode === "local") {
    return localBackend.saveProvider(draft);
  }

  try {
    const result = await callTauri<ProviderConfig>("config_save_provider", { draft });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
    return result;
  } catch {
    return fallback(() => localBackend.saveProvider(draft));
  }
}

export async function deleteProvider(providerId: string): Promise<void> {
  if (backendMode === "local") {
    return localBackend.deleteProvider(providerId);
  }

  try {
    await callTauri<void>("config_delete_provider", { providerId });
    backendMode = "tauri";
    await syncLocalConfigFromTauri();
  } catch {
    return fallback(() => localBackend.deleteProvider(providerId));
  }
}

export async function connectProject(projectId: string): Promise<{
  session: SessionSummary;
  tab: TerminalTab;
  logs: LogChunk[];
}> {
  return withBackend("ssh_connect_project", { projectId }, () => localBackend.connectProject(projectId));
}

export async function createTerminalTab(projectId: string, currentCount: number): Promise<{
  session: SessionSummary;
  tab: TerminalTab;
}> {
  return withBackend("ssh_create_terminal_tab", { projectId, currentCount }, () =>
    localBackend.createTerminalTab(projectId, currentCount),
  );
}

export async function executeSessionCommand(
  sessionId: string,
  command: string,
): Promise<{
  session: SessionSummary;
  lines: string[];
}> {
  return withBackend("ssh_execute_session_command", { sessionId, command }, () =>
    localBackend.executeSessionCommand(sessionId, command),
  );
}

export async function refreshProjectLogs(projectId: string): Promise<LogChunk[]> {
  return withBackend("logs_refresh_project", { projectId }, () => localBackend.refreshProjectLogs(projectId));
}

export async function runDatabaseQuery(databaseId: string, statement: string): Promise<QueryResult> {
  return withBackend("database_run_query", { databaseId, statement }, () =>
    localBackend.runDatabaseQuery(databaseId, statement),
  );
}

export async function analyzeProject(
  projectId: string,
  context: AiContextPack,
): Promise<AiConversationResponse> {
  if (backendMode === "local") {
    return localBackend.analyzeProject(projectId, context);
  }
  // AI calls never silently fall back to mock — surface the real error.
  try {
    const result = await callTauri<AiConversationResponse>("ai_analyze_project", { projectId, context });
    backendMode = "tauri";
    return result;
  } catch (error) {
    if (backendMode === "unknown") {
      // First call ever failed — Tauri not available, use local.
      backendMode = "local";
      return localBackend.analyzeProject(projectId, context);
    }
    throw error;
  }
}

export async function sendAiFollowup(
  projectId: string,
  context: AiContextPack,
  history: AIMessage[],
  prompt: string,
): Promise<AiConversationResponse> {
  if (backendMode === "local") {
    return localBackend.sendAiFollowup(projectId, context, history, prompt);
  }
  try {
    const result = await callTauri<AiConversationResponse>("ai_send_followup", { projectId, context, history, prompt });
    backendMode = "tauri";
    return result;
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return localBackend.sendAiFollowup(projectId, context, history, prompt);
    }
    throw error;
  }
}

export async function confirmSuggestedCommand(
  projectId: string,
  sessionId: string | undefined,
  suggestion: AiCommandSuggestion,
): Promise<{ session: SessionSummary; lines: string[] }> {
  return withBackend("ai_confirm_suggested_command", { projectId, sessionId, suggestion }, () =>
    localBackend.confirmSuggestedCommand(projectId, sessionId, suggestion),
  );
}

export async function validateProvider(providerId: string): Promise<{ ok: boolean; message: string }> {
  return withBackend("ai_validate_provider", { providerId }, () => localBackend.validateProvider(providerId));
}

export async function inspectCredentialRef(ref?: string | null): Promise<boolean> {
  return withBackend("secure_inspect_credential", { reference: ref }, () =>
    localBackend.inspectCredentialRef(ref),
  );
}

export function getResolvedBackendMode(): "unknown" | "tauri" | "local" {
  return backendMode;
}
