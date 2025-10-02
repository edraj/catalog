<script lang="ts">
  import { website } from "@/config";
  import { onMount, onDestroy } from "svelte";
  import { user } from "@/stores/user";
  import { ResourceType } from "@edraj/tsdmart";
  import {
    createMessages,
    getAllUsers,
    getMessagesBetweenUsers,
    getMessageByShortname,
    getConversationPartners,
    getUsersByShortnames,
    attachAttachmentsToEntity,
    createGroup,
    getUserGroups,
    getGroupDetails,
    createGroupMessage,
    getGroupMessages,
    addUserToGroup,
    removeUserFromGroup,
    makeUserGroupAdmin,
    updateGroup,
  } from "@/lib/dmart_services";
  import { _ } from "@/i18n";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import MessengerAttachments from "@/components/MessengerAttachments.svelte";
  import {
    getDisplayName,
    formatTime,
    getPreviewUrl,
    getFileIcon,
    formatFileSize,
    formatRecordingDuration,
    scrollToBottom,
    transformUserRecord,
    transformMessageRecord,
    getCacheKey,
    cacheMessages,
    getCachedMessages,
    isRelevantMessage,
    sortMessagesByTimestamp,
    transformGroupRecord,
    transformGroupMessageRecord,
    isRelevantGroupMessage,
    getGroupCacheKey,
    isUserGroupAdmin,
    canUserAccessGroup,
    getGroupDisplayName,
    type MessageData,
    type UserData,
    type GroupData,
    type GroupMessageData,
  } from "@/lib/utils/messagingUtils";

  let socket = null;
  let isConnected = $state(false);
  let connectionStatus = $state("Disconnecting...");

  let users = $state([]);
  let selectedUser = $state(null);
  let messages = $state([]);
  let currentMessage = $state("");
  let currentUser = $state(null);
  const authToken = localStorage.getItem("authToken") || "";

  let groups = $state([]);
  let selectedGroup = $state(null);
  let groupMessages = $state([]);
  let isGroupsLoading = $state(true);
  let showGroupForm = $state(false);
  let newGroupName = $state("");
  let newGroupDescription = $state("");
  let selectedGroupParticipants = $state([]);
  let chatMode = $state("direct");

  let showGroupEditForm = $state(false);
  let editGroupName = $state("");
  let editGroupDescription = $state("");
  let editGroupParticipants = $state([]);
  let availableUsersForGroup = $state([]);

  let conversationMessages = new Map();
  let groupConversationMessages = new Map();
  let attachment;
  let isUsersLoading = $state(true);
  let isMessagesLoading = $state(false);
  let isLoadingOlderMessages = $state(false);
  let hasMoreMessages = $state(true);
  let messagesOffset = $state(0);
  const MESSAGES_LIMIT = 10;
  let chatContainer = $state(null);
  let showAllUsers = $state(false);

  let selectedAttachments = $state([]);
  let isAttachmentLoading = $state(false);

  let isRecording = $state(false);
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingDuration = $state(0);
  let recordingInterval = null;
  let stream = null;

  const WS_URL = website.websocket;
  const TOKEN = authToken;

  let isRTL = $state(false);

  onMount(async () => {
    isRTL =
      document.documentElement.dir === "rtl" ||
      document.documentElement.getAttribute("dir") === "rtl";
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
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (recordingInterval) {
      clearInterval(recordingInterval);
    }
  });

  function handleScroll(event) {
    const container = event.target;
    if (
      container.scrollTop === 0 &&
      hasMoreMessages &&
      !isLoadingOlderMessages
    ) {
      loadOlderMessages();
    }
  }

  async function loadOlderMessages() {
    if (!selectedUser || isLoadingOlderMessages || !hasMoreMessages) return;

    isLoadingOlderMessages = true;
    const previousScrollHeight = chatContainer.scrollHeight;

    try {
      const response = await getMessagesBetweenUsers(
        currentUser?.shortname,
        selectedUser.shortname,
        MESSAGES_LIMIT,
        messagesOffset + MESSAGES_LIMIT
      );

      if (response && response.status === "success" && response.records) {
        const olderMessages = sortMessagesByTimestamp(
          response.records.map((record) =>
            transformMessageRecord(record, currentUser?.shortname)
          )
        );

        if (olderMessages.length < MESSAGES_LIMIT) {
          hasMoreMessages = false;
        }

        if (olderMessages.length > 0) {
          const existingIds = new Set(messages.map((msg) => msg.id));
          const newMessages = olderMessages.filter(
            (msg) => !existingIds.has(msg.id)
          );

          messages = [...newMessages, ...messages];
          messagesOffset += MESSAGES_LIMIT;

          setTimeout(() => {
            const newScrollHeight = chatContainer.scrollHeight;
            chatContainer.scrollTop = newScrollHeight - previousScrollHeight;
          }, 0);
        }
      }
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_failed_load_older_messages") ||
          "Failed to load older messages"
      );
    } finally {
      isLoadingOlderMessages = false;
    }
  }

  async function initializeChat() {
    try {
      currentUser = $user;

      if (!currentUser?.shortname) {
        errorToastMessage($_("messaging.toast_user_not_logged_in"));
        connectionStatus = $_("messaging.toast_user_not_logged_in");
        return;
      }
      await Promise.all([loadUsers(), loadGroups()]);

      connectWebSocket();
    } catch (error) {
      errorToastMessage($_("messaging.toast_failed_initialize") + ": " + error);
      connectionStatus = $_("messaging.toast_failed_initialize");
    }
  }

  async function loadUsers() {
    try {
      isUsersLoading = true;

      if (!currentUser?.shortname) {
        errorToastMessage($_("messaging.toast_no_user_shortname"));
        users = [];
        return;
      }

      if (showAllUsers) {
        const response = await getAllUsers();
        if (response.status === "success" && response.records) {
          users = response.records
            .map(transformUserRecord)
            .filter(
              (user) => user.isActive && user.id !== currentUser?.shortname
            );
        }
      } else {
        const conversationPartners = await getConversationPartners(
          currentUser.shortname
        );

        if (conversationPartners.length === 0) {
          users = [];
          return;
        }

        const response = await getUsersByShortnames(conversationPartners);

        if (response.status === "success" && response.records) {
          users = response.records
            .map(transformUserRecord)
            .filter((user) => user.isActive);
        } else {
          users = [];
        }
      }
    } catch (error) {
      errorToastMessage($_("messaging.toast_failed_load_users") + ": " + error);
      users = [];
    } finally {
      isUsersLoading = false;
    }
  }

  async function loadGroups() {
    try {
      isGroupsLoading = true;

      if (!currentUser?.shortname) {
        errorToastMessage($_("messaging.toast_no_user_shortname"));
        groups = [];
        return;
      }

      const response = await getUserGroups(currentUser.shortname);
      if (response.status === "success" && response.records) {
        groups = response.records
          .map(transformGroupRecord)
          .filter(
            (group) =>
              group.isActive && canUserAccessGroup(group, currentUser.shortname)
          );
      } else {
        groups = [];
      }
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_failed_load_groups") + ": " + error
      );
      groups = [];
    } finally {
      isGroupsLoading = false;
    }
  }

  function selectGroup(group) {
    selectedGroup = group;
    selectedUser = null;
    chatMode = "group";

    loadGroupMessages(group.id);
  }

  function selectUser(user) {
    selectedUser = user;
    selectedGroup = null;
    chatMode = "direct";
    loadConversation(user.shortname);
  }

  async function loadGroupMessages(groupId) {
    try {
      isMessagesLoading = true;
      messagesOffset = 0;
      hasMoreMessages = true;

      const cacheKey = getGroupCacheKey(currentUser?.shortname, groupId);
      const cachedMessages = getCachedMessages(cacheKey);

      if (cachedMessages.length > 0) {
        groupMessages = cachedMessages;
        setTimeout(() => scrollToBottom(chatContainer), 100);
      }

      const response = await getGroupMessages(groupId, MESSAGES_LIMIT, 0);

      if (response && response.status === "success" && response.records) {
        const newMessages = sortMessagesByTimestamp(
          response.records.map((record: any) =>
            transformGroupMessageRecord(record, currentUser?.shortname)
          ) as MessageData[]
        );

        groupMessages = newMessages;
        groupConversationMessages.set(groupId, [...newMessages]);
        cacheMessages(cacheKey, newMessages);

        setTimeout(() => scrollToBottom(chatContainer), 100);
      }
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_failed_load_group_messages") + ": " + error
      );
    } finally {
      isMessagesLoading = false;
    }
  }

  async function sendGroupMessage() {
    if (!currentMessage.trim() && selectedAttachments.length === 0) {
      return;
    }
    if (!selectedGroup || !currentUser?.shortname) {
      return;
    }

    const messageContent = currentMessage.trim() || "";
    const hasAttachments = selectedAttachments.length > 0;
    const tempId = `temp_group_${Date.now()}`;

    if (hasAttachments) {
      isAttachmentLoading = true;
    }

    const tempMessage = {
      id: tempId,
      senderId: currentUser.shortname,
      groupId: selectedGroup.id,
      content: messageContent || (hasAttachments ? "📎 attachment" : ""),
      timestamp: new Date(),
      isOwn: true,
      hasAttachments: hasAttachments,
      attachments: hasAttachments ? selectedAttachments : null,
      isUploading: hasAttachments,
    };

    groupMessages = [...groupMessages, tempMessage];
    scrollToBottom(chatContainer);

    currentMessage = "";
    const attachmentsToProcess = [...selectedAttachments];
    selectedAttachments = [];

    try {
      const groupMessageData = {
        groupId: selectedGroup.id,
        sender: currentUser.shortname,
        content: messageContent || (hasAttachments ? "attachment" : ""),
      };

      const persistedMessageId = await createGroupMessage(groupMessageData);

      if (persistedMessageId) {
        groupMessages = groupMessages.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: persistedMessageId, isUploading: false }
            : msg
        );

        if (hasAttachments && attachmentsToProcess.length > 0) {
          try {
            for (const attachment of attachmentsToProcess) {
              const attachmentResult = await attachAttachmentsToEntity(
                persistedMessageId,
                "messages",
                "messages",
                attachment
              );

              if (!attachmentResult) {
                errorToastMessage(
                  $_("messaging.toast_attachment_failed", {
                    values: { name: attachment.name },
                  }) || `Failed to attach ${attachment.name}`
                );
              }
            }

            setTimeout(async () => {
              try {
                const response = await getGroupMessages(
                  selectedGroup.id,
                  MESSAGES_LIMIT,
                  0
                );

                if (
                  response &&
                  response.status === "success" &&
                  response.records
                ) {
                  const updatedMessages = sortMessagesByTimestamp(
                    response.records.map((record: any) =>
                      transformGroupMessageRecord(
                        record,
                        currentUser?.shortname
                      )
                    ) as MessageData[]
                  );

                  groupMessages = updatedMessages;
                  groupConversationMessages.set(selectedGroup.id, [
                    ...updatedMessages,
                  ]);

                  const cacheKey = getGroupCacheKey(
                    currentUser?.shortname,
                    selectedGroup.id
                  );
                  cacheMessages(cacheKey, updatedMessages);

                  scrollToBottom(chatContainer);
                }
              } catch (error) {
                console.error("Error refreshing group messages:", error);
              }
            }, 1500);
          } catch (attachmentError) {
            errorToastMessage(
              $_("messaging.toast_attachment_error") + ": " + attachmentError
            );

            groupMessages = groupMessages.map((msg) =>
              msg.id === persistedMessageId
                ? { ...msg, isUploading: false, uploadFailed: true }
                : msg
            );
          }
        }

        groupConversationMessages.set(selectedGroup.id, [...groupMessages]);
        const cacheKey = getGroupCacheKey(
          currentUser?.shortname,
          selectedGroup.id
        );
        cacheMessages(cacheKey, groupMessages);

        const wsMessage = {
          type: "message",
          messageId: persistedMessageId,
          senderId: currentUser.shortname,
          groupId: selectedGroup.id,
          content: messageContent || (hasAttachments ? "attachment" : ""),
          timestamp: tempMessage.timestamp.toISOString(),
          hasAttachments: hasAttachments,
          participants: selectedGroup.participants,
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(wsMessage));
        } else {
          console.warn(
            "⚠️ [Group Message] WebSocket not available for broadcasting:",
            {
              socketExists: !!socket,
              readyState: socket?.readyState,
              expectedState: WebSocket.OPEN,
            }
          );
        }

        setTimeout(() => scrollToBottom(chatContainer), 100);
      } else {
        console.error("❌ [Group Message] API returned no response");
        groupMessages = groupMessages.filter((msg) => msg.id !== tempId);
      }
    } catch (error) {
      console.error("❌ [Group Message] Error sending message:", error);
      errorToastMessage(
        $_("messaging.toast_failed_send_group_message") + ": " + error
      );
      groupMessages = groupMessages.filter((msg) => msg.id !== tempId);
    } finally {
      isAttachmentLoading = false;
    }
  }

  async function createNewGroup() {
    if (!newGroupName.trim() || selectedGroupParticipants.length === 0) {
      errorToastMessage(
        $_("messaging.toast_group_creation_error") ||
          "Please provide group name and select participants"
      );
      return;
    }

    try {
      const participants = [
        currentUser.shortname,
        ...selectedGroupParticipants.map((p) => p.shortname),
      ];

      const response = await createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        participants: participants,
        createdBy: currentUser.shortname,
      });

      if (response) {
        successToastMessage(
          $_("messaging.toast_group_created") || "Group created successfully"
        );
        showGroupForm = false;
        newGroupName = "";
        newGroupDescription = "";
        selectedGroupParticipants = [];
        await loadGroups();
      }
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_failed_create_group") + ": " + error
      );
    }
  }

  async function openGroupEditForm() {
    if (
      !selectedGroup ||
      !isUserGroupAdmin(selectedGroup, currentUser?.shortname)
    ) {
      errorToastMessage("Only group admins can edit group settings");
      return;
    }

    editGroupName = selectedGroup.name;
    editGroupDescription = selectedGroup.description.en || "";
    editGroupParticipants = selectedGroup.participants || [];

    try {
      const response = await getAllUsers();
      if (response.status === "success" && response.records) {
        availableUsersForGroup = response.records
          .map(transformUserRecord)
          .filter(
            (user) =>
              user.isActive &&
              user.id !== currentUser?.shortname &&
              !editGroupParticipants.includes(user.shortname)
          );
      }
    } catch (error) {
      console.error("Failed to load users for group editing:", error);
    }

    showGroupEditForm = true;
  }

  async function updateGroupDetails() {
    if (!editGroupName.trim()) {
      errorToastMessage("Group name is required");
      return;
    }

    if (!selectedGroup) return;

    try {
      const updateData = {
        name: editGroupName.trim(),
        description: editGroupDescription.trim(),
        participants: editGroupParticipants,
      };

      const success = await updateGroup(selectedGroup.shortname, updateData);

      if (success) {
        successToastMessage("Group updated successfully");
        showGroupEditForm = false;

        selectedGroup = {
          ...selectedGroup,
          name: editGroupName.trim(),
          description: editGroupDescription.trim(),
          participants: editGroupParticipants,
        };

        await loadGroups();
      } else {
        errorToastMessage("Failed to update group");
      }
    } catch (error) {
      errorToastMessage("Failed to update group: " + error);
    }
  }

  function addParticipantToGroup(user) {
    if (!editGroupParticipants.includes(user.shortname)) {
      editGroupParticipants = [...editGroupParticipants, user.shortname];
      availableUsersForGroup = availableUsersForGroup.filter(
        (u) => u.shortname !== user.shortname
      );
    }
  }

  function removeParticipantFromGroup(userShortname) {
    if (userShortname === currentUser?.shortname) {
      errorToastMessage("You cannot remove yourself from the group");
      return;
    }

    editGroupParticipants = editGroupParticipants.filter(
      (p) => p !== userShortname
    );

    const userToAdd = users.find((u) => u.shortname === userShortname);
    if (
      userToAdd &&
      !availableUsersForGroup.some((u) => u.shortname === userShortname)
    ) {
      availableUsersForGroup = [...availableUsersForGroup, userToAdd];
    }
  }

  function connectWebSocket() {
    try {
      connectionStatus = "Connecting...";
      socket = new WebSocket(`${WS_URL}?token=${TOKEN}`);

      socket.onopen = () => {
        isConnected = true;
        connectionStatus = "Connected";

        const subscriptionMessage = {
          type: "notification_subscription",
          space_name: "messages",
          subpath: "/messages",
        };
        socket.send(JSON.stringify(subscriptionMessage));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error(
            "❌ [WebSocket] Failed to parse message:",
            error,
            event.data
          );
          errorToastMessage(
            $_("messaging.toast_failed_parse_ws") + ": " + error
          );
        }
      };

      socket.onclose = (event) => {
        console.warn("🔌 [WebSocket] Connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        isConnected = false;
        connectionStatus = "Disconnected";

        setTimeout(() => {
          if (!isConnected) {
            connectWebSocket();
          }
        }, 3000);
      };

      socket.onerror = (error) => {
        console.error("❌ [WebSocket] Connection error:", error);
        errorToastMessage($_("messaging.toast_ws_error") + ": " + error);
        connectionStatus = $_("messaging.toast_ws_error");
      };
    } catch (error) {
      console.error("❌ [WebSocket] Failed to create connection:", error);
      errorToastMessage($_("messaging.toast_failed_connect_ws") + ": " + error);
      connectionStatus = $_("messaging.toast_failed_connect_ws");
    }
  }

  function handleWebSocketMessage(data) {
    if (data.type === "connection_response") {
      if (data.message?.status === "success") {
        successToastMessage($_("messaging.toast_ws_connected"));
      }
      return;
    }

    if (data.type === "notification_subscription") {
      if (data.message?.action_type === "create" && data.message?.shortname) {
        fetchMessageByShortname(data.message.shortname);
        return;
      }
    }

    if (data.type === "message") {
      if (data.groupId) {
        if (
          selectedGroup &&
          data.groupId === selectedGroup.id &&
          chatMode === "group"
        ) {
          const isRelevant = isRelevantGroupMessage(
            data,
            selectedGroup.id,
            currentUser?.shortname
          );

          if (isRelevant) {
            if (data.senderId === currentUser?.shortname) {
              return;
            }
            const newGroupMessage = {
              id: data.messageId || `ws_group_${Date.now()}`,
              senderId: data.senderId,
              groupId: data.groupId,
              content: data.content || "",
              timestamp: new Date(data.timestamp || Date.now()),
              isOwn: false,
              hasAttachments: data.hasAttachments || false,
              attachments: data.attachments || null,
            };

            const messageExists = groupMessages.some(
              (msg) =>
                msg.id === newGroupMessage.id ||
                (msg.senderId === newGroupMessage.senderId &&
                  msg.groupId === newGroupMessage.groupId &&
                  Math.abs(
                    new Date(msg.timestamp).getTime() -
                      new Date(newGroupMessage.timestamp).getTime()
                  ) < 5000)
            );

            if (!messageExists) {
              addGroupMessageToConversation(newGroupMessage);

              if (document.hidden || !selectedGroup) {
                const senderName = getUserDisplayName(data.senderId);
                successToastMessage(
                  `${senderName}: ${data.content.substring(0, 50)}${data.content.length > 50 ? "..." : ""}`
                );
              }
            } else {
            }
          } else {
          }
        } else if (data.groupId && !selectedGroup) {
          const groupName =
            getGroupDisplayName(data.groupId) || `Group ${data.groupId}`;
          const senderName = getUserDisplayName(data.senderId);
          successToastMessage(
            `${senderName} in ${groupName}: ${data.content.substring(0, 50)}${data.content.length > 50 ? "..." : ""}`
          );
        } else {
        }
        return;
      }

      if (
        selectedUser &&
        data.senderId &&
        data.receiverId &&
        chatMode === "direct"
      ) {
        const isRelevant = isRelevantMessage(
          data,
          selectedUser.shortname,
          currentUser?.shortname
        );

        if (isRelevant) {
          if (data.senderId === currentUser?.shortname) {
            return;
          }

          if (data.hasAttachments && data.messageId) {
            const tempMessage = {
              id: `temp_attachment_${data.messageId}`,
              senderId: data.senderId,
              receiverId: data.receiverId,
              content: data.content || "📎 Attachment",
              timestamp: new Date(data.timestamp || Date.now()),
              isOwn: false,
              hasAttachments: true,
              attachments: null,
              isUploading: true,
            };

            const messageExists = messages.some(
              (msg) => msg.id === data.messageId || msg.id === tempMessage.id
            );

            if (!messageExists) {
              addMessageToConversation(tempMessage);
            }

            setTimeout(async () => {
              try {
                const response = await getMessagesBetweenUsers(
                  currentUser?.shortname,
                  selectedUser.shortname
                );

                if (
                  response &&
                  response.status === "success" &&
                  response.records
                ) {
                  const updatedMessages = sortMessagesByTimestamp(
                    response.records.map((record) =>
                      transformMessageRecord(record, currentUser?.shortname)
                    )
                  );

                  const hasNewAttachmentData = updatedMessages.some(
                    (msg) => msg.id === data.messageId && msg.attachments
                  );

                  if (hasNewAttachmentData) {
                    messages = updatedMessages;

                    conversationMessages.set(selectedUser.shortname, [
                      ...messages,
                    ]);

                    const cacheKey = getCacheKey(
                      currentUser?.shortname,
                      selectedUser.shortname
                    );
                    cacheMessages(cacheKey, messages);

                    scrollToBottom(chatContainer);
                  }
                }
              } catch (error) {
                console.error("Error fetching attachment message:", error);

                messages = messages.filter((msg) => msg.id !== tempMessage.id);

                errorToastMessage(
                  $_("messaging.toast_failed_fetch_attachment") ||
                    "Failed to load attachment"
                );
              }
            }, 1000);

            return;
          }

          const newMessage = {
            id: data.messageId || `ws_${Date.now()}`,
            senderId: data.senderId,
            receiverId: data.receiverId,
            content: data.content || "",
            timestamp: new Date(data.timestamp || Date.now()),
            isOwn: false,
            hasAttachments: false,
            attachments: null,
          };

          const messageExists = messages.some(
            (msg) =>
              msg.id === newMessage.id ||
              (msg.senderId === newMessage.senderId &&
                msg.receiverId === newMessage.receiverId &&
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

      if (
        data.type === "group_message" ||
        (data.groupId && chatMode === "group")
      ) {
        if (selectedGroup && data.groupId === selectedGroup.id) {
          const isRelevant = isRelevantGroupMessage(
            data,
            selectedGroup.id,
            currentUser?.shortname
          );

          if (isRelevant) {
            if (data.senderId === currentUser?.shortname) {
              return;
            }

            const newGroupMessage = {
              id: data.messageId || `ws_group_${Date.now()}`,
              senderId: data.senderId,
              groupId: data.groupId,
              content: data.content || "",
              timestamp: new Date(data.timestamp || Date.now()),
              isOwn: false,
              hasAttachments: data.hasAttachments || false,
              attachments: data.attachments || null,
            };

            const messageExists = groupMessages.some(
              (msg) =>
                msg.id === newGroupMessage.id ||
                (msg.senderId === newGroupMessage.senderId &&
                  msg.groupId === newGroupMessage.groupId &&
                  Math.abs(
                    new Date(msg.timestamp).getTime() -
                      new Date(newGroupMessage.timestamp).getTime()
                  ) < 5000)
            );

            if (!messageExists) {
              addGroupMessageToConversation(newGroupMessage);

              if (document.hidden || !selectedGroup) {
                const senderName = getUserDisplayName(data.senderId);
                successToastMessage(
                  `${senderName}: ${data.content.substring(0, 50)}${data.content.length > 50 ? "..." : ""}`
                );
              }
            }
          }
        } else if (data.groupId && !selectedGroup) {
          const groupName =
            getGroupDisplayName(data.groupId) || `Group ${data.groupId}`;
          const senderName = getUserDisplayName(data.senderId);
          successToastMessage(
            `${senderName} in ${groupName}: ${data.content.substring(0, 50)}${data.content.length > 50 ? "..." : ""}`
          );
        }
      }

      if (data.type === "message" && !data.groupId) {
      }

      if (data.type === "message" && !data.groupId) {
        if (
          selectedUser &&
          data.senderId &&
          data.receiverId &&
          chatMode === "direct"
        ) {
          const isRelevant = isRelevantMessage(
            data,
            selectedUser.shortname,
            currentUser?.shortname
          );

          if (isRelevant) {
            if (data.senderId === currentUser?.shortname) {
              return;
            }

            if (data.hasAttachments && data.messageId) {
              const tempMessage = {
                id: `temp_attachment_${data.messageId}`,
                senderId: data.senderId,
                receiverId: data.receiverId,
                content: data.content || "📎 Attachment",
                timestamp: new Date(data.timestamp || Date.now()),
                isOwn: false,
                hasAttachments: true,
                attachments: null,
                isUploading: true,
              };

              const messageExists = messages.some(
                (msg) => msg.id === data.messageId || msg.id === tempMessage.id
              );

              if (!messageExists) {
                addMessageToConversation(tempMessage);
              }

              setTimeout(async () => {
                try {
                  const response = await getMessagesBetweenUsers(
                    currentUser?.shortname,
                    selectedUser.shortname
                  );

                  if (
                    response &&
                    response.status === "success" &&
                    response.records
                  ) {
                    const updatedMessages = sortMessagesByTimestamp(
                      response.records.map((record) =>
                        transformMessageRecord(record, currentUser?.shortname)
                      )
                    );

                    const hasNewAttachmentData = updatedMessages.some(
                      (msg) => msg.id === data.messageId && msg.attachments
                    );

                    if (hasNewAttachmentData) {
                      messages = updatedMessages;

                      conversationMessages.set(selectedUser.shortname, [
                        ...messages,
                      ]);

                      const cacheKey = getCacheKey(
                        currentUser?.shortname,
                        selectedUser.shortname
                      );
                      cacheMessages(cacheKey, messages);

                      scrollToBottom(chatContainer);
                    }
                  }
                } catch (error) {
                  console.error("Error fetching attachment message:", error);

                  messages = messages.filter(
                    (msg) => msg.id !== tempMessage.id
                  );

                  errorToastMessage(
                    $_("messaging.toast_failed_fetch_attachment") ||
                      "Failed to load attachment"
                  );
                }
              }, 1000);

              return;
            }

            const newMessage = {
              id: data.messageId || `ws_${Date.now()}`,
              senderId: data.senderId,
              receiverId: data.receiverId,
              content: data.content || "",
              timestamp: new Date(data.timestamp || Date.now()),
              isOwn: false,
              hasAttachments: false,
              attachments: null,
            };

            const messageExists = messages.some(
              (msg) =>
                msg.id === newMessage.id ||
                (msg.senderId === newMessage.senderId &&
                  msg.receiverId === newMessage.receiverId &&
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
  }

  async function fetchMessageByShortname(messageShortname) {
    try {
      const messageData = await getMessageByShortname(messageShortname);

      if (!messageData) {
        return;
      }

      if (selectedGroup && chatMode === "group") {
        if (messageData.groupId === selectedGroup.id) {
          if (messageData.senderId === currentUser?.shortname) {
            return;
          }

          setTimeout(async () => {
            try {
              const response = await getGroupMessages(
                selectedGroup.id,
                MESSAGES_LIMIT,
                0
              );

              if (
                response &&
                response.status === "success" &&
                response.records
              ) {
                const updatedMessages = sortMessagesByTimestamp(
                  response.records.map((record: any) =>
                    transformGroupMessageRecord(record, currentUser?.shortname)
                  ) as MessageData[]
                );

                const currentMessageCount = groupMessages.length;
                const newMessageCount = updatedMessages.length;

                if (
                  newMessageCount > currentMessageCount ||
                  updatedMessages.some((msg) => msg.id === messageData.id)
                ) {
                  groupMessages = updatedMessages;

                  groupConversationMessages.set(selectedGroup.id, [
                    ...updatedMessages,
                  ]);

                  const cacheKey = getGroupCacheKey(
                    currentUser?.shortname,
                    selectedGroup.id
                  );
                  cacheMessages(cacheKey, updatedMessages);

                  scrollToBottom(chatContainer);
                } else {
                }
              }
            } catch (error) {
              console.error(
                "❌ [Fetch Message] Error refreshing group conversation:",
                error
              );
            }
          }, 1500);
        } else {
        }
        return;
      }

      if (selectedUser && chatMode === "direct") {
        const isRelevant = isRelevantMessage(
          messageData,
          selectedUser.shortname,
          currentUser?.shortname
        );

        if (isRelevant) {
          if (messageData.senderId === currentUser?.shortname) {
            return;
          }

          setTimeout(async () => {
            try {
              const response = await getMessagesBetweenUsers(
                currentUser?.shortname,
                selectedUser.shortname
              );

              if (
                response &&
                response.status === "success" &&
                response.records
              ) {
                const updatedMessages = sortMessagesByTimestamp(
                  response.records.map((record) =>
                    transformMessageRecord(record, currentUser?.shortname)
                  )
                );

                const currentMessageCount = messages.length;
                const newMessageCount = updatedMessages.length;

                if (
                  newMessageCount > currentMessageCount ||
                  updatedMessages.some((msg) => msg.id === messageData.id)
                ) {
                  messages = updatedMessages;

                  conversationMessages.set(selectedUser.shortname, [
                    ...messages,
                  ]);

                  const cacheKey = getCacheKey(
                    currentUser?.shortname,
                    selectedUser.shortname
                  );
                  cacheMessages(cacheKey, messages);

                  scrollToBottom(chatContainer);
                }
              }
            } catch (error) {
              console.error(
                "❌ [Fetch Message] Error refreshing direct conversation:",
                error
              );
            }
          }, 1500);
        }
      }
    } catch (error) {
      console.error("❌ [Fetch Message] Error fetching message:", error);
      errorToastMessage(
        $_("messaging.toast_failed_fetch_by_shortname") + ": " + error
      );
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

      const cacheKey = getCacheKey(
        currentUser?.shortname,
        selectedUser.shortname
      );
      cacheMessages(cacheKey, messages);
    }

    scrollToBottom(chatContainer);
  }

  function addGroupMessageToConversation(newMessage) {
    groupMessages = [...groupMessages, newMessage];

    if (selectedGroup) {
      const conversationKey = selectedGroup.id;
      const existingMessages =
        groupConversationMessages.get(conversationKey) || [];

      groupConversationMessages.set(conversationKey, [
        ...existingMessages,
        newMessage,
      ]);

      const cacheKey = getGroupCacheKey(
        currentUser?.shortname,
        selectedGroup.id
      );
      cacheMessages(cacheKey, groupMessages);
    } else {
      console.warn("⚠️ [Group Message] No selected group for caching");
    }

    scrollToBottom(chatContainer);
  }

  function getUserDisplayName(shortname) {
    const user = users.find((u) => u.shortname === shortname);
    return user ? user.name || user.displayname || shortname : shortname;
  }

  async function loadConversation(userShortname) {
    if (!selectedUser) return;

    isMessagesLoading = true;
    messagesOffset = 0;
    hasMoreMessages = true;

    try {
      const response = await getMessagesBetweenUsers(
        currentUser?.shortname,
        userShortname,
        MESSAGES_LIMIT,
        0
      );

      if (response && response.status === "success" && response.records) {
        messages = sortMessagesByTimestamp(
          response.records.map((record) =>
            transformMessageRecord(record, currentUser?.shortname)
          )
        );

        if (messages.length < MESSAGES_LIMIT) {
          hasMoreMessages = false;
        }
      } else {
        messages = [];
        hasMoreMessages = false;
      }

      conversationMessages.set(userShortname, [...messages]);

      const cacheKey = getCacheKey(currentUser?.shortname, userShortname);
      cacheMessages(cacheKey, messages);
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_failed_load_history") + ": " + error
      );
      messages = conversationMessages.get(userShortname) || [];

      if (messages.length === 0) {
        const cacheKey = getCacheKey(currentUser?.shortname, userShortname);
        messages = getCachedMessages(cacheKey);
      }
    } finally {
      isMessagesLoading = false;
      scrollToBottom(chatContainer);
    }
  }

  async function sendMessage() {
    if (
      (!currentMessage.trim() && selectedAttachments.length === 0) ||
      !selectedUser ||
      !isConnected
    ) {
      return;
    }

    const messageContent = currentMessage.trim() || "";
    const hasAttachments = selectedAttachments.length > 0;
    const tempId = `temp_${Date.now()}`;

    if (hasAttachments) {
      isAttachmentLoading = true;
    }

    const newMessage = {
      id: tempId,
      senderId: currentUser?.shortname,
      receiverId: selectedUser.shortname,
      content: messageContent || (hasAttachments ? "attachment" : ""),
      timestamp: new Date(),
      isOwn: true,
      hasAttachments: hasAttachments,
      attachments: hasAttachments ? selectedAttachments : null,
      isUploading: hasAttachments,
    };

    messages = [...messages, newMessage];
    scrollToBottom(chatContainer);

    currentMessage = "";
    const attachmentsToProcess = [...selectedAttachments];
    selectedAttachments = [];

    try {
      const messageData = {
        content: messageContent || (hasAttachments ? "attachment" : ""),
        sender: currentUser?.shortname,
        receiver: selectedUser.shortname,
        message_type: hasAttachments ? "attachment" : "text",
        timestamp: new Date().toISOString(),
      };

      const persistedMessageId = await createMessages(messageData);

      if (persistedMessageId) {
        messages = messages.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: persistedMessageId, isUploading: false }
            : msg
        );

        if (hasAttachments && attachmentsToProcess.length > 0) {
          try {
            for (const attachment of attachmentsToProcess) {
              const attachmentResult = await attachAttachmentsToEntity(
                persistedMessageId,
                "messages",
                "messages",
                attachment
              );

              if (!attachmentResult) {
                errorToastMessage(
                  $_("messaging.toast_attachment_failed", {
                    values: { name: attachment.name },
                  }) || `Failed to attach ${attachment.name}`
                );
              }
            }

            setTimeout(async () => {
              try {
                const response = await getMessagesBetweenUsers(
                  currentUser?.shortname,
                  selectedUser.shortname
                );

                if (
                  response &&
                  response.status === "success" &&
                  response.records
                ) {
                  const updatedMessages = sortMessagesByTimestamp(
                    response.records.map((record) =>
                      transformMessageRecord(record, currentUser?.shortname)
                    )
                  );

                  messages = updatedMessages;
                  conversationMessages.set(selectedUser.shortname, [
                    ...messages,
                  ]);

                  const cacheKey = getCacheKey(
                    currentUser?.shortname,
                    selectedUser.shortname
                  );
                  cacheMessages(cacheKey, messages);

                  scrollToBottom(chatContainer);
                }
              } catch (error) {
                console.error("Error refreshing messages:", error);
              }
            }, 1500);
          } catch (attachmentError) {
            errorToastMessage(
              $_("messaging.toast_attachment_error") + ": " + attachmentError
            );

            messages = messages.map((msg) =>
              msg.id === persistedMessageId
                ? { ...msg, isUploading: false, uploadFailed: true }
                : msg
            );
          }
        }

        const wsMessage = {
          type: "message",
          senderId: currentUser?.shortname,
          receiverId: selectedUser.shortname,
          content: messageContent || (hasAttachments ? "attachment" : ""),
          timestamp: new Date().toISOString(),
          messageId: persistedMessageId,
          hasAttachments: hasAttachments,
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(wsMessage));
        }
      } else {
        errorToastMessage($_("messaging.toast_failed_persist_message"));
        messages = messages.filter((msg) => msg.id !== tempId);
      }
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_failed_send_message") + ": " + error
      );
      messages = messages.filter((msg) => msg.id !== tempId);
    } finally {
      isAttachmentLoading = false;
    }

    if (!hasAttachments) {
      const conversationKey = selectedUser.shortname;
      const existingMessages = conversationMessages.get(conversationKey) || [];
      const updatedMessages = messages.filter((msg) => msg.id !== tempId);

      if (updatedMessages.length > 0) {
        conversationMessages.set(conversationKey, updatedMessages);

        const cacheKey = getCacheKey(
          currentUser?.shortname,
          selectedUser.shortname
        );
        cacheMessages(cacheKey, updatedMessages);
      }
    }
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (chatMode === "group" && selectedGroup) {
        sendGroupMessage();
      } else if (chatMode === "direct" && selectedUser) {
        sendMessage();
      }
    }
  }

  function toggleUserView() {
    showAllUsers = !showAllUsers;
    loadUsers();
  }

  function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedAttachments = [...selectedAttachments, ...files];
    event.target.value = "";
  }

  function removeAttachment(index) {
    selectedAttachments = selectedAttachments.filter((_, i) => i !== index);
  }

  async function startVoiceRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeTypes = [
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];

      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported audio format found");
      }

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000,
      });

      audioChunks = [];
      recordingDuration = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: selectedMimeType });

        let fileExtension = "mp3";
        let finalMimeType = selectedMimeType;

        if (selectedMimeType.includes("webm")) {
          fileExtension = "mp3";
          finalMimeType = "audio/mpeg";
        } else if (selectedMimeType.includes("mp4")) {
          fileExtension = "mp3";
          finalMimeType = "audio/mpeg";
        } else if (selectedMimeType.includes("wav")) {
          fileExtension = "wav";
          finalMimeType = "audio/wav";
        }

        const fileName = `voice_message_${Date.now()}.${fileExtension}`;

        const audioFile = new File([audioBlob], fileName, {
          type: finalMimeType,
          lastModified: Date.now(),
        });

        selectedAttachments = [...selectedAttachments, audioFile];

        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
        }

        successToastMessage(
          $_("messaging.toast_voice_recorded") ||
            "Voice message recorded successfully"
        );
      };

      mediaRecorder.start();
      isRecording = true;

      recordingInterval = setInterval(() => {
        recordingDuration++;
      }, 1000);

      successToastMessage(
        $_("messaging.toast_recording_started") || "Recording started..."
      );
    } catch (error) {
      errorToastMessage(
        $_("messaging.toast_recording_failed") + ": " + error.message ||
          "Failed to start recording"
      );
      isRecording = false;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }

    isRecording = false;

    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
  }

  function cancelVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }

    isRecording = false;
    recordingDuration = 0;
    audioChunks = [];

    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    successToastMessage(
      $_("messaging.toast_recording_cancelled") || "Recording cancelled"
    );
  }
