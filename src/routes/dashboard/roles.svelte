<script lang="ts">
  import { preventDefault } from "svelte/legacy";

  import MetaRoleForm from "@/components/forms/MetaRoleForm.svelte";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { onMount } from "svelte";
  import {
    getEntity,
    updateRole,
    createEntity,
    getSpaces,
    getSpaceContents,
    deleteEntity,
    createRole,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { derived } from "svelte/store";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let roleTypes = $state([]);
  let selectedRoleType = $state("");
  let formData = $state({});
  let validateFn = $state(() => true);
  let isLoading = $state(false);
  let isSaving = $state(false);
  let isLoadingRoles = $state(true);
  let lastSaved = $state(null);
  let spaces = $state([]);
  let roleExists = $state(false);
  let currentRoleShortname = $state("");
  let isDeleting = $state(false);
  let isCreating = $state(false);
  let showDeleteConfirm = $state(false);
  let showAddModal = $state(false);
  let newRoleName = $state("");

  async function loadRoleTypes() {
    isLoadingRoles = true;
    try {
      const rolesResponse = await getSpaceContents(
        "management",
        "roles",
        "managed"
      );

      if (rolesResponse.status === "success") {
        roleTypes = rolesResponse.records.map((role) => ({
          name: role?.attributes?.displayname?.en || role.shortname,
          value: role.shortname,
        }));

        if (roleTypes.length > 0 && !selectedRoleType) {
          selectedRoleType = roleTypes[0].value;
        }

        successToastMessage(`Loaded ${roleTypes.length} role types`);
      } else {
        errorToastMessage($_("failed_to_load_role_types"));
      }
    } catch (error) {
      console.error("Error loading role types:", error);
      errorToastMessage($_("failed_to_load_role_types"));
    } finally {
      isLoadingRoles = false;
    }
  }

  async function loadSpaces() {
    try {
      const spacesResponse = await getSpaces();
      spaces = spacesResponse.records || [];
    } catch (error) {
      console.error("Error loading spaces:", error);
      errorToastMessage($_("failed_to_load_spaces"));
    }
  }

  async function loadRoleData(roleType) {
    if (!roleType) return;

    isLoading = true;
    try {
      const roleEntity = await getEntity(
        roleType,
        "management",
        "roles",
        ResourceType.role,
        "managed",
        true,
        false
      );

      if (roleEntity) {
        roleExists = true;
        currentRoleShortname = roleEntity.shortname;

        formData = {
          permissions: roleEntity.permissions || [],
        };

        successToastMessage(`Loaded ${roleType} role`);
      } else {
        roleExists = false;
        currentRoleShortname = "";
        successToastMessage(
          `No existing ${roleType} role found. Using defaults.`
        );
      }
    } catch (error) {
      console.error("Error loading role data:", error);
      errorToastMessage($_("failed_to_load_role_data"));
    } finally {
      isLoading = false;
    }
  }

  async function saveRole() {
    if (!validateFn()) {
      errorToastMessage($_("fix_validation_errors"));
      return;
    }

    isSaving = true;
    try {
      let result;
      result = await updateRole(
        currentRoleShortname,
        "management",
        "roles",
        ResourceType.role,
        formData,
        "",
        ""
      );

      if (result) {
        lastSaved = new Date().toLocaleTimeString();
        successToastMessage(`${selectedRoleType} role saved successfully`);
      } else {
        throw new Error("Failed to save role");
      }
    } catch (error) {
      console.error("Error saving role:", error);
      errorToastMessage($_("failed_to_save_role"));
    } finally {
      isSaving = false;
    }
  }

  async function createNewRole() {
    if (!newRoleName.trim()) {
      errorToastMessage($_("enter_role_name"));
      return;
    }

    isCreating = true;
    try {
      const roleData = {
        title: newRoleName,
        content: `Role configuration for ${newRoleName}`,
        is_active: true,
        tags: [],
      };

      const result = await createRole(
        roleData,
        "management",
        "roles",
        ResourceType.role,
        "",
        ""
      );

      if (result) {
        successToastMessage(`Role "${newRoleName}" created successfully`);
        showAddModal = false;
        newRoleName = "";
        await loadRoleTypes();
        selectedRoleType = result;
      } else {
        throw new Error("Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      errorToastMessage($_("failed_to_create_role"));
    } finally {
      isCreating = false;
    }
  }

  async function deleteRole() {
    if (!currentRoleShortname) {
      errorToastMessage($_("no_role_selected"));
      return;
    }

    isDeleting = true;
    try {
      const result = await deleteEntity(
        currentRoleShortname,
        "management",
        "roles",
        ResourceType.role
      );

      if (result) {
        successToastMessage(`Role "${selectedRoleType}" deleted successfully`);
        showDeleteConfirm = false;
        await loadRoleTypes();

        if (roleTypes.length > 0) {
          selectedRoleType = roleTypes[0].value;
        } else {
          selectedRoleType = "";
          roleExists = false;
          currentRoleShortname = "";
          formData = {};
        }
      } else {
        throw new Error("Failed to delete role");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      errorToastMessage($_("failed_to_delete_role"));
    } finally {
      isDeleting = false;
    }
  }

  onMount(async () => {
    await loadSpaces();
    await loadRoleTypes();
  });

  $effect(() => {
    if (selectedRoleType && !isLoadingRoles) {
      loadRoleData(selectedRoleType);
    }
  });
</script>

<div class="container" class:rtl={$isRTL}>
  <div class="page-header">
    <h1 class="page-title">{$_("role_management")}</h1>
    <p class="page-subtitle">
      {$_("configure_roles_and_permissions")}
    </p>
  </div>

  <div class="card">
    <div class="card-header">
      <h2 class="card-title">{$_("select_role_type")}</h2>
      <div class="header-actions">
        <button class="btn btn-success" onclick={() => (showAddModal = true)}>
          <span>+</span>
          {$_("add_role")}
        </button>
        {#if roleExists}
          <button
            class="btn btn-danger"
            onclick={() => (showDeleteConfirm = true)}
            disabled={isDeleting}
          >
            {#if isDeleting}
              <div class="spinner-small"></div>
            {:else}
              <span>🗑</span>
            {/if}
            {$_("delete")}
          </button>
        {/if}
      </div>
    </div>

    {#if isLoadingRoles}
      <div class="loading-card">
        <div class="spinner"></div>
        <span>{$_("loading_role_types")}</span>
      </div>
    {:else if roleTypes.length === 0}
      <div class="alert alert-warning">
        <div class="alert-icon">⚠</div>
        <div>
          <strong>{$_("no_roles_found")}:</strong>
          No role types are available in the management/roles space.
        </div>
      </div>
    {:else}
      <div class="grid grid-cols-2">
        <div>
          <select class="form-select" bind:value={selectedRoleType}>
            {#each roleTypes as type}
              <option value={type.value}>{type.name}</option>
            {/each}
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          {#if lastSaved}
            <div class="status-indicator status-success">
              <span>✓</span>
              <span>Last saved: {lastSaved}</span>
            </div>
          {/if}
          {#if roleExists}
            <div class="status-indicator status-info">
              <span>ℹ</span>
              <span>{$_("existing_role")}</span>
            </div>
          {:else}
            <div class="status-indicator status-warning">
              <span>⚠</span>
              <span>{$_("new_role")}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if !isLoadingRoles && roleTypes.length > 0}
    <div class="alert alert-info">
      <div class="alert-icon">ℹ</div>
      <div>
        <strong>{$_("role_info")}:</strong>
        {#if selectedRoleType === "super_admin"}
          Super Admin has full system access and can manage all aspects of the
          platform.
        {:else if selectedRoleType === "admin"}
          Admin has administrative access to manage content and users.
        {:else if selectedRoleType === "moderator"}
          Moderator can review and moderate content but has limited
          administrative access.
        {:else if selectedRoleType === "catalog_user"}
          Catalog User can view and create content within the catalog system.
        {:else if selectedRoleType === "guest"}
          Guest has read-only access to public content.
        {:else}
          Configure the permissions and settings for {selectedRoleType} role.
        {/if}
      </div>
    </div>

    {#if isLoading}
      <div class="card">
        <div class="loading-card">
          <div class="spinner"></div>
          <span>{$_("loading_role_data")}</span>
        </div>
      </div>
    {:else}
      <MetaRoleForm bind:formData bind:validateFn />

      <div class="card">
        <div class="action-bar">
          <div class="action-buttons">
            <button
              class="btn btn-primary"
              onclick={preventDefault((e) => {
                saveRole();
              })}
              disabled={isSaving}
            >
              {#if isSaving}
                <div
                  class="spinner"
                  style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"
                ></div>
                {$_("saving")}
              {:else}
                {roleExists ? $_("update") : $_("create")} {$_("role")}
              {/if}
            </button>
          </div>

          <div class="meta-info">
            <div><strong>{$_("role_type")}:</strong> {selectedRoleType}</div>
            {#if currentRoleShortname}
              <div>
                <strong>ID:</strong>
                <span class="meta-code">{currentRoleShortname}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if showAddModal}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-role-modal-title"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Escape") showAddModal = false;
    }}
  >
    <div
      class="modal"
      role="document"
      tabindex="-1"
      onkeydown={(e) => {
        if (e.key === "Escape") showAddModal = false;
      }}
    >
      <div class="modal-header">
        <h3 id="add-role-modal-title">{$_("add_new_role")}</h3>
        <button
          class="modal-close"
          aria-label={$_("close")}
          onclick={() => (showAddModal = false)}
          onkeydown={(e) => {
            if (e.key === "Enter") showAddModal = false;
          }}
        >
          ×
        </button>
      </div>
      <div class="modal-body">
        <label class="form-label" for="new-role-name">{$_("role_name")}</label>
        <input
          type="text"
          class="form-input"
          id="new-role-name"
          bind:value={newRoleName}
          placeholder={$_("enter_role_name")}
          onkeydown={(e) => {
            if (e.key === "Enter") createNewRole();
          }}
        />
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={() => (showAddModal = false)}
          onkeydown={(e) => {
            if (e.key === "Enter") showAddModal = false;
          }}
        >
          {$_("cancel")}
        </button>
        <button
          class="btn btn-primary"
          onclick={preventDefault((e) => {
            createNewRole();
          })}
          disabled={isCreating || !newRoleName.trim()}
          onkeydown={(e) => {
            if (e.key === "Enter") createNewRole();
          }}
        >
          {#if isCreating}
            <div class="spinner-small"></div>
            {$_("creating")}
          {:else}
            {$_("create_role")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteConfirm}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-role-modal-title"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Escape") showDeleteConfirm = false;
    }}
  >
    <div
      class="modal"
      role="document"
      tabindex="-1"
      onkeydown={(e) => {
        if (e.key === "Escape") showDeleteConfirm = false;
      }}
    >
      <div class="modal-header">
        <h3 id="delete-role-modal-title">{$_("delete_role")}</h3>
        <button
          class="modal-close"
          aria-label={$_("close")}
          onclick={() => (showDeleteConfirm = false)}
          onkeydown={(e) => {
            if (e.key === "Enter") showDeleteConfirm = false;
          }}
        >
          ×
        </button>
      </div>
      <div class="modal-body">
        <p>
          {$_("are_you_sure_delete_role")}
          <strong>"{selectedRoleType}"</strong>?
        </p>
        <p class="text-danger">{$_("action_cannot_be_undone")}</p>
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={() => (showDeleteConfirm = false)}
          onkeydown={(e) => {
            if (e.key === "Enter") showDeleteConfirm = false;
          }}
        >
          {$_("cancel")}
        </button>
        <button
          class="btn btn-danger"
          onclick={preventDefault((e) => {
            deleteRole();
          })}
          disabled={isDeleting}
          onkeydown={(e) => {
            if (e.key === "Enter") deleteRole();
          }}
        >
          {#if isDeleting}
            <div class="spinner-small"></div>
            {$_("deleting")}
          {:else}
            {$_("delete_role")}
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

  .container {
    max-width: 1200px;
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
    margin-bottom: 16px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .card-title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .form-select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .grid {
    display: grid;
    gap: 16px;
  }

  .grid-cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    .grid-cols-2 {
      grid-template-columns: 1fr;
    }
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .status-success {
    color: #059669;
  }

  .status-warning {
    color: #d97706;
  }

  .status-info {
    color: #2563eb;
  }

  .alert {
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .alert-info {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
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

  .loading-card {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px;
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

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f4f6;
    border-top: 2px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
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

  .btn {
    padding: 12px 24px;
    border-radius: 8px;
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

  .btn-success {
    background: #10b981;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #059669;
    transform: translateY(-1px);
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .meta-info {
    font-size: 14px;
    color: #6b7280;
  }

  .meta-info strong {
    color: #374151;
  }

  .meta-code {
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 12px;
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .spaces-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .space-item {
    background: #f9fafb;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .space-name {
    font-weight: 600;
    color: #111827;
    font-size: 14px;
  }

  .space-display {
    color: #6b7280;
    font-size: 12px;
    margin-top: 4px;
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

  .modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 24px 0;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }

  .modal-header h3 {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-body {
    padding: 0 24px 24px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px 24px;
    border-top: 1px solid #e5e7eb;
  }

  .form-label {
    display: block;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .form-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .text-danger {
    color: #dc2626;
    font-size: 14px;
    margin-top: 8px;
  }
</style>
