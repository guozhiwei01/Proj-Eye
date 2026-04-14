/**
 * Connection Runtime Types
 *
 * Types for the connection runtime system that manages project connections
 * and session lifecycle.
 */

export type ConnectionState =
  | "idle"
  | "connecting"
  | "active"
  | "degraded"
  | "reconnecting"
  | "closed"
  | "failed";

export const ConnectionState = {
  Idle: "idle" as ConnectionState,
  Connecting: "connecting" as ConnectionState,
  Active: "active" as ConnectionState,
  Degraded: "degraded" as ConnectionState,
  Reconnecting: "reconnecting" as ConnectionState,
  Closed: "closed" as ConnectionState,
  Failed: "failed" as ConnectionState,
};

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Connection health metrics
 */
export interface ConnectionHealth {
  successCount: number;
  failureCount: number;
  avgLatencyMs?: number;
  lastCheckAt?: number;
  healthStatus: HealthStatus;
}

export interface ConnectionContext {
  projectId: string;
  serverId?: string;
  databaseId?: string;
  primarySessionId?: string;
  sessionIds: string[];
  nodeIds: string[];
  state: ConnectionState;
  lastError?: string;
  lastConnectedAt?: number;
  health: ConnectionHealth;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMetadata {
  session_id: string;
  project_id: string;
  created_at: number;
  last_active: number;
}
