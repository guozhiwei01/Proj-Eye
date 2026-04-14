import type { ConnectionState } from "./connection";

/**
 * Terminal state snapshot for reconnection
 */
export interface TerminalState {
  cols: number;
  rows: number;
  scrollbackLines: string[];
  cursorPosition: [number, number];
}

/**
 * Reconnect snapshot for preserving connection state
 */
export interface ReconnectSnapshot {
  snapshotId: string;
  projectId: string;
  sessionId: string;
  connectionState: ConnectionState;
  terminalState?: TerminalState;
  createdAt: number;
  expiresAt: number;
}

/**
 * Snapshot creation options
 */
export interface CreateSnapshotOptions {
  projectId: string;
  sessionId: string;
  connectionState: ConnectionState;
  terminalState?: TerminalState;
}

/**
 * Snapshot restore result
 */
export interface RestoreSnapshotResult {
  snapshot: ReconnectSnapshot;
  success: boolean;
  message?: string;
}
