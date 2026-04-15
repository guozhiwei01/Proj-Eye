import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalWebSocket } from '../lib/ws-terminal';
import {
  createTerminalSession,
  resizeTerminalSession,
  closeTerminalSession,
  getWsPort,
} from '../lib/backend-terminal';

export interface UseTerminalOptions {
  host: string;
  port: number;
  username: string;
  credential: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface UseTerminalReturn {
  sessionId: string | null;
  terminal: Terminal | null;
  loading: boolean;
  error: string | null;
  connect: (element: HTMLElement) => Promise<void>;
  disconnect: () => Promise<void>;
  write: (data: string) => void;
  clear: () => void;
  fit: () => void;
}

/**
 * Hook for managing terminal sessions with WebSocket communication
 */
export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const connect = async (element: HTMLElement) => {
    if (sessionId) {
      console.warn('[useTerminal] Already connected');
      return;
    }

    setLoading(true);
    setError(null);
    elementRef.current = element;

    try {
      // 1. Create xterm.js terminal
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(element);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // 2. Get WebSocket port
      const wsPort = await getWsPort();

      // 3. Create backend terminal session
      const { cols, rows } = terminal;
      const sid = await createTerminalSession({
        host: options.host,
        port: options.port,
        username: options.username,
        credential: options.credential,
        cols,
        rows,
      });

      setSessionId(sid);

      // 4. Connect WebSocket
      const ws = new TerminalWebSocket(sid, `ws://localhost:${wsPort}`, {
        onData: (data) => {
          terminal.write(data);
        },
        onConnect: () => {
          console.log('[useTerminal] WebSocket connected');
          options.onConnect?.();
        },
        onDisconnect: () => {
          console.log('[useTerminal] WebSocket disconnected');
          options.onDisconnect?.();
        },
        onError: (err) => {
          console.error('[useTerminal] WebSocket error:', err);
          setError(err.message);
          options.onError?.(err);
        },
      });

      ws.connect();
      wsRef.current = ws;

      // 5. Handle terminal input
      terminal.onData((data) => {
        ws.send(data);
      });

      // 6. Handle terminal resize
      terminal.onResize(({ cols, rows }) => {
        resizeTerminalSession(sid, cols, rows).catch((err) => {
          console.error('[useTerminal] Failed to resize:', err);
        });
      });

      // 7. Handle window resize
      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener('resize', handleResize);

      // Store cleanup function
      (terminal as any)._cleanup = () => {
        window.removeEventListener('resize', handleResize);
      };

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setLoading(false);
      options.onError?.(err instanceof Error ? err : new Error(message));
    }
  };

  const disconnect = async () => {
    if (!sessionId) {
      return;
    }

    try {
      // Close WebSocket
      wsRef.current?.close();
      wsRef.current = null;

      // Close backend session
      await closeTerminalSession(sessionId);

      // Cleanup terminal
      if (terminalRef.current) {
        (terminalRef.current as any)._cleanup?.();
        terminalRef.current.dispose();
        terminalRef.current = null;
      }

      fitAddonRef.current = null;
      setSessionId(null);
    } catch (err) {
      console.error('[useTerminal] Failed to disconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const write = (data: string) => {
    terminalRef.current?.write(data);
  };

  const clear = () => {
    terminalRef.current?.clear();
  };

  const fit = () => {
    fitAddonRef.current?.fit();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    sessionId,
    terminal: terminalRef.current,
    loading,
    error,
    connect,
    disconnect,
    write,
    clear,
    fit,
  };
}
