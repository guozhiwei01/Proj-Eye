import { useState, useEffect } from 'react';
import { FilePane } from './FilePane';
import { TransferProgress } from './TransferProgress';
import { useSFTPSession, useFileList, useFileOperations } from '../../hooks/useSFTP';
import { useFileTransfer } from '../../hooks/useFileTransfer';
import { X } from 'lucide-react';
import type { Server } from '../../types/models';

interface SFTPPanelProps {
  server: Server;
}

export default function SFTPPanel({ server }: SFTPPanelProps) {
  const { session, loading: sessionLoading, error: sessionError, createSession, closeSession } =
    useSFTPSession(server.id);

  const {
    files: remoteFiles,
    currentPath: remotePath,
    loading: remoteLoading,
    error: remoteError,
    refresh: refreshRemote,
    navigateTo: navigateRemote,
  } = useFileList(session?.session_id, '/');

  const { transfers, cancelTransfer } = useFileTransfer(session?.session_id);

  // Create session on mount
  useEffect(() => {
    // TODO: Get credentials from secure store using server.credentialRef
    createSession(server.host, server.port, server.username, undefined);
  }, [createSession, server.host, server.port, server.username]);

  // Close session on unmount
  useEffect(() => {
    return () => {
      if (session) {
        closeSession();
      }
    };
  }, [session, closeSession]);

  if (sessionLoading && !session) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--text1)]">
        Connecting to SFTP server...
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4">
        <div className="text-[var(--error)]">Failed to connect: {sessionError}</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text0)]">
            SFTP File Manager
          </span>
          <span className="text-xs text-[var(--text2)]">
            {server.username}@{server.host}:{server.port}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Remote Pane */}
        <div className="flex-1">
          <FilePane
            type="remote"
            files={remoteFiles}
            currentPath={remotePath}
            loading={remoteLoading}
            error={remoteError}
            onNavigate={navigateRemote}
            onRefresh={refreshRemote}
          />
        </div>
      </div>

      {/* Transfer Progress */}
      <TransferProgress transfers={transfers} onCancel={cancelTransfer} />
    </div>
  );
}
