import { create } from "zustand";
import {
  connectProject,
  createTerminalTab,
  executeSessionCommand,
  refreshProjectLogs,
  runDatabaseQuery,
  writeSessionInput,
  resizeSession,
  closeSession,
  reconnectSession as reconnectTerminalSession,
} from "../lib/backend";
import {
  WorkspaceConnectionState,
  type HealthMetrics,
  type LogChunk,
  type QueryResult,
  type SessionSummary,
  type TerminalTab,
  type WorkspaceConnectionState as WorkspaceConnectionStateValue,
} from "../types/models";

interface WorkspaceState {
  connectionState: WorkspaceConnectionStateValue;
  terminalTabs: TerminalTab[];
  sessions: SessionSummary[];
  terminalBuffers: Record<string, string>;
  logs: LogChunk[];
  metrics: HealthMetrics;
  commandDrafts: Record<string, string>;
  commandErrors: Record<string, string | null>;
  commandBusy: Record<string, boolean>;
  queryDrafts: Record<string, string>;
  queryResults: Record<string, QueryResult | null>;
  queryErrors: Record<string, string | null>;
  setConnectionState: (state: WorkspaceConnectionStateValue) => void;
  hydrateProject: (projectId: string) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  addTab: (projectId: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  closeProjectTabs: (projectId: string) => Promise<void>;
  setCommandDraft: (sessionId: string, command: string) => void;
  executeCommand: (sessionId: string, commandOverride?: string) => Promise<void>;
  writeTerminalInput: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  reconnectSession: (sessionId: string) => Promise<void>;
  refreshLogs: (projectId: string) => Promise<void>;
  upsertSession: (session: SessionSummary) => void;
  appendTerminalData: (sessionId: string, data: string) => void;
  appendTranscript: (sessionId: string, lines: string[]) => void;
  setQueryDraft: (databaseId: string, statement: string) => void;
  executeQuery: (databaseId: string) => Promise<void>;
  clearProjectRuntime: (projectId: string) => void;
  ingestRuntimeConnection: (event: {
    kind: "connected" | "tab-opened";
    payload: {
      session: SessionSummary;
      tab: TerminalTab;
      logs?: LogChunk[];
    };
  }) => void;
  ingestLogs: (logs: LogChunk[]) => void;
}

const defaultMetrics: HealthMetrics = {
  cpu: 0,
  memory: 0,
  logRate: 0,
  dbLatency: 0,
};

const hydrationInFlight = new Set<string>();

function mergeById<T extends { id: string }>(items: T[], additions: T[]): T[] {
  const next = new Map(items.map((item) => [item.id, item]));
  additions.forEach((item) => {
    next.set(item.id, item);
  });
  return [...next.values()];
}

function mergeSessionSnapshot(current: SessionSummary, incoming: SessionSummary): SessionSummary {
  if (current.transcript.length > incoming.transcript.length) {
    return {
      ...incoming,
      transcript: current.transcript,
    };
  }

  return incoming;
}

function seedTerminalBuffer(session: SessionSummary): string {
  if (session.transcript.length === 0) {
    return "";
  }

  return `${session.transcript.join("\r\n")}\r\n`;
}

function buildMetrics(logs: LogChunk[]): HealthMetrics {
  return {
    cpu: Math.min(85, 26 + logs.length * 12),
    memory: Math.min(78, 33 + logs.length * 8),
    logRate: logs.length * 24,
    dbLatency: 22 + logs.length * 4,
  };
}

function buildSessionRuntimeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `[terminal input error] ${error.message.trim()}`;
  }

  if (typeof error === "string" && error.trim()) {
    return `[terminal input error] ${error.trim()}`;
  }

  return "[terminal input error] Unable to write to the interactive shell.";
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  connectionState: WorkspaceConnectionState.Idle,
  terminalTabs: [],
  sessions: [],
  terminalBuffers: {},
  logs: [],
  metrics: defaultMetrics,
  commandDrafts: {},
  commandErrors: {},
  commandBusy: {},
  queryDrafts: {},
  queryResults: {},
  queryErrors: {},

  setConnectionState: (connectionState) => set({ connectionState }),

  hydrateProject: async (projectId) => {
    if (
      hydrationInFlight.has(projectId) ||
      get().terminalTabs.some((tab) => tab.projectId === projectId)
    ) {
      set({ connectionState: WorkspaceConnectionState.Ready });
      return;
    }

    hydrationInFlight.add(projectId);
    set({ connectionState: WorkspaceConnectionState.Connecting });
    try {
      const payload = await connectProject(projectId);
      get().ingestRuntimeConnection({ kind: "connected", payload });
    } catch {
      set({ connectionState: WorkspaceConnectionState.Failed });
    } finally {
      hydrationInFlight.delete(projectId);
    }
  },

  setActiveTab: (tabId) =>
    set((state) => {
      const target = state.terminalTabs.find((tab) => tab.id === tabId);
      if (!target) {
        return state;
      }

      return {
        terminalTabs: state.terminalTabs.map((tab) => ({
          ...tab,
          active: tab.projectId === target.projectId ? tab.id === tabId : tab.active,
        })),
      };
    }),

  addTab: async (projectId) => {
    const currentCount = get().terminalTabs.filter((tab) => tab.projectId === projectId).length;
    const payload = await createTerminalTab(projectId, currentCount);
    get().ingestRuntimeConnection({ kind: "tab-opened", payload });
  },

  closeTab: async (tabId) => {
    const tab = get().terminalTabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }

    await closeSession(tab.sessionId);

    set((state) => {
      const remainingTabs = state.terminalTabs.filter((item) => item.id !== tabId);
      const sameProjectTabs = remainingTabs.filter((item) => item.projectId === tab.projectId);
      const nextActiveTabId = tab.active ? sameProjectTabs[0]?.id ?? null : null;
      const keepSessionIds = new Set(remainingTabs.map((item) => item.sessionId));

      return {
        terminalTabs: remainingTabs.map((item) => ({
          ...item,
          active:
            item.projectId === tab.projectId && nextActiveTabId
              ? item.id === nextActiveTabId
              : item.active,
        })),
        sessions: state.sessions.filter((item) => keepSessionIds.has(item.id)),
        terminalBuffers: Object.fromEntries(
          Object.entries(state.terminalBuffers).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
        commandDrafts: Object.fromEntries(
          Object.entries(state.commandDrafts).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
        commandErrors: Object.fromEntries(
          Object.entries(state.commandErrors).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
        commandBusy: Object.fromEntries(
          Object.entries(state.commandBusy).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
      };
    });
  },

  closeProjectTabs: async (projectId) => {
    const tabIds = get()
      .terminalTabs.filter((tab) => tab.projectId === projectId)
      .map((tab) => tab.id);

    for (const tabId of tabIds) {
      await get().closeTab(tabId);
    }
  },

  setCommandDraft: (sessionId, command) =>
    set((state) => ({
      commandDrafts: {
        ...state.commandDrafts,
        [sessionId]: command,
      },
      commandErrors: {
        ...state.commandErrors,
        [sessionId]: null,
      },
    })),

  executeCommand: async (sessionId, commandOverride) => {
    const command = (commandOverride ?? get().commandDrafts[sessionId] ?? "").trim();
    if (!command) {
      set((state) => ({
        commandErrors: {
          ...state.commandErrors,
          [sessionId]: "Command cannot be empty.",
        },
      }));
      return;
    }

    set((state) => ({
      commandBusy: {
        ...state.commandBusy,
        [sessionId]: true,
      },
      commandErrors: {
        ...state.commandErrors,
        [sessionId]: null,
      },
    }));

    try {
      const payload = await executeSessionCommand(sessionId, command);
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === payload.session.id ? mergeSessionSnapshot(session, payload.session) : session,
        ),
        commandBusy: {
          ...state.commandBusy,
          [sessionId]: false,
        },
        commandDrafts: {
          ...state.commandDrafts,
          [sessionId]: "",
        },
      }));
    } catch (error) {
      set((state) => ({
        commandBusy: {
          ...state.commandBusy,
          [sessionId]: false,
        },
        commandErrors: {
          ...state.commandErrors,
          [sessionId]: error instanceof Error ? error.message : "Unable to execute the command.",
        },
      }));
    }
  },

  refreshLogs: async (projectId) => {
    const logs = await refreshProjectLogs(projectId);
    get().ingestLogs(logs);
  },

  writeTerminalInput: async (sessionId, data) => {
    try {
      await writeSessionInput(sessionId, data);
    } catch (error) {
      const message = buildSessionRuntimeErrorMessage(error);
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                connectionState: WorkspaceConnectionState.Failed,
                transcript: [...session.transcript, message],
              }
            : session,
        ),
        terminalBuffers: {
          ...state.terminalBuffers,
          [sessionId]: `${state.terminalBuffers[sessionId] ?? ""}\r\n${message}\r\n`,
        },
      }));
    }
  },

  resizeTerminal: async (sessionId, cols, rows) => {
    try {
      await resizeSession(sessionId, cols, rows);
    } catch (error) {
      console.warn("Unable to resize terminal session", { sessionId, cols, rows, error });
    }
  },

  reconnectSession: async (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              connectionState: WorkspaceConnectionState.Reconnecting,
            }
          : session,
      ),
    }));

    try {
      const payload = await reconnectTerminalSession(sessionId);
      set((state) => ({
        sessions: [
          ...state.sessions.filter((session) => session.id !== sessionId),
          payload.session,
        ],
        terminalTabs: state.terminalTabs.map((tab) =>
          tab.id === payload.tab.id
            ? {
                ...payload.tab,
                active: true,
              }
            : tab.projectId === payload.tab.projectId
              ? {
                  ...tab,
                  active: false,
                }
              : tab,
        ),
        terminalBuffers: {
          ...Object.fromEntries(
            Object.entries(state.terminalBuffers).filter(([existingSessionId]) => existingSessionId !== sessionId),
          ),
          [payload.session.id]: seedTerminalBuffer(payload.session),
        },
        commandDrafts: Object.fromEntries(
          Object.entries(state.commandDrafts).filter(([existingSessionId]) => existingSessionId !== sessionId),
        ),
        commandErrors: Object.fromEntries(
          Object.entries(state.commandErrors).filter(([existingSessionId]) => existingSessionId !== sessionId),
        ),
        commandBusy: Object.fromEntries(
          Object.entries(state.commandBusy).filter(([existingSessionId]) => existingSessionId !== sessionId),
        ),
      }));
    } catch {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                connectionState: WorkspaceConnectionState.Failed,
              }
            : session,
        ),
      }));
    }
  },

  upsertSession: (session) =>
    set((state) => ({
      sessions: state.sessions.some((item) => item.id === session.id)
        ? state.sessions.map((item) => (item.id === session.id ? mergeSessionSnapshot(item, session) : item))
        : [...state.sessions, session],
      terminalBuffers: state.terminalBuffers[session.id]
        ? state.terminalBuffers
        : {
            ...state.terminalBuffers,
            [session.id]: seedTerminalBuffer(session),
          },
    })),

  appendTerminalData: (sessionId, data) =>
    set((state) => ({
      terminalBuffers: {
        ...state.terminalBuffers,
        [sessionId]: `${state.terminalBuffers[sessionId] ?? ""}${data}`,
      },
    })),

  appendTranscript: (sessionId, lines) =>
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              transcript: [...session.transcript, ...lines],
            }
          : session,
      ),
    })),

  setQueryDraft: (databaseId, statement) =>
    set((state) => ({
      queryDrafts: {
        ...state.queryDrafts,
        [databaseId]: statement,
      },
      queryErrors: {
        ...state.queryErrors,
        [databaseId]: null,
      },
    })),

  executeQuery: async (databaseId) => {
    const statement = get().queryDrafts[databaseId] ?? "";
    try {
      const result = await runDatabaseQuery(databaseId, statement);
      set((state) => ({
        queryResults: {
          ...state.queryResults,
          [databaseId]: result,
        },
        queryErrors: {
          ...state.queryErrors,
          [databaseId]: null,
        },
      }));
    } catch (error) {
      set((state) => ({
        queryErrors: {
          ...state.queryErrors,
          [databaseId]: error instanceof Error ? error.message : "Unable to execute the query.",
        },
      }));
    }
  },

  clearProjectRuntime: (projectId) =>
    set((state) => {
      const nextSessions = state.sessions.filter((session) => session.projectId !== projectId);
      const keepSessionIds = new Set(nextSessions.map((session) => session.id));

      return {
        terminalTabs: state.terminalTabs.filter((tab) => tab.projectId !== projectId),
        sessions: nextSessions,
        terminalBuffers: Object.fromEntries(
          Object.entries(state.terminalBuffers).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
        logs: state.logs.filter((log) => log.projectId !== projectId),
        commandDrafts: Object.fromEntries(
          Object.entries(state.commandDrafts).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
        commandErrors: Object.fromEntries(
          Object.entries(state.commandErrors).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
        commandBusy: Object.fromEntries(
          Object.entries(state.commandBusy).filter(([sessionId]) => keepSessionIds.has(sessionId)),
        ),
      };
    }),

  ingestRuntimeConnection: ({ kind, payload }) =>
    set((state) => {
      const { session, tab, logs = [] } = payload;
      const projectId = session.projectId;
      const nextTabs =
        kind === "connected"
          ? mergeById(
              state.terminalTabs.filter((item) => item.projectId !== projectId),
              [tab],
            ).map((item) => ({
              ...item,
              active: item.projectId === projectId ? item.id === tab.id : item.active,
            }))
          : mergeById(
              state.terminalTabs.map((item) => ({
                ...item,
                active: item.projectId === projectId ? false : item.active,
              })),
              [tab],
            ).map((item) => ({
              ...item,
              active: item.projectId === projectId ? item.id === tab.id : item.active,
            }));
      const nextSessions =
        kind === "connected"
          ? mergeById(
              state.sessions.filter((item) => item.projectId !== projectId),
              [session],
            )
          : mergeById(state.sessions, [session]);
      const nextLogs =
        kind === "connected"
          ? mergeById(
              state.logs.filter((item) => item.projectId !== projectId),
              logs,
            )
          : mergeById(state.logs, logs);

      return {
        connectionState: WorkspaceConnectionState.Ready,
        terminalTabs: nextTabs,
        sessions: nextSessions,
        terminalBuffers: {
          ...state.terminalBuffers,
          [session.id]: state.terminalBuffers[session.id] ?? seedTerminalBuffer(session),
        },
        logs: nextLogs,
        metrics: buildMetrics(nextLogs.filter((item) => item.projectId === session.projectId)),
      };
    }),

  ingestLogs: (logs) =>
    set((state) => {
      if (logs.length === 0) {
        return state;
      }

      const nextLogs = mergeById(state.logs, logs);
      const projectId = logs[0]?.projectId;
      const projectLogs = projectId
        ? nextLogs.filter((item) => item.projectId === projectId)
        : nextLogs;

      return {
        logs: nextLogs,
        metrics: buildMetrics(projectLogs),
      };
    }),
}));
