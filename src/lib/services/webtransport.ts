/**
 * WebTransport Service for Real-time Communication
 * 
 * This service provides WebTransport-based real-time communication
 * for chat and notifications, with automatic WebSocket fallback.
 */

import { website } from "@/config";

export type WebTransportMessage = {
  type: string;
  [key: string]: any;
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WebTransportCallbacks {
  onMessage?: (data: WebTransportMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

type TransportMode = "webtransport" | "websocket" | "none";

export class WebTransportService {
  private transport: WebTransport | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private ws: WebSocket | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private status: ConnectionStatus = "disconnected";
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private callbacks: WebTransportCallbacks = {};
  private token: string;
  private subscriptions: WebTransportMessage[] = [];
  private isReading = false;
  private mode: TransportMode = "none";
  private connectPromise: Promise<boolean> | null = null;

  constructor(token: string, callbacks: WebTransportCallbacks = {}) {
    this.token = token;
    this.callbacks = callbacks;
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get current transport mode
   */
  getMode(): TransportMode {
    return this.mode;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): WebTransportMessage[] {
    return [...this.subscriptions];
  }

  /**
   * Check if WebTransport is supported in the browser
   */
  static isSupported(): boolean {
    return typeof WebTransport !== "undefined";
  }

  /**
   * Update callbacks (useful for reactive frameworks like Svelte)
   */
  setCallbacks(callbacks: WebTransportCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Connect to the server (tries WebTransport first, falls back to WebSocket)
   */
  async connect(): Promise<boolean> {
    if (this.status === "connected") {
      return true;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        console.log("[Transport] Starting connection process...");
        this.updateStatus("connecting");
        this.clearReconnectTimer();

        // Try WebTransport first
        if (WebTransportService.isSupported()) {
          const wtSuccess = await this.connectWebTransport();
          if (wtSuccess) {
            return true;
          }
          console.warn("[WebTransport] WebTransport failed, falling back to WebSocket");
        } else {
          console.warn("[WebTransport] Not supported in this browser, using WebSocket");
        }

        // Fall back to WebSocket
        const wsSuccess = await this.connectWebSocket();
        if (wsSuccess) {
          return true;
        }

        this.updateStatus("error");
        return false;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  /**
   * Try to connect via WebTransport (QUIC/H3)
   */
  private async connectWebTransport(): Promise<boolean> {
    try {
      const url = `${website.webtransport}/${this.token}`;
      let transportOptions: any = undefined;

      if (website.webtransport.includes("localhost") || website.webtransport.includes("127.0.0.1")) {
        try {
          const urlObj = new URL(website.webtransport);
          const fingerUrl = `http://${urlObj.hostname}:${urlObj.port}/wt-fingerprint`;
          console.log(`[WebTransport] Attempting to fetch certificate fingerprint from ${fingerUrl}`);
          const response = await fetch(fingerUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.fingerprint) {
              const binaryString = atob(data.fingerprint);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              transportOptions = {
                serverCertificateHashes: [
                  {
                    algorithm: "sha-256",
                    value: bytes,
                  },
                ],
              };
              console.log("[WebTransport] Configured with server certificate hash:", data.fingerprint);
            }
          } else {
            console.warn(`[WebTransport] Failed to fetch fingerprint: ${response.status} ${response.statusText}`);
          }
        } catch (e) {
          console.warn("[WebTransport] Could not fetch certificate fingerprint.", e);
        }
      }

      this.transport = new WebTransport(url, transportOptions);

      const transportRef = this.transport;
      this.transport.closed.then(() => {
        console.log("[WebTransport] Connection closed gracefully");
        if (this.transport === transportRef && this.mode === "webtransport") {
          this.handleDisconnect();
        }
      }).catch((error) => {
        console.error("[WebTransport] Connection closed with error:", error);
        if (this.transport === transportRef && this.mode === "webtransport") {
          this.handleDisconnect();
        }
      });

      await this.transport.ready;
      console.log("[WebTransport] Connection ready");

      const stream = await this.transport.createBidirectionalStream();
      this.writer = stream.writable.getWriter();
      this.reader = stream.readable.getReader();

      this.mode = "webtransport";
      this.updateStatus("connected");
      this.reconnectAttempts = 0;

      this.startReadingWebTransport();
      this.resendSubscriptions();

      return true;
    } catch (error: any) {
      console.error("[WebTransport] WebTransport connection failed:", error?.message || error);
      // Clean up failed attempt
      this.cleanupWebTransport();
      return false;
    }
  }

  /**
   * Connect via WebSocket (fallback)
   */
  private async connectWebSocket(): Promise<boolean> {
    try {
      // Derive WebSocket URL from the webtransport config URL
      // Note: The Hypercorn HTTP/WS server runs without TLS even though
      // the QUIC/WebTransport server uses HTTPS. Always use ws:// for
      // the HTTP-based WebSocket fallback.
      const wtUrl = new URL(website.webtransport);
      const wsUrl = `ws://${wtUrl.host}/ws?token=${this.token}`;

      console.log(`[WebSocket] Connecting to ${wsUrl}`);

      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(wsUrl);
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.error("[WebSocket] Connection timeout");
            ws.close();
            resolve(false);
          }
        }, 10000);

        ws.onopen = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);

          console.log("[WebSocket] Connected successfully");
          this.ws = ws;
          this.mode = "websocket";
          this.updateStatus("connected");
          this.reconnectAttempts = 0;

          this.resendSubscriptions();
          resolve(true);
        };

        ws.onmessage = (event) => {
          this.handleWebSocketMessage(event.data);
        };

        ws.onerror = (error) => {
          console.error("[WebSocket] Connection error:", error);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        };

        ws.onclose = (event) => {
          console.log(`[WebSocket] Connection closed: code=${event.code}, reason=${event.reason}`);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          } else if (this.mode === "websocket") {
            this.handleDisconnect();
          }
        };
      });
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      return false;
    }
  }

  /**
   * Handle WebSocket incoming messages
   */
  private handleWebSocketMessage(data: string): void {
    try {
      // WebSocket messages don't need newline framing
      const parsed = JSON.parse(data);
      this.handleMessage(parsed);
    } catch (error) {
      console.error("[WebSocket] Failed to parse message:", error, data);
    }
  }

  /**
   * Handle disconnect from either transport
   */
  private handleDisconnect(): void {
    this.updateStatus("disconnected");
    this.mode = "none";
    this.scheduleReconnect();
  }

  /**
   * Clean up WebTransport resources
   */
  private cleanupWebTransport(): void {
    try {
      if (this.writer) {
        this.writer.close().catch(() => {});
        this.writer = null;
      }
    } catch (e) { /* ignore */ }

    try {
      if (this.reader) {
        this.reader.cancel().catch(() => {});
        this.reader = null;
      }
    } catch (e) { /* ignore */ }

    try {
      if (this.transport) {
        this.transport.close();
        this.transport = null;
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Clean up WebSocket resources
   */
  private cleanupWebSocket(): void {
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch (e) { /* ignore */ }
      this.ws = null;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.isReading = false;

    this.cleanupWebTransport();
    this.cleanupWebSocket();

    this.mode = "none";
    this.updateStatus("disconnected");
  }

  /**
   * Send a message to the server
   */
  async send(message: WebTransportMessage): Promise<boolean> {
    if (this.status !== "connected") {
      // If we're connecting, wait for it to finish
      if (this.connectPromise || this.status === "connecting") {
        console.log("[Transport] Send requested while connecting, waiting...");
        const connected = await this.connect();
        if (!connected) return false;
      } else {
        console.warn("[Transport] Cannot send, not connected. Status:", this.status, "Mode:", this.mode);
        return false;
      }
    }

    try {
      const json = JSON.stringify(message);

      if (this.mode === "webtransport" && this.writer) {
        const data = this.encoder.encode(json + '\n');
        await this.writer.write(data);
        return true;
      }

      if (this.mode === "websocket" && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(json);
        return true;
      }

      console.warn("[Transport] No active transport to send on. Mode:", this.mode);
      return false;
    } catch (error) {
      console.error("[Transport] Send failed:", error);
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Subscribe to a channel/space for notifications
   */
  async subscribe(spaceName: string, subpath: string): Promise<boolean> {
    const subscription: WebTransportMessage = {
      type: "notification_subscription",
      space_name: spaceName,
      subpath: subpath,
    };

    // Store subscription for reconnection
    const existingIndex = this.subscriptions.findIndex(
      (s) => s.space_name === spaceName && s.subpath === subpath
    );
    if (existingIndex === -1) {
      this.subscriptions.push(subscription);
    }

    return await this.send(subscription);
  }

  /**
   * Unsubscribe from a channel (remove from pending subscriptions)
   */
  unsubscribe(spaceName: string, subpath: string): void {
    this.subscriptions = this.subscriptions.filter(
      (s) => !(s.space_name === spaceName && s.subpath === subpath)
    );
  }

  /**
   * Send a chat message
   */
  async sendChatMessage(
    spaceName: string,
    subpath: string,
    message: string,
    options: {
      senderId?: string;
      receiverId?: string;
      groupId?: string;
      hasAttachments?: boolean;
      attachments?: any[];
    } = {}
  ): Promise<boolean> {
    const msg: WebTransportMessage = {
      type: "chat_message",
      space_name: spaceName,
      subpath: subpath,
      message: message,
      ...options,
    };
    return await this.send(msg);
  }

  /**
   * Send a broadcast message (for group messaging)
   */
  async sendBroadcastMessage(
    messageId: string,
    senderId: string,
    content: string,
    options: {
      receiverId?: string;
      groupId?: string;
      timestamp?: string;
      hasAttachments?: boolean;
      attachments?: any[];
      participants?: string[];
    } = {}
  ): Promise<boolean> {
    const msg: WebTransportMessage = {
      type: "message",
      messageId,
      senderId,
      content,
      ...options,
    };
    return await this.send(msg);
  }

  /**
   * Start reading messages from the WebTransport stream
   */
  private async startReadingWebTransport(): Promise<void> {
    if (!this.reader || this.isReading) return;

    this.isReading = true;
    let buffer = new Uint8Array(0);

    try {
      while (this.isReading && this.status === "connected") {
        const { value, done } = await this.reader.read();
        
        if (done) {
          console.log("[WebTransport] Stream closed by server");
          break;
        }

        if (value) {
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          let start = 0;
          for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 10) { // '\n' LF byte
              const line = buffer.slice(start, i);
              start = i + 1;
              if (line.length === 0) continue;

              try {
                const json = this.decoder.decode(line);
                const data = JSON.parse(json);
                this.handleMessage(data);
              } catch (error) {
                console.error("[WebTransport] Failed to parse message:", error);
              }
            }
          }
          if (start > 0) {
            buffer = buffer.slice(start);
          }
        }
      }
    } catch (error) {
      if (this.status === "connected") {
        console.error("[WebTransport] Read error:", error);
      }
    } finally {
      this.isReading = false;
      
      if (this.status === "connected") {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: WebTransportMessage): void {
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(data);
    }
  }

  /**
   * Update connection status and notify callback
   */
  private updateStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      console.log(`[Transport] Status: ${this.status} → ${status} (mode: ${this.mode})`);
      this.status = status;
      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange(status);
      }
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Transport] Max reconnection attempts reached");
      this.updateStatus("error");
      return;
    }

    this.updateStatus("disconnected");
    this.reconnectAttempts++;

    console.log(
      `[Transport] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      // Clean up old connections before reconnecting
      this.cleanupWebTransport();
      this.cleanupWebSocket();
      this.mode = "none";
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Resend all stored subscriptions after reconnection
   */
  private async resendSubscriptions(): Promise<void> {
    for (const subscription of this.subscriptions) {
      await this.send(subscription);
    }
  }
}

// Singleton instance for app-wide use
let globalWebTransport: WebTransportService | null = null;

export function getWebTransportService(
  token?: string,
  callbacks?: WebTransportCallbacks
): WebTransportService | null {
  if (!globalWebTransport && token) {
    globalWebTransport = new WebTransportService(token, callbacks);
  } else if (globalWebTransport && callbacks) {
    globalWebTransport.setCallbacks(callbacks);
  }

  return globalWebTransport;
}

export function resetWebTransportService(): void {
  if (globalWebTransport) {
    globalWebTransport.disconnect();
    globalWebTransport = null;
  }
}

export default WebTransportService;
