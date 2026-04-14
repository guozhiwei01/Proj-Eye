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
import type { ConnectionContext, ConnectionState, SessionMetadata } from "../types/connection";
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
  } catch (error) {
    if (backendMode === "unknown") {
      return fallback(localFactory);
    }
    throw error;
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

export async function writeSessionInput(sessionId: string, input: string): Promise<void> {
  return withBackend("ssh_write_session_input", { sessionId, input }, () =>
    localBackend.writeSessionInput(sessionId, input),
  );
}

export async function resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
  return withBackend("ssh_resize_session", { sessionId, cols, rows }, () =>
    localBackend.resizeSession(sessionId, cols, rows),
  );
}

export async function closeSession(sessionId: string): Promise<{ sessionId: string; tabId: string; projectId: string }> {
  return withBackend("ssh_close_session", { sessionId }, () => localBackend.closeSession(sessionId));
}

export async function reconnectSession(sessionId: string): Promise<{
  session: SessionSummary;
  tab: TerminalTab;
}> {
  return withBackend("ssh_reconnect_session", { sessionId }, () => localBackend.reconnectSession(sessionId));
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

export async function appendTimingLog(entry: Record<string, unknown>): Promise<void> {
  if (backendMode === "local") {
    return;
  }

  try {
    await callTauri<void>("diag_append_timing_log", { entry });
    backendMode = "tauri";
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return;
    }
    throw error;
  }
}

export async function getTimingLogPath(): Promise<string | null> {
  if (backendMode === "local") {
    return null;
  }

  try {
    const path = await callTauri<string>("diag_get_timing_log_path");
    backendMode = "tauri";
    return path;
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return null;
    }
    throw error;
  }
}

export async function inspectCredentialRef(ref?: string | null): Promise<boolean> {
  return withBackend("secure_inspect_credential", { reference: ref }, () =>
    localBackend.inspectCredentialRef(ref),
  );
}

export function getResolvedBackendMode(): "unknown" | "tauri" | "local" {
  return backendMode;
}

// Workspace Node API
export async function registerWorkspaceNode(
  nodeId: string,
  projectId: string,
  kind: string,
): Promise<void> {
  if (backendMode === "local") {
    return;
  }

  try {
    await callTauri<void>("workspace_register_node", { nodeId, projectId, kind });
    backendMode = "tauri";
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return;
    }
    throw error;
  }
}

export async function bindNodeToSession(nodeId: string, sessionId: string): Promise<void> {
  if (backendMode === "local") {
    return;
  }

  try {
    await callTauri<void>("workspace_bind_node_session", { nodeId, sessionId });
    backendMode = "tauri";
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return;
    }
    throw error;
  }
}

export async function getSessionByNode(nodeId: string): Promise<string | null> {
  if (backendMode === "local") {
    return null;
  }

  try {
    const result = await callTauri<string | null>("workspace_get_session_by_node", { nodeId });
    backendMode = "tauri";
    return result;
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return null;
    }
    throw error;
  }
}

export async function getNodeBySession(sessionId: string): Promise<string | null> {
  if (backendMode === "local") {
    return null;
  }

  try {
    const result = await callTauri<string | null>("workspace_get_node_by_session", { sessionId });
    backendMode = "tauri";
    return result;
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return null;
    }
    throw error;
  }
}

export async function updateNodeState(nodeId: string, state: string): Promise<void> {
  if (backendMode === "local") {
    return;
  }

  try {
    await callTauri<void>("workspace_update_node_state", { nodeId, state });
    backendMode = "tauri";
  } catch (error) {
    if (backendMode === "unknown") {
      backendMode = "local";
      return;
    }
    throw error;
  }
}

// ============================================================================
// Connection Runtime API
// ============================================================================

export async function connectionRegister(projectId: string): Promise<ConnectionContext> {
  return withBackend("connection_register", { projectId }, () => {
    throw new Error("Connection runtime not available in local mode");
  });
}

export async function connectionGet(projectId: string): Promise<ConnectionContext | null> {
  return withBackend("connection_get", { projectId }, async () => null);
}

export async function connectionUpdateState(projectId: string, state: ConnectionState): Promise<void> {
  return withBackend("connection_update_state", { projectId, state }, async () => {});
}

export async function connectionSetError(projectId: string, error: string): Promise<void> {
  return withBackend("connection_set_error", { projectId, error }, async () => {});
}

export async function connectionBindSession(projectId: string, sessionId: string): Promise<void> {
  return withBackend("connection_bind_session", { projectId, sessionId }, async () => {});
}

export async function connectionUnbindSession(projectId: string, sessionId: string): Promise<void> {
  return withBackend("connection_unbind_session", { projectId, sessionId }, async () => {});
}

