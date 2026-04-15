import { useEffect, useState, useCallback, useRef } from 'react';
import {
  lifecycleGetSession,
  lifecycleRecordActivity,
  lifecyclePauseSession,
  lifecycleResumeSession,
  lifecycleHibernateSession,
  lifecycleWakeSession,
  lifecycleDestroySession,
  lifecycleGetSessionsByState,
  lifecycleGetStats,
  lifecycleCheckTransitions,
  lifecycleSetPolicy,
  SessionLifecycle,
  LifecycleStats,
} from '../lib/backend-lifecycle';

/**
 * Hook for managing session lifecycle
 */
export function useSessionLifecycle(sessionId: string | null) {
  const [lifecycle, setLifecycle] = useState<SessionLifecycle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lifecycle info
  const refresh = useCallback(async () => {
    if (!sessionId) {
      setLifecycle(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await lifecycleGetSession(sessionId);
      setLifecycle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Record activity
  const recordActivity = useCallback(async () => {
    if (!sessionId) return;

    try {
      await lifecycleRecordActivity(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, refresh]);

  // Pause session
  const pause = useCallback(async () => {
    if (!sessionId) return;

    try {
      await lifecyclePauseSession(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, refresh]);

  // Resume session
  const resume = useCallback(async () => {
    if (!sessionId) return;

    try {
      await lifecycleResumeSession(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, refresh]);

  // Hibernate session
  const hibernate = useCallback(async () => {
    if (!sessionId) return;

    try {
      await lifecycleHibernateSession(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, refresh]);

  // Wake session
  const wake = useCallback(async () => {
    if (!sessionId) return;

    try {
      await lifecycleWakeSession(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, refresh]);

  // Destroy session
  const destroy = useCallback(async () => {
    if (!sessionId) return;

    try {
      await lifecycleDestroySession(sessionId);
      setLifecycle(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    lifecycle,
    loading,
    error,
    refresh,
    recordActivity,
    pause,
    resume,
    hibernate,
    wake,
    destroy,
  };
}

/**
 * Hook for monitoring lifecycle statistics
 */
export function useLifecycleStats(refreshInterval = 5000) {
  const [stats, setStats] = useState<LifecycleStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await lifecycleGetStats();
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
 * Hook for automatic lifecycle management
 */
export function useAutoLifecycle(sessionId: string | null, options?: {
  enableKeepAlive?: boolean;
  keepAliveInterval?: number;
  enableAutoTransitions?: boolean;
  transitionCheckInterval?: number;
}) {
  const {
    enableKeepAlive = true,
    keepAliveInterval = 30000, // 30 seconds
    enableAutoTransitions = true,
    transitionCheckInterval = 60000, // 1 minute
  } = options || {};

  const { recordActivity } = useSessionLifecycle(sessionId);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep-alive mechanism
  useEffect(() => {
    if (!sessionId || !enableKeepAlive) return;

    const startKeepAlive = () => {
      keepAliveTimerRef.current = setInterval(() => {
        recordActivity().catch(console.error);
      }, keepAliveInterval);
    };

    startKeepAlive();

    return () => {
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
      }
    };
  }, [sessionId, enableKeepAlive, keepAliveInterval, recordActivity]);

  // Automatic transition checking
  useEffect(() => {
    if (!enableAutoTransitions) return;

    const checkTransitions = async () => {
      try {
        const transitions = await lifecycleCheckTransitions();
        if (transitions.length > 0) {
          console.log('Lifecycle transitions:', transitions);
        }
      } catch (err) {
        console.error('Failed to check transitions:', err);
      }
    };

    transitionTimerRef.current = setInterval(checkTransitions, transitionCheckInterval);

    return () => {
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
      }
    };
  }, [enableAutoTransitions, transitionCheckInterval]);
}

/**
 * Hook for managing lifecycle policy
 */
export function useLifecyclePolicy() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPolicy = useCallback(async (policy: {
    idleTimeoutSecs: number;
    hibernateTimeoutSecs: number;
    destroyTimeoutSecs: number;
    maxSessionAgeSecs: number;
    keepAliveIntervalSecs: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      await lifecycleSetPolicy(policy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { setPolicy, loading, error };
}

/**
 * Hook for querying sessions by state
 */
export function useSessionsByState(
  state: 'created' | 'active' | 'idle' | 'paused' | 'hibernated' | 'destroyed',
  refreshInterval = 5000
) {
  const [sessions, setSessions] = useState<SessionLifecycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await lifecycleGetSessionsByState(state);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    refresh();

    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { sessions, loading, error, refresh };
}
