import { create } from "zustand";
import {
  snapshotSave,
  snapshotGet,
  snapshotRemove,
  snapshotListAll,
  snapshotListValid,
  snapshotCleanupExpired,
  type ReconnectSnapshot,
  type TerminalTabSnapshot,
} from "../lib/backend";

interface SnapshotStore {
  // State
  snapshots: Map<string, ReconnectSnapshot>;
  isLoading: boolean;
  error: string | null;

  // Actions
  saveSnapshot: (
    projectId: string,
    reason: "disconnect" | "error" | "manual" | "periodic",
    options?: {
      serverId?: string;
      databaseId?: string;
      activeNodeIds?: string[];
      terminalTabs?: TerminalTabSnapshot[];
      activeLogSources?: string[];
      lastAiPrompt?: string;
      lastConnectionState?: string;
    }
  ) => Promise<void>;

  getSnapshot: (projectId: string) => Promise<ReconnectSnapshot | null>;
  removeSnapshot: (projectId: string) => Promise<void>;
  loadAllSnapshots: () => Promise<void>;
  loadValidSnapshots: (maxAgeMs: number) => Promise<void>;
  cleanupExpired: (maxAgeMs: number) => Promise<number>;

  // Helpers
  hasSnapshot: (projectId: string) => boolean;
  getSnapshotAge: (projectId: string) => number | null;
  isSnapshotValid: (projectId: string, maxAgeMs: number) => boolean;
}

export const useSnapshotStore = create<SnapshotStore>((set, get) => ({
  // Initial state
  snapshots: new Map(),
  isLoading: false,
  error: null,

  // Save a snapshot
  saveSnapshot: async (projectId, reason, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      await snapshotSave(projectId, reason, options);

      // Reload the snapshot to get the full data
      const snapshot = await snapshotGet(projectId);
      if (snapshot) {
        set((state) => {
          const newSnapshots = new Map(state.snapshots);
          newSnapshots.set(projectId, snapshot);
          return { snapshots: newSnapshots, isLoading: false };
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Get a snapshot
  getSnapshot: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const snapshot = await snapshotGet(projectId);
      if (snapshot) {
        set((state) => {
          const newSnapshots = new Map(state.snapshots);
          newSnapshots.set(projectId, snapshot);
          return { snapshots: newSnapshots, isLoading: false };
        });
      } else {
        set({ isLoading: false });
      }
      return snapshot;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Remove a snapshot
  removeSnapshot: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      await snapshotRemove(projectId);
      set((state) => {
        const newSnapshots = new Map(state.snapshots);
        newSnapshots.delete(projectId);
        return { snapshots: newSnapshots, isLoading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Load all snapshots
  loadAllSnapshots: async () => {
    set({ isLoading: true, error: null });
    try {
      const snapshots = await snapshotListAll();
      const snapshotMap = new Map<string, ReconnectSnapshot>();
      snapshots.forEach((s) => snapshotMap.set(s.projectId, s));
      set({ snapshots: snapshotMap, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Load valid snapshots
  loadValidSnapshots: async (maxAgeMs) => {
    set({ isLoading: true, error: null });
    try {
      const snapshots = await snapshotListValid(maxAgeMs);
      const snapshotMap = new Map<string, ReconnectSnapshot>();
      snapshots.forEach((s) => snapshotMap.set(s.projectId, s));
      set({ snapshots: snapshotMap, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Cleanup expired snapshots
  cleanupExpired: async (maxAgeMs) => {
    set({ isLoading: true, error: null });
    try {
      const count = await snapshotCleanupExpired(maxAgeMs);
      // Reload valid snapshots after cleanup
      await get().loadValidSnapshots(maxAgeMs);
      return count;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Helper: Check if snapshot exists
  hasSnapshot: (projectId) => {
    return get().snapshots.has(projectId);
  },

  // Helper: Get snapshot age in milliseconds
  getSnapshotAge: (projectId) => {
    const snapshot = get().snapshots.get(projectId);
    if (!snapshot) return null;
    return Date.now() - snapshot.capturedAt;
  },

  // Helper: Check if snapshot is valid
  isSnapshotValid: (projectId, maxAgeMs) => {
    const age = get().getSnapshotAge(projectId);
    if (age === null) return false;
    return age < maxAgeMs;
  },
}));
