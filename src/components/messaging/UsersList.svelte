<script lang="ts">
  import { _ } from "@/i18n";
  import type { UserData } from "@/lib/utils/messagingUtils";

  interface Props {
    users: UserData[];
    selectedUserId?: string;
    isLoading: boolean;
    showAllUsers: boolean;
    onUserSelect: (user: UserData) => void;
    onToggleView: () => void;
    onRefresh: () => void;
  }

  let {
    users,
    selectedUserId,
    isLoading,
    showAllUsers,
    onUserSelect,
    onToggleView,
    onRefresh,
  }: Props = $props();
</script>

<div class="users-section">
  <div class="users-header">
    <h3>
      {showAllUsers ? $_("messaging.all_users") : $_("messaging.conversations")}
      ({users.length})
    </h3>
    <div class="users-header-actions">
      <button
        class="toggle-view-btn"
        onclick={onToggleView}
        aria-label={showAllUsers
          ? "Show conversation partners only"
          : "Show all users"}
        title={showAllUsers
          ? "Show conversation partners only"
          : "Show all users"}
      >
        {showAllUsers ? "👥" : "🌐"}
      </button>
      <button
        class="refresh-btn"
        onclick={onRefresh}
        disabled={isLoading}
        aria-label="Refresh users"
      >
        {isLoading ? "⟳" : "↻"}
      </button>
    </div>
  </div>

  <div class="users-list">
    {#if isLoading}
      <div class="loading">Loading users...</div>
    {:else if users.length === 0}
      <div class="no-users">
        {#if showAllUsers}
          <div class="no-users-message">
            <p>{$_("messaging.no_users_found")}</p>
          </div>
        {:else}
          <div class="no-conversations-message">
            <p>{$_("messaging.no_conversations_yet")}</p>
            <button class="start-conversation-btn" onclick={onToggleView}>
              {$_("messaging.browse_all_users")}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      {#each users as user (user.id)}
        <div
          class="user-item"
          class:selected={selectedUserId === user.id}
          onclick={() => onUserSelect(user)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && onUserSelect(user)}
          aria-label={`Chat with ${user.name}`}
        >
          <div class="user-avatar mx-3">
            {#if user.avatar}
              <img src={user.avatar} alt={user.name} />
            {:else}
              <div class="avatar-placeholder">
                {user.name.charAt(0).toUpperCase()}
              </div>
            {/if}
            <div class="online-indicator" class:online={user.online}></div>
          </div>

          <div class="user-info">
            <div class="user-name">{user.name}</div>
            <div class="user-details">
              @{user.shortname}
            </div>
            <div class="user-status">
              {#if user.online}
                <span class="online-text">Online</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .users-section {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .users-header {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
  }

  .users-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #374151;
  }

  .users-header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .toggle-view-btn,
  .refresh-btn {
    background: transparent;
    border: 1px solid #e2e8f0;
    padding: 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }

  .toggle-view-btn:hover,
  .refresh-btn:hover {
    background: #f8fafc;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .users-list {
    flex: 1;
    overflow-y: auto;
    background: #f8fafc;
  }

  .user-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    cursor: pointer;
    transition: background-color 0.2s;
    background: white;
    margin-bottom: 1px;
  }

  .user-item:hover {
    background: #f8fafc;
  }

  .user-item.selected {
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
  }

  .user-avatar {
    position: relative;
    margin-right: 1rem;
  }

  .user-avatar img,
  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-placeholder {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .online-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #9ca3af;
    border: 2px solid white;
  }

  .online-indicator.online {
    background: #22c55e;
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
  }

  .user-details {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
  }

  .user-status {
    font-size: 0.75rem;
  }

  .online-text {
    color: #22c55e;
    font-weight: 500;
  }

  .loading,
  .no-users {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .no-users-message,
  .no-conversations-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .start-conversation-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .start-conversation-btn:hover {
    background: #2563eb;
  }
</style>
