import { invoke } from '@tauri-apps/api/core';

export interface ReconnectStrategy {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  jitter: boolean;
  grace_period?: GracePeriodConfig;
}

export interface ReconnectContext {
  session_id: string;
  state: 'idle' | 'attempting' | 'backoff' | 'grace_period' | 'success' | 'failed';
  attempt_count: number;
  last_attempt_at?: number;
  next_attempt_at?: number;
  strategy: ReconnectStrategy;
  error_history: string[];
  started_at: number;
  grace_period_elapsed?: number;
  grace_period_total?: number;
}

export interface ReconnectStats {
  total_contexts: number;
  idle: number;
  attempting: number;
  backoff: number;
  grace_period: number;
  success: number;
  failed: number;
}

export interface GracePeriodConfig {
  enabled: boolean;
  duration_secs: number;
  probe_interval_secs: number;
}

/**
 * Start reconnect for a session
 */
export async function reconnectStart(
  sessionId: string,
  strategy?: ReconnectStrategy
): Promise<void> {
  return invoke('reconnect_start', { sessionId, strategy });
}

/**
 * Cancel reconnect for a session
 */
export async function reconnectCancel(sessionId: string): Promise<void> {
  return invoke('reconnect_cancel', { sessionId });
}

/**
 * Get reconnect status
 */
export async function reconnectGetStatus(
  sessionId: string
): Promise<ReconnectContext | null> {
  return invoke('reconnect_get_status', { sessionId });
}

/**
 * List all active reconnects
 */
export async function reconnectListActive(): Promise<ReconnectContext[]> {
  return invoke('reconnect_list_active');
}

/**
 * Record reconnect attempt
 */
export async function reconnectRecordAttempt(
  sessionId: string,
  error?: string
): Promise<void> {
  return invoke('reconnect_record_attempt', { sessionId, error });
}

/**
 * Mark reconnect as successful
 */
export async function reconnectMarkSuccess(sessionId: string): Promise<void> {
  return invoke('reconnect_mark_success', { sessionId });
}

/**
 * Set default reconnect strategy
 */
export async function reconnectSetStrategy(
  strategy: ReconnectStrategy
): Promise<void> {
  return invoke('reconnect_set_strategy', { strategy });
}

/**
 * Get default reconnect strategy
 */
export async function reconnectGetStrategy(): Promise<ReconnectStrategy> {
  return invoke('reconnect_get_strategy');
}

/**
 * Check if session should attempt reconnect now
 */
export async function reconnectShouldAttempt(
  sessionId: string
): Promise<boolean> {
  return invoke('reconnect_should_attempt', { sessionId });
}

/**
 * Get sessions ready for reconnect
 */
export async function reconnectGetReady(): Promise<string[]> {
  return invoke('reconnect_get_ready');
}

/**
 * Cleanup completed reconnects
 */
export async function reconnectCleanup(): Promise<number> {
  return invoke('reconnect_cleanup');
}

/**
 * Get reconnect statistics
 */
export async function reconnectGetStats(): Promise<ReconnectStats> {
  return invoke('reconnect_get_stats');
}

/**
 * Start grace period for a session
 */
export async function reconnectStartGracePeriod(sessionId: string): Promise<void> {
  return invoke('reconnect_start_grace_period', { sessionId });
}

/**
 * Update grace period elapsed time
 */
export async function reconnectUpdateGracePeriod(
  sessionId: string,
  elapsedSecs: number
): Promise<void> {
  return invoke('reconnect_update_grace_period', { sessionId, elapsedSecs });
}

/**
 * End grace period and transition to normal reconnect
 */
export async function reconnectEndGracePeriod(sessionId: string): Promise<void> {
  return invoke('reconnect_end_grace_period', { sessionId });
}

/**
 * Set grace period configuration
 */
export async function reconnectSetGracePeriodConfig(
  config: GracePeriodConfig
): Promise<void> {
  return invoke('reconnect_set_grace_period_config', { config });
}

/**
 * Get grace period configuration
 */
export async function reconnectGetGracePeriodConfig(): Promise<GracePeriodConfig> {
  return invoke('reconnect_get_grace_period_config');
}
