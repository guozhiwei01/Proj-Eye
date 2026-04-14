// Workspace node abstraction layer
// Decouples UI from raw sessionId, enabling reconnection and connection pooling

export type WorkspaceNodeId = string;

export const WorkspaceNodeKind = {
  Terminal: "terminal",
  Logs: "logs",
  Database: "database",
  AI: "ai",
} as const;

export type WorkspaceNodeKind =
  (typeof WorkspaceNodeKind)[keyof typeof WorkspaceNodeKind];

export const WorkspaceNodeState = {
  Idle: "idle",
  Connecting: "connecting",
  Active: "active",
  Degraded: "degraded",
  Reconnecting: "reconnecting",
  Closed: "closed",
} as const;

export type WorkspaceNodeState =
  (typeof WorkspaceNodeState)[keyof typeof WorkspaceNodeState];

/**
 * WorkspaceNode represents a stable UI entity that may be backed by one or more sessions.
 * The UI binds to nodeId, not sessionId, allowing the backend to swap sessions during reconnection.
 */
export interface WorkspaceNode {
  id: WorkspaceNodeId;
  projectId: string;
  kind: WorkspaceNodeKind;
  title: string;
  state: WorkspaceNodeState;

  // Optional backing session - may be undefined during reconnection
  backingSessionId?: string;

  // Terminal-specific fields
  tabId?: string;
  cwd?: string;

  // Metadata
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Maps a workspace node to its backing session.
 * Used internally by the runtime to resolve nodeId -> sessionId.
 */
export interface NodeSessionBinding {
  nodeId: WorkspaceNodeId;
  sessionId: string;
  boundAt: number;
}