</script>

<div class="chat-container" class:rtl={isRTL}>
  <!-- Header -->
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

  <div class="chat-content">
    <!-- Users Sidebar -->
    <div class="users-sidebar">
      <!-- Chat Mode Tabs -->
      <div class="chat-mode-tabs">
        <button
          class="tab-btn"
          class:active={chatMode === "direct"}
          onclick={() => (chatMode = "direct")}
        >
          💬 Direct Messages ({users.length})
        </button>
        <button
          class="tab-btn"
          class:active={chatMode === "group"}
          onclick={() => (chatMode = "group")}
        >
          👥 Groups ({groups.length})
        </button>
      </div>

      {#if chatMode === "direct"}
        <!-- Direct Messages Section -->
        <div class="users-header">
          <h3>
            {showAllUsers
              ? $_("messaging.all_users")
              : $_("messaging.conversations")} ({users.length})
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
                  <p>{$_("messaging.no_users_found")}</p>
                </div>
              {:else}
                <div class="no-conversations-message">
                  <p>{$_("messaging.no_conversations_yet")}</p>
                  <button
                    class="start-conversation-btn"
                    onclick={toggleUserView}
                  >
                    {$_("messaging.browse_users_to_start")}
                  </button>
                </div>
              {/if}
            </div>
          {:else}
            {#each users as user (user.id)}
              <div
                class="user-item"
                class:selected={selectedUser?.id === user.id &&
                  chatMode === "direct"}
                onclick={() => selectUser(user)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === "Enter" && selectUser(user)}
                aria-label={`Chat with ${user.name}`}
              >
                <div class="user-avatar mx-3">
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
                  <div
                    class="online-indicator"
                    class:online={user.online}
                  ></div>
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
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {:else}
        <!-- Groups Section -->
        <div class="groups-header">
          <h3>Groups ({groups.length})</h3>
          <div class="groups-header-actions">
            <button
              class="create-group-btn"
              onclick={() => (showGroupForm = true)}
              aria-label="Create new group"
            >
              ➕ Create Group
            </button>
            <button
              class="refresh-btn"
              onclick={loadGroups}
              disabled={isGroupsLoading}
              aria-label="Refresh groups"
            >
              {isGroupsLoading ? "⟳" : "↻"}
            </button>
          </div>
        </div>

        <div class="groups-list">
          {#if isGroupsLoading}
            <div class="loading">Loading groups...</div>
          {:else if groups.length === 0}
            <div class="no-groups">
              <div class="no-groups-message">
                <p>No groups yet</p>
                <button
                  class="create-group-btn"
                  onclick={() => (showGroupForm = true)}
                >
                  Create your first group
                </button>
              </div>
            </div>
          {:else}
            {#each groups as group (group.id)}
              <div
                class="group-item"
                class:selected={selectedGroup?.id === group.id &&
                  chatMode === "group"}
                onclick={() => selectGroup(group)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === "Enter" && selectGroup(group)}
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
                  <div class="group-details">
                    <div class="participant-count">
                      {group.participants.length} participants
                    </div>
                    {#if group.description}
                      <div class="group-description">
                        {group.description.en}
                      </div>
                    {/if}
                  </div>
                  {#if isUserGroupAdmin(group, currentUser?.shortname)}
                    <div class="admin-badge">Admin</div>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Chat Area -->
    <div class="chat-area">
      {#if selectedUser && chatMode === "direct"}
        <!-- Direct Chat Header -->
        <div class="chat-user-header">
          <div class="chat-user-info">
            <div class="user-avatar small mx-3">
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
                {/if}
              </div>
            </div>
          </div>
        </div>

        <div
          class="messages-container"
          bind:this={chatContainer}
          onscroll={handleScroll}
        >
          {#if isLoadingOlderMessages}
            <div class="loading-older-messages">
              <div class="loading-spinner"></div>
              <span>Loading older messages...</span>
            </div>
          {/if}

          {#if isMessagesLoading}
            <div class="loading">Loading messages...</div>
          {:else if messages.length === 0}
            <div class="no-messages">
              <p>{$_("messaging.no_messages_yet")}</p>
            </div>
          {:else}
            {#each messages as message (message.id)}
              <div class="message" class:own={message.isOwn}>
                <div class="message-content">
                  {#if message.content && message.content !== "attachment"}
                    <div class="message-text">{message.content}</div>
                  {/if}

                  {#if message.isUploading}
                    <div class="upload-status">
                      <div class="upload-spinner"></div>
                      <span>Uploading...</span>
                    </div>
                  {:else if message.uploadFailed}
                    <div class="upload-failed">
                      <span class="error-icon">⚠️</span>
                      <span>Upload failed</span>
                    </div>
                  {/if}

                  {#if message?.attachments && message?.attachments?.length > 0}
                    <MessengerAttachments
                      attachments={message.attachments}
                      resource_type={ResourceType.media}
                      space_name="messages"
                      subpath="/messages"
                      parent_shortname={message.id}
                      isOwner={message.isOwn}
                    />
                  {/if}

                  <!-- Show temp attachments for pending messages -->
                  {#if message.hasAttachments && message.attachments && !message.attachments?.media && !message.isUploading}
                    <div class="message-attachments">
                      {#each message.attachments as file}
                        <div class="attachment-item temp-attachment">
                          {#if file.type.startsWith("audio/") && file.name.includes("voice_message_")}
                            <!-- Voice Message Preview -->
                            <div class="voice-message-preview">
                              <div class="voice-message-icon">🎤</div>
                              <div class="voice-message-info">
                                <div class="voice-message-label">
                                  Voice Message
                                </div>
                                <div class="file-size">
                                  {formatFileSize(file.size)}
                                </div>
                              </div>
                              <audio controls class="voice-audio-control">
                                <source
                                  src={getPreviewUrl(file)}
                                  type={file.type}
                                />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          {:else if getPreviewUrl(file)}
                            <img
                              src={getPreviewUrl(file)}
                              alt={file.name}
                              class="attachment-image"
                            />
                          {:else}
                            <div class="attachment-file">
                              <div class="file-icon-display">
                                {getFileIcon(file)}
                              </div>
                              <div class="file-details">
                                <div class="file-name">{file.name}</div>
                                <div class="file-size">
                                  {formatFileSize(file.size)}
                                </div>
                              </div>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}

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
          <!-- Attachment Preview -->
          {#if selectedAttachments.length > 0}
            <div class="attachment-preview-container">
              {#each selectedAttachments as file, index}
                <div class="attachment-preview-item">
                  {#if file.type.startsWith("audio/") && file.name.includes("voice_message_")}
                    <!-- Voice Message Preview -->
                    <div class="voice-message-icon">🎤</div>
                    <div class="file-info">
                      <div class="file-name">Voice Message</div>
                      <div class="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  {:else if getPreviewUrl(file)}
                    <img
                      src={getPreviewUrl(file)}
                      alt={file.name}
                      class="preview-image"
                    />
                    <div class="file-info">
                      <div class="file-name">{file.name}</div>
                      <div class="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  {:else}
                    <div class="file-icon">{getFileIcon(file)}</div>
                    <div class="file-info">
                      <div class="file-name">{file.name}</div>
                      <div class="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  {/if}
                  <button
                    class="remove-attachment-btn"
                    onclick={() => removeAttachment(index)}
                    aria-label="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="message-input">
            <button
              class="attachment-btn"
              onclick={() =>
                document.getElementById("attachment-input").click()}
              disabled={!isConnected || isRecording}
              aria-label="Add attachment"
            >
              📎
            </button>

            <!-- Voice Recording Button -->
            {#if !isRecording}
              <button
                class="voice-btn"
                onclick={startVoiceRecording}
                disabled={!isConnected}
                aria-label="Record voice message"
                title="Record voice message"
              >
                🎤
              </button>
            {:else}
              <div class="voice-recording-controls">
                <div class="recording-indicator">
                  <div class="recording-dot"></div>
                  <span class="recording-duration"
                    >{formatRecordingDuration(recordingDuration)}</span
                  >
                </div>
                <button
                  class="voice-control-btn cancel"
                  onclick={cancelVoiceRecording}
                  aria-label="Cancel recording"
                  title="Cancel recording"
                >
                  ✕
                </button>
                <button
                  class="voice-control-btn stop"
                  onclick={stopVoiceRecording}
                  aria-label="Stop recording"
                  title="Stop recording"
                >
                  ⏹️
                </button>
              </div>
            {/if}
            <input
              type="file"
              id="attachment-input"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onchange={handleFileSelect}
              style="display: none;"
            />

            <textarea
              bind:value={currentMessage}
              placeholder={$_("messaging.type_a_message")}
              disabled={!isConnected || isRecording}
              rows="1"
              onkeydown={handleKeydown}
            ></textarea>

            <div class="input-actions">
              <button
                class="send-btn"
                onclick={sendMessage}
                disabled={(!currentMessage.trim() &&
                  selectedAttachments.length === 0) ||
                  !isConnected ||
                  isAttachmentLoading ||
                  isRecording}
                aria-label="Send message"
              >
                {#if isAttachmentLoading}
                  <div class="loading-spinner"></div>
                {:else}
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
                {/if}
              </button>
            </div>
          </div>
        </div>
      {:else if selectedGroup && chatMode === "group"}
        <!-- Group Chat Header -->
        <div class="chat-group-header">
          <div class="chat-group-info">
            <div class="group-avatar small">
              {#if selectedGroup.avatar}
                <img src={selectedGroup.avatar} alt={selectedGroup.name} />
              {:else}
                <div class="avatar-placeholder group">
                  {selectedGroup.name.charAt(0).toUpperCase()}
                </div>
              {/if}
            </div>
            <div>
              <div class="chat-group-name">{selectedGroup.name}</div>
              <div class="chat-group-status">
                {selectedGroup.participants.length} participants
                {#if isUserGroupAdmin(selectedGroup, currentUser?.shortname)}
                  • Admin
                {/if}
                <div class="group-participants-preview">
                  {selectedGroup.participants
                    .slice(0, 3)
                    .map((participantId) => getUserDisplayName(participantId))
                    .join(", ")}
                  {#if selectedGroup.participants.length > 3}
                    and {selectedGroup.participants.length - 3} more
                  {/if}
                </div>
              </div>
            </div>
          </div>
          {#if isUserGroupAdmin(selectedGroup, currentUser?.shortname)}
            <div class="group-header-actions">
              <button
                class="edit-group-btn"
                onclick={openGroupEditForm}
                aria-label="Edit group"
                title="Edit group settings"
              >
                ✏️
              </button>
            </div>
          {/if}
        </div>

        <div
          class="messages-container"
          bind:this={chatContainer}
          onscroll={handleScroll}
        >
          {#if isLoadingOlderMessages}
            <div class="loading-older-messages">
              <div class="loading-spinner"></div>
              <span>Loading older messages...</span>
            </div>
          {/if}

          {#if isMessagesLoading}
            <div class="loading">Loading messages...</div>
          {:else if groupMessages.length === 0}
            <div class="no-messages">
              <p>No messages in this group yet</p>
            </div>
          {:else}
            {#each groupMessages as message (message.id)}
              <div class="message group-message" class:own={message.isOwn}>
                {#if !message.isOwn}
                  {@const senderUser = users.find(
                    (u) => u.shortname === message.senderId
                  )}
                  <div class="message-sender-info">
                    <div class="sender-avatar tiny">
                      {#if senderUser?.avatar}
                        <img
                          src={senderUser.avatar}
                          alt={getUserDisplayName(message.senderId)}
                        />
                      {:else}
                        <div class="avatar-placeholder">
                          {getUserDisplayName(message.senderId)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      {/if}
                    </div>
                    <div class="sender-details">
                      <div class="message-sender">
                        {getUserDisplayName(message.senderId)}
                      </div>
                      <div class="message-timestamp">
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                {/if}
                <div class="message-content" class:own-content={message.isOwn}>
                  {#if message.content && message.content !== "attachment"}
                    <div class="message-text">{message.content}</div>
                  {/if}

                  {#if message.isUploading}
                    <div class="upload-status">
                      <div class="upload-spinner"></div>
                      <span>Uploading...</span>
                    </div>
                  {:else if message.uploadFailed}
                    <div class="upload-failed">
                      <span class="error-icon">⚠️</span>
                      <span>Upload failed</span>
                    </div>
                  {/if}

                  {#if message?.attachments && message?.attachments?.length > 0}
                    <MessengerAttachments
                      attachments={message.attachments}
                      resource_type={ResourceType.media}
                      space_name="messages"
                      subpath="/messages"
                      parent_shortname={message.id}
                      isOwner={message.isOwn}
                    />
                  {/if}
                </div>
                {#if message.isOwn}
                  <div class="message-timestamp own-timestamp">
                    {formatTime(message.timestamp)}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>

        <!-- Group Message Input -->
        <div class="message-input-container">
          <!-- Attachment Preview -->
          {#if selectedAttachments.length > 0}
            <div class="attachment-preview-container">
              {#each selectedAttachments as file, index}
                <div class="attachment-preview-item">
                  {#if file.type.startsWith("audio/") && file.name.includes("voice_message_")}
                    <!-- Voice Message Preview -->
                    <div class="voice-message-icon">🎤</div>
                    <div class="file-info">
                      <div class="file-name">Voice Message</div>
                      <div class="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  {:else if getPreviewUrl(file)}
                    <img
                      src={getPreviewUrl(file)}
                      alt={file.name}
                      class="preview-image"
                    />
                    <div class="file-info">
                      <div class="file-name">{file.name}</div>
                      <div class="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  {:else}
                    <div class="file-icon">{getFileIcon(file)}</div>
                    <div class="file-info">
                      <div class="file-name">{file.name}</div>
                      <div class="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  {/if}
                  <button
                    class="remove-attachment-btn"
                    onclick={() => removeAttachment(index)}
                    aria-label="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="message-input">
            <button
              class="attachment-btn"
              onclick={() =>
                document.getElementById("attachment-input").click()}
              disabled={!isConnected || isRecording}
              aria-label="Attach file"
            >
              📎
            </button>

            <input
              type="file"
              id="attachment-input"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onchange={handleFileSelect}
              style="display: none;"
            />

            <textarea
              bind:value={currentMessage}
              placeholder="Type a message to the group..."
              disabled={!isConnected || isRecording}
              rows="1"
              onkeydown={handleKeydown}
            ></textarea>

            <div class="input-actions">
              <button
                class="send-btn"
                onclick={sendGroupMessage}
                disabled={(!currentMessage.trim() &&
                  selectedAttachments.length === 0) ||
                  !isConnected ||
                  isAttachmentLoading ||
                  isRecording}
                aria-label="Send message"
              >
                {#if isAttachmentLoading}
                  <div class="loading-spinner"></div>
                {:else}
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
                {/if}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="no-chat-selected">
          <div class="no-chat-message">
            <h3>
              {chatMode === "direct"
                ? $_("messaging.select_user_to_chat")
                : "Select a group to chat"}
            </h3>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Group Creation Modal -->
{#if showGroupForm}
  <div class="modal-overlay" role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-content" role="document">
      <div class="modal-header">
        <h3>Create New Group</h3>
        <button
          class="close-btn"
          onclick={() => (showGroupForm = false)}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="groupName">Group Name</label>
          <input
            id="groupName"
            type="text"
            bind:value={newGroupName}
            placeholder="Enter group name"
            maxlength="50"
          />
        </div>

        <div class="form-group">
          <label for="groupDescription">Description (optional)</label>
          <textarea
            id="groupDescription"
            bind:value={newGroupDescription}
            placeholder="Enter group description"
            rows="3"
            maxlength="200"
          ></textarea>
        </div>

        <div class="form-group">
          <fieldset>
            <legend>Select Participants</legend>
            <div class="participants-list">
              {#each users.filter((u) => u.isActive) as user (user.id)}
                <div class="participant-item">
                  <input
                    type="checkbox"
                    id="participant-{user.id}"
                    bind:group={selectedGroupParticipants}
                    value={user}
                  />
                  <label for="participant-{user.id}">
                    <div class="user-avatar tiny">
                      {#if user.avatar}
                        <img src={user.avatar} alt={user.name} />
                      {:else}
                        <div class="avatar-placeholder">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      {/if}
                    </div>
                    {user.name}
                  </label>
                </div>
              {/each}
            </div>
          </fieldset>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" onclick={() => (showGroupForm = false)}>
          Cancel
        </button>
        <button
          class="create-btn"
          onclick={createNewGroup}
          disabled={!newGroupName.trim() ||
            selectedGroupParticipants.length === 0}
        >
          Create Group
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Group Edit Modal -->
{#if showGroupEditForm}
  <div class="modal-overlay" role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-content" role="document">
      <div class="modal-header">
        <h3>Edit Group Settings</h3>
        <button
          class="close-btn"
          onclick={() => (showGroupEditForm = false)}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="edit-group-name">Group Name</label>
          <input
            id="edit-group-name"
            type="text"
            bind:value={editGroupName}
            placeholder="Enter group name"
            maxlength="50"
          />
        </div>

        <div class="form-group">
          <label for="edit-group-description">Description (Optional)</label>
          <textarea
            id="edit-group-description"
            bind:value={editGroupDescription}
            placeholder="Enter group description"
            maxlength="200"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <h4>Current Participants ({editGroupParticipants.length})</h4>
          <div class="participants-list">
            {#each editGroupParticipants as participantId}
              {#if participantId !== currentUser?.shortname}
                <div class="participant-item">
                  <span class="participant-name"
                    >{getUserDisplayName(participantId)}</span
                  >
                  <button
                    class="remove-participant-btn"
                    onclick={() => removeParticipantFromGroup(participantId)}
                    aria-label="Remove participant"
                    title="Remove from group"
                  >
                    ✕
                  </button>
                </div>
              {:else}
                <div class="participant-item current-user">
                  <span class="participant-name"
                    >{getUserDisplayName(participantId)} (You)</span
                  >
                  <span class="admin-badge">Admin</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>

        <div class="form-group">
          <h4>Add New Participants</h4>
          {#if availableUsersForGroup.length > 0}
            <div class="available-users-list">
              {#each availableUsersForGroup as user}
                <div class="available-user-item">
                  <span class="user-name">{user.name}</span>
                  <button
                    class="add-user-btn"
                    onclick={() => addParticipantToGroup(user)}
                    aria-label="Add to group"
                    title="Add to group"
                  >
                    ➕
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-users-message">No additional users available to add</p>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" onclick={() => (showGroupEditForm = false)}>
          Cancel
        </button>
        <button
          class="update-btn"
          onclick={updateGroupDetails}
          disabled={!editGroupName.trim()}
        >
          Update Group
        </button>
      </div>
    </div>
  </div>
{/if}

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

  /* Default LTR Layout */
  .users-sidebar {
    width: 320px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    order: 1;
  }

  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    order: 2;
  }

  /* RTL Layout */
  .chat-container.rtl .users-sidebar {
    border-right: none;
    border-left: 1px solid #e2e8f0;
    order: 2;
  }

  .chat-container.rtl .chat-area {
    order: 1;
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

  .toggle-view-btn,
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

  .toggle-view-btn:hover,
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
  }

  /* Border styling for selected user */
  .user-item.selected {
    border-right: 3px solid #0ea5e9;
  }

  .chat-container.rtl .user-item.selected {
    border-right: none;
    border-left: 3px solid #0ea5e9;
  }

  .user-avatar {
    position: relative;
    margin-right: 0.75rem;
  }

  .chat-container.rtl .user-avatar {
    margin-right: 0;
    margin-left: 0.75rem;
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

  .chat-container.rtl .online-indicator {
    right: auto;
    left: 2px;
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

  .chat-user-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .chat-user-info {
    display: flex;
    align-items: center;
  }

  .chat-user-info > div:last-child {
    margin-left: 0.75rem;
  }

  .chat-container.rtl .chat-user-info > div:last-child {
    margin-left: 0;
    margin-right: 0.75rem;
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

  .loading-older-messages {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .loading-older-messages .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e2e8f0;
    border-radius: 50%;
    border-top-color: #64748b;
    animation: spin 1s ease-in-out infinite;
  }

  .message {
    display: flex;
    margin-bottom: 1rem;
  }

  /* Group Message Enhancements */
  .message.group-message {
    flex-direction: column;
    gap: 0.5rem;
  }

  .message.group-message.own {
    align-items: flex-end;
  }

  .message.group-message:not(.own) {
    align-items: flex-start;
  }

  .message-sender-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .sender-avatar.tiny {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .sender-avatar.tiny img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sender-avatar.tiny .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e2e8f0;
    color: #475569;
    font-size: 0.6rem;
    font-weight: 600;
  }

  .sender-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .message-sender {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    margin: 0;
  }

  .message-content.own-content {
    background: #3b82f6;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .message.group-message .message-timestamp {
    font-size: 0.625rem;
    color: #94a3b8;
    margin: 0;
  }

  .own-timestamp {
    align-self: flex-end;
    text-align: right;
    margin-top: 0.25rem;
  }

  /* RTL adjustments for group messages */
  .chat-container.rtl .message.group-message.own {
    align-items: flex-start;
  }

  .chat-container.rtl .message.group-message:not(.own) {
    align-items: flex-end;
  }

  .chat-container.rtl .message-sender-info {
    flex-direction: row-reverse;
  }

  .chat-container.rtl .sender-details {
    text-align: right;
  }

  .chat-container.rtl .own-timestamp {
    align-self: flex-start;
    text-align: left;
  }

  /* Default LTR message alignment */
  .message.own {
    justify-content: flex-end;
  }

  .message:not(.own) {
    justify-content: flex-start;
  }

  /* RTL message alignment */
  .chat-container.rtl .message.own {
    justify-content: flex-start;
  }

  .chat-container.rtl .message:not(.own) {
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

  /* RTL text direction for textarea in RTL mode */
  .chat-container.rtl .message-input textarea {
    direction: rtl;
    text-align: right;
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .attachment-btn,
  .voice-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
    font-size: 1.2rem;
  }

  .attachment-btn:hover:not(:disabled),
  .voice-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #1e293b;
  }

  .attachment-btn:disabled,
  .voice-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .voice-btn:hover:not(:disabled) {
    color: #ef4444;
  }

  /* Voice Recording Styles */
  .voice-recording-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 1rem;
    padding: 0.5rem 0.75rem;
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .recording-dot {
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulse-recording 1.5s ease-in-out infinite;
  }

  @keyframes pulse-recording {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }

  .recording-duration {
    font-size: 0.875rem;
    font-weight: 500;
    color: #ef4444;
    min-width: 40px;
    font-family: monospace;
  }

  .voice-control-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .voice-control-btn.cancel {
    color: #64748b;
  }

  .voice-control-btn.cancel:hover {
    background: #f1f5f9;
    color: #ef4444;
  }

  .voice-control-btn.stop {
    color: #ef4444;
  }

  .voice-control-btn.stop:hover {
    background: #fef2f2;
    color: #dc2626;
  }

  /* Attachment Preview Styles */
  .attachment-preview-container {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .attachment-preview-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: white;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
    border: 1px solid #e2e8f0;
  }

  .attachment-preview-item:last-child {
    margin-bottom: 0;
  }

  .preview-image {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 0.25rem;
  }

  .file-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: #f1f5f9;
    border-radius: 0.25rem;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .chat-container.rtl .file-info {
    text-align: right;
  }

  .file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 0.75rem;
    color: #64748b;
  }

  .remove-attachment-btn {
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }

  .remove-attachment-btn:hover {
    background: #dc2626;
  }

  /* Voice Message Styles */
  .voice-message-preview {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 0.5rem;
    max-width: 280px;
  }

  .voice-message-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: #e0f2fe;
    border-radius: 0.25rem;
    color: #0284c7;
  }

  .voice-message-info {
    flex: 1;
    min-width: 0;
  }

  .voice-message-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #0284c7;
    margin-bottom: 0.125rem;
  }

  .voice-audio-control {
    width: 200px;
    height: 30px;
  }

  .voice-audio-control::-webkit-media-controls-panel {
    background-color: transparent;
  }

  /* Message Attachments */
  .message-attachments {
    margin-top: 0.5rem;
  }

  .message-attachments :global(.attachments-container) {
    width: 100%;
    max-width: 100%;
  }

  .message-attachments :global(.attachment-card) {
    background: transparent;
    border: none;
    border-radius: 8px;
    box-shadow: none;
    margin-bottom: 0.5rem;
    max-width: 100%;
    overflow: hidden;
  }

  .message-attachments :global(.attachment-card:hover) {
    transform: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .message-attachments :global(.attachment-header) {
    display: none;
  }

  .message-attachments :global(.attachment-preview) {
    height: auto;
    min-height: auto;
    background: transparent;
    border-radius: 8px;
    overflow: hidden;
  }

  .message-attachments :global(.media-wrapper) {
    height: auto;
    max-height: 200px;
  }

  .message-attachments :global(.attachment-preview img) {
    width: 100%;
    height: auto;
    max-height: 200px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .message-attachments :global(.attachment-preview video) {
    width: 100%;
    height: auto;
    max-height: 200px;
    max-width: 280px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .message-attachments :global(.media-overlay) {
    border-radius: 8px;
  }

  .message-attachments :global(.attachment-info) {
    padding: 0.5rem 0 0 0;
    background: transparent;
  }

  .message-attachments :global(.attachment-name) {
    font-size: 0.75rem;
    color: currentColor;
    opacity: 0.8;
    margin-bottom: 0;
  }

  .message-attachments :global(.unsupported-file) {
    height: 80px;
    background: rgba(248, 250, 252, 0.5);
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .attachment-item {
    margin-bottom: 0.5rem;
  }

  .attachment-item:last-child {
    margin-bottom: 0;
  }

  .attachment-image {
    max-width: 200px;
    max-height: 200px;
    object-fit: cover;
    border-radius: 0.5rem;
    border: 1px solid #e2e8f0;
  }

  .attachment-file {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    max-width: 250px;
  }

  .chat-container.rtl .attachment-file {
    direction: rtl;
  }

  .file-icon-display {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 0.25rem;
  }

  .file-details {
    flex: 1;
    min-width: 0;
  }

  .chat-container.rtl .file-details {
    text-align: right;
  }

  .temp-attachment {
    opacity: 0.7;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff40;
    border-radius: 50%;
    border-top-color: #ffffff;
    animation: spin 1s ease-in-out infinite;
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

  /* Upload Status Styles */
  .upload-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #3b82f6;
    margin-bottom: 0.5rem;
  }

  .upload-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #3b82f640;
    border-radius: 50%;
    border-top-color: #3b82f6;
    animation: spin 1s ease-in-out infinite;
  }

  .upload-failed {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #ef4444;
    margin-bottom: 0.5rem;
  }

  .error-icon {
    font-size: 1rem;
  }

  .message.own .upload-status {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .message.own .upload-spinner {
    border-color: rgba(255, 255, 255, 0.3);
    border-top-color: white;
  }

  .message.own .upload-failed {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  /* Group Chat Styles */
  .chat-mode-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 1rem;
  }

  .tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.9rem;
    color: #6b7280;
    transition: all 0.2s ease;
  }

  .tab-btn.active {
    color: #3b82f6;
    border-bottom: 2px solid #3b82f6;
    background: #f8fafc;
  }

  .tab-btn:hover {
    background: #f1f5f9;
  }

  .groups-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .groups-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #1f2937;
  }

  .groups-header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .create-group-btn {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s ease;
  }

  .create-group-btn:hover {
    background: #2563eb;
  }

  .groups-list {
    padding: 1rem;
    overflow-y: auto;
    max-height: calc(100vh - 200px);
  }

  .group-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border: 2px solid transparent;
  }

  .group-item:hover {
    background: #f8fafc;
  }

  .group-item.selected {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .group-avatar {
    width: 40px;
    height: 40px;
    border-radius: 0.5rem;
    margin-right: 0.75rem;
    position: relative;
    overflow: hidden;
  }

  .group-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .group-avatar .avatar-placeholder.group {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
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

  .group-details {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .participant-count {
    margin-bottom: 0.125rem;
  }

  .group-description {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .admin-badge {
    background: #10b981;
    color: white;
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    margin-top: 0.25rem;
    display: inline-block;
  }

  .chat-group-header {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: white;
    justify-content: space-between;
  }

  .chat-group-info {
    display: flex;
    align-items: center;
  }

  .group-avatar.small {
    width: 32px;
    height: 32px;
    margin-right: 0.75rem;
  }

  .chat-group-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.125rem;
  }

  .chat-group-status {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .group-participants-preview {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.25rem;
    font-style: italic;
  }

  .message-sender {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .no-groups {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #6b7280;
  }

  .no-groups-message {
    text-align: center;
  }

  .no-groups-message p {
    margin-bottom: 1rem;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 0.75rem;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
    color: #1f2937;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem;
  }

  .close-btn:hover {
    color: #374151;
  }

  .modal-body {
    padding: 1.5rem;
    max-height: 50vh;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .participants-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 0.5rem;
  }

  .participant-item {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    margin-bottom: 0.25rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s ease;
  }

  .participant-item:hover {
    background: #f8fafc;
  }

  .participant-item input[type="checkbox"] {
    margin-right: 0.75rem;
    width: auto;
  }

  .participant-item label {
    display: flex;
    align-items: center;
    cursor: pointer;
    margin: 0;
  }

  .user-avatar.tiny {
    width: 24px;
    height: 24px;
    margin-right: 0.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .cancel-btn {
    padding: 0.75rem 1.5rem;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover {
    background: #f9fafb;
  }

  .create-btn {
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .create-btn:hover {
    background: #2563eb;
  }

  .create-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .users-sidebar {
      width: 280px;
    }

    .message-content {
      max-width: 85%;
    }

    .chat-content {
      flex-direction: column;
    }

    .users-sidebar {
      width: 100%;
      height: 40vh;
      order: 1;
    }

    .chat-area {
      order: 2;
      height: 60vh;
    }

    .chat-container.rtl .users-sidebar,
    .chat-container.rtl .chat-area {
      order: unset;
    }
  }

  /* Group Edit Styles */
  .group-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-group-btn {
    background: transparent;
    border: none;
    padding: 0.5rem;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }

  .edit-group-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .form-group h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .participants-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.5rem;
  }

  .participant-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .participant-item:hover {
    background: #f8fafc;
  }

  .participant-item.current-user {
    background: #eff6ff;
    border: 1px solid #dbeafe;
  }

  .participant-name {
    font-weight: 500;
    color: #374151;
  }

  .admin-badge {
    background: #10b981;
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .remove-participant-btn {
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .remove-participant-btn:hover {
    background: #dc2626;
  }

  .available-users-list {
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.5rem;
  }

  .available-user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .available-user-item:hover {
    background: #f8fafc;
  }

  .user-name {
    font-weight: 500;
    color: #374151;
  }

  .add-user-btn {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .add-user-btn:hover {
    background: #059669;
  }

  .no-users-message {
    color: #6b7280;
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  .update-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .update-btn:hover {
    background: #2563eb;
  }

  .update-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
</style>
