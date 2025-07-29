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
  let isMenuOpen = $state(false);
  let isRTL = $locale === "ar" || $locale === "ku";

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
    isMenuOpen = false;
  }

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  function closeMenu() {
    isMenuOpen = false;
  }

  function handleMenuItemClick(href: string) {
    $goto(href);
    closeMenu();
  }

  $effect(() => {
    renderNotificationIconColor();
  });

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest(".menu-container")) {
        closeMenu();
      }
    }

    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
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
      <div class="flex items-center space-x-3">
        {#if $user.signedin}
          <SearchBar />

          <!-- Menu Dropdown -->
          <div class="relative menu-container">
            <button
              onclick={toggleMenu}
              class="nav-icon-btn menu-trigger"
              aria-label="Menu"
              title="Menu"
              aria-expanded={isMenuOpen}
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {#if $newNotificationType}
                <span
                  class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse"
                ></span>
              {/if}
            </button>

            {#if isMenuOpen}
              <div
                class="dropdown-menu {isRTL
                  ? 'dropdown-menu-rtl'
                  : 'dropdown-menu-ltr'}"
              >
                <div class="dropdown-content">
                  {#if $roles.includes("super_admin")}
                    <div class="menu-section">
                      <div class="menu-section-title">{$_("admin")}</div>
                      <button
                        onclick={() => handleMenuItemClick("/dashboard/admin")}
                        class="menu-item"
                      >
                        <svg
                          class="menu-icon"
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
                        <span>{$_("dashboard")}</span>
                      </button>
                      <button
                        onclick={() =>
                          handleMenuItemClick(
                            "/dashboard/admin/contact-messages"
                          )}
                        class="menu-item"
                      >
                        <svg
                          class="menu-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        <span>{$_("contact_messages")}</span>
                      </button>
                      <button
                        onclick={() =>
                          handleMenuItemClick("/dashboard/permissions")}
                        class="menu-item"
                      >
                        <svg
                          class="menu-icon"
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
                        <span>{$_("permissions")}</span>
                      </button>
                      <button
                        onclick={() => handleMenuItemClick("/dashboard/roles")}
                        class="menu-item"
                      >
                        <svg
                          class="menu-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5.121 17.804A9 9 0 1112 21v-1a7 7 0 100-14v1m0 4a3 3 0 013 3 3 3 0 01-3 3 3 3 0 01-3-3 3 3 0 013-3z"
                          />
                        </svg>

                        <span>{$_("roles")}</span>
                      </button>
                      <button
                        onclick={() =>
                          handleMenuItemClick("/dashboard/admin/users")}
                        class="menu-item"
                      >
                        <svg
                          class="menu-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 17h5v-1a4 4 0 00-4-4h-1M9 17H4v-1a4 4 0 014-4h1m3-4a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>

                        <span>{$_("Users")}</span>
                      </button>
                    </div>
                    <div class="menu-divider"></div>
                  {/if}

                  <!-- Main Navigation -->
                  <div class="menu-section">
                    <button
                      onclick={() => handleMenuItemClick("/entries")}
                      class="menu-item"
                    >
                      <svg
                        class="menu-icon"
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
                      <span>{$_("entries")}</span>
                    </button>
                    <button
                      onclick={() => handleMenuItemClick("/notifications")}
                      class="menu-item"
                    >
                      <svg
                        class="menu-icon {renderNotificationIconColor()}"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                      <span>{$_("notifications")}</span>
                      {#if $newNotificationType}
                        <span class="notification-badge"></span>
                      {/if}
                    </button>
                    <button
                      onclick={() => handleMenuItemClick("/me")}
                      class="menu-item"
                    >
                      <svg
                        class="menu-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>{$_("my_profile")}</span>
                    </button>
                  </div>

                  <div class="menu-divider"></div>

                  <!-- Settings & Actions -->
                  <div class="menu-section">
                    <div class="menu-item language-item">
                      <svg
                        class="menu-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                        />
                      </svg>
                      <select
                        bind:value={$locale}
                        onchange={(e) =>
                          switchLocale((e.target as HTMLSelectElement).value)}
                        class="language-select-dropdown"
                      >
                        <option value="en">{$_("english")}</option>
                        <option value="ar">{$_("arabic")}</option>
                        <option value="ku">{$_("kurdish")}</option>
                      </select>
                    </div>
                    <button
                      onclick={handleLogout}
                      class="menu-item logout-item"
                    >
                      <svg
                        class="menu-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>{$_("sign_out")}</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Language selector for larger screens -->
          <div class="relative ml-2 hidden sm:block">
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

  .menu-trigger[aria-expanded="true"] {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
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

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    z-index: 50;
    min-width: 16rem;
    background: white;
    border: 1px solid rgba(229, 231, 235, 0.8);
    border-radius: 1rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(16px);
    animation: dropdown-enter 0.2s ease-out;
  }

  @keyframes dropdown-enter {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dropdown-content {
    padding: 0.75rem;
  }

  .menu-section {
    margin-bottom: 0.5rem;
  }

  .menu-section:last-child {
    margin-bottom: 0;
  }

  .menu-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.5rem 0.75rem 0.25rem;
    margin-bottom: 0.25rem;
  }

  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
    border: none;
    background: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
  }

  .menu-item:hover {
    background: rgba(243, 244, 246, 0.8);
    color: #111827;
  }

  .menu-icon {
    width: 1.25rem;
    height: 1.25rem;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .menu-item span {
    flex: 1;
  }

  .logout-item:hover {
    background: rgba(254, 242, 242, 0.8);
    color: #dc2626;
  }

  .logout-item:hover .menu-icon {
    color: #dc2626;
  }

  .language-item {
    padding: 0.5rem 0.75rem;
  }

  .language-select-dropdown {
    appearance: none;
    background: transparent;
    border: none;
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    outline: none;
    flex: 1;
    margin-left: 0.75rem;
  }

  .menu-divider {
    height: 1px;
    background: rgba(229, 231, 235, 0.6);
    margin: 0.5rem 0;
  }

  .notification-badge {
    width: 0.5rem;
    height: 0.5rem;
    background: #ef4444;
    border-radius: 50%;
    margin-left: auto;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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

    .dropdown-menu {
      min-width: 14rem;
      right: -1rem;
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

  .menu-item:focus {
    outline: none;
    background: rgba(59, 130, 246, 0.1);
    color: #1d4ed8;
  }
  .dropdown-menu-ltr {
    right: 0;
  }

  .dropdown-menu-rtl {
    left: 0;
  }
  @media (max-width: 640px) {
    .dropdown-menu-ltr {
      right: -1rem;
    }

    .dropdown-menu-rtl {
      left: -1rem;
    }
  }
</style>
