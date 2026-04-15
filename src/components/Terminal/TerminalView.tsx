import { useEffect, useRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import '@xterm/xterm/css/xterm.css';

export interface TerminalViewProps {
  host: string;
  port: number;
  username: string;
  credential: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Terminal component with WebSocket-based communication
 */
export default function TerminalView({
  host,
  port,
  username,
  credential,
  onConnect,
  onDisconnect,
  onError,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { sessionId, loading, error, connect, disconnect } = useTerminal({
    host,
    port,
    username,
    credential,
    onConnect,
    onDisconnect,
    onError,
  });

  useEffect(() => {
    if (terminalRef.current && !sessionId && !loading && !error) {
      connect(terminalRef.current);
    }

    return () => {
      if (sessionId) {
        disconnect();
      }
    };
  }, [terminalRef.current]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          <div className="mb-2 font-semibold">Connection Error</div>
          <div className="text-sm">{error}</div>
          <button
            type="button"
            onClick={() => {
              if (terminalRef.current) {
                connect(terminalRef.current);
              }
            }}
            className="mt-3 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-[var(--text2)]">
          <div className="mb-2 text-center">Connecting to {host}...</div>
          <div className="h-1 w-48 overflow-hidden rounded-full bg-[var(--bg3)]">
            <div className="h-full w-1/2 animate-pulse bg-[var(--green)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
