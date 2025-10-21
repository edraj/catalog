<script lang="ts">
  import {
    deleteAllNotification,
    fetchMyNotifications,
    getAvatar,
    getEntity,
    markNotification,
  } from "@/lib/dmart_services";
  import { user } from "@/stores/user";
  import { onMount, onDestroy } from "svelte";
  import { formatDate, truncateString } from "@/lib/helpers";
  import Avatar from "@/components/Avatar.svelte";
  import { SyncLoader } from "svelte-loading-spinners";
  import { newNotificationType } from "@/stores/newNotificationType";
  import { ResourceType } from "@edraj/tsdmart";
  import { _ } from "@/i18n";
  import { goto } from "@roxi/routify";
  import { website } from "@/config";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";

  $goto;

  let notifications = $state([]);
  let isNotificationsLoading = $state(false);
  let ws = $state(null);
  let connectionStatus = $state("Disconnected");
  let notificationError = $state(null);

  let showReportModal = $state(false);
  let selectedReportNotification = $state(null);

  onMount(async () => {
    $newNotificationType = "";
    await loadNotifications();
    connectWebSocket();
  });

  onDestroy(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  function connectWebSocket() {
    if (!$user.signedin || !website.websocket) {
      return;
    }

    try {
      connectionStatus = "Connecting...";
      const authToken = localStorage.getItem("authToken") || "";
      ws = new WebSocket(`${website.websocket}?token=${authToken}`);

      ws.onopen = () => {
        connectionStatus = "Connected";
        ws.send(
          JSON.stringify({
            type: "notification_subscription",
            space_name: "Report",
            subpath: "/reports",
          })
        );

        ws.send(
          JSON.stringify({
            type: "notification_subscription",
            space_name: "personal",
            subpath: `people/${$user.shortname}/notifications`,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          errorToastMessage("Failed to parse notification");
        }
      };

      ws.onclose = () => {
        connectionStatus = "Disconnected";
        setTimeout(() => {
          if (connectionStatus === "Disconnected") {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        connectionStatus = "Error";
        errorToastMessage("WebSocket connection error");
      };
    } catch (error) {
      connectionStatus = "Error";
      errorToastMessage("Failed to connect to notifications");
    }
  }

  function handleWebSocketMessage(data) {
    if (data.type === "connection_response") {
      return;
    }

    if (data.type === "notification" && data.message) {
      const message = data.message;

      if (
        (message.action_type === "create" ||
          message.action_type === "update") &&
        (message.resource_type === "comment" ||
          message.resource_type === "reaction" ||
          message.resource_type === "ticket")
      ) {
        $newNotificationType = `create_${message.resource_type}`;
        loadNotifications(true);
      }
      return;
    }

    if (data.type === "notification_subscription" && data.message) {
      const message = data.message;

      if (
        (message.action_type === "create" ||
          message.action_type === "update") &&
        (message.space === "Report" || message.space === "catalog")
      ) {
        $newNotificationType = message.action_type;
        loadNotifications(true);
      }
      return;
    }
  }

  async function loadNotifications(force: boolean = false) {
    isNotificationsLoading = true;
    notificationError = null;

    try {
      let _notifications = await fetchMyNotifications($user.shortname);

      const __notifications = await Promise.all(
        _notifications.map(async (n) => {
          try {
            const {
              action_by,
              entry_shortname,
              entry_subpath,
              entry_space,
              resource_type,
              is_read,
            } = n.attributes.payload.body;

            const resourceTypeString = (function () {
              switch (resource_type) {
                case "ticket":
                  return "new updates";
                case "reaction":
                  return "reacted";
                case "comment":
                  return "New comment";
                default:
                  return "notification";
              }
            })();

            let _notification: any = {
              shortname: n.shortname,
              created_at: formatDate(n.attributes.created_at),
              action_by,
              entry_shortname,
              entry_subpath,
              entry_space,
              resource_type,
              resourceTypeString: resourceTypeString,
              is_read,
              title: "Notification",
              body: "",
            };

            if (
              [ResourceType.comment, ResourceType.reaction].includes(
                resource_type
              ) &&
              n.attributes.relationships?.length > 0
            ) {
              const relationshipData = n.attributes.relationships[0].related_to;
              _notification.parent_shortname = relationshipData.shortname;
              _notification.parent_space_name = relationshipData.space_name;
              _notification.parent_subpath = relationshipData.subpath;

              try {
                let entity = await getEntity(
                  resource_type === ResourceType.ticket
                    ? entry_shortname
                    : _notification.parent_shortname,
                  _notification.parent_space_name,
                  _notification.parent_subpath,
                  resource_type === ResourceType.ticket
                    ? ResourceType.content
                    : ResourceType.ticket,
                  "public"
                );

                if (entity) {
                  _notification.title = entity.payload?.body?.title || "Post";

                  if (_notification.resource_type === ResourceType.comment) {
                    const attachments = entity.attachments as {
                      comment?: any[];
                    };
                    const commentAttachment = (attachments.comment ?? []).find(
                      (c) =>
                        c.shortname ===
                        n.attributes.payload.body.entry_shortname
                    );
                    if (commentAttachment) {
                      _notification.body =
                        commentAttachment.attributes.payload.body.body;
                    }
                  }
                }
              } catch (entityError) {
                _notification.title = "Content";
              }
            }

            return _notification;
          } catch (notificationError) {
            return {
              shortname: n.shortname,
              created_at: formatDate(n.attributes.created_at),
              action_by: n.attributes.payload.body.action_by || "Unknown",
              resource_type:
                n.attributes.payload.body.resource_type || "unknown",
              resourceTypeString: "notification",
              is_read: n.attributes.payload.body.is_read || "no",
              title: "Notification",
              body: "",
            };
          }
        })
      );

      if (notifications.length === 0 || force) {
        notifications = __notifications;
      } else {
        const newNotifications = __notifications.filter((__notification) => {
          return !notifications.some(
            (notification) =>
              __notification.shortname === notification.shortname
          );
        });

        const removedNotifications = notifications.filter((notification) => {
          return !__notifications.some(
            (__notification) =>
              __notification.shortname === notification.shortname
          );
        });

        notifications = notifications.filter((notification) => {
          return !removedNotifications.some(
            (removedNotification) =>
              removedNotification.shortname === notification.shortname
          );
        });

        notifications = [...newNotifications, ...notifications];
      }
    } catch (error) {
      errorToastMessage("Failed to load notifications");
    }

    isNotificationsLoading = false;
  }

  async function handleNotificationClick(notification) {
    try {
      await markNotification($user.shortname, notification.shortname);

      if (
        notification.resource_type === ResourceType.ticket ||
        notification.resource_type === "ticket"
      ) {
        selectedReportNotification = notification;
        showReportModal = true;
        return;
      }

      if (
        notification.parent_shortname &&
        notification.parent_space_name &&
        notification.parent_subpath
      ) {
        $goto(
          "/dashboard/admin/[space_name]/[subpath]/[shortname]/[resource_type]",
          {
            space_name: notification.parent_space_name,
            subpath: notification.parent_subpath.startsWith("/")
              ? notification.parent_subpath.substring(1)
              : notification.parent_subpath,
            shortname: notification.parent_shortname,
            resource_type: "content",
          }
        );
      } else if (notification.entry_shortname && notification.entry_subpath) {
        $goto(
          "/dashboard/admin/[space_name]/[subpath]/[shortname]/[resource_type]",
          {
            space_name: notification.entry_space || "catalog",
            subpath: notification.entry_subpath.startsWith("/")
              ? notification.entry_subpath.substring(1)
              : notification.entry_subpath,
            shortname: notification.entry_shortname,
            resource_type: "content",
          }
        );
      } else {
        $goto("/dashboard/admin");
      }
    } catch (error) {
      errorToastMessage("Failed to open notification");
    }
  }

  $effect(() => {
    if ($newNotificationType) {
      loadNotifications(true).then((_) => {
        $newNotificationType = "";
      });
    }
  });

  async function handleReadAll() {
    try {
      await Promise.all(
        notifications.map(async (notification) => {
          if (notification.is_read !== "yes") {
            await markNotification($user.shortname, notification.shortname);
          }
        })
      );
      await loadNotifications(true);
      successToastMessage("All notifications marked as read");
    } catch (error) {
      errorToastMessage("Failed to mark all as read");
    }
  }

  async function handleUnReadAll() {
    try {
      await Promise.all(
        notifications.map(async (notification) => {
          if (notification.is_read === "yes") {
            await markNotification(
              $user.shortname,
              notification.shortname,
              false
            );
          }
        })
      );
      await loadNotifications(true);
      successToastMessage("All notifications marked as unread");
    } catch (error) {
      errorToastMessage("Failed to mark all as unread");
    }
  }

  async function handleDeleteAll() {
    try {
      const shortnames = notifications.map((n) => n.shortname);
      await deleteAllNotification($user.shortname, shortnames);
      await loadNotifications(true);
      successToastMessage("All notifications deleted");
    } catch (error) {
      errorToastMessage("Failed to delete all notifications");
    }
  }

  async function handleRefresh() {
    await loadNotifications(true);
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
    >
      <div>
        <h1 class="text-3xl font-bold text-gray-900">
          {$_("Notifications")}
        </h1>
        <p class="text-gray-600 mt-1">
          {$_("NotificationsMsg")}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <!-- Connection Status Indicator -->
        <div class="flex items-center gap-2 text-xs">
          <div class="flex items-center gap-1">
            <div
              class="w-2 h-2 rounded-full {connectionStatus === 'Connected'
                ? 'bg-green-500'
                : connectionStatus === 'Connecting...'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'}"
            ></div>
            <span class="text-gray-600">{connectionStatus}</span>
          </div>
        </div>

        <button
          onclick={handleRefresh}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200"
          aria-label="Refresh notifications"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            x="0px"
            y="0px"
            class="w-4 h-4"
            stroke="currentColor"
            viewBox="0 0 32 32"
          >
            <path
              d="M 16 4 C 10.886719 4 6.617188 7.160156 4.875 11.625 L 6.71875 12.375 C 8.175781 8.640625 11.710938 6 16 6 C 19.242188 6 22.132813 7.589844 23.9375 10 L 20 10 L 20 12 L 27 12 L 27 5 L 25 5 L 25 8.09375 C 22.808594 5.582031 19.570313 4 16 4 Z M 25.28125 19.625 C 23.824219 23.359375 20.289063 26 16 26 C 12.722656 26 9.84375 24.386719 8.03125 22 L 12 22 L 12 20 L 5 20 L 5 27 L 7 27 L 7 23.90625 C 9.1875 26.386719 12.394531 28 16 28 C 21.113281 28 25.382813 24.839844 27.125 20.375 Z"
            ></path>
          </svg>
          <span class="hidden sm:inline">
            {$_("Refresh")}
          </span>
        </button>
        <button
          onclick={handleReadAll}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200"
          aria-label="Mark all as read"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            ></path>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            ></path>
          </svg>
          <span class="hidden sm:inline">
            {$_("ReadAll")}
          </span>
        </button>

        <button
          onclick={handleUnReadAll}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
          aria-label="Mark all as unread"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
            ></path>
          </svg>
          <span class="hidden sm:inline">{$_("UnReadAll")}</span>
        </button>

        <button
          onclick={handleDeleteAll}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200"
          aria-label="Delete all notifications"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            ></path>
          </svg>
          <span class="hidden sm:inline">
            {$_("DeleteAll")}
          </span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    {#if notificationError}
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-start gap-3">
          <svg
            class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            ></path>
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800">Error</p>
            <p class="text-sm text-red-700">{notificationError}</p>
          </div>
          <button
            onclick={() => (notificationError = null)}
            class="text-red-400 hover:text-red-600"
            aria-label="Close error message"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    {#if isNotificationsLoading}
      <div class="flex justify-center py-16">
        <SyncLoader color="#3b82f6" size="50" unit="px" />
      </div>
    {/if}

    {#if !isNotificationsLoading && notifications.length === 0}
      <div class="text-center py-16">
        <div
          class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 17h5l-1.405-12.142A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          {$_("NoNotifications")}
        </h3>
        <p class="text-gray-600">
          {$_("NoNotificationsMsg")}
        </p>
      </div>
    {/if}

    <div class="space-y-4">
      {#each notifications as notification}
        <div
          class="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer {notification.is_read ===
          'yes'
            ? ''
            : 'ring-2 ring-blue-100 border-blue-200'}"
          role="button"
          tabindex="0"
          onclick={(e) => handleNotificationClick(notification)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleNotificationClick(notification);
            }
          }}
        >
          <div class="p-6">
            <div class="flex gap-4">
              <div class="flex-shrink-0">
                {#await getAvatar(notification.action_by) then avatar}
                  <Avatar src={avatar} size="48" />
                {:catch error}
                  <Avatar src={null} size="48" />
                {/await}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="font-semibold text-gray-900 truncate">
                        {notification.action_by}
                      </h3>
                      {#if notification.is_read !== "yes"}
                        <span
                          class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"
                        ></span>
                      {/if}
                    </div>

                    <h4 class="font-medium text-gray-800 mb-2 line-clamp-2">
                      {notification.title || "Notification"}
                    </h4>

                    <div class="text-gray-600 mb-3">
                      {#if notification.resource_type === ResourceType.reaction}
                        <p>
                          Has <span class="font-medium text-red-600"
                            >{notification.resourceTypeString}</span
                          > to your post
                        </p>
                      {:else if notification.resource_type === ResourceType.ticket || notification.resource_type === "ticket"}
                        <p>
                          Has <span class="font-medium text-blue-600"
                            >{notification.resourceTypeString}</span
                          > for your entity
                        </p>
                      {:else if notification.resource_type === ResourceType.comment}
                        <p>
                          <span class="font-medium text-green-600"
                            >{notification.resourceTypeString}</span
                          >: {notification.body
                            ? truncateString(notification.body)
                            : "New comment"}
                        </p>
                      {:else}
                        <p>
                          <span class="font-medium text-gray-600"
                            >{notification.resourceTypeString}</span
                          >
                        </p>
                      {/if}
                    </div>

                    <p class="text-sm text-gray-500">
                      {notification.created_at}
                    </p>
                  </div>

                  <div class="flex-shrink-0">
                    {#if notification.resource_type === ResourceType.reaction}
                      <div
                        class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"
                      >
                        <svg
                          class="w-4 h-4 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                          />
                        </svg>
                      </div>
                    {:else if notification.resource_type === ResourceType.comment}
                      <div
                        class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"
                      >
                        <svg
                          class="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                          />
                        </svg>
                      </div>
                    {:else}
                      <div
                        class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center"
                      >
                        <svg
                          class="w-4 h-4 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
