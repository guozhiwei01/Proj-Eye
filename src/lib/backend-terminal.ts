import { invoke } from '@tauri-apps/api/core';

/**
 * Terminal session configuration
 */
export interface TerminalConfig {
  host: string;
  port: number;
  username: string;
  credential: string;
  cols: number;
  rows: number;
}

/**
 * Terminal session information
 */
export interface TerminalSession {
  session_id: string;
  host: string;
  port: number;
  username: string;
  cols: number;
  rows: number;
}

/**
 * Create a new terminal session
 */
export async function createTerminalSession(config: TerminalConfig): Promise<string> {
  return invoke('create_terminal_session', {
    host: config.host,
    port: config.port,
    username: config.username,
    credential: config.credential,
    cols: config.cols,
    rows: config.rows,
  });
}

/**
 * Resize a terminal session
 */
export async function resizeTerminalSession(
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  return invoke('resize_terminal_session', {
    sessionId,
    cols,
    rows,
  });
}

/**
 * Close a terminal session
 */
export async function closeTerminalSession(sessionId: string): Promise<void> {
  return invoke('close_terminal_session', { sessionId });
}

/**
 * Get terminal session information
 */
export async function getTerminalSession(sessionId: string): Promise<TerminalSession | null> {
  return invoke('get_terminal_session', { sessionId });
}

/**
 * List all terminal sessions
 */
export async function listTerminalSessions(): Promise<string[]> {
  return invoke('list_terminal_sessions');
}

/**
 * Get WebSocket server port
 */
export async function getWsPort(): Promise<number> {
  return invoke('get_ws_port');
}
