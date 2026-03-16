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
    if (!WebTransportService.isSupported()) {
      console.error("[WebTransport] Not supported in this browser");
      this.updateStatus("error");
      return false;
    }

    if (this.status === "connected" || this.status === "connecting") {
      return true;
    }

    this.updateStatus("connecting");
    this.clearReconnectTimer();

    try {
      const url = `${website.webtransport}/${this.token}`;
      this.transport = new WebTransport(url);

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
    } catch (error) {
      console.error("[WebTransport] Connection failed:", error);
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

    this.updateStatus("disconnected");
  }

  /**
   * Send a message to the server
   */
  async send(message: WebTransportMessage): Promise<boolean> {
    if (!this.writer || this.status !== "connected") {
      console.warn("[WebTransport] Cannot send, not connected");
      return false;
    }

    try {
      const json = JSON.stringify(message);
      const data = this.encoder.encode(json);
      await this.writer.write(data);
      return true;
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

    try {
      while (this.isReading && this.status === "connected") {
        const { value, done } = await this.reader.read();
        
        if (done) {
          console.log("[WebTransport] Stream closed by server");
          break;
        }

        if (value) {
          try {
            const json = this.decoder.decode(value);
            const data = JSON.parse(json);
            this.handleMessage(data);
          } catch (error) {
            console.error("[WebTransport] Failed to parse message:", error);
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
  if (!WebTransportService.isSupported()) {
    return null;
  }

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
