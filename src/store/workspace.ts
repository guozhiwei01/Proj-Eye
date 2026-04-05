import { create } from "zustand";
import {
  connectProject,
  createTerminalTab,
  executeSessionCommand,
  refreshProjectLogs,
  runDatabaseQuery,
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
  setCommandDraft: (sessionId: string, command: string) => void;
  executeCommand: (sessionId: string, commandOverride?: string) => Promise<void>;
  refreshLogs: (projectId: string) => Promise<void>;
  upsertSession: (session: SessionSummary) => void;
  appendTranscript: (sessionId: string, lines: string[]) => void;
  setQueryDraft: (databaseId: string, statement: string) => void;
  executeQuery: (databaseId: string) => Promise<void>;
  clearProjectRuntime: (projectId: string) => void;
  ingestRuntimeConnection: (payload: {
    session: SessionSummary;
    tab: TerminalTab;
    logs?: LogChunk[];
  }) => void;
  ingestLogs: (logs: LogChunk[]) => void;
}

const defaultMetrics: HealthMetrics = {
  cpu: 0,
  memory: 0,
  logRate: 0,
  dbLatency: 0,
};

function mergeById<T extends { id: string }>(items: T[], additions: T[]): T[] {
  const next = new Map(items.map((item) => [item.id, item]));
  additions.forEach((item) => {
    next.set(item.id, item);
  });
  return [...next.values()];
}

function buildMetrics(logs: LogChunk[]): HealthMetrics {
  return {
    cpu: Math.min(85, 26 + logs.length * 12),
    memory: Math.min(78, 33 + logs.length * 8),
    logRate: logs.length * 24,
    dbLatency: 22 + logs.length * 4,
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  connectionState: WorkspaceConnectionState.Idle,
  terminalTabs: [],
  sessions: [],
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
    if (get().sessions.some((session) => session.projectId === projectId)) {
      set({ connectionState: WorkspaceConnectionState.Ready });
      return;
    }
    set({ connectionState: WorkspaceConnectionState.Connecting });
    try {
      const payload = await connectProject(projectId);
      get().ingestRuntimeConnection(payload);
    } catch {
      set({ connectionState: WorkspaceConnectionState.Failed });
    }
  },

  setActiveTab: (tabId) =>
    set((state) => ({
      terminalTabs: state.terminalTabs.map((tab) => ({
        ...tab,
        active: tab.id === tabId,
      })),
    })),

  addTab: async (projectId) => {
    const currentCount = get().terminalTabs.filter((tab) => tab.projectId === projectId).length;
    const { session, tab } = await createTerminalTab(projectId, currentCount);
    set((state) => ({
      terminalTabs: [
        ...state.terminalTabs.map((existing) => ({
          ...existing,
          active: existing.projectId === projectId ? false : existing.active,
        })),
        tab,
      ],
      sessions: [...state.sessions, session],
      connectionState: WorkspaceConnectionState.Ready,
    }));
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
          session.id === payload.session.id ? payload.session : session,
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

  upsertSession: (session) =>
    set((state) => ({
      sessions: mergeById(state.sessions, [session]),
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

  ingestRuntimeConnection: ({ session, tab, logs = [] }) =>
    set((state) => {
      const nextTabs = mergeById(
        state.terminalTabs.filter((item) => item.projectId !== session.projectId),
        [tab],
      ).map((item) => ({
        ...item,
        active: item.projectId === session.projectId ? item.id === tab.id : item.active,
      }));
      const nextSessions = mergeById(
        state.sessions.filter((item) => item.projectId !== session.projectId),
        [session],
      );
      const nextLogs = mergeById(
        state.logs.filter((item) => item.projectId !== session.projectId),
        logs,
      );

      return {
        connectionState: WorkspaceConnectionState.Ready,
        terminalTabs: nextTabs,
        sessions: nextSessions,
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
