import { useState, useEffect, useCallback } from 'react';
import {
  sftpCreateSession,
  sftpCloseSession,
  sftpGetSession,
  sftpListDir,
  sftpCreateDir,
  sftpDelete,
  sftpRename,
  SftpSession,
  FileEntry,
} from '../lib/backend-sftp';

export function useSFTPSession(serverId?: string) {
  const [session, setSession] = useState<SftpSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (host: string, port: number, username: string, password?: string) => {
      if (!serverId) return;
      setLoading(true);
      setError(null);
      try {
        const newSession = await sftpCreateSession(serverId, host, port, username, password);
        setSession(newSession);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [serverId]
  );

  const closeSession = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      await sftpCloseSession(session.session_id);
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const refreshSession = useCallback(async () => {
    if (!session) return;
    try {
      const updated = await sftpGetSession(session.session_id);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session]);

  return {
    session,
    loading,
    error,
    createSession,
    closeSession,
    refreshSession,
  };
}

export function useFileList(sessionId?: string, initialPath: string = '/') {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(
    async (path: string) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const entries = await sftpListDir(sessionId, path);
        // Sort: directories first, then by name
        entries.sort((a, b) => {
          if (a.is_dir && !b.is_dir) return -1;
          if (!a.is_dir && b.is_dir) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(entries);
        setCurrentPath(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const refresh = useCallback(() => {
    loadFiles(currentPath);
  }, [loadFiles, currentPath]);

  const navigateTo = useCallback(
    (path: string) => {
      loadFiles(path);
    },
    [loadFiles]
  );

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFiles(parentPath);
  }, [currentPath, loadFiles]);

  useEffect(() => {
    if (sessionId) {
      loadFiles(currentPath);
    }
  }, [sessionId, currentPath, loadFiles]);

  return {
    files,
    currentPath,
    loading,
    error,
    refresh,
    navigateTo,
    navigateUp,
  };
}

export function useFileOperations(sessionId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDir = useCallback(
    async (path: string) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        await sftpCreateDir(sessionId, path);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const deleteFile = useCallback(
    async (path: string) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        await sftpDelete(sessionId, path);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        await sftpRename(sessionId, oldPath, newPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  return {
    loading,
    error,
    createDir,
    deleteFile,
    renameFile,
  };
}
