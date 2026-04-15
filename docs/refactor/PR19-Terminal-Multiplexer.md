# PR19: Terminal Multiplexer - Dual-Plane Communication

## 目标
实现双平面通信架构，将终端 I/O 数据流与控制命令分离，提升终端响应性能。

## 架构设计

### 双平面架构
```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  xterm.js ←→ WebSocket Client (Data Plane)                  │
│  React UI ←→ Tauri IPC (Control Plane)                      │
└─────────────────────────────────────────────────────────────┘
                    ↓                    ↓
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Server (localhost:9527) - Data Plane             │
│  - Binary frames for terminal I/O                           │
│  - High throughput, low latency                             │
│  - Frame format: [session_id_len(1)][session_id][payload]   │
│                                                              │
│  Tauri Commands - Control Plane                             │
│  - JSON-based IPC                                           │
│  - Session management (create, close, resize)               │
│  - Terminal configuration                                   │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                    SSH Connections                           │
│  - PTY sessions via ssh2 crate                              │
│  - Multiple concurrent sessions                             │
└─────────────────────────────────────────────────────────────┘
```

### 为什么需要双平面？
1. **性能优化**: 终端 I/O 数据量大，WebSocket 比 Tauri IPC 更高效
2. **降低 IPC 压力**: 将高频数据流从 IPC 通道分离
3. **更好的响应性**: WebSocket 的二进制帧传输延迟更低
4. **架构清晰**: 数据流和控制流分离，职责明确

## 实施步骤

### Phase 1: Backend - WebSocket Server
**文件**: `src-tauri/src/runtime/ws_server.rs`

```rust
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct WsServer {
    addr: String,
    sessions: Arc<RwLock<HashMap<String, WsSession>>>,
}

struct WsSession {
    session_id: String,
    tx: mpsc::Sender<Vec<u8>>,
    rx: mpsc::Receiver<Vec<u8>>,
}

impl WsServer {
    pub async fn start(addr: &str) -> Result<Self> {
        let listener = TcpListener::bind(addr).await?;
        // Accept connections and handle frames
    }
    
    async fn handle_connection(&self, stream: TcpStream) {
        // Parse frame: [session_id_len][session_id][payload]
        // Route to corresponding PTY session
    }
}
```

**依赖**: 
- `tokio-tungstenite = "0.20"`
- `tokio = { version = "1", features = ["full"] }`

### Phase 2: Backend - Terminal Session Manager
**文件**: `src-tauri/src/runtime/terminal.rs`

```rust
use ssh2::Session;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct TerminalManager {
    sessions: Arc<RwLock<HashMap<String, TerminalSession>>>,
    ws_server: Arc<WsServer>,
}

struct TerminalSession {
    session_id: String,
    ssh_session: Session,
    channel: ssh2::Channel,
    size: (u32, u32), // cols, rows
}

impl TerminalManager {
    pub async fn create_session(
        &self,
        host: &str,
        port: u16,
        username: &str,
        credential: &str,
    ) -> Result<String> {
        // 1. Create SSH connection
        // 2. Request PTY
        // 3. Start shell
        // 4. Spawn read/write tasks
        // 5. Register with WebSocket server
    }
    
    pub async fn resize_session(&self, session_id: &str, cols: u32, rows: u32) {
        // Send PTY resize request
    }
    
    pub async fn close_session(&self, session_id: &str) {
        // Clean up SSH session and WebSocket connection
    }
}
```

### Phase 3: Backend - Tauri Commands (Control Plane)
**文件**: `src-tauri/src/commands/terminal.rs`

```rust
#[tauri::command]
pub async fn create_terminal_session(
    host: String,
    port: u16,
    username: String,
    credential: String,
    cols: u32,
    rows: u32,
    state: State<'_, Arc<TerminalManager>>,
) -> Result<String, String> {
    state.create_session(&host, port, &username, &credential, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resize_terminal(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, Arc<TerminalManager>>,
) -> Result<(), String> {
    state.resize_session(&session_id, cols, rows).await;
    Ok(())
}

#[tauri::command]
pub async fn close_terminal_session(
    session_id: String,
    state: State<'_, Arc<TerminalManager>>,
) -> Result<(), String> {
    state.close_session(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn get_ws_port(
    state: State<'_, Arc<WsServer>>,
) -> Result<u16, String> {
    Ok(state.port())
}
```

### Phase 4: Frontend - WebSocket Client (Data Plane)
**文件**: `src/lib/ws-terminal.ts`

