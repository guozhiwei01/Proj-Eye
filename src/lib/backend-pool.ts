/**
 * Connection Pool Backend API
 */

import { invoke } from "@tauri-apps/api/core";

// Connection Pool APIs
export async function poolAcquire(projectId: string, serverId: string): Promise<string> {
  return invoke("pool_acquire", { projectId, serverId });
}

export async function poolRelease(sessionId: string): Promise<void> {
  return invoke("pool_release", { sessionId });
}

export async function poolGetInfo(sessionId: string): Promise<any> {
  return invoke("pool_get_info", { sessionId });
}

export async function poolCleanupIdle(maxIdleMs: number): Promise<number> {
  return invoke("pool_cleanup_idle", { maxIdleMs });
}

export async function poolListAll(): Promise<any[]> {
  return invoke("pool_list_all");
}

export async function poolStats(): Promise<{ total: number; active: number; idle: number }> {
  return invoke("pool_stats");
}

export async function poolPrewarm(projectId: string, serverId: string, count: number): Promise<void> {
  return invoke("pool_prewarm", { projectId, serverId, count });
}

export async function poolHealthCheck(sessionId: string): Promise<boolean> {
  return invoke("pool_health_check", { sessionId });
}
