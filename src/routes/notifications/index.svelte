<script lang="ts">
  import {
    deleteAllNotification,
    deleteNotification,
    fetchMyNotifications,
    getAvatar,
    getEntity,
    markNotification,
  } from "@/lib/dmart_services";
  import { user } from "@/stores/user";
  import { onMount } from "svelte";
  import { formatDate, truncateString } from "@/lib/helpers";
  import Avatar from "@/components/Avatar.svelte";
  import { SyncLoader } from "svelte-loading-spinners";
  import { newNotificationType } from "@/stores/newNotificationType";
  import { ResourceType } from "@edraj/tsdmart";
  import { _ } from "@/i18n";
  import { goto } from "@roxi/routify";
  $goto;

  let notifications = $state([]);
  let isNotificationsLoading = $state(false);

  onMount(async () => {
    $newNotificationType = "";
    await loadNotifications();
  });

  async function loadNotifications(force: boolean = false) {
    isNotificationsLoading = true;
    let _notifications = await fetchMyNotifications($user.shortname);

    const __notifications = await Promise.all(
      _notifications.map(async (n) => {
        const {
          action_by,
          entry_shortname,
          entry_subpath,
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
          }
        })();

        let _notification: any = {
          shortname: n.shortname,
          created_at: formatDate(n.attributes.created_at),
          action_by,
          entry_shortname,
          entry_subpath,
          resource_type,
          resourceTypeString: resourceTypeString,
          is_read,
        };

        if (
          [ResourceType.comment, ResourceType.reaction].includes(
            _notification.resource_type
          ) &&
          n.attributes.relationships.length
        ) {
          const parent_shortname =
            n.attributes.relationships[0].related_to.shortname;
          _notification.parent_shortname = parent_shortname;
          let entity = await getEntity(
            resource_type === ResourceType.ticket
              ? entry_shortname
              : parent_shortname
          );
          if (entity) {
            _notification.title = entity.payload.body.title;
            if (_notification.resource_type === ResourceType.comment) {
              const attachments = entity.attachments as { comment?: any[] };
              const r = (attachments.comment ?? []).filter((c) => {
                return (
                  c.shortname === n.attributes.payload.body.entry_shortname
                );
              });
              if (r.length) {
                _notification.body = r[0].attributes.payload.body.body;
              }
            }
          }
        }

        return _notification;
      })
    );

    if (notifications.length === 0 || force) {
      notifications = __notifications;
    } else {
      const newNotifications = __notifications.filter((__notification) => {
        return !notifications.some(
          (notification) => __notification.shortname === notification.shortname
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

      notifications = [...notifications, ...newNotifications];
    }

    isNotificationsLoading = false;
  }

  async function handleNotificationClick(notification) {
    await markNotification($user.shortname, notification.shortname);
    $goto("/dashboard/[shortname]", {
      shortname: notification.parent_shortname,
    });
  }

  $effect(() => {
    if ($newNotificationType) {
      loadNotifications().then((_) => {
        $newNotificationType = "";
      });
    }
  });

  async function handleReadAll() {
    await Promise.all(
      notifications.map(async (notification) => {
        await markNotification($user.shortname, notification.shortname);
      })
    );
    await loadNotifications(true);
  }

  async function handleUnReadAll() {
    await Promise.all(
      notifications.map(async (notification) => {
        await markNotification($user.shortname, notification.shortname, false);
      })
    );
    await loadNotifications(true);
  }

  async function handleDeleteAll() {
    await Promise.all(
      notifications.map(async (notification) => {
        await deleteAllNotification(notification.shortname);
      })
    );
    await loadNotifications(true);
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
        <button
          onclick={handleRefresh}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200"
          aria-label="Mark all as read"
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
            {$_("ReadAll")}
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
                      {notification.title}
                    </h4>

                    <div class="text-gray-600 mb-3">
                      {#if notification.resource_type === ResourceType.reaction}
                        <p>
                          Has <span class="font-medium text-red-600"
                            >{notification.resourceTypeString}</span
                          > to your post
                        </p>
                      {:else if notification.resource_type === ResourceType.ticket}
                        <p>
                          Has <span class="font-medium text-blue-600"
                            >{notification.resourceTypeString}</span
                          > for your entity
                        </p>
                      {:else if notification.resource_type === ResourceType.comment}
                        <p>
                          <span class="font-medium text-green-600"
                            >{notification.resourceTypeString}</span
                          >: {truncateString(notification.body)}
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
