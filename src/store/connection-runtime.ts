/**
 * Connection Runtime Store
 *
 * 管理项目连接的生命周期和状态
 * 与后端 ConnectionRuntime 同步
 */

import { create } from "zustand";
import type { ConnectionContext, ConnectionState } from "../types/connection";
import * as backend from "../lib/backend";

interface ConnectionRuntimeStore {
  // 状态
  connections: Map<string, ConnectionContext>;
  loading: boolean;
  error: string | null;

  // 操作
  register: (projectId: string) => Promise<ConnectionContext>;
  get: (projectId: string) => Promise<ConnectionContext | null>;
  updateState: (projectId: string, state: ConnectionState) => Promise<void>;
  setError: (projectId: string, error: string) => Promise<void>;
  bindSession: (projectId: string, sessionId: string) => Promise<void>;
  unbindSession: (projectId: string, sessionId: string) => Promise<void>;
  addNode: (projectId: string, nodeId: string) => Promise<void>;
  removeNode: (projectId: string, nodeId: string) => Promise<void>;
  recordSuccess: (projectId: string, latencyMs?: number) => Promise<void>;
  updateHealthCheck: (projectId: string) => Promise<void>;
  remove: (projectId: string) => Promise<void>;
  listAll: () => Promise<ConnectionContext[]>;
  listByState: (state: ConnectionState) => Promise<ConnectionContext[]>;
  listWithActiveNodes: () => Promise<ConnectionContext[]>;
  listByServer: (serverId: string) => Promise<ConnectionContext[]>;

  // 内部方法
  _updateLocal: (context: ConnectionContext) => void;
  _removeLocal: (projectId: string) => void;
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
}

export const useConnectionRuntime = create<ConnectionRuntimeStore>((set, get) => ({
  connections: new Map(),
  loading: false,
  error: null,

  register: async (projectId: string) => {
    try {
      get()._setLoading(true);
      get()._setError(null);
      const context = await backend.connectionRegister(projectId);
      get()._updateLocal(context);
      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to register connection";
      get()._setError(message);
      throw error;
    } finally {
      get()._setLoading(false);
    }
  },

  get: async (projectId: string) => {
    try {
      const context = await backend.connectionGet(projectId);
      if (context) {
        get()._updateLocal(context);
      }
      return context;
    } catch (error) {
      console.error("Failed to get connection:", error);
      return null;
    }
  },

  updateState: async (projectId: string, state: ConnectionState) => {
    try {
      await backend.connectionUpdateState(projectId, state);
      const connections = new Map(get().connections);
      const existing = connections.get(projectId);
      if (existing) {
        connections.set(projectId, { ...existing, state });
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to update connection state:", error);
      throw error;
    }
  },

  setError: async (projectId: string, error: string) => {
    try {
      await backend.connectionSetError(projectId, error);
      const connections = new Map(get().connections);
      const existing = connections.get(projectId);
      if (existing) {
        connections.set(projectId, { ...existing, error: error });
        set({ connections });
      }
    } catch (err) {
      console.error("Failed to set connection error:", err);
      throw err;
    }
  },

  bindSession: async (projectId: string, sessionId: string) => {
    try {
      await backend.connectionBindSession(projectId, sessionId);
      const connections = new Map(get().connections);
      const existing = connections.get(projectId);
      if (existing) {
        connections.set(projectId, { ...existing, session_id: sessionId });
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to bind session:", error);
      throw error;
    }
  },

  unbindSession: async (projectId: string, sessionId: string) => {
    try {
      await backend.connectionUnbindSession(projectId, sessionId);
      const connections = new Map(get().connections);
      const existing = connections.get(projectId);
      if (existing) {
        const sessionIds = existing.sessionIds.filter((id) => id !== sessionId);
        const primarySessionId = existing.primarySessionId === sessionId ? sessionIds[0] : existing.primarySessionId;
        connections.set(projectId, { ...existing, sessionIds, primarySessionId });
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to unbind session:", error);
      throw error;
    }
  },

  addNode: async (projectId: string, nodeId: string) => {
    try {
      await backend.connectionAddNode(projectId, nodeId);
      const connections = new Map(get().connections);
      const existing = connections.get(projectId);
      if (existing && !existing.nodeIds.includes(nodeId)) {
        connections.set(projectId, {
          ...existing,
          nodeIds: [...existing.nodeIds, nodeId],
        });
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to add node:", error);
      throw error;
    }
  },

  removeNode: async (projectId: string, nodeId: string) => {
    try {
      await backend.connectionRemoveNode(projectId, nodeId);
      const connections = new Map(get().connections);
      const existing = connections.get(projectId);
      if (existing) {
        connections.set(projectId, {
          ...existing,
          nodeIds: existing.nodeIds.filter((id) => id !== nodeId),
        });
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to remove node:", error);
      throw error;
    }
  },

  recordSuccess: async (projectId: string, latencyMs?: number) => {
    try {
      await backend.connectionRecordSuccess(projectId, latencyMs);
      // Optionally refresh the connection to get updated health metrics
      const updated = await backend.connectionGet(projectId);
      if (updated) {
        const connections = new Map(get().connections);
        connections.set(projectId, updated);
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to record success:", error);
      throw error;
    }
  },

  updateHealthCheck: async (projectId: string) => {
    try {
      await backend.connectionUpdateHealthCheck(projectId);
      const updated = await backend.connectionGet(projectId);
      if (updated) {
        const connections = new Map(get().connections);
        connections.set(projectId, updated);
        set({ connections });
      }
    } catch (error) {
      console.error("Failed to update health check:", error);
      throw error;
    }
  },

  remove: async (projectId: string) => {
    try {
      await backend.connectionRemove(projectId);
      get()._removeLocal(projectId);
    } catch (error) {
      console.error("Failed to remove connection:", error);
      throw error;
    }
  },

  listAll: async () => {
    try {
      get()._setLoading(true);
      const contexts = await backend.connectionListAll();
      const connections = new Map<string, ConnectionContext>();
      contexts.forEach(ctx => connections.set(ctx.project_id, ctx));
      set({ connections });
      return contexts;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list connections";
      get()._setError(message);
      throw error;
    } finally {
      get()._setLoading(false);
    }
  },

  listByState: async (state: ConnectionState) => {
    try {
      const contexts = await backend.connectionListByState(state);
      return contexts;
    } catch (error) {
      console.error("Failed to list connections by state:", error);
      throw error;
    }
  },

  listWithActiveNodes: async () => {
    try {
      const contexts = await backend.connectionListWithActiveNodes();
      return contexts;
    } catch (error) {
      console.error("Failed to list connections with active nodes:", error);
      throw error;
    }
  },

  listByServer: async (serverId: string) => {
    try {
      const contexts = await backend.connectionListByServer(serverId);
      return contexts;
    } catch (error) {
      console.error("Failed to list connections by server:", error);
      throw error;
    }
  },

  _updateLocal: (context: ConnectionContext) => {
    set(state => {
      const connections = new Map(state.connections);
      connections.set(context.project_id, context);
      return { connections };
    });
  },

  _removeLocal: (projectId: string) => {
    set(state => {
      const connections = new Map(state.connections);
      connections.delete(projectId);
      return { connections };
    });
  },

  _setLoading: (loading: boolean) => {
    set({ loading });
  },

  _setError: (error: string | null) => {
    set({ error });
  },
}));
