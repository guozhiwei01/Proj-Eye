import { invoke } from '@tauri-apps/api/core';

export interface PrewarmStrategy {
  predictive_enabled: boolean;
  scheduled_enabled: boolean;
  on_project_open: boolean;
  min_usage_count: number;
  pattern_window_secs: number;
  prewarm_count: number;
}

export interface UsagePattern {
  project_id: string;
  total_connections: number;
  last_connection_at: number;
  connection_times: number[];
  avg_interval_secs: number;
  predicted_next_connection: number;
}

export interface PrewarmSchedule {
  project_id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  weekdays: number[]; // 0-6 (Sunday-Saturday)
  enabled: boolean;
}

/**
 * Record connection usage for predictive prewarming
 */
export async function prewarmRecordUsage(projectId: string): Promise<void> {
  return invoke('prewarm_record_usage', { projectId });
}

/**
 * Get projects that should be prewarmed now
 */
export async function prewarmGetCandidates(): Promise<string[]> {
  return invoke('prewarm_get_candidates');
}

/**
 * Get usage pattern for a project
 */
export async function prewarmGetPattern(projectId: string): Promise<UsagePattern> {
  return invoke('prewarm_get_pattern', { projectId });
}

/**
 * Get all usage patterns
 */
export async function prewarmGetAllPatterns(): Promise<UsagePattern[]> {
  return invoke('prewarm_get_all_patterns');
}

/**
 * Add a prewarm schedule
 */
export async function prewarmAddSchedule(schedule: PrewarmSchedule): Promise<void> {
  return invoke('prewarm_add_schedule', { schedule });
}

/**
 * Remove a prewarm schedule
 */
export async function prewarmRemoveSchedule(projectId: string): Promise<void> {
  return invoke('prewarm_remove_schedule', { projectId });
}

/**
 * Get all prewarm schedules
 */
export async function prewarmGetSchedules(): Promise<PrewarmSchedule[]> {
  return invoke('prewarm_get_schedules');
}

/**
 * Set prewarm strategy
 */
export async function prewarmSetStrategy(strategy: PrewarmStrategy): Promise<void> {
  return invoke('prewarm_set_strategy', { strategy });
}

/**
 * Get prewarm strategy
 */
export async function prewarmGetStrategy(): Promise<PrewarmStrategy> {
  return invoke('prewarm_get_strategy');
}

/**
 * Clear all usage patterns
 */
export async function prewarmClearPatterns(): Promise<number> {
  return invoke('prewarm_clear_patterns');
}
