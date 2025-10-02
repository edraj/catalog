<script lang="ts">
  interface Props {
    chatMode: string;
    usersCount: number;
    groupsCount: number;
    onModeChange: (mode: string) => void;
  }

  let { chatMode, usersCount, groupsCount, onModeChange }: Props = $props();
</script>

<div class="chat-mode-tabs">
  <button
    class="tab-btn"
    class:active={chatMode === "direct"}
    onclick={() => onModeChange("direct")}
  >
    💬 Direct Messages ({usersCount})
  </button>
  <button
    class="tab-btn"
    class:active={chatMode === "group"}
    onclick={() => onModeChange("group")}
  >
    👥 Groups ({groupsCount})
  </button>
</div>

<style>
  .chat-mode-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: white;
  }

  .tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: #374151;
    background: #f8fafc;
  }

  .tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: #f8fafc;
  }
</style>
