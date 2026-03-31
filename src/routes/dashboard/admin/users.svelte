<script lang="ts">
  import { onMount } from "svelte";
  import {
    getAllUsers,
    filterUserByRole,
    getSpaceContents,
    updateUserRoles,
  } from "@/lib/dmart_services/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { formatNumber } from "@/lib/helpers";
  import { derived } from "svelte/store";
  import { Modal } from "flowbite-svelte";
  import { ResourceType, Dmart, RequestType } from "@edraj/tsdmart";
  import { createEntity } from "@/lib/dmart_services/core";
  import { getEntity } from "@/lib/dmart_services";
  import {
    parseValueByType,
    getFieldType,
    formatValueForEdit,
    setNestedValue,
  } from "@/lib/schemaTypes";
  import { getParentPath } from "@/lib/helpers";
  import ModalCSVUpload from "@/components/management/Modals/ModalCSVUpload.svelte";
  import ModalCSVDownload from "@/components/management/Modals/ModalCSVDownload.svelte";
  import MetaForm from "@/components/management/forms/MetaForm.svelte";
  import MetaUserForm from "@/components/management/forms/MetaUserForm.svelte";
  import DataTable from "@/components/DataTable.svelte";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let users = $state<any[]>([]);
  let availableRoles = $state<any[]>([]);
  let isLoading = $state(true);
  let isUpdating = $state(false);
  let selectedUser = $state<any>(null);
  let showRoleModal = $state(false);
  let selectedRoles = $state<string[]>([]);
  let searchTerm = $state("");
  let filteredUsers = $state<any[]>([]);
  let selectedRoleFilter = $state("");
  let roleSearchTerm = $state("");
  let filteredRoles = $state([]);
  let showCreateUserModal = $state(false);
  let isEditingUserMode = $state(false);
  let isSavingUser = $state(false);
  
  let metaContent = $state<any>({});
  let validateMetaForm = $state<(() => boolean) | null>(null);
  let validateRTForm = $state<(() => boolean) | null>(null);

  let folderMetadata = $state<any>(null);
  let canUploadCSV = $derived((folderMetadata as any)?.attributes?.payload?.body?.allow_upload_csv === true);
  let canDownloadCSV = $derived((folderMetadata as any)?.attributes?.payload?.body?.allow_csv === true);
  let indexAttributes = $derived(
    (folderMetadata as any)?.attributes?.payload?.body?.index_attributes || [],
  );

  let isCSVUploadModalOpen = $state(false);
  let isCSVDownloadModalOpen = $state(false);

  let showColumnSettingsModal = $state(false);
  let editingIndexAttributes = $state([]);
  let isSavingColumns = $state(false);

  let showBulkEditModal = $state(false);
  let bulkEditData = $state<Record<string, any>>({});
  let isBulkSaving = $state(false);

  function getAttributeValue(item, key) {
    if (!item) return "";
    if (!key) return "";
    if (key === "displayname") return item.displayname || item.shortname;
    if (key === "email") return item.email;
    if (key === "roles") return item.roles.map(r => getRoleDisplayName(r)).join(", ");
    if (key === "status") {
      return item.is_active
        ? $_("admin_content.status.active")
        : $_("admin_content.status.inactive");
    }
    const findValue = (obj, k) => {
      if (!obj || typeof obj !== "object") return undefined;
      if (obj[k] !== undefined) return obj[k];
      const tk = k.toLowerCase();
      const foundKey = Object.keys(obj).find((ok) => ok.toLowerCase() === tk);
      return foundKey ? obj[foundKey] : undefined;
    };
    
    if (key.includes(".")) {
      const parts = key.split(".");
      let current = item;
      for (const part of parts) {
        if (current === undefined || current === null) break;
        if (part === "attributes") {
           current = item;
        } else {
           current = findValue(current, part);
        }
      }
      return current !== undefined ? current : "";
    }
    
    let baseVal = findValue(item, key);
    return baseVal !== undefined ? baseVal : "";
  }

  let selectedItems = $state(new Set<string>());

  function toggleAllItems(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      filteredUsers.forEach((u) => selectedItems.add(u.shortname));
      selectedItems = new Set(selectedItems);
    } else {
      selectedItems = new Set();
    }
  }

  function toggleItemSelection(shortname: string) {
    if (selectedItems.has(shortname)) {
      selectedItems.delete(shortname);
    } else {
      selectedItems.add(shortname);
    }
    selectedItems = new Set(selectedItems);
  }

  function clearSelection() {
    selectedItems = new Set();
  }

  let currentPage = $state(1);
  let itemsPerPage = $state(20);
  let totalUsers = $state(0);
  let totalPages = $state(0);

  async function loadUsers() {
    try {
      isLoading = true;
      folderMetadata = await getEntity('users', 'management', '/', ResourceType.folder, 'managed');

      let usersResponse;

      if (selectedRoleFilter) {
        usersResponse = await filterUserByRole(
          selectedRoleFilter,
          itemsPerPage,
          (currentPage - 1) * itemsPerPage,
        );
      } else {
        usersResponse = await getAllUsers(
          itemsPerPage,
          (currentPage - 1) * itemsPerPage,
        );
      }

      if (usersResponse && usersResponse.status === "success") {
        users = usersResponse.records.map((user) => ({
          ...user,
          shortname: user.shortname,
          displayname: typeof user.attributes?.displayname === 'object'
            ? (user.attributes?.displayname?.en || user.attributes?.displayname?.ar || user.attributes?.displayname?.ku || user.shortname)
            : (user.attributes?.displayname || user.shortname),
          email: user.attributes?.email || "N/A",
          roles: Array.isArray(user.attributes?.roles) 
            ? user.attributes.roles.map((r: any) => typeof r === 'string' ? r : (r.shortname || r.name || String(r)))
            : [],
          is_active: user.attributes?.is_active ?? true,
          created_at: user.attributes?.created_at || "N/A",
        }));

        totalUsers = usersResponse.attributes?.total || users.length;
        totalPages = Math.ceil(totalUsers / itemsPerPage);

        updateFilteredUsers();
      } else {
        errorToastMessage($_("failed_to_load_users"));
      }
    } catch (error) {
      console.error("Error loading users:", error);
      errorToastMessage($_("failed_to_load_users"));
    } finally {
      isLoading = false;
    }
  }

  async function loadRoles() {
    try {
      const rolesResponse = await getSpaceContents(
        "management",
        "roles",
        "managed",
      );

      if (rolesResponse.status === "success") {
        availableRoles = rolesResponse.records.map((role) => ({
          shortname: role.shortname,
          displayname: typeof role.attributes?.displayname === 'object'
            ? (role.attributes?.displayname?.en || role.attributes?.displayname?.ar || role.attributes?.displayname?.ku || role.shortname)
            : (role.attributes?.displayname || role.shortname),
          description: typeof role.attributes?.description === 'object'
            ? (role.attributes?.description?.en || role.attributes?.description?.ar || role.attributes?.description?.ku || `Role: ${role.shortname}`)
            : (role.attributes?.description || `Role: ${role.shortname}`),
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
          user.roles.some((role) => role.toLowerCase().includes(term)),
      );
    }

    filteredUsers = filtered;
  }

  function openEditUserModal(user) {
    isEditingUserMode = true;
    selectedUser = user;
    metaContent = {
      ...$state.snapshot(user.attributes || {}),
      shortname: user.shortname
    };
    showCreateUserModal = true;
  }

  function closeUserModal() {
    showCreateUserModal = false;
    isEditingUserMode = false;
    selectedUser = null;
    metaContent = {};
  }

  function openRoleModal(user) {
    selectedUser = user;
    selectedRoles = [...user.roles];
    roleSearchTerm = ""; // Reset search when opening modal
    filteredRoles = availableRoles; // Initialize filtered roles
    showRoleModal = true;
  }

  function closeRoleModal() {
    selectedUser = null;
    selectedRoles = [];
    roleSearchTerm = "";
    filteredRoles = [];
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

  function filterAvailableRoles() {
    if (!roleSearchTerm.trim()) {
      filteredRoles = availableRoles;
      return;
    }

    const term = roleSearchTerm.toLowerCase();
    filteredRoles = availableRoles.filter(
      (role) =>
        role.shortname.toLowerCase().includes(term) ||
        role.displayname.toLowerCase().includes(term) ||
        role.description.toLowerCase().includes(term),
    );
  }

  
  function handleOpenColumnSettings() {
    editingIndexAttributes = JSON.parse(JSON.stringify(indexAttributes));
    if (editingIndexAttributes.length === 0) {
      editingIndexAttributes = [
        { key: "displayname", name: "User" },
        { key: "email", name: "Email" },
        { key: "roles", name: "Roles" },
        { key: "status", name: "Status" },
      ];
    }
    showColumnSettingsModal = true;
  }

  function addColumnSetting() {
    editingIndexAttributes = [...editingIndexAttributes, { key: "", name: "" }];
  }

  function removeColumnSetting(index) {
    editingIndexAttributes = editingIndexAttributes.filter((_, i) => i !== index);
  }

  async function handleUpdateColumns() {
    isSavingColumns = true;
    try {
      const response = await Dmart.request({
        space_name: "management",
        request_type: RequestType.update,
        records: [
          {
            resource_type: ResourceType.folder,
            shortname: "users",
            subpath: "/",
            attributes: {
              payload: {
                ...(folderMetadata as any)?.attributes?.payload,
                body: {
                  ...(folderMetadata as any)?.attributes?.payload?.body,
                  index_attributes: editingIndexAttributes.filter(
                    (a) => a.key.trim() && a.name.trim(),
                  ),
                },
              },
            },
          },
        ],
      });

      if (response && response.status === "success") {
        showColumnSettingsModal = false;
        successToastMessage($_("toast.folder_updated") || "Folder updated");
        await loadUsers();
      } else {
        errorToastMessage($_("toast.folder_update_failed") || "Failed to update columns");
      }
    } catch (err) {
      console.error("Error updating columns:", err);
      errorToastMessage("Failed to update columns");
    } finally {
      isSavingColumns = false;
    }
  }

  async function handleCSVUpload(parsedFromCSV: any[]) {
    try {
      if (!parsedFromCSV || parsedFromCSV.length === 0) {
        errorToastMessage($_("admin_content.bulk_actions.invalid_csv_data"));
        return;
      }

      parsedFromCSV.forEach((item) => {
        if (item.displayname && typeof item.displayname === "string") {
          item.displayname = {
            ar: item.displayname,
            en: item.displayname,
            ku: item.displayname,
          };
        }
        if (item.description && typeof item.description === "string") {
          item.description = {
            ar: item.description,
            en: item.description,
            ku: item.description,
          };
        }
      });

      const response = await Dmart.request({
        space_name: "management",
        request_type: RequestType.merge,
        records: parsedFromCSV,
      });

      if (response && response.status === "success") {
        successToastMessage($_("admin_content.bulk_actions.csv_upload_success"));
        isCSVUploadModalOpen = false;
        loadUsers();
      } else {
        errorToastMessage(
          response?.error?.message ||
            $_("admin_content.bulk_actions.csv_upload_failed"),
        );
      }
    } catch (error) {
      console.error("CSV Upload failed:", error);
      errorToastMessage($_("admin_content.bulk_actions.csv_upload_failed"));
    }
  }

  function handleCSVDownload(itemsToDownload) {
    if (!itemsToDownload || itemsToDownload.length === 0) {
      errorToastMessage($_("admin_content.bulk_actions.no_items_export"));
      return;
    }
    isCSVDownloadModalOpen = false;
  }

  function openBulkEditModal() {
    isBulkSaving = false;
    const initialData = {};
    const effectiveColumns = indexAttributes.length > 0 ? indexAttributes : [
      { key: "displayname", name: "User" },
      { key: "email", name: "Email" },
      { key: "roles", name: "Roles" },
      { key: "status", name: "Status" }
    ];

    for (const shortname of selectedItems) {
      const item = users.find((i) => i.shortname === shortname);
      if (item) {
        const editData = {};
        for (const col of effectiveColumns) {
           const key = col.key;
           const val = getAttributeValue(item, key);
           editData[key] = val;
        }
        initialData[shortname] = editData;
      }
    }
    bulkEditData = { ...initialData };
    showBulkEditModal = true;
  }
  
  function closeBulkEditModal() {
    showBulkEditModal = false;
    bulkEditData = {};
  }
  
  function updateBulkEditField(shortname, field, value) {
    if (bulkEditData[shortname]) {
      bulkEditData[shortname] = { ...bulkEditData[shortname], [field]: value };
    }
  }

  async function handleBulkSave() {
    if (Object.keys(bulkEditData).length === 0) return;
    isBulkSaving = true;

    try {
      const records = [];

      for (const [shortname, editData] of Object.entries(bulkEditData)) {
        const item = users.find((i) => i.shortname === shortname);
        if (item) {
          const attributes = { ...(item.attributes || {}) };
          
          for (const [key, value] of Object.entries(editData)) {
            if (key === "shortname") continue;
            
            const fieldType = getFieldType(key);
            const parsedValue = parseValueByType(value, fieldType);
            
            const attrKey = key.startsWith("attributes.") ? key.slice(11) : key;
            setNestedValue(attributes, attrKey, parsedValue);
          }

          records.push({
            resource_type: ResourceType.user,
            shortname: item.shortname,
            subpath: "/users",
            attributes,
          });
        }
      }

      const response = await Dmart.request({
        space_name: "management",
        request_type: RequestType.update,
        records,
      });

      if (response && response.status === 'success') {
        successToastMessage($_("admin_content.bulk_actions.edit_success", { values: { count: records.length }}));
        closeBulkEditModal();
        selectedItems = new Set();
        await loadUsers();
      } else {
        errorToastMessage($_("admin_content.bulk_actions.edit_failed", { values: { count: records.length }}));
      }

    } catch (err) {
       console.error(err);
       errorToastMessage($_("admin_content.bulk_actions.edit_failed"));
    } finally {
       isBulkSaving = false;
    }
  }

  async function saveUserRoles() {
    if (!selectedUser) return;

    isUpdating = true;
    try {
      const success = await updateUserRoles(
        selectedUser.shortname,
        selectedRoles,
      );
      if (success) {
        const userIndex = users.findIndex(
          (u) => u.shortname === selectedUser.shortname,
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

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      loadUsers();
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadUsers();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  }

  async function handleRoleFilterChange() {
    currentPage = 1;
    await loadUsers();
  }

  $effect(() => {
    updateFilteredUsers();
  });

  onMount(async () => {
    isLoading = true;
    await Promise.all([loadUsers(), loadRoles()]);
    isLoading = false;
  });

  async function handleSaveUser() {
    if (validateMetaForm && !validateMetaForm()) return;
    if (validateRTForm && !validateRTForm()) return;
    
    isSavingUser = true;
    try {
      const _metaContent = $state.snapshot(metaContent);
      const shortname = _metaContent.shortname;
      delete _metaContent.shortname;
      
      if (isEditingUserMode) {
        const response = await Dmart.request({
          space_name: "management",
          request_type: RequestType.update,
          records: [{
            resource_type: ResourceType.user,
            shortname: shortname,
            subpath: "/users",
            attributes: _metaContent
          }]
        });
        
        if (response && response.status === 'success') {
          successToastMessage($_("user_updated_successfully") || "User updated successfully!");
          closeUserModal();
          await loadUsers();
        } else {
          errorToastMessage($_("failed_to_update_user") || "Failed to update user.");
        }
      } else {
        const result = await createEntity(
          "management",
          "users",
          ResourceType.user,
          _metaContent,
          shortname
        );
        
        if (result) {
          successToastMessage($_("user_created_successfully") || "User created successfully!");
          closeUserModal();
          await loadUsers();
        } else {
          errorToastMessage($_("failed_to_create_user") || "Failed to create user.");
        }
      }
    } catch (error) {
      console.error("Error saving user:", error);
      errorToastMessage(isEditingUserMode ? ($_("failed_to_update_user") || "Failed to update user.") : ($_("failed_to_create_user") || "Failed to create user."));
    } finally {
      isSavingUser = false;
    }
  }
</script>

<div class="container" class:rtl={$isRTL}>
  <div class="page-header">
    <h1 class="page-title">{$_("user_management")}</h1>
    <p class="page-subtitle">{$_("manage_users_and_roles")}</p>
  </div>

  <div class="stats-card mb-4">
    <h3 class="card-title">{$_("statistics")}</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(totalUsers, $locale)}
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
            users.filter((u: any) => u.roles.length === 0).length,
            $locale,
          )}
        </div>
        <div class="stat-label">{$_("users_without_roles")}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2 class="card-title">{$_("users_overview")}</h2>
      <!-- Bulk Actions -->
      {#if selectedItems.size > 0}
        <div class="flex items-center gap-2 mr-4 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
           <span class="text-sm font-medium text-indigo-700 hidden sm:inline-block">
             {$_("admin_content.bulk_actions.selected", { values: { count: selectedItems.size } })}
           </span>
           <button onclick={openBulkEditModal} class="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors group relative" aria-label={$_("admin_content.bulk_actions.edit")}>
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
             <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">{$_("admin_content.bulk_actions.edit")}</span>
           </button>
        </div>
      {/if}
      <div class="flex items-center gap-2 ml-auto">
        <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" onclick={handleOpenColumnSettings} aria-label={$_("admin_content.column_settings.title")}>
           <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
        {#if canUploadCSV}
          <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" onclick={() => isCSVUploadModalOpen = true}>
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          </button>
        {/if}
        {#if canDownloadCSV}
          <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" onclick={() => isCSVDownloadModalOpen = true}>
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </button>
        {/if}
      </div>
      <div class="filters-container">
        <button class="btn btn-primary" onclick={() => {
          isEditingUserMode = false;
          metaContent = {};
          showCreateUserModal = true;
        }}>
          {$_("create_user") || "Create User"}
        </button>
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
            onchange={handleRoleFilterChange}
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
      <DataTable
        items={filteredUsers}
        indexAttributes={indexAttributes}
        selectable={true}
        selectedItems={selectedItems}
        onSelectAll={(checked) => {
          if (checked) {
            filteredUsers.forEach((u) => selectedItems.add(u.shortname));
            selectedItems = new Set(selectedItems);
          } else {
            selectedItems = new Set();
          }
        }}
        onSelectItem={(shortname) => toggleItemSelection(shortname)}
        onRowClick={(user) => openEditUserModal(user)}
        loading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalUsers}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => goToPage(page)}
        onItemsPerPageChange={(count) => {
          itemsPerPage = count;
          currentPage = 1;
          loadUsers();
        }}
        rtl={$isRTL}
      >
        {#snippet cell({ item: user, attr })}
          {#if attr.key === 'displayname'}
            <div class="flex flex-col">
              <span class="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1.5 bg-blue-100 text-blue-800">user</span>
              <div class="flex items-center gap-2">
                <span class="text-lg text-gray-400">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </span>
                <span class="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs">{user.displayname}</span>
              </div>
            </div>
          {:else if attr.key === 'email'}
            <span class="text-sm text-gray-500 font-medium">{user.email}</span>
          {:else if attr.key === 'roles'}
            {#if user.roles.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each user.roles as role}
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{getRoleDisplayName(role)}</span>
                {/each}
              </div>
            {:else}
              <span class="text-xs text-gray-400 italic">{$_("no_roles_assigned")}</span>
            {/if}
          {:else if attr.key === 'status'}
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium {user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">
              <span class="w-1.5 h-1.5 rounded-full {user.is_active ? 'bg-emerald-500' : 'bg-red-500'} mr-1.5"></span>
              {user.is_active ? $_("admin_content.status.active") : $_("admin_content.status.inactive")}
            </span>
          {:else}
            <span class="text-sm text-gray-500 font-medium">{getAttributeValue(user, attr.key)}</span>
          {/if}
        {/snippet}

        {#snippet actions({ item: user })}
          <button
            onclick={(e) => {
              e.stopPropagation();
              openEditUserModal(user);
            }}
            class="text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            Edit
          </button>
          <button
            onclick={(e) => {
              e.stopPropagation();
              openRoleModal(user);
            }}
            class="text-[12px] font-semibold text-amber-500 hover:text-amber-700 flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            Roles
          </button>
        {/snippet}

        {#snippet bulkActions({ selectedCount })}
          <button
            onclick={clearSelection}
            class="bulk-btn bulk-btn-secondary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {$_("admin_content.bulk_actions.clear_selection")}
          </button>
          <button
            onclick={openBulkEditModal}
            class="bulk-btn bulk-btn-primary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            {$_("admin_content.bulk_actions.edit")}
          </button>
        {/snippet}
      </DataTable>
    {/if}
  </div>

</div>

<Modal
  title="{$_('manageRolesFor')} {selectedUser?.displayname ?? ''}"
  bind:open={showRoleModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <p class="modal-description">
    {$_("selectRolesToAssignDescription")}
  </p>

  {#if availableRoles.length === 0}
    <div class="alert alert-warning">
      <div class="alert-icon">⚠</div>
      <div>{$_("noRolesAvailable")}</div>
    </div>
  {:else}
    <div class="role-search-container">
      <input
        type="text"
        class="role-search-input"
        placeholder={$_("search_roles") || "Search roles..."}
        bind:value={roleSearchTerm}
        oninput={filterAvailableRoles}
      />
    </div>

    {#if filteredRoles.length === 0}
      <div class="empty-roles-state">
        <p>
          {$_("no_roles_match_search") || "No roles match your search"}
        </p>
      </div>
    {:else}
      <div class="roles-selection">
        {#each filteredRoles as role}
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
  {/if}

  {#snippet footer()}
    <button
      class="btn btn-secondary"
      onclick={closeRoleModal}
      disabled={isUpdating}
    >
      {$_("cancel")}
    </button>
    <button
      class="btn btn-primary"
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
  {/snippet}
</Modal>

<Modal
  title={isEditingUserMode ? ($_('edit_user') || 'Edit User') : ($_('create_user') || 'Create User')}
  bind:open={showCreateUserModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <div class="space-y-4 max-h-[60vh] overflow-y-auto">
    <MetaForm
      bind:formData={metaContent}
      bind:validateFn={validateMetaForm}
      isCreate={!isEditingUserMode}
      fullWidth={true}
    />
    <MetaUserForm
      bind:formData={metaContent}
      bind:validateFn={validateRTForm}
      isCreate={!isEditingUserMode}
      fullWidth={true}
    />
  </div>

  {#snippet footer()}
    <button
      class="btn btn-secondary"
      onclick={closeUserModal}
      disabled={isSavingUser}
    >
      {$_("cancel")}
    </button>
    <button
      class="btn btn-primary"
      onclick={handleSaveUser}
      disabled={isSavingUser}
    >
      {#if isSavingUser}
        <div class="spinner small"></div>
        {isEditingUserMode ? ($_("updating") || "Updating...") : ($_("creating") || "Creating...")}
      {:else}
        {isEditingUserMode ? ($_("update_user") || "Update User") : ($_("create_user") || "Create User")}
      {/if}
    </button>
  {/snippet}
</Modal>

{#if isCSVUploadModalOpen}
  <ModalCSVUpload
    space_name={"management"}
    actualSubpath={"users"}
    isOpen={isCSVUploadModalOpen}
    onClose={() => (isCSVUploadModalOpen = false)}
    onUpload={handleCSVUpload}
  />
{/if}

{#if isCSVDownloadModalOpen}
  <ModalCSVDownload
    spaceName={"management"}
    actualSubpath={"users"}
    indexAttributes={indexAttributes}
    isOpen={isCSVDownloadModalOpen}
    onClose={() => (isCSVDownloadModalOpen = false)}
    onDownload={handleCSVDownload}
    contents={users}
  />
{/if}

{#if showColumnSettingsModal}
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div class="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 modal-container">
      <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-white modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Column Settings</h2>
        </div>
        <button onclick={() => (showColumnSettingsModal = false)} class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors modal-close-btn">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="p-6 max-h-[60vh] overflow-y-auto bg-gray-50/30 modal-content">
        <div class="space-y-4">
          {#each editingIndexAttributes as attr, i}
            <div class="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div class="flex-1 grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1">Label Name</label>
                  <input type="text" bind:value={attr.name} placeholder="e.g. Server Name" class="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div class="space-y-1.5">
                  <label class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1">Data Key</label>
                  <input type="text" bind:value={attr.key} placeholder="e.g. server_name" class="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono" />
                </div>
              </div>
              <button onclick={() => removeColumnSetting(i)} class="mt-6 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove Column">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          {/each}
        </div>

        <button onclick={addColumnSetting} class="w-full mt-6 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add New Column
        </button>
      </div>

      <div class="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-white modal-footer">
        <button onclick={() => (showColumnSettingsModal = false)} class="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          {$_("common.cancel")}
        </button>
        <button onclick={handleUpdateColumns} disabled={isSavingColumns} class="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
          {#if isSavingColumns}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {$_("common.saving") || "Saving..."}
          {:else}
            {$_("common.save_changes") || "Save Changes"}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showBulkEditModal}
  <div class="modal-overlay z-[100] fixed top-0 left-0 w-full h-full bg-black/50 overflow-auto flex items-center justify-center">
    <div class="modal-container bg-white p-6 rounded shadow-lg " style="width: 90vw; max-width: 1200px;">
      <div class="modal-header flex justify-between mb-4">
         <h3 class="modal-title font-bold text-lg">Bulk Edit ({Object.keys(bulkEditData).length} items)</h3>
         <button onclick={closeBulkEditModal} class="modal-close-btn"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
      </div>
      <div class="modal-body max-h-[70vh] overflow-y-auto">
        <table class="w-full text-left border-collapse">
           <thead>
             <tr>
               <th class="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 w-48 shrink-0">Item</th>
               {#each (indexAttributes.length > 0 ? indexAttributes : [{key:'displayname',name:'User'},{key:'email',name:'Email'},{key:'roles',name:'Roles'},{key:'status',name:'Status'}]) as attr}
                 <th class="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 min-w-[200px] whitespace-nowrap">{attr.name}</th>
               {/each}
             </tr>
           </thead>
           <tbody class="divide-y divide-gray-200 text-left">
             {#each Object.entries(bulkEditData) as [shortname, editData]}
               <tr>
                 <td class="px-4 py-3 bg-gray-50/50 font-mono text-xs text-gray-500 border-r border-gray-200 truncate" title={shortname}>{shortname}</td>
                 {#each (indexAttributes.length > 0 ? indexAttributes : [{key:'displayname',name:'User'},{key:'email',name:'Email'},{key:'roles',name:'Roles'},{key:'status',name:'Status'}]) as attr}
                   <td class="px-4 py-3">
                     <input type="text" class="w-full px-3 py-1.5 text-sm border font-medium text-gray-700 bg-white border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={editData[attr.key] !== undefined ? editData[attr.key] : ""}
                        oninput={(e) => updateBulkEditField(shortname, attr.key, (e.target as HTMLInputElement).value)} />
                   </td>
                 {/each}
               </tr>
             {/each}
           </tbody>
        </table>
      </div>
      <div class="modal-footer flex gap-2 justify-end mt-4 text-right">
        <button onclick={closeBulkEditModal} class="btn btn-secondary px-4 py-2 bg-gray-100 text-gray-800 rounded">Cancel</button>
        <button onclick={handleBulkSave} disabled={isBulkSaving} class="btn btn-primary px-4 py-2 bg-indigo-600 text-white rounded w-36">{#if isBulkSaving}...{:else}Save Changes{/if}</button>
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

  /* Modal Styles removed - now using flowbite Modal */

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

  .role-search-container {
    margin-bottom: 16px;
  }

  .role-search-input {
    width: 100%;
    padding: 10px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .role-search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .empty-roles-state {
    text-align: center;
    padding: 32px;
    color: #9ca3af;
    font-size: 14px;
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

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pagination-pages {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .page-btn {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-btn:hover:not(.active) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .page-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
    font-weight: 600;
  }

  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 600;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
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

    .pagination {
      flex-direction: column;
      gap: 16px;
    }

    .pagination-pages {
      order: 2;
      justify-content: center;
      width: 100%;
    }

    .pagination-info {
      order: 1;
      justify-content: center;
    }

    .page-btn {
      min-width: 32px;
      height: 32px;
      font-size: 13px;
    }
  }
</style>
