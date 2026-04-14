/**
 * useLogsConnection Hook
 *
 * 将 Logs 组件与新的 ConnectionRuntime 系统集成的桥接层。
 * 这个 hook 负责：
 * 1. 管理 logs 的 workspace node 注册
 * 2. 将 log sources 绑定到 ConnectionContext
 * 3. 同步连接状态到 ConnectionRuntime
 * 4. 追踪活跃的 log sources
 */

import { useEffect, useCallback, useRef } from 'react';
import { useConnectionRuntime } from '../store/connection-runtime';
import { useWorkspaceNodes } from '../store/workspace-nodes';
import type { LogChunk, LogSource } from '../types/models';
import { ConnectionState } from '../types/connection';

interface UseLogsConnectionOptions {
  projectId: string;
  logSources: LogSource[];
  logs: LogChunk[];
  isActive: boolean;
}

interface LogsConnectionResult {
  nodeId: string | null;
  connectionState: ConnectionState;
  isHealthy: boolean;
  recordLogActivity: (sourceId: string) => Promise<void>;
  getActiveLogSources: () => string[];
}

export function useLogsConnection({
  projectId,
  logSources,
  logs,
  isActive,
}: UseLogsConnectionOptions): LogsConnectionResult {
  const { connections, createConnection, updateConnection, recordSuccess } = useConnectionRuntime();
  const { nodes, registerNode } = useWorkspaceNodes();

  const nodeIdRef = useRef<string | null>(null);
  const activeSourcesRef = useRef<Set<string>>(new Set());

  // 1. 注册 workspace node（如果还没有）
  useEffect(() => {
    if (!isActive) return;

    // 查找现有的 logs node
    const existingNode = Array.from(nodes.values()).find(
      (node) => node.kind === 'logs' && node.projectId === projectId
    );

    if (existingNode) {
      nodeIdRef.current = existingNode.id;
      return;
    }

    // 创建新的 workspace node
    const newNode = {
      id: `logs-${projectId}-${Date.now()}`,
      projectId,
      kind: 'logs' as const,
      title: 'Logs',
      state: 'active' as const,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    registerNode(newNode);
    nodeIdRef.current = newNode.id;
  }, [isActive, projectId, logSources, nodes, registerNode]);

  // 2. 更新 node 的 log sources (removed - not needed for now)

  // 3. 确保 ConnectionContext 存在
  useEffect(() => {
    if (!isActive) return;

    const existingConnection = connections.get(projectId);
    if (!existingConnection) {
      createConnection({
        projectId,
        sessionIds: [],
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
    } else if (nodeIdRef.current && !existingConnection.nodeIds.includes(nodeIdRef.current)) {
      // 添加 logs node 到现有连接
      updateConnection(projectId, {
        nodeIds: [...existingConnection.nodeIds, nodeIdRef.current],
      }).catch(console.error);
    }
  }, [projectId, isActive, connections, createConnection, updateConnection]);

  // 4. 追踪活跃的 log sources
  useEffect(() => {
    if (!isActive || logs.length === 0) return;

    // 从最近的 logs 中提取 source IDs
    const recentSources = new Set(
      logs
        .slice(-10) // 只看最近 10 条
        .map(log => log.sourceId)
        .filter(Boolean)
    );

    activeSourcesRef.current = recentSources;
  }, [logs, isActive]);

  // 5. 记录日志活动（用于健康度监控）
  const handleRecordLogActivity = useCallback(
    async (sourceId: string) => {
      if (!isActive) return;

      activeSourcesRef.current.add(sourceId);

      // 记录成功的日志拉取
      await recordSuccess(projectId, undefined);
    },
    [projectId, isActive, recordSuccess]
  );

  // 6. 获取活跃的 log sources
  const handleGetActiveLogSources = useCallback(() => {
    return Array.from(activeSourcesRef.current);
  }, []);

  // 获取当前连接状态
  const connection = connections.get(projectId);
  const connectionState = connection?.state || ConnectionState.Idle;
  const isHealthy = connection?.health.healthStatus === 'healthy';

  return {
    nodeId: nodeIdRef.current,
    connectionState,
    isHealthy,
    recordLogActivity: handleRecordLogActivity,
    getActiveLogSources: handleGetActiveLogSources,
  };
}
