<script lang="ts">
    import {onMount} from "svelte";
    import {getAllUsers, getSpaceContents, updateUserRoles,} from "@/lib/dmart_services";
    import {errorToastMessage, successToastMessage,} from "@/lib/toasts_messages";
    import {_, locale} from "@/i18n";
    import {formatNumber} from "@/lib/helpers";
    import {derived} from "svelte/store";
    import {user} from "@/stores/user";

    const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let users = $state([]);
  let availableRoles = $state([]);
  let isLoading = $state(true);
  let isUpdating = $state(false);
  let selectedUser = $state(null);
  let showRoleModal = $state(false);
  let selectedRoles = $state([]);
  let searchTerm = $state("");
  let filteredUsers = $state([]);
  let selectedRoleFilter = $state("");

  async function loadUsers() {
    try {
      const usersResponse = await getAllUsers();

      if (usersResponse.status === "success") {
        users = usersResponse.records.map((user) => ({
          shortname: user.shortname,
          displayname: user.attributes?.displayname?.en || user.shortname,
          email: user.attributes?.email || "N/A",
          roles: user.attributes?.roles || [],
          is_active: user.attributes?.is_active ?? true,
          created_at: user.attributes?.created_at || "N/A",
        }));
        updateFilteredUsers();
      } else {
        errorToastMessage($_("failed_to_load_users"));
      }
    } catch (error) {
      console.error("Error loading users:", error);
      errorToastMessage($_("failed_to_load_users"));
    }
  }

  async function loadRoles() {
    try {
      const rolesResponse = await getSpaceContents(
        "management",
        "roles",
        "managed"
      );

      if (rolesResponse.status === "success") {
        availableRoles = rolesResponse.records.map((role) => ({
          shortname: role.shortname,
          displayname: role.attributes?.displayname?.en || role.shortname,
          description:
            role.attributes?.description?.en || `Role: ${role.shortname}`,
        }));
      } else {
        errorToastMessage($_("failed_to_load_roles"));
      }
    } catch (error) {
      console.error("Error loading roles:", error);
      errorToastMessage($_("failed_to_load_roles"));
    }
  }

  function updateFilteredUsers() {
    let filtered = users;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.shortname.toLowerCase().includes(term) ||
          user.displayname.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          user.roles.some((role) => role.toLowerCase().includes(term))
      );
    }

    if (selectedRoleFilter) {
      filtered = filtered.filter((user) =>
        user.roles.includes(selectedRoleFilter)
      );
    }

    filteredUsers = filtered;
  }

  function openRoleModal(user) {
    selectedUser = user;
    selectedRoles = [...user.roles];
    showRoleModal = true;
  }

  function closeRoleModal() {
    selectedUser = null;
    selectedRoles = [];
    showRoleModal = false;
  }

  function toggleRole(roleShortname) {
    const index = selectedRoles.indexOf(roleShortname);
    if (index > -1) {
      selectedRoles = selectedRoles.filter((r) => r !== roleShortname);
    } else {
      selectedRoles = [...selectedRoles, roleShortname];
    }
  }

  async function saveUserRoles() {
    if (!selectedUser) return;

    isUpdating = true;
    try {
      const success = await updateUserRoles(
        selectedUser.shortname,
        selectedRoles
      );
      if (success) {
        const userIndex = users.findIndex(
          (u) => u.shortname === selectedUser.shortname
        );
        if (userIndex > -1) {
          users[userIndex].roles = [...selectedRoles];

          updateFilteredUsers();
        }

        successToastMessage(`Updated roles for ${selectedUser.displayname}`);
        closeRoleModal();
      } else {
        errorToastMessage($_("failed_to_update_user_roles"));
      }
    } catch (error) {
      console.error("Error updating user roles:", error);
      errorToastMessage($_("failed_to_update_user_roles"));
    } finally {
      isUpdating = false;
    }
  }

  function getRoleDisplayName(roleShortname) {
    const role = availableRoles.find((r) => r.shortname === roleShortname);
    return role ? role.displayname : roleShortname;
  }
  $effect(() => {
    updateFilteredUsers();
  });

  onMount(async () => {
    isLoading = true;
    await Promise.all([loadUsers(), loadRoles()]);
    isLoading = false;
  });
</script>

