import { useEffect, useState, useCallback, useRef } from 'react';
import {
  healthCheckRegister,
  healthCheckUnregister,
  healthCheckGetMetrics,
  healthCheckGetAll,
  healthCheckGetByStatus,
  healthCheckSetConfig,
  healthCheckGetConfig,
  healthCheckGetStats,
  healthCheckPerform,
  HealthMetrics,
  HealthCheckConfig,
  HealthCheckStats,
  HealthStatus,
} from '../lib/backend-health';

/**
 * Hook for managing health check for a specific session
 */
export function useHealthCheck(sessionId: string | null) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch health metrics
  const refresh = useCallback(async () => {
    if (!sessionId) {
      setMetrics(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await healthCheckGetMetrics(sessionId);
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Perform manual health check
  const performCheck = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      await healthCheckPerform(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, refresh]);

  // Register session on mount
  useEffect(() => {
    if (sessionId) {
      healthCheckRegister(sessionId).catch(console.error);
      refresh();
    }

    return () => {
      if (sessionId) {
        healthCheckUnregister(sessionId).catch(console.error);
      }
    };
  }, [sessionId, refresh]);

  return {
    metrics,
    loading,
    error,
    refresh,
    performCheck,
    isHealthy: metrics?.status === 'healthy',
    isDegraded: metrics?.status === 'degraded',
    isUnhealthy: metrics?.status === 'unhealthy',
  };
}

/**
 * Hook for monitoring all health metrics
 */
export function useAllHealthMetrics(refreshInterval = 5000) {
  const [metrics, setMetrics] = useState<HealthMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await healthCheckGetAll();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { metrics, loading, error, refresh };
}

/**
 * Hook for filtering health metrics by status
 */
export function useHealthMetricsByStatus(
  status: HealthStatus,
  refreshInterval = 5000
) {
  const [metrics, setMetrics] = useState<HealthMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await healthCheckGetByStatus(status);
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();

    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { metrics, loading, error, refresh };
}

/**
 * Hook for health check statistics
 */
export function useHealthCheckStats(refreshInterval = 5000) {
  const [stats, setStats] = useState<HealthCheckStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await healthCheckGetStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { stats, loading, error, refresh };
}

/**
 * Hook for managing health check configuration
 */
export function useHealthCheckConfig() {
  const [config, setConfigState] = useState<HealthCheckConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await healthCheckGetConfig();
      setConfigState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: HealthCheckConfig) => {
    setLoading(true);
    setError(null);

    try {
      await healthCheckSetConfig(newConfig);
      setConfigState(newConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, updateConfig, refresh: fetchConfig };
}

/**
 * Hook for automatic health checking
 */
export function useAutoHealthCheck(
  sessionId: string | null,
  options?: {
    enabled?: boolean;
    interval?: number;
    onHealthy?: () => void;
    onDegraded?: () => void;
    onUnhealthy?: () => void;
  }
) {
  const {
    enabled = true,
    interval = 30000,
    onHealthy,
    onDegraded,
    onUnhealthy,
  } = options || {};

  const { metrics, performCheck } = useHealthCheck(sessionId);
  const previousStatusRef = useRef<HealthStatus | null>(null);

  // Monitor status changes
  useEffect(() => {
    if (!metrics) return;

    const currentStatus = metrics.status;
    const previousStatus = previousStatusRef.current;

    if (currentStatus !== previousStatus) {
      if (currentStatus === 'healthy' && onHealthy) {
        onHealthy();
      } else if (currentStatus === 'degraded' && onDegraded) {
        onDegraded();
      } else if (currentStatus === 'unhealthy' && onUnhealthy) {
        onUnhealthy();
      }

      previousStatusRef.current = currentStatus;
    }
  }, [metrics, onHealthy, onDegraded, onUnhealthy]);

  // Auto-perform health checks
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const intervalId = setInterval(() => {
      performCheck();
    }, interval);

    return () => clearInterval(intervalId);
  }, [enabled, sessionId, interval, performCheck]);

  return {
    metrics,
    performCheck,
    isHealthy: metrics?.status === 'healthy',
    isDegraded: metrics?.status === 'degraded',
    isUnhealthy: metrics?.status === 'unhealthy',
  };
}
