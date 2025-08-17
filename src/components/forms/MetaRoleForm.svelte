<script lang="ts">
  import { onMount } from "svelte";
  import { Dmart, QueryType } from "@edraj/tsdmart";
  import { writable } from "svelte/store";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";

  let {
    formData = $bindable(),
    validateFn = $bindable(),
  }: {
    formData: any;
    validateFn: () => boolean;
  } = $props();

  let availablePermissions = writable([]);
  let loading = writable(true);
  let filteredPermissions = writable([]);
  let searchTerm = writable("");
  let showDropdown = writable(false);
  let dropdownWrapperRef;

  if (!formData.permissions) {
    formData.permissions = [];
  }

  async function getPermissions() {
    try {
      const response: any = await Dmart.query({
        space_name: "management",
        subpath: "/permissions",
        type: QueryType.search,
        search: "",
        limit: 100,
      });
      if (response) {
        availablePermissions.set(response.records);
        updateFilteredPermissions();
      }
    } catch (error) {
      console.error("Failed to load permissions:", error);
    } finally {
      loading.set(false);
    }
  }

  onMount(() => {
    getPermissions();

    const handleClickOutside = (event) => {
      if (dropdownWrapperRef && !dropdownWrapperRef.contains(event.target)) {
        showDropdown.set(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  function updateFilteredPermissions() {
    searchTerm.subscribe((term) => {
      availablePermissions.subscribe((perms) => {
        filteredPermissions.set(
          perms
            .filter((perm) =>
              perm.shortname.toLowerCase().includes(term.toLowerCase())
            )
            .map((perm) => ({ key: perm.shortname, value: perm.shortname }))
        );
      });
    });
  }

  function togglePermission(event, permission) {
    event.stopPropagation();

    const index = formData.permissions.indexOf(permission.value);
    if (index === -1) {
      formData.permissions = [...formData.permissions, permission.value];
    } else {
      formData.permissions = formData.permissions.filter(
        (p) => p !== permission.value
      );
    }
  }

  function removePermission(permission) {
    formData.permissions = formData.permissions.filter((p) => p !== permission);
  }

  function validate() {
    return formData.permissions.length !== 0;
  }

  validateFn = validate;

  searchTerm.subscribe((term) => {
    if (term) {
      updateFilteredPermissions();
    } else {
      availablePermissions.subscribe((perms) => {
        filteredPermissions.set(
          perms.map((perm) => ({ key: perm.shortname, value: perm.shortname }))
        );
      });
    }
  });
</script>

<div class="card">
  <h2 class="card-title">{$_("rolePermissions")}</h2>

  <div class="form-group">
    <label class="form-label" for="permissions-search">
      <span class="required">*</span>
      {$_("permissions")}
    </label>

    {#if $loading}
      <div class="loading-skeleton">
        <div class="skeleton-line"></div>
      </div>
    {:else}
      <div bind:this={dropdownWrapperRef}>
        <div class="search-container">
          <div class="search-input-wrapper">
            <div class="search-icon">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              id="permissions-search"
              class="search-input"
              placeholder={$_("searchPermissionsPlaceholder")}
              bind:value={$searchTerm}
              onfocus={() => showDropdown.set(true)}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  showDropdown.set(false);
                }
              }}
            />
          </div>
        </div>

        {#if $showDropdown && $filteredPermissions.length > 0}
          <div class="dropdown">
            {#each $filteredPermissions as permission}
              <button
                class="dropdown-item"
                aria-label={`${$_("toggle")} ${permission.key}`}
                onclick={(e) => togglePermission(e, permission)}
              >
                <span>{permission.key}</span>
                {#if formData.permissions.includes(permission.value)}
                  <span class="selected-badge">{$_("selected")}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if formData.permissions.length > 0}
      <div class="permissions-display">
        <label class="form-label">{$_("addedPermissions")}</label>
        <div class="permissions-container">
          <div class="permissions-list">
            {#each formData.permissions as permission}
              <div class="permission-tag">
                <span>{permission}</span>
                <button
                  class="remove-btn"
                  aria-label={`${$_("remove")} ${permission}`}
                  onclick={() => removePermission(permission)}
                  type="button"
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="empty-state">{$_("noPermissionsAdded")}</div>
    {/if}
  </div>
</div>

<style>
  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 24px;
    margin-bottom: 24px;
    max-width: 1024px;
    margin-left: auto;
    margin-right: auto;
  }

  .card-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 24px;
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-label {
    display: block;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .required {
    color: #ef4444;
    font-size: 18px;
    vertical-align: middle;
    margin-right: 4px;
  }

  .loading-skeleton {
    padding: 16px 0;
  }

  .skeleton-line {
    height: 12px;
    background: #e5e7eb;
    border-radius: 6px;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    margin: 10px 8px;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .search-container {
    margin-bottom: 16px;
    position: relative;
  }

  .search-input-wrapper {
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px 12px 44px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .dropdown {
    position: absolute;
    width: 100%;
    margin-top: 4px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 10;
    max-height: 240px;
    overflow-y: auto;
  }

  .dropdown-item {
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background-color 0.2s ease;
    border-bottom: 1px solid #f3f4f6;
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover {
    background: #f9fafb;
  }

  .selected-badge {
    background: #dbeafe;
    color: #1e40af;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .permissions-display {
    margin-top: 24px;
  }

  .permissions-container {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    background: #f9fafb;
  }

  .permissions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .permission-tag {
    background: #dbeafe;
    color: #1e40af;
    padding: 8px 12px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .remove-btn {
    background: none;
    border: none;
    color: #1e40af;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .remove-btn:hover {
    background: #1e40af;
    color: white;
  }

  .empty-state {
    margin-top: 16px;
    padding: 32px 16px;
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    text-align: center;
    color: #6b7280;
    font-size: 14px;
  }
</style>
