<script lang="ts">
  import { run } from "svelte/legacy";

  import MetaPermissionForm from "@/components/forms/MetaPermissionForm.svelte";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { onMount } from "svelte";
  import {
    getEntity,
    getSpaces,
    updatePermission,
    getSpaceContents,
    deleteEntity,
    createPermission,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { derived } from "svelte/store";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let formData = $state({});
  let validateFn = $state(() => true);
  let isLoading = $state(false);
  let isSaving = $state(false);
  let lastSaved = $state(null);
  let spaces = $state([]);
  let permissionExists = $state(false);
  let currentPermissionShortname = $state("");
  let permissionTypes = $state([]);
  let selectedPermissionType = $state("");
  let isLoadingPermissions = $state(true);
  let isDeleting = $state(false);
  let isCreating = $state(false);
  let showDeleteConfirm = $state(false);
  let showAddModal = $state(false);
  let newPermissionName = $state("");

  async function loadPermissionTypes() {
    isLoadingPermissions = true;
    try {
      const permissionsResponse = await getSpaceContents(
        "management",
        "permissions",
        "managed"
      );
      if (permissionsResponse.status === "success") {
        permissionTypes = permissionsResponse.records.map((permission) => ({
          name: permission.attributes.displayname?.en || permission.shortname,
          value: permission.shortname,
        }));

        if (permissionTypes.length > 0 && !selectedPermissionType) {
          selectedPermissionType = permissionTypes[0].value;
        }

        successToastMessage(
          `Loaded ${permissionTypes.length} permission types`
        );
      } else {
        errorToastMessage($_("failed_to_load_permission_types"));
      }
    } catch (error) {
      console.error("Error loading permission types:", error);
      errorToastMessage($_("failed_to_load_permission_types"));
    } finally {
      isLoadingPermissions = false;
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

  async function loadPermissionData(permissionType) {
    if (!permissionType) return;
    isLoading = true;
    try {
      const permissionEntity = await getEntity(
        permissionType,
        "management",
        "permissions",
        ResourceType.permission,
        "managed",
        true,
        false
      );

      if (permissionEntity) {
        const permission = permissionEntity;
        permissionExists = true;
        currentPermissionShortname = permission.shortname;

        formData = {
          resource_types: permissionEntity?.resource_types || [],
          actions: permissionEntity?.actions || [],
          subpaths: permissionEntity?.subpaths || {},
          conditions: permissionEntity?.conditions || [],
          restricted_fields: permissionEntity?.restricted_fields || [],
          allowed_fields_values: permissionEntity?.allowed_fields_values || {},
        };

        successToastMessage(`Loaded ${permissionType} permissions`);
      } else {
        permissionExists = false;
        currentPermissionShortname = "";
        successToastMessage(
          `No existing ${permissionType} permissions found. Using defaults.`
        );
      }
    } catch (error) {
      console.error("Error loading permission data:", error);
      errorToastMessage($_("failed_to_load_permission_data"));
    } finally {
      isLoading = false;
    }
  }

  async function savePermissions() {
    isSaving = true;
    try {
      const payload = {
        shortname: currentPermissionShortname,
        tags: ["permission", selectedPermissionType],
        subpaths: formData.subpaths || {},
        resource_types: formData.resource_types || [],
        actions: formData.actions || [],
        conditions: formData.conditions || [],
        restricted_fields: formData.restricted_fields || [],
        allowed_fields_values: formData.allowed_fields_values || {},
      };

      let result;
      const updatePayload = {
        tags: payload.tags,
        subpaths: payload.subpaths,
        resource_types: payload.resource_types,
        actions: payload.actions,
        conditions: payload.conditions,
        restricted_fields: payload.restricted_fields,
        allowed_fields_values: payload.allowed_fields_values,
      };

      result = await updatePermission(
        currentPermissionShortname,
        "management",
        "permissions",
        ResourceType.permission,
        updatePayload,
        "",
        ""
      );

      if (result) {
        lastSaved = new Date().toLocaleTimeString();
        successToastMessage(
          `${selectedPermissionType} permissions saved successfully`
        );
      } else {
        throw new Error("Failed to save permissions");
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      errorToastMessage($_("failed_to_save_permissions"));
    } finally {
      isSaving = false;
    }
  }
  async function createNewPermission() {
    if (!newPermissionName.trim()) {
      errorToastMessage($_("enter_permission_name"));
      return;
    }

    isCreating = true;
    try {
      const permissionData = {
        shortname: newPermissionName,
        tags: ["permission"],
        subpaths: {},
        resource_types: [],
        actions: [],
        conditions: [],
        restricted_fields: [],
        allowed_fields_values: {},
      };

      const result = await createPermission(
        permissionData,
        "management",
        "permissions",
        ResourceType.permission,
        "",
        ""
      );

      if (result) {
        successToastMessage(
          `Permission "${newPermissionName}" created successfully`
        );
        showAddModal = false;
        newPermissionName = "";
        await loadPermissionTypes();
        selectedPermissionType = result;
      } else {
        throw new Error("Failed to create permission");
      }
    } catch (error) {
      console.error("Error creating permission:", error);
      errorToastMessage($_("failed_to_create_permission"));
    } finally {
      isCreating = false;
    }
  }

  async function deletePermission() {
    if (!currentPermissionShortname) {
      errorToastMessage($_("no_permission_selected"));
      return;
    }

    isDeleting = true;
    try {
      const result = await deleteEntity(
        currentPermissionShortname,
        "management",
        "permissions",
        ResourceType.permission
      );

      if (result) {
        successToastMessage(
          `Permission "${selectedPermissionType}" deleted successfully`
        );
        showDeleteConfirm = false;
        await loadPermissionTypes();

        if (permissionTypes.length > 0) {
          selectedPermissionType = permissionTypes[0].value;
        } else {
          selectedPermissionType = "";
          permissionExists = false;
          currentPermissionShortname = "";
          formData = {};
        }
      } else {
        throw new Error("Failed to delete permission");
      }
    } catch (error) {
      console.error("Error deleting permission:", error);
      errorToastMessage($_("failed_to_delete_permission"));
    } finally {
      isDeleting = false;
    }
  }

  onMount(async () => {
    await loadSpaces();
    await loadPermissionTypes();
  });

  run(() => {
    if (selectedPermissionType && !isLoadingPermissions) {
      loadPermissionData(selectedPermissionType);
    }
  });
</script>

<div class="container" class:rtl={$isRTL}>
  <div class="page-header">
    <h1 class="page-title">{$_("user_permissions_management")}</h1>
    <p class="page-subtitle">
      {$_("configure_access_permissions")}
    </p>
  </div>

  <div class="card">
    <div class="card-header">
      <h2 class="card-title">{$_("select_permission_type")}</h2>
      <div class="header-actions">
        <button
          aria-label={`Add permission`}
          class="btn btn-success"
          onclick={() => (showAddModal = true)}
        >
          <span>+</span>
          {$_("add_permission")}
        </button>
        {#if permissionExists}
          <button
            aria-label={`Delete permission ${selectedPermissionType}`}
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

    <div class="grid grid-cols-2">
      <div>
        <select class="form-select" bind:value={selectedPermissionType}>
          {#each permissionTypes as type}
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
        {#if permissionExists}
          <div class="status-indicator status-info">
            <span>ℹ</span>
            <span>{$_("existing_configuration")}</span>
          </div>
        {:else}
          <div class="status-indicator status-warning">
            <span>⚠</span>
            <span>{$_("new_configuration")}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="alert alert-info">
    <div class="alert-icon">ℹ</div>
    <div>
      <strong>{$_("permission_info")}:</strong>
      {#if selectedPermissionType === "world"}
        {$_("world_permissions_info")}
      {:else if selectedPermissionType === "catalog_user"}
        {$_("catalog_user_permissions_info")}
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="card">
      <div class="loading-card">
        <div class="spinner"></div>
        <span>{$_("loading_permission_data")}</span>
      </div>
    </div>
  {:else}
    <MetaPermissionForm bind:formData bind:validateFn />

    <div class="card">
      <div class="action-bar">
        <div class="action-buttons">
          <button
            aria-label={`Save permissions`}
            class="btn btn-primary"
            onclick={savePermissions}
            disabled={isSaving}
          >
            {#if isSaving}
              <div
                class="spinner"
                style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"
              ></div>
              {$_("saving")}
            {:else}
              {permissionExists ? $_("update") : $_("create")}
              {$_("permission")}
            {/if}
          </button>
        </div>

        <div class="meta-info">
          <div>
            <strong>{$_("permission_type")}:</strong>
            {selectedPermissionType}
          </div>
          {#if currentPermissionShortname}
            <div>
              <strong>ID:</strong>
              <span class="meta-code">{currentPermissionShortname}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Add Permission Modal -->
{#if showAddModal}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    onkeydown={(e) => {
      if (e.key === "Escape") showAddModal = false;
    }}
  >
    <div class="modal" role="document">
      <div class="modal-header">
        <h3>{$_("add_new_permission")}</h3>
        <button
          class="modal-close"
          onclick={() => (showAddModal = false)}
          aria-label={$_("close")}
        >
          ×
        </button>
      </div>
      <div class="modal-body">
        <label class="form-label" for="permissionName"
          >{$_("permission_name")}</label
        >
        <input
          type="text"
          class="form-input"
          bind:value={newPermissionName}
          placeholder={$_("enter_permission_name")}
          id="permissionName"
        />
      </div>
      <div class="modal-footer">
        <button
          aria-label={`Cancel adding permission`}
          class="btn btn-secondary"
          onclick={() => (showAddModal = false)}
        >
          {$_("cancel")}
        </button>
        <button
          aria-label={`Create new permission`}
          class="btn btn-primary"
          onclick={createNewPermission}
          disabled={isCreating || !newPermissionName.trim()}
        >
          {#if isCreating}
            <div class="spinner-small"></div>
            {$_("creating")}
          {:else}
            {$_("create_permission")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    onkeydown={(e) => {
      if (e.key === "Escape") showDeleteConfirm = false;
    }}
  >
    <div class="modal" role="document">
      <div class="modal-header">
        <h3>{$_("delete_permission")}</h3>
        <button
          class="modal-close"
          onclick={() => (showDeleteConfirm = false)}
          aria-label={$_("close")}
        >
          ×
        </button>
      </div>
      <div class="modal-body">
        <p>
          {$_("are_you_sure_delete_permission")}
          <strong>"{selectedPermissionType}"</strong>?
        </p>
        <p class="text-danger">{$_("action_cannot_be_undone")}</p>
      </div>
      <div class="modal-footer">
        <button
          aria-label={`Cancel deleting permission`}
          class="btn btn-secondary"
          onclick={() => (showDeleteConfirm = false)}
        >
          {$_("cancel")}
        </button>
        <button
          aria-label={`Delete permission ${selectedPermissionType}`}
          class="btn btn-danger"
          onclick={deletePermission}
          disabled={isDeleting}
        >
          {#if isDeleting}
            <div class="spinner-small"></div>
            {$_("deleting")}
          {:else}
            {$_("delete_permission")}
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
