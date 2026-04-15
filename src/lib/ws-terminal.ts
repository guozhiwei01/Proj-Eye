/**
 * WebSocket Terminal Client
 * Handles binary WebSocket communication for terminal I/O
 */

export interface TerminalWebSocketOptions {
  onData: (data: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private wsUrl: string;
  private options: Required<TerminalWebSocketOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private isManualClose = false;

  constructor(sessionId: string, wsUrl: string, options: TerminalWebSocketOptions) {
    this.sessionId = sessionId;
    this.wsUrl = wsUrl;
    this.options = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      ...options,
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isManualClose = false;
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log(`[TerminalWS] Connected: ${this.sessionId}`);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.options.onConnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = this.decodeFrame(event.data);
        this.options.onData(data);
      } catch (error) {
        console.error('[TerminalWS] Failed to decode frame:', error);
        this.options.onError(error as Error);
      }
    };

    this.ws.onerror = (event) => {
      console.error('[TerminalWS] Error:', event);
      this.options.onError(new Error('WebSocket error'));
    };

    this.ws.onclose = () => {
      console.log(`[TerminalWS] Disconnected: ${this.sessionId}`);
      this.stopHeartbeat();
      this.options.onDisconnect();

      if (!this.isManualClose && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
  }

  send(data: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[TerminalWS] Cannot send, not connected');
      return;
    }

    try {
      const frame = this.encodeFrame(data);
      this.ws.send(frame);
    } catch (error) {
      console.error('[TerminalWS] Failed to send data:', error);
      this.options.onError(error as Error);
    }
  }

  close(): void {
    this.isManualClose = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private encodeFrame(data: string): ArrayBuffer {
    const sessionIdBytes = new TextEncoder().encode(this.sessionId);
    const payloadBytes = new TextEncoder().encode(data);

    const frame = new Uint8Array(1 + sessionIdBytes.length + payloadBytes.length);
    frame[0] = sessionIdBytes.length;
    frame.set(sessionIdBytes, 1);
    frame.set(payloadBytes, 1 + sessionIdBytes.length);

    return frame.buffer;
  }

  private decodeFrame(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    const sessionIdLen = view[0];
    const payloadStart = 1 + sessionIdLen;
    const payload = view.slice(payloadStart);

    return new TextDecoder().decode(payload);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts++;

    console.log(
      `[TerminalWS] Reconnecting in ${this.options.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
