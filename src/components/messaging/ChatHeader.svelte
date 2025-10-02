<script lang="ts">
  import { _ } from "@/i18n";

  interface Props {
    isConnected: boolean;
    connectionStatus: string;
  }

  let { isConnected, connectionStatus }: Props = $props();
</script>

<div class="chat-header">
  <h1>{$_("messaging.title")}</h1>
  <div
    class="connection-status"
    class:connected={isConnected}
    class:disconnected={!isConnected}
  >
    <div class="status-indicator"></div>
    <span>{connectionStatus}</span>
  </div>
</div>

<style>
  .chat-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .chat-header h1 {
    margin: 0;
    color: #1e293b;
    font-size: 1.5rem;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .connection-status.connected {
    background: #dcfce7;
    color: #166534;
  }

  .connection-status.disconnected {
    background: #fecaca;
    color: #dc2626;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  .connected .status-indicator {
    background: #22c55e;
  }

  .disconnected .status-indicator {
    background: #ef4444;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
