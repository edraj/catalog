<script lang="ts">
  import MetaPermissionForm from "@/components/forms/MetaPermissionForm.svelte";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { onMount } from "svelte";
  import {
    getEntity,
    updateEntity,
    createEntity,
    getSpaces,
    updatePermission,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";

  const permissionTypes = [
    { name: "World (Guest Access)", value: "world" },
    { name: "Catalog User", value: "catalog_user_view" },
    { name: "Catalog User Create", value: "catalog_user_create" },
    { name: "Catalog User Edit/Delete", value: "catalog_user_update_delete" },
  ];

  let selectedPermissionType = $state("world");
  let formData = $state({});
  let validateFn = $state(() => true);
  let isLoading = $state(false);
  let isSaving = $state(false);
  let lastSaved = $state(null);
  let spaces = $state([]);
  let permissionExists = $state(false);
  let currentPermissionShortname = $state("");

  async function loadSpaces() {
    try {
      const spacesResponse = await getSpaces();
      spaces = spacesResponse.records || [];
    } catch (error) {
      console.error("Error loading spaces:", error);
      errorToastMessage("Failed to load spaces");
    }
  }

  async function loadPermissionData(permissionType) {
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
      console.log("Loaded permission entity:", permissionEntity);

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
      errorToastMessage("Failed to load permission data");
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
      if (permissionExists && currentPermissionShortname) {
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
      }
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
      errorToastMessage("Failed to save permissions");
    } finally {
      isSaving = false;
    }
  }

  onMount(async () => {
    await loadSpaces();
    await loadPermissionData(selectedPermissionType);
  });

  $effect(() => {
    if (selectedPermissionType) {
      loadPermissionData(selectedPermissionType);
    }
  });
</script>

<div class="container">
  <div class="page-header">
    <h1 class="page-title">User Permissions Management</h1>
    <p class="page-subtitle">
      Configure access permissions for different user types
    </p>
  </div>

  <div class="card">
    <h2 class="card-title">Select Permission Type</h2>
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
            <span>Existing configuration</span>
          </div>
        {:else}
          <div class="status-indicator status-warning">
            <span>⚠</span>
            <span>New configuration</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="alert alert-info">
    <div class="alert-icon">ℹ</div>
    <div>
      <strong>Permission Info:</strong>
      {#if selectedPermissionType === "world"}
        World permissions apply to all guests and unauthenticated users. These
        are the most restrictive permissions.
      {:else if selectedPermissionType === "catalog_user"}
        Catalog User permissions apply to authenticated users with catalog
        access. These users can interact with content.
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="card">
      <div class="loading-card">
        <div class="spinner"></div>
        <span>Loading permission data...</span>
      </div>
    </div>
  {:else}
    <MetaPermissionForm bind:formData bind:validateFn />

    <div class="card">
      <div class="action-bar">
        <div class="action-buttons">
          <button
            class="btn btn-primary"
            onclick={savePermissions}
            disabled={isSaving}
          >
            {#if isSaving}
              <div
                class="spinner"
                style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"
              ></div>
              Saving...
            {:else}
              {permissionExists ? "Update" : "Create"} Permissions
            {/if}
          </button>
        </div>

        <div class="meta-info">
          <div><strong>Permission Type:</strong> {selectedPermissionType}</div>
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

  {#if spaces.length > 0}
    <div class="card">
      <h3 class="card-title">Available Spaces</h3>
      <div class="spaces-grid">
        {#each spaces as space}
          <div class="space-item">
            <div class="space-name">{space.shortname}</div>
            {#if space.attributes?.displayname?.en}
              <div class="space-display">{space.attributes.displayname.en}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
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

  .card-title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 16px;
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
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
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

  .reference-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }

  .reference-item h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 12px;
    font-size: 16px;
  }

  .reference-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .reference-list li {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 8px;
    padding-left: 16px;
    position: relative;
  }

  .reference-list li::before {
    content: "•";
    color: #3b82f6;
    position: absolute;
    left: 0;
  }
</style>