export async function connectionAddNode(projectId: string, nodeId: string): Promise<void> {
  return withBackend("connection_add_node", { projectId, nodeId }, async () => {});
}

export async function connectionRemoveNode(projectId: string, nodeId: string): Promise<void> {
  return withBackend("connection_remove_node", { projectId, nodeId }, async () => {});
}

export async function connectionRecordSuccess(projectId: string, latencyMs?: number): Promise<void> {
  return withBackend("connection_record_success", { projectId, latencyMs }, async () => {});
}

export async function connectionUpdateHealthCheck(projectId: string): Promise<void> {
  return withBackend("connection_update_health_check", { projectId }, async () => {});
}

export async function connectionListWithActiveNodes(): Promise<ConnectionContext[]> {
  return withBackend("connection_list_with_active_nodes", {}, async () => []);
}

export async function connectionListByServer(serverId: string): Promise<ConnectionContext[]> {
  return withBackend("connection_list_by_server", { serverId }, async () => []);
}

export async function connectionRemove(projectId: string): Promise<ConnectionContext | null> {
  return withBackend("connection_remove", { projectId }, async () => null);
}

export async function connectionListAll(): Promise<ConnectionContext[]> {
  return withBackend("connection_list_all", {}, async () => []);
}

export async function connectionListByState(state: ConnectionState): Promise<ConnectionContext[]> {
  return withBackend("connection_list_by_state", { state }, async () => []);
}

export async function sessionRegister(sessionId: string, projectId: string): Promise<void> {
  return withBackend("session_register", { sessionId, projectId }, async () => {});
}

export async function sessionGet(sessionId: string): Promise<SessionMetadata | null> {
  return withBackend("session_get", { sessionId }, async () => null);
}

export async function sessionTouch(sessionId: string): Promise<void> {
  return withBackend("session_touch", { sessionId }, async () => {});
}

export async function sessionListByProject(projectId: string): Promise<SessionMetadata[]> {
  return withBackend("session_list_by_project", { projectId }, async () => []);
}

export async function sessionRemove(sessionId: string): Promise<SessionMetadata | null> {
  return withBackend("session_remove", { sessionId }, async () => null);
}

export async function sessionRemoveByProject(projectId: string): Promise<SessionMetadata[]> {
  return withBackend("session_remove_by_project", { projectId }, async () => []);
}

export async function sessionCountByProject(projectId: string): Promise<number> {
  return withBackend("session_count_by_project", { projectId }, async () => 0);
}

// ============================================================================
// Snapshot APIs
// ============================================================================

export interface SnapshotReason {
  type: "disconnect" | "error" | "manual" | "periodic";
}

export interface TerminalTabSnapshot {
  nodeId: string;
  title: string;
  cwd?: string;
  lastCommand?: string;
  index: number;
}

export interface ReconnectSnapshot {
  projectId: string;
  serverId?: string;
  databaseId?: string;
  activeNodeIds: string[];
  terminalTabs: TerminalTabSnapshot[];
  activeLogSources: string[];
  lastAiPrompt?: string;
  lastConnectionState: string;
  capturedAt: number;
  reason: string;
}

export async function snapshotSave(
  projectId: string,
  reason: string,
  options: {
    serverId?: string;
    databaseId?: string;
    activeNodeIds?: string[];
    terminalTabs?: TerminalTabSnapshot[];
    activeLogSources?: string[];
    lastAiPrompt?: string;
    lastConnectionState?: string;
  } = {}
): Promise<void> {
  return withBackend(
    "snapshot_create",
    {
      projectId,
      reason,
      serverId: options.serverId,
      databaseId: options.databaseId,
      activeNodeIds: options.activeNodeIds || [],
      terminalTabs: options.terminalTabs || [],
      activeLogSources: options.activeLogSources || [],
      lastAiPrompt: options.lastAiPrompt,
      lastConnectionState: options.lastConnectionState || "unknown",
    },
    async () => {}
  );
}

export async function snapshotGet(projectId: string): Promise<ReconnectSnapshot | null> {
  return withBackend("snapshot_get", { projectId }, async () => null);
}

export async function snapshotRemove(projectId: string): Promise<ReconnectSnapshot | null> {
  return withBackend("snapshot_remove", { projectId }, async () => null);
}

export async function snapshotListAll(): Promise<ReconnectSnapshot[]> {
  // Use snapshot_get for each known project, or return empty array
  // Since we don't have a list_all command anymore
  return [];
}

export async function snapshotListValid(_maxAgeMs: number): Promise<ReconnectSnapshot[]> {
  // Similar to above - would need to track projects separately
  return [];
}

export async function snapshotCleanupExpired(maxAgeMs: number): Promise<number> {
  return withBackend("snapshot_cleanup_expired", { maxAgeMs }, async () => 0);
}
