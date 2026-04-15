import { invoke } from '@tauri-apps/api/core';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckConfig {
  interval_ms: number;
  timeout_ms: number;
  failure_threshold: number;
  success_threshold: number;
  enabled: boolean;
}

export interface HealthMetrics {
  session_id: string;
  status: HealthStatus;
  last_check_at: number;
  next_check_at: number;
  consecutive_successes: number;
  consecutive_failures: number;
  total_checks: number;
  total_successes: number;
  total_failures: number;
  avg_latency_ms: number;
  last_error?: string;
}

export interface HealthCheckResult {
  success: boolean;
  latency_ms: number;
  error?: string;
  timestamp: number;
}

export interface HealthCheckStats {
  total_sessions: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  total_checks: number;
  total_successes: number;
  total_failures: number;
  avg_success_rate: number;
}

/**
 * Register a session for health checking
 */
export async function healthCheckRegister(sessionId: string): Promise<void> {
  return invoke('health_check_register', { sessionId });
}

/**
 * Unregister a session
 */
export async function healthCheckUnregister(sessionId: string): Promise<void> {
  return invoke('health_check_unregister', { sessionId });
}

/**
 * Record a health check result
 */
export async function healthCheckRecord(
  sessionId: string,
  success: boolean,
  latencyMs: number,
  error?: string,
  timestamp?: number
): Promise<void> {
  return invoke('health_check_record', {
    sessionId,
    success,
    latencyMs,
    error,
    timestamp: timestamp || Date.now(),
  });
}

/**
 * Get health metrics for a session
 */
export async function healthCheckGetMetrics(
  sessionId: string
): Promise<HealthMetrics> {
  return invoke('health_check_get_metrics', { sessionId });
}

/**
 * Get all health metrics
 */
export async function healthCheckGetAll(): Promise<HealthMetrics[]> {
  return invoke('health_check_get_all');
}

/**
 * Get sessions by health status
 */
export async function healthCheckGetByStatus(
  status: HealthStatus
): Promise<HealthMetrics[]> {
  return invoke('health_check_get_by_status', { status });
}

/**
 * Get sessions ready for health check
 */
export async function healthCheckGetReady(): Promise<string[]> {
  return invoke('health_check_get_ready');
}

/**
 * Set health check configuration
 */
export async function healthCheckSetConfig(
  config: HealthCheckConfig
): Promise<void> {
  return invoke('health_check_set_config', { config });
}

/**
 * Get health check configuration
 */
export async function healthCheckGetConfig(): Promise<HealthCheckConfig> {
  return invoke('health_check_get_config');
}

/**
 * Get health check statistics
 */
export async function healthCheckGetStats(): Promise<HealthCheckStats> {
  return invoke('health_check_get_stats');
}

/**
 * Cleanup old health metrics
 */
export async function healthCheckCleanup(): Promise<number> {
  return invoke('health_check_cleanup');
}

/**
 * Perform a manual health check
 */
export async function healthCheckPerform(
  sessionId: string
): Promise<HealthCheckResult> {
  return invoke('health_check_perform', { sessionId });
}
