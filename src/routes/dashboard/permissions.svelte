<script lang="ts">
  import { run } from "svelte/legacy";
  import { Modal } from "flowbite-svelte";

  import MetaPermissionForm from "@/components/forms/MetaPermissionForm.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { onMount } from "svelte";
  import {
    createPermission,
    deleteEntity,
    getEntity,
    getSpaceContents,
    getSpaces,
    updatePermission,
  } from "@/lib/dmart_services/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
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
        "managed",
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
          `Loaded ${permissionTypes.length} permission types`,
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
        false,
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
          `No existing ${permissionType} permissions found. Using defaults.`,
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
        "",
      );

      if (result) {
        lastSaved = new Date().toLocaleTimeString();
        successToastMessage(
          `${selectedPermissionType} permissions saved successfully`,
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
        "",
      );

      if (result) {
        successToastMessage(
          `Permission "${newPermissionName}" created successfully`,
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
        ResourceType.permission,
      );

      if (result) {
        successToastMessage(
          `Permission "${selectedPermissionType}" deleted successfully`,
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
  <div class="page-header text-center mb-8">
    <h1 class="page-title text-3xl font-bold text-gray-900 mb-2">
      {$_("user_permissions_management")}
    </h1>
    <p class="page-subtitle text-gray-500">
      {$_("configure_access_permissions")}
    </p>
  </div>

  <div class="card mb-6">
    <div class="card-header flex justify-between items-center mb-4">
      <h2 class="card-title text-xl font-semibold m-0">
        {$_("select_permission_type")}
      </h2>
      <div class="header-actions flex gap-3">
        <button
          aria-label={`Add permission`}
          class="btn btn-primary"
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
              <svg
                class="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                ></path></svg
              >
            {/if}
            {$_("delete")}
          </button>
        {/if}
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="select-wrapper relative">
        <select
          class="form-select bg-gray-50 border-0 rounded-lg w-full"
          bind:value={selectedPermissionType}
        >
          {#each permissionTypes as type}
            <option value={type.value}>{type.name}</option>
          {/each}
        </select>
        <svg
          class="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          ></path></svg
        >
      </div>

      <div class="flex items-center gap-4 mt-2">
        {#if permissionExists}
          <div
            class="status-indicator status-info flex items-center gap-1 text-sm text-blue-500"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path></svg
            >
            <span>{$_("existing_configuration")}</span>
          </div>
        {:else}
          <div
            class="status-indicator status-warning flex items-center gap-1 text-sm text-amber-500"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path></svg
            >
            <span>{$_("new_configuration")}</span>
          </div>
        {/if}
        {#if lastSaved}
          <div
            class="status-indicator status-success flex items-center gap-1 text-sm text-green-500 ml-auto"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path></svg
            >
            <span>Last saved: {lastSaved}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div
    class="alert alert-info bg-blue-50 text-blue-500 border-0 rounded-xl mb-6 flex items-start p-4 gap-3 w-full"
  >
    <svg
      class="w-5 h-5 flex-shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      ><path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      ></path></svg
    >
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
    <div class="card bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
      <div class="loading-card flex items-center justify-center p-16">
        <div class="spinner mr-3"></div>
        <span class="text-gray-500">{$_("loading_permission_data")}</span>
      </div>
    </div>
  {:else}
    <div
      class="card bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-6"
    >
      <MetaPermissionForm bind:formData bind:validateFn />
    </div>

    <!-- Actions (Bottom) -->
    <div class="action-bar flex justify-between items-center mt-8">
      <button
        aria-label={`Save permissions`}
        class="btn btn-primary bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-6 py-3"
        onclick={savePermissions}
        disabled={isSaving}
      >
        {#if isSaving}
          <div class="spinner w-4 h-4 border-2 mr-2"></div>
        {/if}
        {permissionExists ? $_("update") : $_("create")}
        {$_("permission")}
      </button>

      <div class="meta-info text-sm text-gray-400 text-right">
        <div>
          Permission Type: <span class="font-mono bg-transparent"
            >{selectedPermissionType}</span
          >
        </div>
        {#if currentPermissionShortname}
          <div>
            ID: <span class="font-mono bg-transparent"
              >{currentPermissionShortname}</span
            >
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Add Permission Modal -->
<Modal
  title={$_("add_new_permission")}
  bind:open={showAddModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <label class="form-label" for="permissionName">{$_("permission_name")}</label>
  <input
    type="text"
    class="form-input"
    bind:value={newPermissionName}
    placeholder={$_("enter_permission_name")}
    id="permissionName"
  />
  {#snippet footer()}
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
  {/snippet}
</Modal>

<!-- Delete Confirmation Modal -->
<Modal
  title={$_("delete_permission")}
  bind:open={showDeleteConfirm}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <p>
    {$_("are_you_sure_delete_permission")}
    <strong>"{selectedPermissionType}"</strong>?
  </p>
  <p class="text-danger">{$_("action_cannot_be_undone")}</p>
  {#snippet footer()}
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
  {/snippet}
</Modal>

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

  /* Modal Styles removed - now using flowbite Modal */

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
