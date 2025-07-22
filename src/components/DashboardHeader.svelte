<script lang="ts">
  import SearchBar from "./SearchBar.svelte";
  import { onDestroy, onMount } from "svelte";
  import { website } from "@/config.js";
  import { newNotificationType } from "@/stores/newNotificationType";
  import { _ } from "@/i18n";
  import { locale, switchLocale } from "@/i18n";
  import { user, signout, roles } from "@/stores/user";
  import { goto } from "@roxi/routify";
  $goto;

  let ws = $state(null);

  onMount(() => {
    if ($user.signedin) {
      if (isWSOpen(ws)) {
        ws.send(JSON.stringify({ type: "notification_unsubscribe" }));
      }
      if ("websocket" in website) {
        try {
          const authToken = localStorage.getItem("authToken") || "";
          ws = new WebSocket(`${website.websocket}?token=${authToken}`);
        } catch (e) {
          console.error({ e });
        }
      }

      if (ws) {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "notification_subscription",
              space_name: "catalog",
              subpath: "__ALL__",
            })
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event?.data ?? "");
          if (data.type === "notification") {
            if (data?.message?.action_type === "create") {
              if (data?.message?.resource_type === "reaction") {
                $newNotificationType = "create_reaction";
              } else if (data?.message?.resource_type === "comment") {
                $newNotificationType = "create_comment";
              }
            } else if (data?.message?.action_type === "progress_ticket") {
              $newNotificationType = "progress";
            }
          }
        };
      }
    }
  });

  onDestroy(() => {
    if (ws != null) ws.close();
  });

  function isWSOpen(ws: any) {
    return ws != null && ws.readyState === ws.OPEN;
  }

  function renderNotificationIconColor() {
    switch ($newNotificationType) {
      case "create_comment":
        return "text-blue-500";
      case "create_reaction":
        return "text-red-500";
      case "progress":
        return "text-amber-500";
      default:
        return "text-gray-500";
    }
  }

  function handleLogin() {
    $goto("/login");
  }

  async function handleLogout() {
    await signout();
    $goto("/login");
  }

  $effect(() => {
    renderNotificationIconColor();
  });
</script>

<header
  class="sticky top-0 z-40 w-full border-b border-gray-200 bg-white backdrop-blur-md supports-[backdrop-filter]:bg-white/80"
>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <!-- Logo/Brand -->
      <div class="flex items-center">
        <a href="/home" class="flex items-center space-x-3 group">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105"
          >
            <svg
              class="h-6 w-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          </div>
          <span
            class="font-bold text-xl text-gray-900 sm:inline-block group-hover:text-blue-600 transition-colors duration-200"
            >{$_("Catalog")}</span
          >
        </a>
      </div>

      <!-- Navigation Items -->
      <div class="flex items-center space-x-2">
        {#if $user.signedin}
          <SearchBar />
          {#if $roles.includes("super_admin")}
            <a
              href="/dashboard/admin"
              class="nav-icon-btn"
              aria-label="Admin Dashboard"
              title="Admin Dashboard"
            >
              <svg
                class="nav-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z"
                />
              </svg>
            </a>
            <a
              href="/dashboard/admin/contact-messages"
              class="nav-icon-btn"
              aria-label="Contact Messages"
              title="Contact Messages"
            >
              <svg
                class="nav-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                ></path>
              </svg>
            </a>
            <a
              href="/dashboard/permissions"
              class="nav-icon-btn"
              aria-label="Permissions"
              title="Permissions"
            >
              <svg
                class="nav-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4"
                />
              </svg>
            </a>
          {/if}
          <a
            href="/entries"
            class="nav-icon-btn"
            aria-label="Entries"
            title="Entries"
          >
            <svg
              class="nav-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
          </a>
          <a
            href="/notifications"
            class="nav-icon-btn relative"
            aria-label="Notifications"
            title="Notifications"
          >
            <svg
              class="nav-icon {renderNotificationIconColor()}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              ></path>
            </svg>
            {#if $newNotificationType}
              <span
                class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse"
              ></span>
            {/if}
          </a>

          <a
            href="/me"
            class="nav-icon-btn"
            aria-label="Profile"
            title="My Profile"
          >
            <svg
              class="nav-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              ></path>
            </svg>
          </a>

          <button
            onclick={handleLogout}
            class="nav-icon-btn logout-btn"
            aria-label="Logout"
            title="Sign Out"
          >
            <svg
              class="nav-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              ></path>
            </svg>
          </button>

          <div class="relative ml-2">
            <select
              bind:value={$locale}
              onchange={(e) =>
                switchLocale((e.target as HTMLSelectElement).value)}
              class="language-select"
            >
              <option value="en">EN</option>
              <option value="ar">AR</option>
              <option value="ku">KU</option>
            </select>
          </div>
        {:else}
          <div class="flex items-center space-x-3">
            <div class="relative">
              <select
                bind:value={$locale}
                onchange={(e) =>
                  switchLocale((e.target as HTMLSelectElement).value)}
                class="language-select"
              >
                <option value="en">EN</option>
                <option value="ar">AR</option>
                <option value="ku">KU</option>
              </select>
            </div>

            <button onclick={handleLogin} class="login-btn">
              {$_("Login")}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>

<style>
  .nav-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.75rem;
    background: rgba(249, 250, 251, 0.8);
    border: 1px solid rgba(229, 231, 235, 0.6);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    backdrop-filter: blur(8px);
    cursor: pointer;
    text-decoration: none;
  }

  .nav-icon-btn:hover {
    background: rgba(243, 244, 246, 0.9);
    border-color: rgba(209, 213, 219, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .nav-icon-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .nav-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #6b7280;
    transition: color 0.2s ease;
  }

  .nav-icon-btn:hover .nav-icon {
    color: #374151;
  }

  .logout-btn:hover {
    background: rgba(254, 242, 242, 0.9);
    border-color: rgba(252, 165, 165, 0.6);
  }

  .logout-btn:hover .nav-icon {
    color: #dc2626;
  }

  .login-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px rgba(59, 130, 246, 0.25);
  }

  .login-btn:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
  }

  .login-btn:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .language-select {
    appearance: none;
    background: rgba(249, 250, 251, 0.8);
    border: 1px solid rgba(229, 231, 235, 0.6);
    border-radius: 0.75rem;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1rem 1rem;
    min-width: 4rem;
  }

  .language-select:hover {
    background-color: rgba(243, 244, 246, 0.9);
    border-color: rgba(209, 213, 219, 0.8);
  }

  .language-select:focus {
    outline: none;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.5);
    border-color: #3b82f6;
  }

  header {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  @media (max-width: 640px) {
    .nav-icon-btn {
      width: 2.5rem;
      height: 2.5rem;
    }

    .nav-icon {
      width: 1.125rem;
      height: 1.125rem;
    }

    .login-btn {
      padding: 0.625rem 1.25rem;
      font-size: 0.8rem;
    }

    .language-select {
      padding: 0.5rem 1.75rem 0.5rem 0.625rem;
      font-size: 0.8rem;
      min-width: 3.5rem;
    }
  }

  /* Animation for notification badge */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .nav-icon-btn:focus {
    outline: none;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.5);
    ring-offset: 2px;
  }

  .login-btn:focus {
    outline: none;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.5);
    ring-offset: 2px;
  }
</style>
