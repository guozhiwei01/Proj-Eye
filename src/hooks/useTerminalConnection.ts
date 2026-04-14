/**
 * useTerminalConnection Hook
 *
 * 将 Terminal 组件与新的 ConnectionRuntime 系统集成的桥接层。
 * 这个 hook 负责：
 * 1. 管理 terminal 的 workspace node 注册
 * 2. 将 session 绑定到 ConnectionContext
 * 3. 处理断线重连时的快照创建和恢复
 * 4. 同步连接状态到 ConnectionRuntime
 */

import { useEffect, useCallback, useRef } from 'react';
import { useConnectionRuntime } from '../store/connection-runtime';
import { useSessionRegistry } from '../store/session-registry';
import { useWorkspaceNodes } from '../store/workspace-nodes';
import { useSnapshotStore } from '../store/snapshot';
import type { SessionSummary, TerminalTab } from '../types/models';
import type { TerminalState } from '../types/snapshot';
import { ConnectionState } from '../types/connection';

interface UseTerminalConnectionOptions {
  projectId: string;
  session: SessionSummary | null;
  tab: TerminalTab | null;
  onReconnectComplete?: () => void;
}

interface TerminalConnectionResult {
  nodeId: string | null;
  connectionState: ConnectionState;
  isHealthy: boolean;
  createSnapshot: (terminalState: TerminalState) => Promise<void>;
  restoreFromSnapshot: (snapshotId: string) => Promise<TerminalState | null>;
}

export function useTerminalConnection({
  projectId,
  session,
  tab,
  onReconnectComplete,
}: UseTerminalConnectionOptions): TerminalConnectionResult {
  const { connections, createConnection, updateConnection } = useConnectionRuntime();
  const sessionRegistry = useSessionRegistry();
  const { registerNode, bindNodeToSession, getNodeBySessionId } = useWorkspaceNodes();
  const snapshotStore = useSnapshotStore();

  const nodeIdRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  // 1. 注册 workspace node（如果还没有）
  useEffect(() => {
    if (!tab || !session) return;

    const existingNode = getNodeBySessionId(session.id);
    if (existingNode) {
      nodeIdRef.current = existingNode.id;
      return;
    }

    // 创建新的 workspace node
    const newNode = {
      id: `terminal-${tab.id}-${Date.now()}`,
      projectId,
      kind: 'terminal' as const,
      title: tab.title || `Terminal ${tab.active ? 'Active' : ''}`,
      state: 'active' as const,
      backingSessionId: session.id,
      tabId: tab.id,
      cwd: session.cwd,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    registerNode(newNode);
    nodeIdRef.current = newNode.id;

    // 绑定 session 到 node
    if (session.id) {
      bindNodeToSession(newNode.id, session.id);
    }
  }, [tab?.id, session?.id, projectId, registerNode, bindNodeToSession, getNodeBySessionId]);

  // 2. 注册 session 到 SessionRegistry
  useEffect(() => {
    if (!session) return;

    sessionRegistry.register(session.id, session.projectId).catch(console.error);

    lastSessionIdRef.current = session.id;
  }, [session?.id, session?.projectId, sessionRegistry]);

  // 3. 确保 ConnectionContext 存在
  useEffect(() => {
    if (!session) return;

    const existingConnection = connections.get(projectId);
    if (!existingConnection) {
      createConnection({
        projectId,
        sessionIds: [session.id],
        nodeIds: nodeIdRef.current ? [nodeIdRef.current] : [],
        state: ConnectionState.Active,
        health: {
          successCount: 0,
          failureCount: 0,
          healthStatus: 'unknown',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).catch(console.error);
    }
  }, [projectId, session?.id, connections, createConnection]);

  // 4. 同步连接状态
  useEffect(() => {
    if (!session) return;

    const connectionStateMap: Record<string, ConnectionState> = {
      idle: ConnectionState.Idle,
      connecting: ConnectionState.Connecting,
      ready: ConnectionState.Active,
      reconnecting: ConnectionState.Reconnecting,
      failed: ConnectionState.Failed,
      closed: ConnectionState.Closed,
    };

    const newState = connectionStateMap[session.connectionState] || ConnectionState.Idle;

    updateConnection(projectId, {
      state: newState,
      lastConnectedAt: newState === ConnectionState.Active ? Date.now() : undefined,
    }).catch(console.error);
  }, [projectId, session?.connectionState, updateConnection]);

  // 5. 定期 touch session 保持活跃
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      sessionRegistry.touch(session.id).catch(console.error);
    }, 30000); // 每 30 秒

    return () => clearInterval(interval);
  }, [session?.id, sessionRegistry]);

  // 6. 创建快照（用于重连）
  const handleCreateSnapshot = useCallback(
    async (_terminalState: TerminalState) => {
      if (!session || !nodeIdRef.current || !tab) return;

      await snapshotStore.saveSnapshot(projectId, 'disconnect', {
        activeNodeIds: [nodeIdRef.current],
        terminalTabs: [{
          nodeId: nodeIdRef.current,
          title: session.title,
          cwd: session.cwd,
          index: 0,
        }],
      });
    },
    [session, tab, projectId, snapshotStore]
  );

  // 7. 从快照恢复
  const handleRestoreFromSnapshot = useCallback(
    async (snapshotId: string): Promise<TerminalState | null> => {
      const snapshot = await snapshotStore.getSnapshot(snapshotId);
      if (!snapshot?.terminalTabs?.[0]) {
        return null;
      }

      if (onReconnectComplete) {
        onReconnectComplete();
      }

      // Return a default terminal state since the snapshot doesn't store it
      return {
        cols: 80,
        rows: 24,
        scrollbackLines: [],
        cursorPosition: [0, 0],
      };
    },
    [snapshotStore, onReconnectComplete]
  );

  // 获取当前连接状态
  const connection = connections.get(projectId);
  const connectionState = connection?.state || ConnectionState.Idle;
  const isHealthy = connection?.health.healthStatus === 'healthy';

  return {
    nodeId: nodeIdRef.current,
    connectionState,
    isHealthy,
    createSnapshot: handleCreateSnapshot,
    restoreFromSnapshot: handleRestoreFromSnapshot,
  };
}
