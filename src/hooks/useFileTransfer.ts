import { useState, useCallback, useEffect } from 'react';
import {
  sftpUpload,
  sftpDownload,
  sftpGetTransferProgress,
  sftpCancelTransfer,
  TransferProgress,
} from '../lib/backend-sftp';

export function useFileTransfer(sessionId?: string) {
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (localPath: string, remotePath: string) => {
      if (!sessionId) return;
      setError(null);
      try {
        const transferId = await sftpUpload(sessionId, localPath, remotePath);
        return transferId;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [sessionId]
  );

  const download = useCallback(
    async (remotePath: string, localPath: string) => {
      if (!sessionId) return;
      setError(null);
      try {
        const transferId = await sftpDownload(sessionId, remotePath, localPath);
        return transferId;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [sessionId]
  );

  const cancelTransfer = useCallback(async (transferId: string) => {
    setError(null);
    try {
      await sftpCancelTransfer(transferId);
      setTransfers((prev) => {
        const next = new Map(prev);
        const transfer = next.get(transferId);
        if (transfer) {
          next.set(transferId, { ...transfer, status: 'Cancelled' });
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const updateProgress = useCallback(async (transferId: string) => {
    try {
      const progress = await sftpGetTransferProgress(transferId);
      if (progress) {
        setTransfers((prev) => {
          const next = new Map(prev);
          next.set(transferId, progress);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update transfer progress:', err);
    }
  }, []);

  const startTracking = useCallback(
    (transferId: string) => {
      const interval = setInterval(() => {
        updateProgress(transferId);
      }, 500);

      return () => clearInterval(interval);
    },
    [updateProgress]
  );

  const activeTransfers = Array.from(transfers.values()).filter(
    (t) => t.status === 'InProgress' || t.status === 'Pending'
  );

  const completedTransfers = Array.from(transfers.values()).filter(
    (t) => t.status === 'Completed' || t.status === 'Failed' || t.status === 'Cancelled'
  );

  return {
    transfers: Array.from(transfers.values()),
    activeTransfers,
    completedTransfers,
    error,
    upload,
    download,
    cancelTransfer,
    updateProgress,
    startTracking,
  };
}

export function useTransferProgress(transferId?: string) {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transferId) return;

    const interval = setInterval(async () => {
      try {
        const p = await sftpGetTransferProgress(transferId);
        setProgress(p);

        // Stop polling if transfer is complete
        if (p && (p.status === 'Completed' || p.status === 'Failed' || p.status === 'Cancelled')) {
          clearInterval(interval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [transferId]);

  const percentage = progress
    ? progress.total_bytes > 0
      ? Math.round((progress.transferred_bytes / progress.total_bytes) * 100)
      : 0
    : 0;

  return {
    progress,
    percentage,
    error,
  };
}
