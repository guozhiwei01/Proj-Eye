/**
 * Session Registry Store
 *
 * 管理 session 的注册和生命周期
 * 与后端 SessionRegistry 同步
 */

import { create } from "zustand";
import type { SessionMetadata } from "../types/connection";
import * as backend from "../lib/backend";

interface SessionRegistryStore {
  // 状态
  sessions: Map<string, SessionMetadata>;
  loading: boolean;
  error: string | null;

  // 操作
  register: (sessionId: string, projectId: string) => Promise<void>;
  get: (sessionId: string) => Promise<SessionMetadata | null>;
  touch: (sessionId: string) => Promise<void>;
  listByProject: (projectId: string) => Promise<SessionMetadata[]>;
  remove: (sessionId: string) => Promise<void>;
  removeByProject: (projectId: string) => Promise<void>;
  countByProject: (projectId: string) => Promise<number>;

  // 内部方法
  _updateLocal: (metadata: SessionMetadata) => void;
  _removeLocal: (sessionId: string) => void;
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
}

export const useSessionRegistry = create<SessionRegistryStore>((set, get) => ({
  sessions: new Map(),
  loading: false,
  error: null,

  register: async (sessionId: string, projectId: string) => {
    try {
      await backend.sessionRegister(sessionId, projectId);
      const metadata: SessionMetadata = {
        session_id: sessionId,
        project_id: projectId,
        created_at: Date.now(),
        last_active: Date.now(),
      };
      get()._updateLocal(metadata);
    } catch (error) {
      console.error("Failed to register session:", error);
      throw error;
    }
  },

  get: async (sessionId: string) => {
    try {
      const metadata = await backend.sessionGet(sessionId);
      if (metadata) {
        get()._updateLocal(metadata);
      }
      return metadata;
    } catch (error) {
      console.error("Failed to get session:", error);
      return null;
    }
  },

  touch: async (sessionId: string) => {
    try {
      await backend.sessionTouch(sessionId);
      const sessions = new Map(get().sessions);
      const existing = sessions.get(sessionId);
      if (existing) {
        sessions.set(sessionId, { ...existing, last_active: Date.now() });
        set({ sessions });
      }
    } catch (error) {
      console.error("Failed to touch session:", error);
      throw error;
    }
  },

  listByProject: async (projectId: string) => {
    try {
      get()._setLoading(true);
      const metadataList = await backend.sessionListByProject(projectId);
      const sessions = new Map(get().sessions);
      metadataList.forEach(meta => sessions.set(meta.session_id, meta));
      set({ sessions });
      return metadataList;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list sessions";
      get()._setError(message);
      throw error;
    } finally {
      get()._setLoading(false);
    }
  },

  remove: async (sessionId: string) => {
    try {
      await backend.sessionRemove(sessionId);
      get()._removeLocal(sessionId);
    } catch (error) {
      console.error("Failed to remove session:", error);
      throw error;
    }
  },

  removeByProject: async (projectId: string) => {
    try {
      const removed = await backend.sessionRemoveByProject(projectId);
      removed.forEach(meta => get()._removeLocal(meta.session_id));
    } catch (error) {
      console.error("Failed to remove sessions by project:", error);
      throw error;
    }
  },

  countByProject: async (projectId: string) => {
    try {
      return await backend.sessionCountByProject(projectId);
    } catch (error) {
      console.error("Failed to count sessions:", error);
      return 0;
    }
  },

  _updateLocal: (metadata: SessionMetadata) => {
    set(state => {
      const sessions = new Map(state.sessions);
      sessions.set(metadata.session_id, metadata);
      return { sessions };
    });
  },

  _removeLocal: (sessionId: string) => {
    set(state => {
      const sessions = new Map(state.sessions);
      sessions.delete(sessionId);
      return { sessions };
    });
  },

  _setLoading: (loading: boolean) => {
    set({ loading });
  },

  _setError: (error: string | null) => {
    set({ error });
  },
}));
