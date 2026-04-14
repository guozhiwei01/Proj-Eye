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
  terminalBuffer: string;
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
  terminalBuffer,
  onReconnectComplete,
}: UseTerminalConnectionOptions): TerminalConnectionResult {
  const { connections, create: createConnection, update: updateConnection } = useConnectionRuntime();
  const { sessions: sessionRegistry, register: registerSession, touch: touchSession } = useSessionRegistry();
  const { nodes, registerNode, bindNodeSession, getNodeBySession } = useWorkspaceNodes();
  const { create: createSnapshot, get: getSnapshot } = useSnapshotStore();

  const nodeIdRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  // 1. 注册 workspace node（如果还没有）
  useEffect(() => {
    if (!tab || !session) return;

    const existingNode = getNodeBySession(session.id);
    if (existingNode) {
      nodeIdRef.current = existingNode.id;
      return;
    }

    // 创建新的 workspace node
    const nodeId = registerNode({
      kind: 'terminal',
      label: tab.label || `Terminal ${tab.index + 1}`,
      metadata: {
        tabId: tab.id,
        projectId,
      },
    });

    nodeIdRef.current = nodeId;

    // 绑定 session 到 node
    if (session.id) {
      bindNodeSession(nodeId, session.id).catch(console.error);
    }
  }, [tab?.id, session?.id, projectId, registerNode, bindNodeSession, getNodeBySession]);

  // 2. 注册 session 到 SessionRegistry
  useEffect(() => {
    if (!session) return;

    registerSession({
      sessionId: session.id,
      projectId: session.projectId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    }).catch(console.error);

    lastSessionIdRef.current = session.id;
  }, [session?.id, session?.projectId, registerSession]);

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
      touchSession(session.id).catch(console.error);
    }, 30000); // 每 30 秒

    return () => clearInterval(interval);
  }, [session?.id, touchSession]);

  // 6. 创建快照（用于重连）
  const handleCreateSnapshot = useCallback(
    async (terminalState: TerminalState) => {
      if (!session || !nodeIdRef.current) return;

      const connection = connections.get(projectId);
      if (!connection) return;

      const snapshotId = `snapshot-${projectId}-${Date.now()}`;

      await createSnapshot({
        snapshotId,
        projectId,
        sessionId: session.id,
        connectionState: connection.state,
        terminalState,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 小时后过期
      });
    },
    [session, projectId, connections, createSnapshot]
  );

  // 7. 从快照恢复
  const handleRestoreFromSnapshot = useCallback(
    async (snapshotId: string): Promise<TerminalState | null> => {
      const snapshot = await getSnapshot(snapshotId);
      if (!snapshot || !snapshot.terminalState) {
        return null;
      }

      if (onReconnectComplete) {
        onReconnectComplete();
      }

      return snapshot.terminalState;
    },
    [getSnapshot, onReconnectComplete]
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
