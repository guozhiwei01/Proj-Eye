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
  | "closed";

export const ConnectionState = {
  Idle: "idle" as ConnectionState,
  Connecting: "connecting" as ConnectionState,
  Active: "active" as ConnectionState,
  Degraded: "degraded" as ConnectionState,
  Reconnecting: "reconnecting" as ConnectionState,
  Closed: "closed" as ConnectionState,
};

/**
 * Connection health metrics
 */
export interface ConnectionHealth {
  successCount: number;
  failureCount: number;
  avgLatencyMs?: number;
  lastCheckAt?: number;
  isHealthy: boolean;
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
  sessionId: string;
  projectId: string;
  createdAt: number;
  lastActiveAt: number;
}
