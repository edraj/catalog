/**
 * WebTransport Service for Real-time Communication
 * 
 * This service provides a WebTransport-based alternative to WebSocket
 * for real-time chat and notifications.
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

export class WebTransportService {
  private transport: WebTransport | null = null;
  private ws: WebSocket | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
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
   * Connect to the WebTransport server
   */
  async connect(): Promise<boolean> {
    if (this.status === "connected" || this.status === "connecting") {
      return true;
    }

    this.updateStatus("connecting");
    this.clearReconnectTimer();

    if (WebTransportService.isSupported()) {

    try {
      const url = `${website.webtransport}/${this.token}`;
      let transportOptions: any = undefined;

      if (website.webtransport.includes("localhost") || website.webtransport.includes("127.0.0.1")) {
        try {
          // Try fetching fingerprint from the server if it's localhost
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
          console.warn("[WebTransport] Could not fetch certificate fingerprint. It might fail if self-signed.", e);
        }
      }

      this.transport = new WebTransport(url, transportOptions);

      // Add event listener for error/closed to get more details
      this.transport.closed.then(() => {
        console.log("[WebTransport] Connection closed gracefully");
      }).catch((error) => {
        console.error("[WebTransport] Connection closed with error:", error);
        
        // If we see QUIC_IETF_GQUIC_ERROR_MISSING, it's usually because WT_ENABLED is not set on the server
        if (error.message && error.message.includes("WT_ENABLED")) {
          console.warn("[WebTransport] HINT: The server must enable WebTransport. Ensure the SETTINGS_WEBTRANSPORT frame is sent with value 1.");
        }
        
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      });

      // Add options for better handshake in some environments
      // Some servers might require certain options or drafts.
      // this.transport = new WebTransport(url, { ...transportOptions, requireUnreliable: true });

      // Wait for connection to be ready
      await this.transport.ready;
      console.log("[WebTransport] Connection ready");

      // Create bidirectional stream
      const stream = await this.transport.createBidirectionalStream();
      this.writer = stream.writable.getWriter();
      this.reader = stream.readable.getReader();

      this.updateStatus("connected");
      this.reconnectAttempts = 0;

      // Start reading messages
      this.startReading();

      // Resend any pending subscriptions
      this.resendSubscriptions();

      return true;
    } catch (error: any) {
      console.error("[WebTransport] Connection failed, falling back to WebSocket:", error);
      
      if (error.name === "WebTransportError" && error.message && error.message.includes("rejected")) {
        console.warn("[WebTransport] HINT: Connection rejected.");
      }
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
    } else {
      console.warn("[WebTransport] Not supported in this browser, falling back to WebSocket");
    }

    // --- WebSocket Fallback ---
    try {
      const urlObj = new URL(website.webtransport);
      // Ensure localhost uses ws:// because Hypercorn TCP isn't TLS encrypted
      const isLocal = urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1";
      const wsProtocol = isLocal ? "ws:" : (urlObj.protocol === "https:" ? "wss:" : "ws:");
      const wsUrl = `${wsProtocol}//${urlObj.host}/ws?token=${this.token}`;
      
      console.log(`[WebSocket] Attempting fallback connection to ${wsUrl}`);
      
      return await new Promise<boolean>((resolve) => {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log("[WebSocket] Connection ready");
          this.updateStatus("connected");
          this.reconnectAttempts = 0;
          this.resendSubscriptions();
          resolve(true);
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
          }
        };
        
        this.ws.onclose = () => {
          console.log("[WebSocket] Connection closed");
          this.updateStatus("disconnected");
          this.scheduleReconnect();
          resolve(false);
        };
        
        this.ws.onerror = (err: any) => {
          console.error("[WebSocket] Connection error:", err);
          if (this.callbacks.onError) this.callbacks.onError(err);
        };
      });
    } catch (wsError) {
      console.error("[WebSocket] Fallback connection failed:", wsError);
      this.updateStatus("error");
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.isReading = false;

    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
    } catch (e) {
      // Ignore errors during cleanup
    }

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
    } catch (e) {
      // Ignore errors during cleanup
    }

    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
    } catch (e) {
      // Ignore errors during cleanup
    }

    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } catch (e) {
      // Ignore errors during cleanup
    }

    this.updateStatus("disconnected");
  }

  /**
   * Send a message to the server
   */
  async send(message: WebTransportMessage): Promise<boolean> {
    if (this.status !== "connected") {
      console.warn("[WebTransport] Cannot send, not connected");
      return false;
    }

    try {
      const json = JSON.stringify(message);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(json);
        return true;
      } else if (this.writer) {
        const data = this.encoder.encode(json + '\n');
        await this.writer.write(data);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("[WebTransport] Send failed:", error);
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
   * Start reading messages from the stream
   */
  private async startReading(): Promise<void> {
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
      console.error("[WebTransport] Max reconnection attempts reached");
      this.updateStatus("error");
      return;
    }

    this.updateStatus("disconnected");
    this.reconnectAttempts++;

    console.log(
      `[WebTransport] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
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
