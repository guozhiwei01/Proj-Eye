import { invoke } from '@tauri-apps/api/core';

export interface SessionState {
  state: 'created' | 'active' | 'idle' | 'paused' | 'hibernated' | 'destroyed';
}

export interface SessionLifecycle {
  session_id: string;
  state: 'created' | 'active' | 'idle' | 'paused' | 'hibernated' | 'destroyed';
  created_at: number;
  last_active_at: number;
  idle_since?: number;
  hibernated_at?: number;
  paused_at?: number;
  activity_count: number;
  total_active_duration: number;
  policy: LifecyclePolicy;
}

export interface LifecyclePolicy {
  idle_timeout: number;
  hibernate_timeout: number;
  destroy_timeout: number;
  max_session_age: number;
  keep_alive_interval: number;
}

export interface LifecycleStats {
  total_sessions: number;
  created_count: number;
  active_count: number;
  idle_count: number;
  paused_count: number;
  hibernated_count: number;
  destroyed_count: number;
  total_activity_count: number;
}

export interface StateTransition {
  session_id: string;
  old_state: string;
  new_state: string;
}

/**
 * Create a new session lifecycle
 */
export async function lifecycleCreateSession(sessionId: string): Promise<SessionLifecycle> {
  return invoke('lifecycle_create_session', { sessionId });
}

/**
 * Get session lifecycle information
 */
export async function lifecycleGetSession(sessionId: string): Promise<SessionLifecycle | null> {
  return invoke('lifecycle_get_session', { sessionId });
}

/**
 * Record activity for a session
 */
export async function lifecycleRecordActivity(sessionId: string): Promise<void> {
  return invoke('lifecycle_record_activity', { sessionId });
}

/**
 * Pause a session
 */
export async function lifecyclePauseSession(sessionId: string): Promise<void> {
  return invoke('lifecycle_pause_session', { sessionId });
}

/**
 * Resume a paused session
 */
export async function lifecycleResumeSession(sessionId: string): Promise<void> {
  return invoke('lifecycle_resume_session', { sessionId });
}

/**
 * Hibernate a session (save state and release resources)
 */
export async function lifecycleHibernateSession(sessionId: string): Promise<void> {
  return invoke('lifecycle_hibernate_session', { sessionId });
}

/**
 * Wake a hibernated session
 */
export async function lifecycleWakeSession(sessionId: string): Promise<void> {
  return invoke('lifecycle_wake_session', { sessionId });
}

/**
 * Destroy a session
 */
export async function lifecycleDestroySession(sessionId: string): Promise<void> {
  return invoke('lifecycle_destroy_session', { sessionId });
}

/**
 * Get all sessions in a specific state
 */
export async function lifecycleGetSessionsByState(
  state: 'created' | 'active' | 'idle' | 'paused' | 'hibernated' | 'destroyed'
): Promise<SessionLifecycle[]> {
  return invoke('lifecycle_get_sessions_by_state', { stateFilter: state });
}

/**
 * Get lifecycle statistics
 */
export async function lifecycleGetStats(): Promise<LifecycleStats> {
  return invoke('lifecycle_get_stats');
}

/**
 * Check and apply automatic state transitions
 * Returns list of transitions that occurred
 */
export async function lifecycleCheckTransitions(): Promise<Array<[string, string, string]>> {
  return invoke('lifecycle_check_transitions');
}

/**
 * Set lifecycle policy
 */
export async function lifecycleSetPolicy(policy: {
  idleTimeoutSecs: number;
  hibernateTimeoutSecs: number;
  destroyTimeoutSecs: number;
  maxSessionAgeSecs: number;
  keepAliveIntervalSecs: number;
}): Promise<void> {
  return invoke('lifecycle_set_policy', {
    idleTimeoutSecs: policy.idleTimeoutSecs,
    hibernateTimeoutSecs: policy.hibernateTimeoutSecs,
    destroyTimeoutSecs: policy.destroyTimeoutSecs,
    maxSessionAgeSecs: policy.maxSessionAgeSecs,
    keepAliveIntervalSecs: policy.keepAliveIntervalSecs,
  });
}
