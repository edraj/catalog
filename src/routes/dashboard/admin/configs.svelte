<script lang="ts">
  import { onMount } from "svelte";
  import {
    getEntity,
    getSpaceContents,
    setDefaultUserRole,
    createEntity,
  } from "@/lib/dmart_services";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { ResourceType } from "@edraj/tsdmart";

  let availableRoles = $state([]);
  let selectedDefaultRole = $state("");
  let currentDefaultRole = $state("");
  let isLoading = $state(true);
  let isSaving = $state(false);

  let showAutoFixModal = $state(false);
  let isAutoFixing = $state(false);

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
        errorToastMessage("Failed to load available roles");
      }
    } catch (error) {
      console.error("Error loading roles:", error);
      errorToastMessage("Failed to load roles");
    }
  }

  async function loadCurrentDefaultRole() {
    try {
      const defaultRole = await getEntity(
        "web_config",
        "applications",
        "public",
        ResourceType.content,
        "managed",
        true,
        false
      );

      if (defaultRole) {
        currentDefaultRole = defaultRole.payload.body.items.find(
          (item) => item.key === "default_user_role"
        )?.value;
        selectedDefaultRole =
          defaultRole.payload.body.items.find(
            (item) => item.key === "default_user_role"
          )?.value || "";
      } else {
        if (availableRoles.length > 0) {
          selectedDefaultRole = availableRoles[0].shortname;
        }
      }
    } catch (error) {
      if (
        error.code === 220 ||
        error.message?.includes("Cannot read properties of undefined")
      ) {
        showAutoFixModal = true;
        return;
      }

      errorToastMessage("Failed to load current default role");
    }
  }

  async function autoFixConfiguration() {
    isAutoFixing = true;
    try {
      const result = await createEntity(
        {
          shortname: "web_config",
          body: {
            items: [
              {
                key: "default_user_role",
              },
            ],
          },
        },
        "applications",
        "public",
        ResourceType.content,
        "",
        "configuration"
      );

      if (result) {
        showAutoFixModal = false;
        successToastMessage("Configuration entity created successfully");

        await loadCurrentDefaultRole();
      } else {
        errorToastMessage("Failed to create configuration entity");
      }
    } catch (error) {
      console.error("Error creating configuration entity:", error);
      errorToastMessage("Failed to create configuration entity");
    } finally {
      isAutoFixing = false;
    }
  }

  async function saveDefaultRole() {
    if (!selectedDefaultRole) {
      errorToastMessage("Please select a default role");
      return;
    }

    isSaving = true;
    try {
      const success = await setDefaultUserRole(selectedDefaultRole);
      if (success) {
        currentDefaultRole = selectedDefaultRole;

        successToastMessage("Default user role updated successfully");
      } else {
        errorToastMessage("Failed to save default user role");
      }
    } catch (error) {
      console.error("Error saving default role:", error);
      errorToastMessage("Failed to save default user role");
    } finally {
      isSaving = false;
    }
  }

  onMount(async () => {
    isLoading = true;
    await loadRoles();
    await loadCurrentDefaultRole();
    isLoading = false;
  });
</script>

