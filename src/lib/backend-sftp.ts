import { invoke } from '@tauri-apps/api/core';

export interface SftpSession {
  session_id: string;
  server_id: string;
  connection_id: string;
  current_remote_path: string;
  created_at: number;
  last_activity: number;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  permissions: string;
}

export interface TransferProgress {
  transfer_id: string;
  operation: 'Upload' | 'Download';
  local_path: string;
  remote_path: string;
  total_bytes: number;
  transferred_bytes: number;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled';
  error?: string;
}

/**
 * Create SFTP session
 */
export async function sftpCreateSession(
  serverId: string,
  host: string,
  port: number,
  username: string,
  password?: string
): Promise<SftpSession> {
  return invoke('sftp_create_session', {
    serverId,
    host,
    port,
    username,
    password,
  });
}

/**
 * Close SFTP session
 */
export async function sftpCloseSession(sessionId: string): Promise<void> {
  return invoke('sftp_close_session', { sessionId });
}

/**
 * Get SFTP session info
 */
export async function sftpGetSession(sessionId: string): Promise<SftpSession | null> {
  return invoke('sftp_get_session', { sessionId });
}

/**
 * List directory contents
 */
export async function sftpListDir(sessionId: string, path: string): Promise<FileEntry[]> {
  return invoke('sftp_list_dir', { sessionId, path });
}

/**
 * Create directory
 */
export async function sftpCreateDir(sessionId: string, path: string): Promise<void> {
  return invoke('sftp_create_dir', { sessionId, path });
}

/**
 * Delete file or directory
 */
export async function sftpDelete(sessionId: string, path: string): Promise<void> {
  return invoke('sftp_delete', { sessionId, path });
}

/**
 * Rename file or directory
 */
export async function sftpRename(
  sessionId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  return invoke('sftp_rename', { sessionId, oldPath, newPath });
}

/**
 * Upload file
 */
export async function sftpUpload(
  sessionId: string,
  localPath: string,
  remotePath: string
): Promise<string> {
  return invoke('sftp_upload', { sessionId, localPath, remotePath });
}

/**
 * Download file
 */
export async function sftpDownload(
  sessionId: string,
  remotePath: string,
  localPath: string
): Promise<string> {
  return invoke('sftp_download', { sessionId, remotePath, localPath });
}

/**
 * Get transfer progress
 */
export async function sftpGetTransferProgress(
  transferId: string
): Promise<TransferProgress | null> {
  return invoke('sftp_get_transfer_progress', { transferId });
}

/**
 * Cancel transfer
 */
export async function sftpCancelTransfer(transferId: string): Promise<void> {
  return invoke('sftp_cancel_transfer', { transferId });
}

/**
 * Read file content
 */
export async function sftpReadFile(
  sessionId: string,
  path: string,
  maxBytes?: number
): Promise<Uint8Array> {
  return invoke('sftp_read_file', { sessionId, path, maxBytes });
}

/**
 * Get file/directory stats
 */
export async function sftpStat(sessionId: string, path: string): Promise<FileEntry> {
  return invoke('sftp_stat', { sessionId, path });
}
