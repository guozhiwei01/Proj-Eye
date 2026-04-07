import { create } from "zustand";
import {
  bootstrapApp,
  deleteDatabase as deleteDatabaseRecord,
  deleteProject as deleteProjectRecord,
  deleteProvider as deleteProviderRecord,
  deleteServer as deleteServerRecord,
  getSecureStatus,
  initializeMasterPassword,
  lockSecureStore,
  refreshConfig,
  saveDatabase as persistDatabase,
  saveProject as persistProject,
  saveProvider as persistProvider,
  saveServer as persistServer,
  saveSettings as persistSettings,
  unlockSecureStore,
} from "../lib/backend";
import {
  AppView,
  FilterMode,
  ManagementSection,
  ThemeMode,
  emptyConfigBundle,
  type AppBootstrapState,
  type AppConfigBundle,
  type AppHealthSnapshot,
  type AppSettings,
  type DatabaseDraft,
  type DatabaseResource,
  type FilterMode as FilterModeValue,
  type ManagementSection as ManagementSectionValue,
  type Project,
  type ProjectDraft,
  type ProviderConfig,
  type ProviderDraft,
  type SecureStoreStatus,
  type Server,
  type ServerDraft,
  type ThemeMode as ThemeModeValue,
  type AppView as AppViewValue,
} from "../types/models";
import { useWorkspaceStore } from "./workspace";

interface AppState {
  bootstrapping: boolean;
  initialized: boolean;
  backendMode: "unknown" | "tauri" | "local";
  health: AppHealthSnapshot | null;
  healthError: string | null;
  secureStatus: SecureStoreStatus;
  config: AppConfigBundle;
  theme: ThemeModeValue;
  searchQuery: string;
  filterMode: FilterModeValue;
  activeView: AppViewValue;
  managementSection: ManagementSectionValue;
  activeProjectId: string;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setTheme: (theme: ThemeModeValue) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilterMode: (mode: FilterModeValue) => void;
  setActiveView: (view: AppViewValue) => void;
  setManagementSection: (section: ManagementSectionValue) => void;
  setActiveProjectId: (projectId: string) => void;
  initializeVault: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<void>;
  lockVault: () => Promise<void>;
  saveServer: (draft: ServerDraft) => Promise<Server>;
  deleteServer: (serverId: string) => Promise<void>;
  saveDatabase: (draft: DatabaseDraft) => Promise<DatabaseResource>;
  deleteDatabase: (databaseId: string) => Promise<void>;
  saveProject: (draft: ProjectDraft) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  saveProvider: (draft: ProviderDraft) => Promise<ProviderConfig>;
  deleteProvider: (providerId: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
}

const defaultSecureStatus: SecureStoreStatus = {
  strategy: "fallback_vault",
  initialized: false,
  locked: false,
  keyringAvailable: false,
  message: "Secure store has not been initialized yet.",
};

function resolveNextProjectId(config: AppConfigBundle, currentId: string): string {
  if (config.projects.some((project) => project.id === currentId)) {
    return currentId;
  }

  return config.projects[0]?.id ?? "";
}

function setBootstrapState(
  set: (partial: Partial<AppState>) => void,
  bootstrap: AppBootstrapState,
  currentProjectId: string,
): void {
  const nextProjectId = resolveNextProjectId(bootstrap.config, currentProjectId);
  set({
    bootstrapping: false,
    initialized: true,
    backendMode: bootstrap.backendMode,
    health: bootstrap.health,
    healthError: null,
    secureStatus: bootstrap.secureStatus,
    config: bootstrap.config,
    theme: bootstrap.config.settings.theme,
    activeProjectId: nextProjectId,
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  bootstrapping: true,
  initialized: false,
  backendMode: "unknown",
  health: null,
  healthError: null,
  secureStatus: defaultSecureStatus,
  config: emptyConfigBundle(),
  theme: ThemeMode.Teal,
  searchQuery: "",
  filterMode: FilterMode.All,
  activeView: AppView.Workspace,
  managementSection: ManagementSection.Projects,
  activeProjectId: "",

  initialize: async () => {
    set({ bootstrapping: true, healthError: null });
    try {
      const bootstrap = await bootstrapApp();
      setBootstrapState(set, bootstrap, get().activeProjectId);
    } catch (error) {
      set({
        bootstrapping: false,
        initialized: true,
        backendMode: "local",
        healthError: error instanceof Error ? error.message : "Failed to bootstrap the app.",
      });
    }
  },

  refresh: async () => {
    const config = await refreshConfig();
    const currentProjectId = get().activeProjectId;
    set({
      config,
      theme: config.settings.theme,
      activeProjectId: resolveNextProjectId(config, currentProjectId),
    });
  },

  setTheme: async (theme) => {
    const settings = {
      ...get().config.settings,
      theme,
    };
    await persistSettings(settings);
    set((state) => ({
      theme,
      config: {
        ...state.config,
        settings,
      },
    }));
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterMode: (filterMode) => set({ filterMode }),
  setActiveView: (activeView) => set({ activeView }),
  setManagementSection: (managementSection) => set({ managementSection, activeView: AppView.Manage }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId, activeView: AppView.Workspace }),

  initializeVault: async (password) => {
    const secureStatus = await initializeMasterPassword(password);
    set({ secureStatus });
  },

  unlockVault: async (password) => {
    const secureStatus = await unlockSecureStore(password);
    set({ secureStatus });
  },

  lockVault: async () => {
    const secureStatus = await lockSecureStore();
    set({ secureStatus });
  },

  saveServer: async (draft) => {
    try {
      const server = await persistServer(draft);
      await get().refresh();
      return server;
    } catch (error) {
      try {
        const secureStatus = await getSecureStatus();
        set({ secureStatus });
      } catch {
        // Keep the original save error as the primary failure signal.
      }
      throw error;
    }
  },

  deleteServer: async (serverId) => {
    const affectedProjectIds = get().config.projects
      .filter((project) => project.serverId === serverId)
      .map((project) => project.id);
    for (const projectId of affectedProjectIds) {
      await useWorkspaceStore.getState().closeProjectTabs(projectId);
    }
    await deleteServerRecord(serverId);
    await get().refresh();
  },

  saveDatabase: async (draft) => {
    try {
      const database = await persistDatabase(draft);
      await get().refresh();
      return database;
    } catch (error) {
      try {
        const secureStatus = await getSecureStatus();
        set({ secureStatus });
      } catch {
        // Keep the original save error as the primary failure signal.
      }
      throw error;
    }
  },

  deleteDatabase: async (databaseId) => {
    await deleteDatabaseRecord(databaseId);
    await get().refresh();
  },

  saveProject: async (draft) => {
    const project = await persistProject(draft);
    await get().refresh();
    set({ activeProjectId: project.id, activeView: AppView.Workspace });
    return project;
  },

  deleteProject: async (projectId) => {
    await useWorkspaceStore.getState().closeProjectTabs(projectId);
    await deleteProjectRecord(projectId);
    await get().refresh();
  },

  saveProvider: async (draft) => {
    try {
      const provider = await persistProvider(draft);
      await get().refresh();
      return provider;
    } catch (error) {
      try {
        const secureStatus = await getSecureStatus();
        set({ secureStatus });
      } catch {
        // Keep the original save error as the primary failure signal.
      }
      throw error;
    }
  },

  deleteProvider: async (providerId) => {
    await deleteProviderRecord(providerId);
    await get().refresh();
  },

  saveSettings: async (settings) => {
    await persistSettings(settings);
    set((state) => ({
      config: {
        ...state.config,
        settings,
      },
      theme: settings.theme,
    }));
  },
}));
