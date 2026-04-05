import { create } from "zustand";
import { analyzeProject, confirmSuggestedCommand, sendAiFollowup } from "../lib/backend";
import { localizeErrorMessage, translate } from "../lib/i18n";
import { useAppStore } from "./app";
import { useWorkspaceStore } from "./workspace";
import {
  AIStatus,
  type AIMessage,
  type AIStatus as AIStatusValue,
  type AiCommandSuggestion,
  type AiContextPack,
  type Locale,
} from "../types/models";

interface AIState {
  statusByProject: Record<string, AIStatusValue>;
  messagesByProject: Record<string, AIMessage[]>;
  suggestionsByProject: Record<string, AiCommandSuggestion | null>;
  setStatus: (projectId: string, status: AIStatusValue) => void;
  analyze: (projectId: string, projectName: string, databaseSummary: string[]) => Promise<void>;
  sendFollowup: (
    projectId: string,
    projectName: string,
    databaseSummary: string[],
    prompt: string,
  ) => Promise<void>;
  confirmSuggestion: (projectId: string) => Promise<void>;
}

function buildContext(projectId: string, projectName: string, databaseSummary: string[]): AiContextPack {
  const workspace = useWorkspaceStore.getState();
  const activeTab = workspace.terminalTabs.find((tab) => tab.projectId === projectId && tab.active);
  const session = workspace.sessions.find((item) => item.id === activeTab?.sessionId);
  const logs = workspace.logs
    .filter((item) => item.projectId === projectId)
    .slice(-5)
    .map((item) => item.line);

  return {
    projectId,
    projectName,
    terminalSnippet: session?.transcript.slice(-6) ?? [],
    logSnippet: logs,
    databaseSummary,
  };
}

function currentLocale(): Locale {
  return useAppStore.getState().config.settings.locale;
}

function errorMessage(error: unknown, locale: Locale, fallbackKey: string): string {
  const localized = localizeErrorMessage(locale, error);
  return localized === "Unknown error" ? translate(locale, fallbackKey) : localized;
}

export const useAiStore = create<AIState>((set, get) => ({
  statusByProject: {},
  messagesByProject: {},
  suggestionsByProject: {},

  setStatus: (projectId, status) =>
    set((state) => ({
      statusByProject: {
        ...state.statusByProject,
        [projectId]: status,
      },
    })),

  analyze: async (projectId, projectName, databaseSummary) => {
    get().setStatus(projectId, AIStatus.Analyzing);
    try {
      const context = buildContext(projectId, projectName, databaseSummary);
      const response = await analyzeProject(projectId, context);
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [...(state.messagesByProject[projectId] ?? []), ...response.messages],
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: response.suggestion,
        },
      }));
    } catch (error) {
      const locale = currentLocale();
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Error,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content: errorMessage(error, locale, "ai.requestFailed"),
              createdAt: Date.now(),
            },
          ],
        },
      }));
    }
  },

  sendFollowup: async (projectId, projectName, databaseSummary, prompt) => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    const context = buildContext(projectId, projectName, databaseSummary);
    const history = get().messagesByProject[projectId] ?? [];
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      speaker: "user",
      content: nextPrompt,
      createdAt: Date.now(),
    };

    set((state) => ({
      statusByProject: {
        ...state.statusByProject,
        [projectId]: AIStatus.Analyzing,
      },
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: [...(state.messagesByProject[projectId] ?? []), userMessage],
      },
    }));

    try {
      const response = await sendAiFollowup(projectId, context, history, nextPrompt);
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [...(state.messagesByProject[projectId] ?? []), ...response.messages],
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: response.suggestion,
        },
      }));
    } catch (error) {
      const locale = currentLocale();
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Error,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content: errorMessage(error, locale, "ai.requestFailed"),
              createdAt: Date.now(),
            },
          ],
        },
      }));
    }
  },

  confirmSuggestion: async (projectId) => {
    const suggestion = get().suggestionsByProject[projectId];
    if (!suggestion) {
      return;
    }

    const workspace = useWorkspaceStore.getState();
    const activeTab = workspace.terminalTabs.find((tab) => tab.projectId === projectId && tab.active);
    try {
      const payload = await confirmSuggestedCommand(projectId, activeTab?.sessionId, suggestion);
      workspace.upsertSession(payload.session);
    } catch (error) {
      const locale = currentLocale();
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Error,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content: errorMessage(error, locale, "ai.commandFailed"),
              createdAt: Date.now(),
            },
          ],
        },
      }));
    }
  },
}));