<div class="container" class:rtl={$isRTL}>
  <div class="page-header">
    <h1 class="page-title">{$_("user_management")}</h1>
    <p class="page-subtitle">{$_("manage_users_and_roles")}</p>
  </div>

  <div class="card">
    <div class="card-header">
      <h2 class="card-title">{$_("users_overview")}</h2>
      <div class="filters-container">
        <div class="search-container">
          <label for="search-input" class="visually-hidden"></label>
          <input
            type="text"
            class="search-input"
            placeholder={$_("search_users")}
            bind:value={searchTerm}
            oninput={updateFilteredUsers}
          />
        </div>
        <div class="role-filter-container">
          <select
            class="role-filter-select"
            bind:value={selectedRoleFilter}
            onchange={updateFilteredUsers}
          >
            <option value="">{$_("all_roles")}</option>
            {#each availableRoles as role}
              <option value={role.shortname}>{role.displayname}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>{$_("loading_users")}</span>
      </div>
    {:else if filteredUsers.length === 0}
      <div class="empty-state">
        {#if searchTerm || selectedRoleFilter}
          <p>{$_("no_users_match_filters")}</p>
          {#if searchTerm}
            <p class="filter-info">Search: "{searchTerm}"</p>
          {/if}
          {#if selectedRoleFilter}
            <p class="filter-info">
              Role: {getRoleDisplayName(selectedRoleFilter)}
            </p>
          {/if}
        {:else}
          <p>{$_("no_users_found")}</p>
        {/if}
      </div>
    {:else}
      <div class="users-table">
        <div class="table-header">
          <div class="header-cell">{$_("user")}</div>
          <div class="header-cell">{$_("email")}</div>
          <div class="header-cell">{$_("roles")}</div>
          <div class="header-cell">{$_("status")}</div>
          <div class="header-cell">{$_("actions")}</div>
        </div>

        {#each filteredUsers as user}
          <div class="table-row">
            <div class="cell user-cell">
              <div class="user-info">
                <div class="user-name">{user.displayname}</div>
                <div class="user-shortname">@{user.shortname}</div>
              </div>
            </div>

            <div class="cell email-cell">
              {user.email}
            </div>

            <div class="cell roles-cell">
              {#if user.roles.length > 0}
                <div class="roles-list">
                  {#each user.roles as role}
                    <span class="role-badge">{getRoleDisplayName(role)}</span>
                  {/each}
                </div>
              {:else}
                <span class="no-roles">{$_("no_roles_assigned")}</span>
              {/if}
            </div>

            <div class="cell status-cell">
              <span
                class="status-badge"
                class:active={user.is_active}
                class:inactive={!user.is_active}
              >
                {user.is_active ? $_("active") : $_("inactive")}
              </span>
            </div>

            <div class="cell actions-cell">
              <button
                class="btn btn-small btn-primary"
                aria-label={$_("manage_roles")}
                onkeydown={(e) => {
                  if (e.key === "Enter") openRoleModal(user);
                }}
                onclick={() => openRoleModal(user)}
              >
                {$_("manage_roles")}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="stats-card">
    <h3 class="card-title">{$_("statistics")}</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(users.length, $locale)}
        </div>
        <div class="stat-label">{$_("total_users")}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(users.filter((u) => u.is_active).length, $locale)}
        </div>
        <div class="stat-label">{$_("active_users")}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(availableRoles.length, $locale)}
        </div>
        <div class="stat-label">{$_("available_roles")}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(
            users.filter((u) => u.roles.length === 0).length,
            $locale
          )}
        </div>
        <div class="stat-label">{$_("users_without_roles")}</div>
      </div>
    </div>
  </div>
</div>

{#if showRoleModal && selectedUser}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === "Escape") closeRoleModal();
    }}
    onclick={closeRoleModal}
  >
    <div
      class="modal"
      tabindex="0"
      onkeydown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 id="modal-title">
          {$_("manageRolesFor")}
          {selectedUser.displayname}
        </h3>
        <button
          class="close-btn"
          aria-label={$_("close")}
          onkeydown={(e) => {
            if (e.key === "Enter") closeRoleModal();
          }}
          onclick={closeRoleModal}>×</button
        >
      </div>

      <div class="modal-body">
        <p class="modal-description">
          {$_("selectRolesToAssignDescription")}
        </p>

        {#if availableRoles.length === 0}
          <div class="alert alert-warning">
            <div class="alert-icon">⚠</div>
            <div>{$_("noRolesAvailable")}</div>
          </div>
        {:else}
          <div class="roles-selection">
            {#each availableRoles as role}
              <label class="role-option">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.shortname)}
                  onchange={() => toggleRole(role.shortname)}
                />
                <div class="role-content">
                  <div class="role-name">{role.displayname}</div>
                  <div class="role-description">{role.description}</div>
                </div>
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onkeydown={(e) => {
            if (e.key === "Enter") closeRoleModal();
          }}
          onclick={closeRoleModal}
          disabled={isUpdating}
        >
          {$_("cancel")}
        </button>
        <button
          class="btn btn-primary"
          onkeydown={(e) => {
            if (e.key === "Enter") saveUserRoles();
          }}
          onclick={saveUserRoles}
          disabled={isUpdating || availableRoles.length === 0}
        >
          {#if isUpdating}
            <div class="spinner small"></div>
            {$_("saving")}
          {:else}
            {$_("saveChanges")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .rtl {
    direction: rtl;
  }
  .filters-container {
    display: flex;
    gap: 16px;
    flex: 1;
    max-width: 600px;
    justify-content: flex-end;
  }

  .role-filter-container {
    min-width: 200px;
  }

  .role-filter-select {
    width: 100%;
    padding: 10px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .role-filter-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }

  .page-header {
    margin-bottom: 32px;
  }

  .page-title {
    font-size: 32px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 8px;
  }

  .page-subtitle {
    color: #6b7280;
    font-size: 16px;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 24px;
    margin-bottom: 24px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .card-title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .search-container {
    flex: 1;
    max-width: 300px;
  }

  .search-input {
    width: 100%;
    padding: 10px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px;
    color: #6b7280;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 12px;
  }

  .spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
    margin-right: 8px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 64px;
    color: #6b7280;
  }

  .users-table {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 2fr 2fr 2fr 1fr 1fr;
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
  }

  .table-row {
    display: grid;
    grid-template-columns: 2fr 2fr 2fr 1fr 1fr;
    background: white;
    transition: background-color 0.2s ease;
  }

  .table-row:hover {
    background: #f9fafb;
  }

  .header-cell,
  .cell {
    padding: 16px;
    display: flex;
    align-items: center;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .user-name {
    font-weight: 600;
    color: #111827;
  }

  .user-shortname {
    font-size: 12px;
    color: #6b7280;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
  }

  .roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .role-badge {
    background: #dbeafe;
    color: #1e40af;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .no-roles {
    color: #9ca3af;
    font-style: italic;
    font-size: 14px;
  }

  .status-badge {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.active {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.inactive {
    background: #fef2f2;
    color: #dc2626;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .stats-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 24px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 24px;
    margin-top: 16px;
  }

  .stat-item {
    text-align: center;
  }

  .stat-number {
    font-size: 32px;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 4px;
  }

  .stat-label {
    color: #6b7280;
    font-size: 14px;
  }

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
    padding: 20px;
  }

  .modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 24px 0 24px;
    margin-bottom: 16px;
  }

  .modal-header h3 {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-body {
    padding: 0 24px 24px 24px;
  }

  .modal-description {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .alert {
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .alert-warning {
    background: #fffbeb;
    border: 1px solid #fed7aa;
    color: #92400e;
  }

  .alert-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .roles-selection {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .role-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .role-option:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .role-option:has(:global(input:checked)) {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .role-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    accent-color: #3b82f6;
  }

  .role-content {
    flex: 1;
  }

  .role-name {
    font-weight: 600;
    color: #111827;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .role-description {
    color: #6b7280;
    font-size: 13px;
    line-height: 1.4;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 24px;
    border-top: 1px solid #e5e7eb;
  }

  @media (max-width: 768px) {
    .filters-container {
      flex-direction: column;
      max-width: none;
    }

    .role-filter-container {
      min-width: auto;
    }
    .table-header,
    .table-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .header-cell,
    .cell {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .header-cell:last-child,
    .cell:last-child {
      border-bottom: none;
    }

    .card-header {
      flex-direction: column;
      align-items: stretch;
    }

    .search-container {
      max-width: none;
    }
  }
</style>
