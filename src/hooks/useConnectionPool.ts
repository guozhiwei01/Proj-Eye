/**
 * useConnectionPool Hook
 *
 * 管理连接池的获取和释放
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import * as backend from '../lib/backend-pool';

interface UseConnectionPoolOptions {
  projectId: string;
  serverId: string;
  autoAcquire?: boolean;
  autoRelease?: boolean;
}

interface ConnectionPoolResult {
  sessionId: string | null;
  isAcquiring: boolean;
  error: string | null;
  acquireConnection: () => Promise<string>;
  releaseConnection: () => Promise<void>;
  getConnectionInfo: () => Promise<any>;
  checkHealth: () => Promise<boolean>;
}

export function useConnectionPool({
  projectId,
  serverId,
  autoAcquire = false,
  autoRelease = true,
}: UseConnectionPoolOptions): ConnectionPoolResult {
  const sessionIdRef = useRef<string | null>(null);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acquireConnection = useCallback(async () => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    setIsAcquiring(true);
    setError(null);

    try {
      const sessionId = await backend.poolAcquire(projectId, serverId);
      sessionIdRef.current = sessionId;
      return sessionId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acquire connection';
      setError(message);
      throw err;
    } finally {
      setIsAcquiring(false);
    }
  }, [projectId, serverId]);

  const releaseConnection = useCallback(async () => {
    if (!sessionIdRef.current) {
      return;
    }

    try {
      await backend.poolRelease(projectId);
      sessionIdRef.current = null;
    } catch (err) {
      console.error('Failed to release connection:', err);
    }
  }, [projectId]);

  const getConnectionInfo = useCallback(async () => {
    try {
      return await backend.poolGetInfo(projectId);
    } catch (err) {
      console.error('Failed to get connection info:', err);
      return null;
    }
  }, [projectId]);

  const checkHealth = useCallback(async () => {
    try {
      return await backend.poolHealthCheck(projectId);
    } catch (err) {
      console.error('Failed to check connection health:', err);
      return false;
    }
  }, [projectId]);

  // Auto-acquire on mount
  useEffect(() => {
    if (autoAcquire) {
      acquireConnection().catch(console.error);
    }
  }, [autoAcquire, acquireConnection]);

  // Auto-release on unmount
  useEffect(() => {
    return () => {
      if (autoRelease) {
        releaseConnection();
      }
    };
  }, [autoRelease, releaseConnection]);

  return {
    sessionId: sessionIdRef.current,
    isAcquiring,
    error,
    acquireConnection,
    releaseConnection,
    getConnectionInfo,
    checkHealth,
  };
}

/**
 * Hook for connection pool statistics
 */
export function useConnectionPoolStats() {
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    idle: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const poolStats = await backend.poolStats();
      setStats(poolStats);
    } catch (err) {
      console.error('Failed to get pool stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [refreshStats]);

  return {
    stats,
    isLoading,
    refreshStats,
  };
}

/**
 * Hook for cleaning up idle connections
 */
export function useConnectionPoolCleanup(maxIdleMs: number = 300000) {
  const cleanupIdle = useCallback(async () => {
    try {
      const removed = await backend.poolCleanupIdle(maxIdleMs);
      console.log(`Cleaned up ${removed} idle connections`);
      return removed;
    } catch (err) {
      console.error('Failed to cleanup idle connections:', err);
      return 0;
    }
  }, [maxIdleMs]);

  // Auto cleanup every minute
  useEffect(() => {
    const interval = setInterval(cleanupIdle, 60000);
    return () => clearInterval(interval);
  }, [cleanupIdle]);

  return {
    cleanupIdle,
  };
}