{#if showAutoFixModal}
  <div class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3>Configuration Missing</h3>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning">
          <div class="alert-icon">⚠</div>
          <div>
            <strong>Configuration Entity Not Found</strong>
            <p>
              The system configuration entity is missing. This is required for
              managing default user roles.
            </p>
          </div>
        </div>
        <p>
          Would you like to automatically create the missing configuration
          entity?
        </p>
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={() => (showAutoFixModal = false)}
          disabled={isAutoFixing}
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          onclick={autoFixConfiguration}
          disabled={isAutoFixing}
        >
          {#if isAutoFixing}
            <div class="spinner small"></div>
            Creating...
          {:else}
            Auto Fix
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<div class="container">
  <div class="page-header">
    <h1 class="page-title">System Configuration</h1>
    <p class="page-subtitle">
      Configure default settings for new users and system behavior
    </p>
  </div>

  <div class="card">
    <h2 class="card-title">User Default Role</h2>
    <p class="card-description">
      Select the default role that will be assigned to newly registered users.
      This role determines the initial permissions and access level for new
      users.
    </p>

    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Loading configuration...</span>
      </div>
    {:else if availableRoles.length === 0}
      <div class="alert alert-warning">
        <div class="alert-icon">⚠</div>
        <div>
          <strong>No Roles Available:</strong>
          Please create roles first before configuring default user role.
        </div>
      </div>
    {:else}
      <div class="config-section">
        <div class="current-config">
          {#if currentDefaultRole}
            <div class="status-indicator status-info">
              <span>ℹ</span>
              <span
                >Current default role: <strong>{currentDefaultRole}</strong
                ></span
              >
            </div>
          {:else}
            <div class="status-indicator status-warning">
              <span>⚠</span>
              <span>No default role configured</span>
            </div>
          {/if}
        </div>

        <div class="role-selection">
          <label class="form-label" for="default-role-select">
            Select Default Role
          </label>
          <select
            id="default-role-select"
            class="form-select"
            bind:value={selectedDefaultRole}
          >
            <option value="">-- Select a role --</option>
            {#each availableRoles as role}
              <option value={role.shortname}>{role.displayname}</option>
            {/each}
          </select>

          {#if selectedDefaultRole}
            <div class="role-info">
              {#each availableRoles as role}
                {#if role.shortname === selectedDefaultRole}
                  <div class="role-details">
                    <h4>{role.displayname}</h4>
                    <p>{role.description}</p>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>

        <div class="action-bar">
          <button
            class="btn btn-primary"
            onclick={saveDefaultRole}
            disabled={isSaving ||
              !selectedDefaultRole ||
              selectedDefaultRole === currentDefaultRole}
          >
            {#if isSaving}
              <div class="spinner small"></div>
              Saving...
            {:else}
              Save Configuration
            {/if}
          </button>

          {#if selectedDefaultRole !== currentDefaultRole && currentDefaultRole}
            <button
              class="btn btn-secondary"
              onclick={() => (selectedDefaultRole = currentDefaultRole)}
              disabled={isSaving}
            >
              Reset to Current
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
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
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    padding: 20px 20px 0 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0 0 15px 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-body p {
    margin: 15px 0 0 0;
    color: #6b7280;
    line-height: 1.5;
  }

  .modal-footer {
    padding: 15px 20px 20px 20px;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    border-top: 1px solid #e5e7eb;
  }

  .alert {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 15px;
  }

  .alert-warning {
    background-color: #fef3c7;
    border: 1px solid #f59e0b;
    color: #92400e;
  }

  .alert-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .alert strong {
    display: block;
    margin-bottom: 4px;
  }

  .alert p {
    margin: 0;
    font-size: 0.9rem;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
    border-color: #2563eb;
  }

  .btn-secondary {
    background-color: white;
    color: #374151;
    border-color: #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e5e7eb;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 14px;
    height: 14px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
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

  .card-title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 8px;
  }

  .card-description {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 24px;
    line-height: 1.5;
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

  .alert {
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
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

  .config-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .current-config {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    padding: 8px 12px;
    border-radius: 6px;
  }

  .status-warning {
    color: #d97706;
    background: #fffbeb;
    border: 1px solid #fed7aa;
  }

  .status-info {
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .role-selection {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-label {
    font-weight: 600;
    color: #374151;
    font-size: 14px;
  }

  .form-select {
    width: 100%;
    max-width: 400px;
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

  .role-info {
    max-width: 400px;
  }

  .role-details {
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .role-details h4 {
    font-weight: 600;
    color: #111827;
    margin-bottom: 8px;
    font-size: 16px;
  }

  .role-details p {
    color: #6b7280;
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
  }

  .action-bar {
    display: flex;
    gap: 12px;
    align-items: center;
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
</style>
