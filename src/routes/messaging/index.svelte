<script>
  import { website } from "@/config";
  import { onMount, onDestroy } from "svelte";
  import { user } from "@/stores/user";
  import {
    createMessages,
    getAllUsers,
    getMessagesBetweenUsers,
    getMessageByShortname,
    getConversationPartners,
    getUsersByShortnames,
  } from "@/lib/dmart_services";

  let socket = null;
  let isConnected = $state(false);
  let connectionStatus = $state("Disconnecting...");

  let users = $state([]);
  let selectedUser = $state(null);
  let messages = $state([]);
  let currentMessage = $state("");
  let currentUser = null;
  const authToken = localStorage.getItem("authToken") || "";

  let conversationMessages = new Map();

  let isUsersLoading = $state(true);
  let isMessagesLoading = $state(false);
  let chatContainer = $state(null);
  let showAllUsers = $state(false);

  const WS_URL = website.websocket;
  const TOKEN = authToken;

  onMount(async () => {
    await initializeChat();
  });

  $effect(() => {
    if ($user && !currentUser) {
      currentUser = $user;
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.close();
    }
  });

  async function initializeChat() {
    try {
      currentUser = $user;

      if (!currentUser?.shortname) {
        console.error("No current user found - user might not be logged in");
        connectionStatus = "User not logged in";
        return;
      }

      await loadUsers();
      connectWebSocket();
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      connectionStatus = "Failed to initialize";
    }
  }

  async function loadUsers() {
    try {
      isUsersLoading = true;

      if (!currentUser?.shortname) {
        console.error("No current user shortname available");
        users = [];
        return;
      }

      if (showAllUsers) {
        const response = await getAllUsers();
        if (response.status === "success" && response.records) {
          users = response.records
            .map((record) => {
              const attrs = record.attributes;
              return {
                id: record.shortname,
                shortname: record.shortname,
                name:
                  getDisplayName(attrs.displayname) ||
                  attrs.email ||
                  record.shortname,
                email: attrs.email,
                avatar: attrs.social_avatar_url || null,
                online: false,
                lastSeen: new Date(attrs.updated_at || attrs.created_at),
                roles: attrs.roles || [],
                isActive: attrs.is_active,
              };
            })
            .filter(
              (user) => user.isActive && user.id !== currentUser?.shortname
            );
        }
      } else {
        const conversationPartners = await getConversationPartners(
          currentUser.shortname
        );

        if (conversationPartners.length === 0) {
          console.log("No conversation partners found");
          users = [];
          return;
        }

        const response = await getUsersByShortnames(conversationPartners);

        if (response.status === "success" && response.records) {
          users = response.records
            .map((record) => {
              const attrs = record.attributes;
              return {
                id: record.shortname,
                shortname: record.shortname,
                name:
                  getDisplayName(attrs.displayname) ||
                  attrs.email ||
                  record.shortname,
                email: attrs.email,
                avatar: attrs.social_avatar_url || null,
                online: false,
                lastSeen: new Date(attrs.updated_at || attrs.created_at),
                roles: attrs.roles || [],
                isActive: attrs.is_active,
              };
            })
            .filter((user) => user.isActive);
        } else {
          console.log("Failed to fetch conversation partner details");
          users = [];
        }
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      users = [];
    } finally {
      isUsersLoading = false;
    }
  }

  function getDisplayName(displayname) {
    if (!displayname) return null;
    return displayname.en || displayname.ar || displayname.ku || null;
  }

  function connectWebSocket() {
    try {
      connectionStatus = "Connecting...";
      socket = new WebSocket(`${WS_URL}?token=${TOKEN}`);

      socket.onopen = () => {
        isConnected = true;
        connectionStatus = "Connected";
        socket.send(
          JSON.stringify({
            type: "notification_subscription",
            space_name: "messages",
            subpath: "/messages",
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      socket.onclose = () => {
        isConnected = false;
        connectionStatus = "Disconnected";

        setTimeout(() => {
          if (!isConnected) {
            connectWebSocket();
          }
        }, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        connectionStatus = "Connection Error";
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      connectionStatus = "Failed to Connect";
    }
  }

  function handleWebSocketMessage(data) {
    if (data.type === "connection_response") {
      if (data.message?.status === "success") {
        console.log("WebSocket connection confirmed");
      }
      return;
    }

    if (data.type === "notification_subscription") {
      if (data.message?.action_type === "create" && data.message?.shortname) {
        fetchMessageByShortname(data.message.shortname);
        return;
      }

      if (selectedUser && data.senderId && data.receiverId && data.content) {
        const isRelevantMessage =
          (data.senderId === selectedUser.shortname &&
            data.receiverId === currentUser?.shortname) ||
          (data.senderId === currentUser?.shortname &&
            data.receiverId === selectedUser.shortname);

        if (isRelevantMessage) {
          const newMessage = {
            id: data.messageId || `ws_${Date.now()}`,
            senderId: data.senderId,
            receiverId: data.receiverId,
            content: data.content,
            timestamp: new Date(data.timestamp || Date.now()),
            isOwn: data.senderId === currentUser?.shortname,
          };

          const messageExists = messages.some(
            (msg) =>
              msg.id === newMessage.id ||
              (msg.content === newMessage.content &&
                msg.senderId === newMessage.senderId &&
                Math.abs(
                  new Date(msg.timestamp).getTime() -
                    new Date(newMessage.timestamp).getTime()
                ) < 5000)
          );

          if (!messageExists) {
            addMessageToConversation(newMessage);
          }
        }
      }
    }
  }

  async function fetchMessageByShortname(messageShortname) {
    try {
      const messageData = await getMessageByShortname(messageShortname);

      if (!messageData) {
        return;
      }
      if (selectedUser) {
        const isRelevantMessage =
          (messageData.senderId === selectedUser.shortname &&
            messageData.receiverId === currentUser?.shortname) ||
          (messageData.senderId === currentUser?.shortname &&
            messageData.receiverId === selectedUser.shortname);

        if (isRelevantMessage) {
          const newMessage = {
            id: messageData.id,
            senderId: messageData.senderId,
            receiverId: messageData.receiverId,
            content: messageData.content,
            timestamp: messageData.timestamp,
            isOwn: messageData.senderId === currentUser?.shortname,
          };

          const messageExists = messages.some(
            (msg) =>
              msg.id === newMessage.id ||
              (msg.content === newMessage.content &&
                msg.senderId === newMessage.senderId &&
                Math.abs(
                  new Date(msg.timestamp).getTime() -
                    new Date(newMessage.timestamp).getTime()
                ) < 5000)
          );

          if (!messageExists) {
            addMessageToConversation(newMessage);
          }
        }
      } else {
        console.log("No user selected, cannot determine message relevance");
      }
    } catch (error) {
      console.error("Failed to fetch message by shortname:", error);
    }
  }

  function addMessageToConversation(newMessage) {
    messages = [...messages, newMessage];

    if (selectedUser) {
      const conversationKey = selectedUser.shortname;
      const existingMessages = conversationMessages.get(conversationKey) || [];
      conversationMessages.set(conversationKey, [
        ...existingMessages,
        newMessage,
      ]);

      try {
        const cacheKey = `chat_${currentUser?.shortname}_${selectedUser.shortname}`;
        localStorage.setItem(cacheKey, JSON.stringify(messages));
      } catch (error) {
        console.warn("Failed to update localStorage cache:", error);
      }
    }

    scrollToBottom();
  }

  async function selectUser(user) {
    if (selectedUser?.id === user.id) return;

    selectedUser = user;
    isMessagesLoading = true;

    try {
      const response = await getMessagesBetweenUsers(
        currentUser?.shortname,
        user.shortname
      );

      if (response && response.status === "success" && response.records) {
        messages = response.records
          .map((record) => {
            const payload = record.attributes.payload;
            const body = payload.body;

            return {
              id: record.shortname,
              senderId: body.sender,
              receiverId: body.receiver,
              content: body.content,
              timestamp: new Date(record.attributes.created_at || Date.now()),
              isOwn: body.sender === currentUser?.shortname,
            };
          })
          .sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
      } else {
        console.log("No messages found or error in response");
        messages = [];
      }

      conversationMessages.set(user.shortname, [...messages]);

      try {
        localStorage.setItem(
          `chat_${currentUser?.shortname}_${user.shortname}`,
          JSON.stringify(messages)
        );
      } catch (error) {
        console.warn("Failed to cache messages in localStorage:", error);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      messages = conversationMessages.get(user.shortname) || [];

      if (messages.length === 0) {
        try {
          const cachedMessages = localStorage.getItem(
            `chat_${currentUser?.shortname}_${user.shortname}`
          );
          if (cachedMessages) {
            messages = JSON.parse(cachedMessages);
          }
        } catch (error) {
          console.warn("Failed to load from localStorage cache:", error);
          messages = [];
        }
      }
    } finally {
      isMessagesLoading = false;
      scrollToBottom();
    }
  }

  async function sendMessage() {
    if (!currentMessage.trim() || !selectedUser || !isConnected) {
      return;
    }

    const messageContent = currentMessage.trim();
    const tempId = `temp_${Date.now()}`;

    const newMessage = {
      id: tempId,
      senderId: currentUser?.shortname,
      receiverId: selectedUser.shortname,
      content: messageContent,
      timestamp: new Date(),
      isOwn: true,
    };

    messages = [...messages, newMessage];
    currentMessage = "";
    scrollToBottom();

    try {
      const messageData = {
        content: messageContent,
        sender: currentUser?.shortname,
        receiver: selectedUser.shortname,
        message_type: "text",
        timestamp: new Date().toISOString(),
      };

      const persistedMessageId = await createMessages(messageData);

      if (persistedMessageId) {
        messages = messages.map((msg) =>
          msg.id === tempId ? { ...msg, id: persistedMessageId } : msg
        );

        const wsMessage = {
          type: "message",
          senderId: currentUser?.shortname,
          receiverId: selectedUser.shortname,
          content: messageContent,
          timestamp: new Date().toISOString(),
          messageId: persistedMessageId,
        };

        socket.send(JSON.stringify(wsMessage));

        setTimeout(() => {
          selectUser(selectedUser);
        }, 1000);
      } else {
        console.error("Failed to persist message - no ID returned");
        messages = messages.filter((msg) => msg.id !== tempId);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      messages = messages.filter((msg) => msg.id !== tempId);
    }

    const conversationKey = selectedUser.shortname;
    const existingMessages = conversationMessages.get(conversationKey) || [];
    const updatedMessages = messages.filter((msg) => msg.id !== tempId);

    if (updatedMessages.length > 0) {
      conversationMessages.set(conversationKey, updatedMessages);

      try {
        const cacheKey = `chat_${currentUser?.shortname}_${selectedUser.shortname}`;
        localStorage.setItem(cacheKey, JSON.stringify(updatedMessages));
      } catch (error) {
        console.warn("Failed to update localStorage cache:", error);
      }
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatLastSeen(date) {
    const now = new Date();
    const lastSeen = new Date(date);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function toggleUserView() {
    showAllUsers = !showAllUsers;
    loadUsers();
  }
</script>

<div class="chat-container">
  <!-- Header -->
  <div class="chat-header">
    <h1>Chat</h1>
    <div
      class="connection-status"
      class:connected={isConnected}
      class:disconnected={!isConnected}
    >
      <div class="status-indicator"></div>
      <span>{connectionStatus}</span>
    </div>
  </div>

  <div class="chat-content">
    <!-- Users Sidebar -->
    <div class="users-sidebar">
      <div class="users-header">
        <h3>
          {showAllUsers ? "All Users" : "Conversations"} ({users.length})
        </h3>
        <div class="users-header-actions">
          <button
            class="toggle-view-btn"
            onclick={toggleUserView}
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
            onclick={loadUsers}
            disabled={isUsersLoading}
            aria-label="Refresh users"
          >
            {isUsersLoading ? "⟳" : "↻"}
          </button>
        </div>
      </div>

      <div class="users-list">
        {#if isUsersLoading}
          <div class="loading">Loading users...</div>
        {:else if users.length === 0}
          <div class="no-users">
            {#if showAllUsers}
              <div class="no-users-message">
                <p>No users found</p>
              </div>
            {:else}
              <div class="no-conversations-message">
                <p>No conversations yet</p>
                <button class="start-conversation-btn" onclick={toggleUserView}>
                  Browse all users to start chatting
                </button>
              </div>
            {/if}
          </div>
        {:else}
          {#each users as user (user.id)}
            <div
              class="user-item"
              class:selected={selectedUser?.id === user.id}
              onclick={() => selectUser(user)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === "Enter" && selectUser(user)}
              aria-label={`Chat with ${user.name}`}
            >
              <div class="user-avatar">
                {#if user.avatar}
                  <img
                    src={user.avatar || "/placeholder.svg"}
                    alt={user.name}
                  />
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
                  {#if user.email}
                    <div class="user-email">{user.email}</div>
                  {/if}
                  {#if user.roles.length > 0}
                    <div class="user-roles">{user.roles.join(", ")}</div>
                  {/if}
                </div>
                <div class="user-status">
                  {#if user.online}
                    <span class="online-text">Online</span>
                  {:else}
                    <span class="offline-text"
                      >Last seen {formatLastSeen(user.lastSeen)}</span
                    >
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Chat Area -->
    <div class="chat-area">
      {#if selectedUser}
        <!-- Chat Header -->
        <div class="chat-user-header">
          <div class="chat-user-info">
            <div class="user-avatar small">
              {#if selectedUser.avatar}
                <img
                  src={selectedUser.avatar || "/placeholder.svg"}
                  alt={selectedUser.name}
                />
              {:else}
                <div class="avatar-placeholder">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              {/if}
              <div
                class="online-indicator small"
                class:online={selectedUser.online}
              ></div>
            </div>
            <div>
              <div class="chat-user-name">{selectedUser.name}</div>
              <div class="chat-user-status">
                {#if selectedUser.online}
                  <span class="online-text">Online</span>
                {:else}
                  <span class="offline-text"
                    >Last seen {formatLastSeen(selectedUser.lastSeen)}</span
                  >
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Messages Container -->
        <div class="messages-container" bind:this={chatContainer}>
          {#if isMessagesLoading}
            <div class="loading">Loading messages...</div>
          {:else if messages.length === 0}
            <div class="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          {:else}
            {#each messages as message (message.id)}
              <div class="message" class:own={message.isOwn}>
                <div class="message-content">
                  <div class="message-text">{message.content}</div>
                  <div class="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Message Input -->
        <div class="message-input-container">
          <div class="message-input">
            <textarea
              bind:value={currentMessage}
              placeholder="Type a message..."
              disabled={!isConnected}
              rows="1"
              onkeydown={handleKeydown}
            ></textarea>
            <button
              class="send-btn"
              onclick={sendMessage}
              disabled={!currentMessage.trim() || !isConnected}
              aria-label="Send message"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m22 2-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      {:else}
        <div class="no-chat-selected">
          <div class="no-chat-message">
            <h3>Select a user to start chatting</h3>
            <p>Choose someone from the users list to begin a conversation</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .chat-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
  }

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
    background: #fee2e2;
    color: #991b1b;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .connected .status-indicator {
    background: #16a34a;
    animation: pulse 2s infinite;
  }

  .disconnected .status-indicator {
    background: #dc2626;
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

  .chat-content {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .users-sidebar {
    width: 320px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
  }

  .users-header {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .users-header h3 {
    margin: 0;
    color: #1e293b;
  }

  .users-header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .toggle-view-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    border-radius: 4px;
    color: #64748b;
    transition: all 0.2s;
  }

  .toggle-view-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .refresh-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    border-radius: 4px;
    color: #64748b;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .refresh-btn:disabled {
    cursor: not-allowed;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .users-list {
    flex: 1;
    overflow-y: auto;
  }

  .user-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    transition: background 0.2s;
  }

  .user-item:hover {
    background: #f8fafc;
  }

  .user-item.selected {
    background: #e0f2fe;
    border-right: 3px solid #0ea5e9;
  }

  .user-avatar {
    position: relative;
    margin-right: 0.75rem;
  }

  .user-avatar img,
  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .user-avatar.small img,
  .user-avatar.small .avatar-placeholder {
    width: 32px;
    height: 32px;
  }

  .avatar-placeholder {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1rem;
  }

  .user-avatar.small .avatar-placeholder {
    font-size: 0.875rem;
  }

  .online-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    background: #94a3b8;
  }

  .online-indicator.small {
    width: 10px;
    height: 10px;
  }

  .online-indicator.online {
    background: #22c55e;
  }

  .user-info {
    flex: 1;
  }

  .user-name {
    font-weight: 500;
    color: #1e293b;
    margin-bottom: 0.25rem;
  }

  .user-details {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.25rem;
  }

  .user-email {
    margin-bottom: 0.125rem;
  }

  .user-roles {
    font-style: italic;
  }

  .user-status {
    font-size: 0.875rem;
  }

  .online-text {
    color: #22c55e;
  }

  .offline-text {
    color: #64748b;
  }

  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
  }

  .chat-user-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .refresh-messages-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.5rem;
    border-radius: 4px;
    color: #64748b;
    transition: all 0.2s;
  }

  .refresh-messages-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .chat-user-info {
    display: flex;
    align-items: center;
  }

  .chat-user-info > div:last-child {
    margin-left: 0.75rem;
  }

  .chat-user-name {
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.125rem;
  }

  .chat-user-status {
    font-size: 0.875rem;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: #f8fafc;
  }

  .message {
    display: flex;
    margin-bottom: 1rem;
  }

  .message.own {
    justify-content: flex-end;
  }

  .message-content {
    max-width: 70%;
    background: white;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .message.own .message-content {
    background: #0ea5e9;
    color: white;
  }

  .message-text {
    word-wrap: break-word;
    line-height: 1.4;
  }

  .message-time {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-top: 0.25rem;
  }

  .message-input-container {
    padding: 1rem 1.5rem;
    background: white;
    border-top: 1px solid #e2e8f0;
  }

  .message-input {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 1.5rem;
    padding: 0.75rem 1rem;
  }

  .message-input textarea {
    flex: 1;
    border: none;
    background: none;
    resize: none;
    outline: none;
    font-family: inherit;
    max-height: 120px;
    min-height: 20px;
  }

  .send-btn {
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: #0284c7;
  }

  .send-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .no-chat-selected {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
  }

  .no-chat-message {
    text-align: center;
    color: #64748b;
  }

  .no-chat-message h3 {
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: #64748b;
  }

  .no-users {
    padding: 2rem;
    text-align: center;
    color: #64748b;
  }

  .no-conversations-message {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }

  .start-conversation-btn {
    background: #0ea5e9;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .start-conversation-btn:hover {
    background: #0284c7;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .users-sidebar {
      width: 280px;
    }

    .message-content {
      max-width: 85%;
    }
  }
</style>
