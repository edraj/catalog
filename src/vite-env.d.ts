/// <reference types="svelte" />
/// <reference types="vite/client" />

// WebTransport API type declarations (experimental API)
// https://developer.mozilla.org/en-US/docs/Web/API/WebTransport

interface WebTransportHash {
  algorithm: string;
  value: BufferSource;
}

interface WebTransportOptions {
  serverCertificateHashes?: WebTransportHash[];
  congestionControl?: "default" | "throughput" | "low-latency";
  requireUnreliable?: boolean;
}

interface WebTransportBidirectionalStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

interface WebTransportDatagramDuplexStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

interface WebTransportCloseInfo {
  closeCode: number;
  reason: string;
}

interface WebTransport {
  readonly incomingBidirectionalStreams: ReadableStream<WebTransportBidirectionalStream>;
  readonly incomingUnidirectionalStreams: ReadableStream<ReadableStream<Uint8Array>>;
  readonly datagrams: WebTransportDatagramDuplexStream;
  readonly ready: Promise<void>;
  readonly closed: Promise<WebTransportCloseInfo>;
  
  close(closeInfo?: WebTransportCloseInfo): void;
  createBidirectionalStream(): Promise<WebTransportBidirectionalStream>;
  createUnidirectionalStream(): Promise<WritableStream<Uint8Array>>;
}

interface WebTransportConstructor {
  new (url: string, options?: WebTransportOptions): WebTransport;
}

declare const WebTransport: WebTransportConstructor;
