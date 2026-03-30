/**
 * WebTransport Service Usage Examples
 * 
 * This file demonstrates how to use the WebTransport service for real-time communication.
 */

import {
  WebTransportService,
  getWebTransportService,
  resetWebTransportService,
  type WebTransportMessage,
  type ConnectionStatus,
} from "./webtransport";

// ============================================================================
// Example 1: Basic Usage with Singleton
// ============================================================================

async function basicUsageExample() {
  const token = localStorage.getItem("authToken") || "";
  
  // Get or create the singleton instance
  const wt = getWebTransportService(token, {
    onMessage: (data: WebTransportMessage) => {
      console.log("Received message:", data);
      
      if (data.type === "chat_message") {
        console.log(`Chat from ${data.from}: ${data.message}`);
      }
    },
    onStatusChange: (status: ConnectionStatus) => {
      console.log("Connection status:", status);
    },
    onError: (error: Error) => {
      console.error("Connection error:", error);
    },
  });

  if (!wt) {
    console.warn("WebTransport not supported in this browser");
    return;
  }

  // Connect to the server
  const connected = await wt.connect();
  
  if (connected) {
    // Subscribe to a channel
    await wt.subscribe("management", "users");
    
    // Send a chat message
    await wt.sendChatMessage(
      "management",
      "users",
      "Hello from WebTransport!",
      { senderId: "user123" }
    );
  }
}

// ============================================================================
// Example 2: Direct Class Instance (for multiple connections)
// ============================================================================

async function directInstanceExample() {
  const token = localStorage.getItem("authToken") || "";
  
  // Create a new instance directly
  const wt = new WebTransportService(token, {
    onMessage: (data) => {
      console.log("Message received:", data);
    },
  });

  // Check if WebTransport is supported
  if (WebTransportService.isSupported()) {
    await wt.connect();
    
    // Send custom messages
    await wt.send({
      type: "custom_event",
      payload: { foo: "bar" },
    });
    
    // Disconnect when done
    await wt.disconnect();
  }
}

// ============================================================================
// Example 3: Integration with Svelte Component
// ============================================================================

/*
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    getWebTransportService,
    resetWebTransportService,
    type WebTransportMessage,
    type ConnectionStatus,
  } from "@/lib/services/webtransport";

  let connectionStatus: ConnectionStatus = "disconnected";
  let messages: string[] = [];
  let wt = $state<WebTransportService | null>(null);

  onMount(() => {
    const token = localStorage.getItem("authToken") || "";
    
    wt = getWebTransportService(token, {
      onMessage: (data: WebTransportMessage) => {
        if (data.type === "chat_message") {
          messages = [...messages, data.message];
        }
      },
      onStatusChange: (status) => {
        connectionStatus = status;
      },
    });

    if (wt) {
      wt.connect();
      wt.subscribe("management", "users");
    }
  });

  onDestroy(() => {
    resetWebTransportService();
  });

  async function sendMessage(content: string) {
    if (wt) {
      await wt.sendChatMessage("management", "users", content);
    }
  }
</script>

<div>
  <p>Status: {connectionStatus}</p>
  <ul>
    {#each messages as msg}
      <li>{msg}</li>
    {/each}
  </ul>
</div>
*/

// ============================================================================
// Example 4: Backend-Aligned Usage (matching your backend example)
// ============================================================================

async function backendAlignedExample() {
  const token = localStorage.getItem("authToken") || "";
  
  const wt = getWebTransportService(token, {
    onMessage: (data) => {
      // Handle incoming messages exactly as in your backend example
      console.log("New Message:", data);
      
      if (data.type === "chat_message") {
        displayChatMessage(data.from, data.message);
      }
    },
  });

  if (!wt) {
    console.warn("WebTransport not supported in this browser");
    return;
  }

  // Connect
  await wt.connect();
  
  // Subscribe (equivalent to your backend example step 1)
  await wt.subscribe("management", "users");
  
  // Send test message (equivalent to your backend example step 3)
  await wt.send({
    type: "chat_message",
    space_name: "management",
    subpath: "users",
    message: "Hello from the browser via WebTransport!",
  });
}

function displayChatMessage(from: string, message: string) {
  console.log(`[${from}]: ${message}`);
}

// ============================================================================
// Export examples for reference
// ============================================================================

export const webTransportExamples = {
  basicUsageExample,
  directInstanceExample,
  backendAlignedExample,
};

export default webTransportExamples;
