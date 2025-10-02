<script lang="ts">
  import type { GroupData } from "@/lib/utils/messagingUtils";

  interface Props {
    groups: GroupData[];
    selectedGroupId?: string;
    isLoading: boolean;
    onGroupSelect: (group: GroupData) => void;
    onCreateGroup: () => void;
    onRefresh: () => void;
  }

  let {
    groups,
    selectedGroupId,
    isLoading,
    onGroupSelect,
    onCreateGroup,
    onRefresh,
  }: Props = $props();
</script>

<div class="groups-section">
  <div class="groups-header">
    <h3>Groups ({groups.length})</h3>
    <div class="groups-header-actions">
      <button
        class="create-group-btn"
        onclick={onCreateGroup}
        aria-label="Create new group"
      >
        ➕ Create Group
      </button>
      <button
        class="refresh-btn"
        onclick={onRefresh}
        disabled={isLoading}
        aria-label="Refresh groups"
      >
        {isLoading ? "⟳" : "↻"}
      </button>
    </div>
  </div>

  <div class="groups-list">
    {#if isLoading}
      <div class="loading">Loading groups...</div>
    {:else if groups.length === 0}
      <div class="no-groups">
        <div class="no-groups-message">
          <p>No groups yet</p>
          <button class="create-group-btn" onclick={onCreateGroup}>
            Create your first group
          </button>
        </div>
      </div>
    {:else}
      {#each groups as group (group.id)}
        <div
          class="group-item"
          class:selected={selectedGroupId === group.id}
          onclick={() => onGroupSelect(group)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && onGroupSelect(group)}
          aria-label={`Chat in ${group.name}`}
        >
          <div class="group-avatar">
            {#if group.avatar}
              <img src={group.avatar} alt={group.name} />
            {:else}
              <div class="avatar-placeholder group">
                {group.name.charAt(0).toUpperCase()}
              </div>
            {/if}
          </div>

          <div class="group-info">
            <div class="group-name">{group.name}</div>
            <div class="group-description">
              {group.description.en || "No description"}
            </div>
            <div class="group-participants">
              {group.participants.length} participants
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .groups-section {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .groups-header {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
  }

  .groups-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #374151;
  }

  .groups-header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .create-group-btn {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .create-group-btn:hover {
    background: #059669;
  }

  .refresh-btn {
    background: transparent;
    border: 1px solid #e2e8f0;
    padding: 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }

  .refresh-btn:hover {
    background: #f8fafc;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .groups-list {
    flex: 1;
    overflow-y: auto;
    background: #f8fafc;
  }

  .group-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    cursor: pointer;
    transition: background-color 0.2s;
    background: white;
    margin-bottom: 1px;
  }

  .group-item:hover {
    background: #f8fafc;
  }

  .group-item.selected {
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
  }

  .group-avatar {
    margin-right: 1rem;
  }

  .group-avatar img,
  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-placeholder.group {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .group-info {
    flex: 1;
    min-width: 0;
  }

  .group-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
  }

  .group-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-participants {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .loading,
  .no-groups {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .no-groups-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
</style>