```typescript
export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private onDataCallback?: (data: Uint8Array) => void;

  constructor(sessionId: string, port: number) {
    this.sessionId = sessionId;
    this.connect(port);
  }

  private connect(port: number) {
    this.ws = new WebSocket(`ws://localhost:${port}`);
    this.ws.binaryType = 'arraybuffer';
    
    this.ws.onmessage = (event) => {
      const data = new Uint8Array(event.data);
      // Parse frame: [session_id_len][session_id][payload]
      const sessionIdLen = data[0];
      const payload = data.slice(1 + sessionIdLen);
      
      if (this.onDataCallback) {
        this.onDataCallback(payload);
      }
    };
  }

  send(data: string | Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Build frame: [session_id_len][session_id][payload]
    const sessionIdBytes = new TextEncoder().encode(this.sessionId);
    const payloadBytes = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;
    
    const frame = new Uint8Array(1 + sessionIdBytes.length + payloadBytes.length);
    frame[0] = sessionIdBytes.length;
    frame.set(sessionIdBytes, 1);
    frame.set(payloadBytes, 1 + sessionIdBytes.length);
    
    this.ws.send(frame);
  }

  onData(callback: (data: Uint8Array) => void) {
    this.onDataCallback = callback;
  }

  close() {
    this.ws?.close();
  }
}
```

### Phase 5: Frontend - Terminal API (Control Plane)
**文件**: `src/lib/backend-terminal.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface TerminalConfig {
  host: string;
  port: number;
  username: string;
  credential: string;
  cols: number;
  rows: number;
}

export async function createTerminalSession(config: TerminalConfig): Promise<string> {
  return invoke('create_terminal_session', config);
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke('resize_terminal', { sessionId, cols, rows });
}

export async function closeTerminalSession(sessionId: string): Promise<void> {
  return invoke('close_terminal_session', { sessionId });
}

export async function getWsPort(): Promise<number> {
  return invoke('get_ws_port');
}
```

### Phase 6: Frontend - React Hook
**文件**: `src/hooks/useTerminal.ts`

```typescript
import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { TerminalWebSocket } from '../lib/ws-terminal';
import { createTerminalSession, resizeTerminal, closeTerminalSession, getWsPort } from '../lib/backend-terminal';

export function useTerminal(host: string, port: number, username: string, credential: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  const connect = async (terminalElement: HTMLElement) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Get WebSocket port
      const wsPort = await getWsPort();

      // 2. Create terminal session
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      });
      
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(terminalElement);
      fitAddon.fit();

      const { cols, rows } = terminal;
      const sid = await createTerminalSession({
        host,
        port,
        username,
        credential,
        cols,
        rows,
      });

      // 3. Connect WebSocket
      const ws = new TerminalWebSocket(sid, wsPort);
      
      // Data plane: terminal output
      ws.onData((data) => {
        terminal.write(data);
      });

      // Data plane: terminal input
      terminal.onData((data) => {
        ws.send(data);
      });

      // Control plane: resize
      terminal.onResize(({ cols, rows }) => {
        resizeTerminal(sid, cols, rows);
      });

      terminalRef.current = terminal;
      wsRef.current = ws;
      setSessionId(sid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (sessionId) {
      await closeTerminalSession(sessionId);
    }
    wsRef.current?.close();
    terminalRef.current?.dispose();
    setSessionId(null);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    sessionId,
    loading,
    error,
    connect,
    disconnect,
  };
}
```

### Phase 7: Frontend - Terminal Component
**文件**: `src/components/Terminal/TerminalView.tsx`

```typescript
import { useEffect, useRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import 'xterm/css/xterm.css';

interface TerminalViewProps {
  host: string;
  port: number;
  username: string;
  credential: string;
}

export default function TerminalView({ host, port, username, credential }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { sessionId, loading, error, connect, disconnect } = useTerminal(
    host,
    port,
    username,
    credential
  );

  useEffect(() => {
    if (terminalRef.current && !sessionId && !loading) {
      connect(terminalRef.current);
    }
  }, [terminalRef.current]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (loading) {
    return <div>Connecting...</div>;
  }

  return (
    <div className="h-full w-full">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
```

## 验收标准

### 功能测试
- [ ] WebSocket 服务器在 localhost:9527 启动成功
- [ ] 创建终端会话并建立 SSH 连接
- [ ] 终端输入/输出通过 WebSocket 正常传输
- [ ] 终端窗口调整大小时 PTY 同步调整
- [ ] 关闭会话时清理所有资源
- [ ] 支持多个并发终端会话

### 性能测试
- [ ] 大量输出时（如 `cat large_file`）无明显延迟
- [ ] 快速输入时（如连续按键）无丢失
- [ ] WebSocket 连接稳定，无频繁断线重连
- [ ] 内存占用合理，无泄漏

### 边界测试
- [ ] SSH 连接失败时正确处理错误
- [ ] WebSocket 连接断开时自动重连或提示
- [ ] 会话 ID 冲突时正确处理
- [ ] 网络异常时优雅降级

## 技术债务
- 考虑添加 WebSocket 心跳机制
- 考虑添加断线重连逻辑
- 考虑添加数据压缩（对于大量输出）
- 考虑添加会话持久化（重启后恢复）

## 参考
- OxideTerm 的双平面架构设计
- xterm.js 官方文档
- ssh2 crate 文档
- tokio-tungstenite 文档
