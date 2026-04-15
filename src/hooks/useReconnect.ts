import { useEffect, useState, useCallback, useRef } from 'react';
import {
  reconnectStart,
  reconnectCancel,
  reconnectGetStatus,
  reconnectListActive,
  reconnectMarkSuccess,
  reconnectSetStrategy,
  reconnectGetStrategy,
  reconnectGetStats,
  ReconnectContext,
  ReconnectStrategy,
  ReconnectStats,
} from '../lib/backend-reconnect';

/**
 * Hook for managing reconnection for a specific session
 */
export function useReconnect(sessionId: string | null) {
  const [context, setContext] = useState<ReconnectContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch reconnect status
  const refresh = useCallback(async () => {
    if (!sessionId) {
      setContext(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await reconnectGetStatus(sessionId);
      setContext(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Start reconnect
  const start = useCallback(
    async (strategy?: ReconnectStrategy) => {
      if (!sessionId) return;

      setLoading(true);
      setError(null);

      try {
        await reconnectStart(sessionId, strategy);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [sessionId, refresh]
  );

  // Cancel reconnect
  const cancel = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      await reconnectCancel(sessionId);
      setContext(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Mark as successful
  const markSuccess = useCallback(async () => {
    if (!sessionId) return;

    try {
      await reconnectMarkSuccess(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    context,
    loading,
    error,
    refresh,
    start,
    cancel,
    markSuccess,
  };
}

/**
 * Hook for monitoring all active reconnects
 */
export function useActiveReconnects(refreshInterval = 5000) {
  const [reconnects, setReconnects] = useState<ReconnectContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await reconnectListActive();
      setReconnects(data);
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

  return { reconnects, loading, error, refresh };
}

/**
 * Hook for reconnect statistics
 */
export function useReconnectStats(refreshInterval = 5000) {
  const [stats, setStats] = useState<ReconnectStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await reconnectGetStats();
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
 * Hook for managing reconnect strategy
 */
export function useReconnectStrategy() {
  const [strategy, setStrategyState] = useState<ReconnectStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await reconnectGetStrategy();
      setStrategyState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStrategy = useCallback(async (newStrategy: ReconnectStrategy) => {
    setLoading(true);
    setError(null);

    try {
      await reconnectSetStrategy(newStrategy);
      setStrategyState(newStrategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  return { strategy, loading, error, updateStrategy, refresh: fetchStrategy };
}

/**
 * Hook for automatic reconnection with exponential backoff
 */
export function useAutoReconnect(
  sessionId: string | null,
  options?: {
    enabled?: boolean;
    strategy?: ReconnectStrategy;
    onReconnecting?: () => void;
    onReconnected?: () => void;
    onFailed?: (error: string) => void;
  }
) {
  const {
    enabled = true,
    strategy,
    onReconnecting,
    onReconnected,
    onFailed,
  } = options || {};

  const { context, start, markSuccess } = useReconnect(sessionId);
  const previousStateRef = useRef<string | null>(null);

  // Monitor state changes
  useEffect(() => {
    if (!context) return;

    const currentState = context.state;
    const previousState = previousStateRef.current;

    if (currentState !== previousState) {
      if (currentState === 'attempting' && onReconnecting) {
        onReconnecting();
      } else if (currentState === 'success' && onReconnected) {
        onReconnected();
      } else if (currentState === 'failed' && onFailed) {
        const lastError =
          context.error_history[context.error_history.length - 1] ||
          'Unknown error';
        onFailed(lastError);
      }

      previousStateRef.current = currentState;
    }
  }, [context, onReconnecting, onReconnected, onFailed]);

  // Auto-start reconnect when enabled
  useEffect(() => {
    if (enabled && sessionId && !context) {
      start(strategy);
    }
  }, [enabled, sessionId, context, strategy, start]);

  return {
    context,
    isReconnecting: context?.state === 'attempting' || context?.state === 'backoff',
    start: () => start(strategy),
    markSuccess,
  };
}
