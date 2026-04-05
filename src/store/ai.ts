import { create } from "zustand";
import { analyzeProject, confirmSuggestedCommand } from "../lib/backend";
import { useWorkspaceStore } from "./workspace";
import {
  AIStatus,
  type AIMessage,
  type AIStatus as AIStatusValue,
  type AiCommandSuggestion,
  type AiContextPack,
} from "../types/models";

interface AIState {
  status: AIStatusValue;
  messagesByProject: Record<string, AIMessage[]>;
  suggestionsByProject: Record<string, AiCommandSuggestion | null>;
  setStatus: (status: AIStatusValue) => void;
  analyze: (projectId: string, projectName: string, databaseSummary: string[]) => Promise<void>;
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

export const useAiStore = create<AIState>((set, get) => ({
  status: AIStatus.Ready,
  messagesByProject: {},
  suggestionsByProject: {},

  setStatus: (status) => set({ status }),

  analyze: async (projectId, projectName, databaseSummary) => {
    set({ status: AIStatus.Analyzing });
    try {
      const context = buildContext(projectId, projectName, databaseSummary);
      const response = await analyzeProject(projectId, context);
      set((state) => ({
        status: AIStatus.Ready,
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
      set((state) => ({
        status: AIStatus.Error,
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content:
                error instanceof Error ? error.message : "AI analysis could not be completed.",
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
      set((state) => ({
        status: AIStatus.Error,
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content:
                error instanceof Error ? error.message : "The suggested command could not be executed.",
              createdAt: Date.now(),
            },
          ],
        },
      }));
    }
  },
}));
