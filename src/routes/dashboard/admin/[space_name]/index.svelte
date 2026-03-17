<script lang="ts">
  import { onMount } from "svelte";
  import { Modal } from "flowbite-svelte";
  import { goto, params } from "@roxi/routify";
  import {
    deleteEntity,
    getSpaceContents,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import FolderForm from "@/components/forms/FolderForm.svelte";
  import MetaForm from "@/components/forms/MetaForm.svelte";
  import { formatNumberInText } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog.svelte";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let isLoading = $state(false);
  let allContents = $state([]);
  let displayedContents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let actualSubpath = $state("");
  let isEditMode = $state(false);
  let selectedFolderForEdit = $state(null);

  // Search and Filter State
  let searchQuery = $state("");
  let selectedType = $state("all");
  let selectedStatus = $state("all");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let isSearchActive = $state(false);

  // Filter Options
  const typeOptions = [
    { value: "all", label: $_("admin_dashboard.filters.all") },
    { value: "folder", label: $_("admin_dashboard.filters.folder") },
    { value: "content", label: $_("admin_dashboard.filters.content") },
    { value: "post", label: $_("admin_dashboard.filters.post") },
    { value: "ticket", label: $_("admin_dashboard.filters.ticket") },
    { value: "user", label: $_("admin_dashboard.filters.user") },
    { value: "media", label: $_("admin_dashboard.filters.media") },
  ];

  const statusOptions = [
    { value: "all", label: $_("admin_dashboard.filters.all") },
    { value: "active", label: $_("admin_dashboard.filters.active") },
    { value: "inactive", label: $_("admin_dashboard.filters.inactive") },
  ];

  const sortOptions = [
    { value: "name", label: $_("admin_dashboard.sort.name") },
    { value: "created", label: $_("admin_dashboard.sort.created") },
    { value: "updated", label: $_("admin_dashboard.sort.updated") },
    { value: "owner", label: $_("admin_dashboard.sort.owner") },
  ];

  // Modal States
  let showCreateFolderModal = $state(false);
  let folderContent = {
    title: "",
    content: "",
    is_active: true,
    tags: [],
    index_attributes: [],
    sort_by: "created_at",
    sort_type: "descending",
    content_resource_types: [],
    content_schema_shortnames: [],
    workflow_shortnames: [],
    allow_view: true,
    allow_create: true,
    allow_update: true,
    allow_delete: false,
    allow_create_category: false,
    allow_csv: false,
    allow_upload_csv: false,
    use_media: false,
    stream: false,
    expand_children: false,
    disable_filter: false,
  };
  let isCreatingFolder = false;

  let metaContent: any = {};
  let validateMetaForm = null;

  onMount(async () => {
    spaceName = $params.space_name;
    actualSubpath = $params.subpath || "/";
    await loadContents();
  });

  async function loadContents() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        spaceName,
        "/",
        "managed",
        100,
        0,
        true,
      );
      if (response && response.records) {
        allContents = response.records;
        applyFilters();
      } else {
        allContents = [];
        displayedContents = [];
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = $_("admin_space.error.failed_load_contents");
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    let filtered = [...allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const shortname = item.shortname?.toLowerCase() || "";
        const displayName = getDisplayName(item).toLowerCase();
        const description = getDescription(item).toLowerCase();
        const owner = item.attributes?.owner_shortname?.toLowerCase() || "";

        return (
          shortname.includes(query) ||
          displayName.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
      });
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.resource_type === selectedType);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => {
        const isActive = item.attributes?.is_active;
        return selectedStatus === "active" ? isActive : !isActive;
      });
    }

    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = getDisplayName(a).toLowerCase();
          bValue = getDisplayName(b).toLowerCase();
          break;
        case "type":
          aValue = a.resource_type || "";
          bValue = b.resource_type || "";
          break;
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        case "updated":
          aValue = new Date(a.attributes?.updated_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        case "owner":
          aValue = (a.attributes?.owner_shortname || "").toLowerCase();
          bValue = (b.attributes?.owner_shortname || "").toLowerCase();
          break;
        default:
          aValue = getDisplayName(a).toLowerCase();
          bValue = getDisplayName(b).toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    displayedContents = filtered;
    isSearchActive =
      searchQuery.trim() !== "" ||
      selectedType !== "all" ||
      selectedStatus !== "all";
  }

  function clearFilters() {
    searchQuery = "";
    selectedType = "all";
    selectedStatus = "all";
    sortBy = "name";
    sortOrder = "asc";
    applyFilters();
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    applyFilters();
  }

  $effect(() => {
    applyFilters();
  });

  function handleItemClick(item: any) {
    if (item.resource_type === "folder" || item.subpath !== "/") {
      const subpath =
        item.subpath === "/"
          ? item.shortname
          : `${item.subpath}/${item.shortname}`;
      $goto(`/dashboard/admin/[space_name]/[subpath]`, {
        space_name: spaceName,
        subpath: subpath,
      });
    }
  }

  function handleCreateFolder() {
    isEditMode = false;
    selectedFolderForEdit = null;
    folderContent = {
      title: "",
      content: "",
      is_active: true,
      tags: [],
      index_attributes: [],
      sort_by: "created_at",
      sort_type: "descending",
      content_resource_types: [],
      content_schema_shortnames: [],
      workflow_shortnames: [],
      allow_view: true,
      allow_create: true,
      allow_update: true,
      allow_delete: false,
      allow_create_category: false,
      allow_csv: false,
      allow_upload_csv: false,
      use_media: false,
      stream: false,
      expand_children: false,
      disable_filter: false,
    };
    showCreateFolderModal = true;
  }

  function handleEditFolder(item) {
    isEditMode = true;
    selectedFolderForEdit = item;

    metaContent = {
      shortname: item.shortname,
      displayname: item.attributes?.displayname || {},
      description: item.attributes?.description || {},
    };

    const existingContent = item.attributes?.payload?.body || {};
    folderContent = {
      title: existingContent.title || "",
      content: existingContent.content || "",
      is_active:
        existingContent.is_active !== undefined
          ? existingContent.is_active
          : true,
      tags: existingContent.tags || [],
      index_attributes: existingContent.index_attributes || [],
      sort_by: existingContent.sort_by || "created_at",
      sort_type: existingContent.sort_type || "descending",
      content_resource_types: existingContent.content_resource_types || [],
      content_schema_shortnames:
        existingContent.content_schema_shortnames || [],
      workflow_shortnames: existingContent.workflow_shortnames || [],
      allow_view:
        existingContent.allow_view !== undefined
          ? existingContent.allow_view
          : true,
      allow_create:
        existingContent.allow_create !== undefined
          ? existingContent.allow_create
          : true,
      allow_update:
        existingContent.allow_update !== undefined
          ? existingContent.allow_update
          : true,
      allow_delete:
        existingContent.allow_delete !== undefined
          ? existingContent.allow_delete
          : false,
      allow_create_category:
        existingContent.allow_create_category !== undefined
          ? existingContent.allow_create_category
          : false,
      allow_csv:
        existingContent.allow_csv !== undefined
          ? existingContent.allow_csv
          : false,
      allow_upload_csv:
        existingContent.allow_upload_csv !== undefined
          ? existingContent.allow_upload_csv
          : false,
      use_media:
        existingContent.use_media !== undefined
          ? existingContent.use_media
          : false,
      stream:
        existingContent.stream !== undefined ? existingContent.stream : false,
      expand_children:
        existingContent.expand_children !== undefined
          ? existingContent.expand_children
          : false,
      disable_filter:
        existingContent.disable_filter !== undefined
          ? existingContent.disable_filter
          : false,
    };

    showCreateFolderModal = true;
  }

  async function handleSaveFolder(event) {
    event.preventDefault();
    isCreatingFolder = true;

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: isEditMode ? RequestType.update : RequestType.create,
        records: [
          {
            resource_type: ResourceType.folder,
            shortname: metaContent.shortname || "auto",
            subpath: "/",
            attributes: {
              displayname: metaContent.displayname,
              description: metaContent.description,
              payload: {
                body: folderContent,
                content_type: "json",
              },
              is_active: true,
            },
          },
        ],
      });

      if (response) {
        showCreateFolderModal = false;
        if (isEditMode) {
          successToastMessage($_("toast.folder_updated"));
        } else {
          successToastMessage($_("toast.folder_created"));
        }
        await loadContents();
        metaContent = {};
      } else {
        const errorMessage = isEditMode
          ? $_("toast.folder_update_failed")
          : $_("toast.folder_create_failed");
        errorToastMessage(errorMessage);
      }
    } catch (err) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} folder:`,
        err,
      );
      const errorMessage = isEditMode
        ? $_("toast.folder_update_failed")
        : $_("toast.folder_create_failed");
      errorToastMessage(errorMessage + ": " + err.message);
    } finally {
      isCreatingFolder = false;
    }
  }

  // Delete confirmation dialog state
  let showDeleteDialog = $state(false);
  let itemToDelete: any = $state(null);
  let isDeletingItem = $state(false);

  function openDeleteDialog(item: any, event: Event) {
    event.stopPropagation();
    itemToDelete = item;
    showDeleteDialog = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
    itemToDelete = null;
    isDeletingItem = false;
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) return;

    isDeletingItem = true;
    try {
      const success = await deleteEntity(
        itemToDelete.shortname,
        spaceName,
        actualSubpath,
        itemToDelete.resource_type,
      );
      if (success) {
        successToastMessage($_("toast.item_deleted"));
        await loadContents();
        closeDeleteDialog();
      } else {
        errorToastMessage($_("toast.item_delete_failed"));
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      errorToastMessage($_("toast.item_delete_failed") + ": " + err.message);
    } finally {
      isDeletingItem = false;
    }
  }

  function getItemIcon(item: any): string {
    switch (item.resource_type) {
      case "folder":
        return "📁";
      case "content":
        return "📄";
      case "post":
        return "📝";
      case "ticket":
        return "🎫";
      case "user":
        return "👤";
      case "media":
        return "🖼️";
      default:
        return "📋";
    }
  }

  function getResourceTypeColor(resourceType: string): string {
    switch (resourceType) {
      case "folder":
        return "bg-blue-100 text-blue-800";
      case "content":
        return "bg-green-100 text-green-800";
      case "post":
        return "bg-purple-100 text-purple-800";
      case "ticket":
        return "bg-orange-100 text-orange-800";
      case "user":
        return "bg-indigo-100 text-indigo-800";
      case "media":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getDisplayName(item: any): string {
    if (item.attributes?.displayname) {
      return (
        item.attributes.displayname[$locale] ||
        item.attributes.displayname.en ||
        item.attributes.displayname.ar ||
        item.shortname
      );
    }
    return item.shortname || "Unnamed Item";
  }

  function getDescription(item: any): string {
    if (item.attributes?.description) {
      return (
        item.attributes.description[$locale] ||
        item.attributes.description.en ||
        item.attributes.description.ar ||
        "No description available"
      );
    }
    return "No description available";
  }

  function formatDate(dateString: string): string {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale);
  }

  function goBack() {
    $goto("/dashboard/admin");
  }
</script>

<div class="min-h-screen bg-gray-50" class:rtl={$isRTL}>
  <div class="bg-white border-b border-gray-100" class:rtl={$isRTL}>
    <div class="container mx-auto px-4 py-8 max-w-5xl">
      <div class="flex items-start justify-between">
        <button
          onclick={goBack}
          class="flex items-center text-gray-500 hover:text-gray-900 transition-colors duration-200 text-sm font-medium pt-1"
          class:flex-row-reverse={$isRTL}
          aria-label={$_("admin_space.navigation.go_back")}
        >
          <svg
            class="w-4 h-4 mr-2"
            class:mr-2={!$isRTL}
            class:ml-2={$isRTL}
            class:rotate-180={$isRTL}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            ></path>
          </svg>
        </button>

        <div
          class="flex-1 ml-6 text-left"
          class:mr-6={$isRTL}
          class:text-right={$isRTL}
        >
          <h1 class="text-[26px] leading-[30px] font-bold text-gray-900 mb-1">
            <span class="capitalize">{spaceName}</span> Space
          </h1>
          <!--          <p class="text-[14px] font-medium text-indigo-400">-->
          <!--            Full administrative access to manage all content-->
          <!--          </p>-->
        </div>

        <button
          onclick={handleCreateFolder}
          class="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 shadow-sm"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            ></path>
          </svg>
          Create Folder
        </button>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 pb-12 max-w-5xl">
    {#if isLoading}
      <div class="flex items-center justify-center py-32">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else if error}
      <div class="text-center py-16" class:text-right={$isRTL}>
        <div
          class="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          {$_("admin_space.error.title")}
        </h3>
        <p class="text-gray-600">{error}</p>
      </div>
    {:else if allContents.length === 0}
      <div class="text-center py-16" class:text-right={$isRTL}>
        <div
          class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 13h6m-3-3v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          {$_("admin_space.empty.title")}
        </h3>
        <p class="text-gray-600">
          {$_("admin_space.empty.description")}
        </p>
      </div>
    {:else}
      <!-- Search and Filter Section -->
      <div
        class="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-6 mb-8 mt-4"
      >
        <div class="mb-6">
          <h2 class="text-base font-bold text-gray-900">
            Manage Spaces ({displayedContents.length})
          </h2>
          <!--          <p class="text-[13px] text-gray-400 mt-1">-->
          <!--            Administrative access to all spaces-->
          <!--          </p>-->
        </div>

        <div class="space-y-4">
          <!-- Search spaces -->
          <div>
            <label
              for="search-input"
              class="block text-[13px] font-medium text-gray-500 mb-1.5"
              >Search Spaces</label
            >
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              >
                <svg
                  class="h-4 w-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </div>
              <input
                id="search-input"
                type="text"
                bind:value={searchQuery}
                placeholder={$_("route_labels.placeholder_search_by_name_desc")}
                class="block w-full pl-9 pr-10 py-2.5 text-sm border-none bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
              />
              {#if searchQuery}
                <button
                  onclick={() => {
                    searchQuery = "";
                  }}
                  class="absolute inset-y-0 right-0 pr-3 flex items-center justify-center hover:text-gray-600 transition-colors"
                >
                  <svg
                    class="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              {/if}
            </div>
          </div>

          <div class="flex gap-4">
            <!-- Type Filter -->
            <div class="flex-1">
              <label
                for="type-filter"
                class="block text-[13px] font-medium text-indigo-500 mb-1.5 ml-1"
                >Type</label
              >
              <select
                id="type-filter"
                bind:value={selectedType}
                onchange={applyFilters}
                class="block w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-xl text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                {#each typeOptions as option}
                  <option value={option.value}
                    >{option.label === "All"
                      ? option.label
                      : option.label}</option
                  >
                {/each}
              </select>
            </div>

            <!-- Status Filter -->
            <div class="flex-1">
              <label
                for="status-filter"
                class="block text-[13px] font-medium text-indigo-500 mb-1.5 ml-1"
                >Status</label
              >
              <select
                id="status-filter"
                bind:value={selectedStatus}
                onchange={applyFilters}
                class="block w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-xl text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                {#each statusOptions as option}
                  <option value={option.value}
                    >{option.label === "All"
                      ? option.label
                      : option.label}</option
                  >
                {/each}
              </select>
            </div>
          </div>

          <div>
            <label
              for="sort-by"
              class="block text-[13px] font-medium text-indigo-500 mb-1.5 ml-1"
              >Sort By</label
            >
            <div class="flex gap-2 items-center">
              <select
                id="sort-by"
                bind:value={sortBy}
                onchange={applyFilters}
                class="block w-auto min-w-[200px] px-3 py-2 text-sm border-none bg-gray-50 rounded-xl text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                {#each sortOptions as option}
                  <option value={option.value}
                    >{option.label === "Name"
                      ? option.label
                      : option.label}</option
                  >
                {/each}
              </select>
              <button
                onclick={toggleSortOrder}
                class="h-[36px] w-[36px] flex items-center justify-center bg-gray-50 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-indigo-500"
                title={$_("search_filters.toggle_sort")}
                aria-label={$_("search_filters.toggle_sort")}
              >
                <svg
                  class="w-4 h-4 {sortOrder === 'desc'
                    ? 'rotate-180'
                    : ''} transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      {#if displayedContents.length === 0 && isSearchActive}
        <div class="text-center py-12">
          <svg
            class="mx-auto w-12 h-12 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.291-1.007-5.691-2.709M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            ></path>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            {$_("search_filters.no_results_title")}
          </h3>
          <p class="text-gray-500 mb-4">
            {$_("search_filters.no_results_description")}
          </p>
          <button
            onclick={clearFilters}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {$_("search_filters.clear_filters")}
          </button>
        </div>
      {:else}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {#each displayedContents as item}
            <div
              class="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-indigo-100 cursor-pointer transition-all duration-300 group flex flex-col h-full"
              onclick={() => handleItemClick(item)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleItemClick(item);
                }
              }}
            >
              <!-- Card Header: Icon, Title, and Actions -->
              <div
                class="flex items-start justify-between mb-4"
                class:flex-row-reverse={$isRTL}
              >
                <div
                  class="flex gap-4 min-w-0 flex-1"
                  class:flex-row-reverse={$isRTL}
                >
                  <div
                    class="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                  >
                    {getItemIcon(item)}
                  </div>
                  <div class="flex-1 min-w-0" class:text-right={$isRTL}>
                    <h3
                      class="text-base font-bold text-gray-900 truncate"
                      title={getDisplayName(item)}
                    >
                      {getDisplayName(item)}
                    </h3>
                    <p
                      class="text-sm text-gray-500 mt-1 mb-2 line-clamp-2 min-h-[40px]"
                    >
                      {getDescription(item) !== "No description available"
                        ? getDescription(item)
                        : "No description provided."}
                    </p>
                  </div>
                </div>

                {#if item.resource_type === "folder"}
                  <div class="relative pt-1 pl-2">
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        handleEditFolder(item);
                      }}
                      class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors bg-gray-50 mb-1 block opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Edit folder"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        ></path>
                      </svg>
                    </button>
                    <button
                      onclick={(e) => openDeleteDialog(item, e)}
                      class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-gray-50 block opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete folder"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                {/if}
              </div>

              <div class="flex-grow"></div>

              <div
                class="mt-2 pt-4 border-t border-gray-100 flex items-center justify-between"
              >
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium {item
                    .attributes?.is_active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'}"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full {item.attributes?.is_active
                      ? 'bg-emerald-500'
                      : 'bg-red-500'} mr-1.5"
                  ></span>
                  {item.attributes?.is_active
                    ? $_("status.active")
                    : $_("status.inactive")}
                </span>

                {#if item.attributes?.created_at}
                  <span class="text-xs text-gray-400 font-medium">
                    {formatDate(item.attributes.created_at)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<Modal
  title={isEditMode
    ? $_("admin_space.modal.edit.title")
    : $_("admin_space.modal.create.title")}
  bind:open={showCreateFolderModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <p class="text-sm text-gray-500 -mt-2 mb-4">
    {isEditMode
      ? $_("admin_space.modal.edit.subtitle")
      : $_("admin_space.modal.create.subtitle")}
  </p>

  <div class="form-section">
    <div class="section-header" class:text-right={$isRTL}>
      <h4 class="section-title">
        {$_("admin_space.modal.basic_info.title")}
      </h4>
      <p class="section-description">
        {$_("admin_space.modal.basic_info.description")}
      </p>
    </div>
    <MetaForm
      bind:formData={metaContent}
      bind:validateFn={validateMetaForm}
      isCreate={!isEditMode}
    />
  </div>

  <div class="form-section mt-6">
    <div class="section-header" class:text-right={$isRTL}>
      <h4 class="section-title">
        {$_("admin_space.modal.folder_config.title")}
      </h4>
      <p class="section-description">
        {$_("admin_space.modal.folder_config.description")}
      </p>
    </div>
    <FolderForm
      bind:content={folderContent}
      space_name={spaceName}
      on:foo={handleSaveFolder}
    />
  </div>

  {#snippet footer()}
    <button
      onclick={() => (showCreateFolderModal = false)}
      class="btn btn-secondary"
      disabled={isCreatingFolder}
    >
      {$_("admin_space.modal.cancel")}
    </button>
    <button
      onclick={handleSaveFolder}
      class="btn btn-primary"
      disabled={isCreatingFolder}
    >
      {#if isCreatingFolder}
        <Diamonds size="20" color="#ffffff" />
        {isEditMode
          ? $_("admin_space.modal.updating")
          : $_("admin_space.modal.creating")}
      {:else}
        {isEditMode
          ? $_("admin_space.modal.updatebtn")
          : $_("admin_space.modal.createbtn")}
      {/if}
    </button>
  {/snippet}
</Modal>

<DeleteConfirmationDialog
  bind:open={showDeleteDialog}
  title={$_("delete")}
  itemName={itemToDelete ? getDisplayName(itemToDelete) : ""}
  itemType={itemToDelete?.resource_type || "item"}
  isDeleting={isDeletingItem}
  onConfirm={handleConfirmDelete}
  onCancel={closeDeleteDialog}
/>

<style>
  .rtl {
    direction: rtl;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.75rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 120px;
    justify-content: center;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-secondary {
    background: #f8fafc;
    color: #475569;
    border: 2px solid #e2e8f0;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  .btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
