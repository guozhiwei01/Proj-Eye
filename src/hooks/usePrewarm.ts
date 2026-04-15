import { useEffect, useState, useCallback } from 'react';
import {
  prewarmRecordUsage,
  prewarmGetCandidates,
  prewarmGetPattern,
  prewarmGetAllPatterns,
  prewarmAddSchedule,
  prewarmRemoveSchedule,
  prewarmGetSchedules,
  prewarmSetStrategy,
  prewarmGetStrategy,
  prewarmClearPatterns,
  PrewarmStrategy,
  UsagePattern,
  PrewarmSchedule,
} from '../lib/backend-prewarm';

/**
 * Hook for managing prewarm strategy
 */
export function usePrewarmStrategy() {
  const [strategy, setStrategyState] = useState<PrewarmStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await prewarmGetStrategy();
      setStrategyState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStrategy = useCallback(async (newStrategy: PrewarmStrategy) => {
    setLoading(true);
    setError(null);

    try {
      await prewarmSetStrategy(newStrategy);
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
 * Hook for usage patterns
 */
export function useUsagePatterns(refreshInterval = 60000) {
  const [patterns, setPatterns] = useState<UsagePattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await prewarmGetAllPatterns();
      setPatterns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const recordUsage = useCallback(async (projectId: string) => {
    try {
      await prewarmRecordUsage(projectId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refresh]);

  const clearPatterns = useCallback(async () => {
    setLoading(true);
    try {
      await prewarmClearPatterns();
      setPatterns([]);
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

  return { patterns, loading, error, refresh, recordUsage, clearPatterns };
}

/**
 * Hook for prewarm schedules
 */
export function usePrewarmSchedules() {
  const [schedules, setSchedules] = useState<PrewarmSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await prewarmGetSchedules();
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const addSchedule = useCallback(async (schedule: PrewarmSchedule) => {
    setLoading(true);
    setError(null);

    try {
      await prewarmAddSchedule(schedule);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const removeSchedule = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      await prewarmRemoveSchedule(projectId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { schedules, loading, error, refresh, addSchedule, removeSchedule };
}

/**
 * Hook for prewarm candidates
 */
export function usePrewarmCandidates(refreshInterval = 60000) {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await prewarmGetCandidates();
      setCandidates(data);
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

  return { candidates, loading, error, refresh };
}
