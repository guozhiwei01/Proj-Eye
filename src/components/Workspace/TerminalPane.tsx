import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useI18n } from "../../lib/i18n";
import {
  WorkspaceConnectionState,
  type Project,
  type SessionSummary,
} from "../../types/models";

interface TerminalContextMenuState {
  selectedText: string;
  x: number;
  y: number;
}

const REPLAY_SANITIZE_PATTERN = /\x1b\[\?*6n/g;

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the legacy copy path below.
  }

  try {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  } catch {
    return false;
  }
}

async function readClipboardText(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    return null;
  }

  return null;
}

interface TerminalPaneProps {
  project: Project;
  session: SessionSummary | null;
  terminalBuffer: string;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onReconnect: () => void;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-[1.4]">
      <rect x="5.5" y="2.5" width="8" height="10" rx="1.5" />
      <path d="M10.5 13.5H4a1.5 1.5 0 0 1-1.5-1.5V4.5" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-[1.4]">
      <path d="M5.5 3.5h5" />
      <path d="M6.5 2.5h3a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h2v-1a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export default function TerminalPane({
  project,
  session,
  terminalBuffer,
  onInput,
  onResize,
  onReconnect,
}: TerminalPaneProps) {
  const { locale, t } = useI18n();
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const renderedLengthRef = useRef(0);
  const mountedSessionIdRef = useRef<string | null>(null);
  const pendingInputRef = useRef("");
  const flushTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const sessionRef = useRef<SessionSummary | null>(session);
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const lastReportedSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<TerminalContextMenuState | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const replayTerminalData = (data: string, sanitizeReplay = false) => {
    const terminal = terminalRef.current;
    const payload = sanitizeReplay ? data.replace(REPLAY_SANITIZE_PATTERN, "") : data;
    if (!terminal || !payload) {
      return;
    }

    terminal.write(payload);
  };

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    onInputRef.current = onInput;
    onResizeRef.current = onResize;
  }, [onInput, onResize]);

  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) {
      return;
    }

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: {
        background: "#101010",
        foreground: "rgba(255,255,255,0.9)",
        cursor: "#1ce7c2",
        cursorAccent: "#101010",
        black: "#101010",
        brightBlack: "#6c727f",
        red: "#ef476f",
        brightRed: "#ff6b8d",
        green: "#1ce7c2",
        brightGreen: "#59f6d6",
        yellow: "#ffd166",
        brightYellow: "#ffe09a",
        blue: "#58a6ff",
        brightBlue: "#7ab8ff",
        magenta: "#c792ea",
        brightMagenta: "#ddb0ff",
        cyan: "#6be8ff",
        brightCyan: "#94f1ff",
        white: "#d8dee9",
        brightWhite: "#ffffff",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const reportSize = () => {
      const next = { cols: terminal.cols, rows: terminal.rows };
      const previous = lastReportedSizeRef.current;
      if (previous?.cols === next.cols && previous?.rows === next.rows) {
        return;
      }
      lastReportedSizeRef.current = next;
      if (sessionRef.current) {
        onResizeRef.current(next.cols, next.rows);
      }
    };

    const flushInput = () => {
      flushTimerRef.current = null;
      const chunk = pendingInputRef.current;
      pendingInputRef.current = "";
      if (chunk) {
        onInputRef.current(chunk);
      }
    };

    const queueInput = (data: string) => {
      pendingInputRef.current += data;
      if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(flushInput, 12);
      }
    };

    const disposable = terminal.onData((data) => {
      if (!sessionRef.current || sessionRef.current.connectionState === WorkspaceConnectionState.Failed) {
        return;
      }
      queueInput(data);
    });

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        const selection = terminal.getSelection();
        if (selection) {
          void writeClipboardText(selection);
        }
        return false;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") {
        void readClipboardText().then((text) => {
          if (text) {
            onInputRef.current(text);
          }
        });
        return false;
      }

      return true;
    });

    const resizeDisposable = terminal.onResize(() => {
      reportSize();
    });

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        fitAddon.fit();
        reportSize();
      });
    });
    observer.observe(host);
    resizeObserverRef.current = observer;
    window.requestAnimationFrame(() => {
      fitAddon.fit();
      reportSize();
      terminal.focus();
    });

    return () => {
      disposable.dispose();
      resizeDisposable.dispose();
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      pendingInputRef.current = "";
      renderedLengthRef.current = 0;
      mountedSessionIdRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) {
      return;
    }

    const sessionChanged = mountedSessionIdRef.current !== (session?.id ?? null);
    if (sessionChanged) {
      terminal.reset();
      mountedSessionIdRef.current = session?.id ?? null;
      renderedLengthRef.current = 0;
      fitAddon.fit();
      window.requestAnimationFrame(() => {
        fitAddon.fit();
        terminal.focus();
      });
    }

    if (!session) {
      const placeholder = `cd ${project.rootPath}\r\n${t("workspace.awaitingSession")}\r\n`;
      replayTerminalData(placeholder);
      renderedLengthRef.current = placeholder.length;
      return;
    }

    const nextChunk =
      terminalBuffer.length >= renderedLengthRef.current
        ? terminalBuffer.slice(renderedLengthRef.current)
        : terminalBuffer;

    if (sessionChanged && terminalBuffer.length > 0) {
      replayTerminalData(terminalBuffer, true);
      renderedLengthRef.current = terminalBuffer.length;
      return;
    }

    if (nextChunk) {
      replayTerminalData(nextChunk);
      renderedLengthRef.current = terminalBuffer.length;
    }
  }, [project.rootPath, session, t, terminalBuffer]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    const handleViewportChange = () => {
      setContextMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [contextMenu]);

  const failed = session?.connectionState === WorkspaceConnectionState.Failed;
  const reconnecting = session?.connectionState === WorkspaceConnectionState.Reconnecting;
  const menuTitleLabel = locale === "zh-CN" ? "操作" : "Actions";
  const copyLabel = locale === "zh-CN" ? "复制" : "Copy";
  const pasteLabel = locale === "zh-CN" ? "粘贴" : "Paste";
  const emptyCopyLabel = locale === "zh-CN" ? "先选中文本" : "Select text first";
  const copySuccessLabel = locale === "zh-CN" ? "已复制" : "Copied";
  const copyErrorLabel = locale === "zh-CN" ? "复制失败" : "Copy failed";
  const pasteSuccessLabel = locale === "zh-CN" ? "已粘贴" : "Pasted";
  const pasteErrorLabel = locale === "zh-CN" ? "粘贴失败" : "Paste failed";

  const showNotice = (message: string) => {
    setActionNotice(message);

    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setActionNotice(null);
      noticeTimerRef.current = null;
    }, 1200);
  };

  const openContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const terminal = terminalRef.current;
    const selection = terminal?.getSelection() ?? window.getSelection()?.toString() ?? "";
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = 288;
    const height = 126;
    const x = Math.max(12, Math.min(event.clientX - bounds.left, bounds.width - width - 12));
    const y = Math.max(12, Math.min(event.clientY - bounds.top, bounds.height - height - 12));

    setContextMenu({
      selectedText: selection,
      x,
      y,
    });
    terminal?.focus();
  };

  const copySelection = async () => {
    const selectedText = contextMenu?.selectedText ?? "";
    if (!selectedText) {
      return;
    }

    const copied = await writeClipboardText(selectedText);
    setContextMenu(null);
    showNotice(copied ? copySuccessLabel : copyErrorLabel);
    terminalRef.current?.focus();
  };

  const pasteClipboard = async () => {
    const text = await readClipboardText();
    setContextMenu(null);

    if (text === null) {
      showNotice(pasteErrorLabel);
      terminalRef.current?.focus();
      return;
    }

    if (text) {
      onInputRef.current(text);
    }
    showNotice(pasteSuccessLabel);
    terminalRef.current?.focus();
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[12px] bg-[#101010]">
      {(failed || reconnecting) && (
        <div className="flex items-center justify-end border-b border-white/6 px-4 py-3">
          <div className="flex items-center gap-3">
            {failed ? (
              <button
                type="button"
                onClick={onReconnect}
                className="rounded-full border border-[#1ce7c2]/30 bg-[#1ce7c2]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#7ef7df] transition hover:border-[#1ce7c2]/60 hover:bg-[#1ce7c2]/14"
              >
                Reconnect
              </button>
            ) : null}
            {reconnecting ? (
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/54">
                Reconnecting
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div
        className="relative min-h-0 flex-1 bg-[#101010]"
        onMouseDown={() => terminalRef.current?.focus()}
        onClick={() => terminalRef.current?.focus()}
        onContextMenuCapture={openContextMenu}
      >
        <div ref={terminalHostRef} className="h-full w-full px-4 py-4" />

        {contextMenu ? (
          <div
            ref={contextMenuRef}
            className="absolute z-20 w-[288px] overflow-hidden rounded-[10px] border border-[#314158] bg-[rgba(15,23,42,0.98)] shadow-[0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur"
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="border-b border-white/8 px-4 py-3 text-[14px] font-semibold text-white/82">
              {menuTitleLabel}
            </div>
            <button
              type="button"
              onClick={() => {
                void copySelection();
              }}
              disabled={!contextMenu.selectedText}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] text-white/90 transition hover:bg-white/6 disabled:cursor-not-allowed disabled:text-white/35 disabled:hover:bg-transparent"
              role="menuitem"
            >
              <span className="flex items-center gap-3">
                <CopyIcon />
                <span>{copyLabel}</span>
              </span>
              <span className="text-[12px] font-medium text-white/42">
                {contextMenu.selectedText ? "Ctrl+Shift+C" : emptyCopyLabel}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                void pasteClipboard();
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] text-white/90 transition hover:bg-white/6"
              role="menuitem"
            >
              <span className="flex items-center gap-3">
                <PasteIcon />
                <span>{pasteLabel}</span>
              </span>
              <span className="text-[12px] font-medium text-white/42">Ctrl+Shift+V</span>
            </button>
          </div>
        ) : null}

        {actionNotice ? (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-[#1ce7c2]/20 bg-[rgba(28,231,194,0.12)] px-3 py-1 text-[11px] text-[#8bf5e3]">
            {actionNotice}
          </div>
        ) : null}

        {failed ? (
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] text-white/54">
            {session?.cwd ?? project.rootPath}
          </div>
        ) : null}
      </div>
    </div>
  );
}
