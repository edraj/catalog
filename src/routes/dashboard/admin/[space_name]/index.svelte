<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params } from "@roxi/routify";
  import { deleteEntity, getSpaceContents } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import FolderForm from "@/components/forms/FolderForm.svelte";
  import MetaForm from "@/components/forms/MetaForm.svelte";
  import { formatNumberInText } from "@/lib/helpers";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let isLoading = $state(false);
  let allContents = $state([]);
  let displayedContents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let actualSubpath = $state("");
  let isEditMode = $state(false);
  let selectedFolderForEdit = $state(null);

  let searchQuery = $state("");
  let selectedType = $state("all");
  let selectedStatus = $state("all");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let isSearchActive = $state(false);

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
        true
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
        await loadContents();
      } else {
        const errorMessage = isEditMode
          ? $_("admin_space.error.update_folder_failed")
          : $_("admin_space.error.create_folder_failed");
        alert(errorMessage);
      }
    } catch (err) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} folder:`,
        err
      );
      const errorMessage = isEditMode
        ? $_("admin_space.error.update_folder_error")
        : $_("admin_space.error.create_folder_error");
      alert(errorMessage + ": " + err.message);
    } finally {
      isCreatingFolder = false;
    }
  }

  async function handleDeleteItem(item: any, event: Event) {
    event.stopPropagation();

    if (
      !confirm(
        $_("admin_space.confirm.delete_item", {
          values: { name: item.shortname },
        })
      )
    ) {
      return;
    }

    try {
      const success = await deleteEntity(
        item.shortname,
        spaceName,
        actualSubpath,
        item.resource_type
      );
      if (success) {
        await loadContents();
      }
    } catch (err) {
      console.error("Error deleting item:", err);
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
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4" class:space-x-reverse={$isRTL}>
          <button
            onclick={goBack}
            class="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
            class:flex-row-reverse={$isRTL}
            aria-label={$_("admin_space.navigation.go_back")}
          >
            <svg
              class="w-5 h-5 mr-2"
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
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
            {$_("admin_space.navigation.back_to_admin")}
          </button>
          <div class="h-6 w-px bg-gray-300"></div>
          <div class:text-right={$isRTL}>
            <h1 class="text-2xl font-bold text-gray-900 capitalize">
              {$_("admin_space.title", { values: { spaceName } })}
            </h1>
            <p class="text-gray-600">
              {$_("admin_space.subtitle")}
            </p>
          </div>
        </div>

        <button
          aria-label={`Create new folder`}
          onclick={handleCreateFolder}
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          class:flex-row-reverse={$isRTL}
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
          {$_("admin_space.actions.create_folder")}
        </button>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="flex justify-center py-16">
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
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div class="p-6 border-b border-gray-200">
          <div
            class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
          >
            <div class="flex-1">
              <h2 class="text-lg font-semibold text-gray-900 mb-2">
                {$_("admin_dashboard.manage_spaces", {
                  values: {
                    count: formatNumberInText(
                      displayedContents.length,
                      $locale
                    ),
                  },
                })}
              </h2>
              <p class="text-sm text-gray-600">
                {#if isSearchActive}
                  Showing {formatNumberInText(
                    displayedContents.length,
                    $locale
                  )} of {formatNumberInText(allContents.length, $locale)} spaces
                {:else}
                  {$_("admin_dashboard.admin_access_description")}
                {/if}
              </p>
            </div>
          </div>
        </div>

        <!-- Search and Filter Controls -->
        <div class="p-6 bg-gray-50 border-b border-gray-200">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <!-- Search Input -->
            <div class="lg:col-span-2">
              <label
                for="search"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("search_filters.search_label")}
              </label>
              <div class="relative">
                <div
                  class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                >
                  <svg
                    class="h-5 w-5 text-gray-400"
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
                <label for="search"></label>
                <input
                  id="search"
                  type="text"
                  bind:value={searchQuery}
                  placeholder={$_("search_filters.search_placeholder")}
                  class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
                {#if searchQuery}
                  <button
                    onclick={() => {
                      searchQuery = "";
                    }}
                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                    aria-label={$_("search_filters.clear_search")}
                  >
                    <svg
                      class="h-4 w-4 text-gray-400 hover:text-gray-600"
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

            <!-- Type Filter -->
            <div>
              <label
                for="type-filter"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                Type
              </label>
              <select
                id="type-filter"
                bind:value={selectedType}
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {#each typeOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <!-- Status Filter -->
            <div>
              <label
                for="status-filter"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("search_filters.status_label")}
              </label>
              <select
                id="status-filter"
                bind:value={selectedStatus}
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {#each statusOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <!-- Sort Options -->
            <div>
              <label
                for="sort-by"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("search_filters.sort_label")}
              </label>
              <div class="flex gap-2">
                <select
                  id="sort-by"
                  bind:value={sortBy}
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {#each sortOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <button
                  onclick={toggleSortOrder}
                  class="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  title={$_("search_filters.toggle_sort")}
                  aria-label={$_("search_filters.toggle_sort")}
                >
                  <svg
                    class="w-4 h-4 text-gray-600 {sortOrder === 'desc'
                      ? 'rotate-180'
                      : ''}"
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

          <!-- Clear Filters -->
          {#if isSearchActive}
            <div class="mt-4 flex items-center justify-between">
              <div class="text-sm text-gray-600">
                {$_("search_filters.results_count", {
                  values: {
                    displayed: formatNumberInText(
                      displayedContents.length,
                      $locale
                    ),
                    total: formatNumberInText(allContents.length, $locale),
                  },
                })}
                {#if searchQuery}
                  {$_("search_filters.results_for", {
                    values: { query: searchQuery },
                  })}
                {/if}
              </div>
              <button
                onclick={clearFilters}
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label={$_("search_filters.clear_filters")}
              >
                <svg
                  class="w-4 h-4 mr-1.5"
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
                {$_("search_filters.clear_filters")}
              </button>
            </div>
          {/if}
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
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {$_("search_filters.clear_filters")}
            </button>
          </div>
        {:else}
          <div
            class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-6"
          >
            {#each displayedContents as item}
              <div
                class="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer transition-all duration-200 p-4 group"
                onclick={() => handleItemClick(item)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleItemClick(item);
                  }
                }}
              >
                <div
                  class="flex items-start justify-between mb-3"
                  class:flex-row-reverse={$isRTL}
                >
                  <div
                    class="flex items-start space-x-3 flex-1 min-w-0"
                    class:space-x-reverse={$isRTL}
                    class:flex-row-reverse={$isRTL}
                  >
                    <div class="text-2xl">
                      {getItemIcon(item)}
                    </div>
                    <div class="flex-1 min-w-0" class:text-right={$isRTL}>
                      <h3 class="text-sm font-semibold text-gray-900 truncate">
                        {getDisplayName(item)}
                      </h3>
                      <p class="text-xs text-gray-500 mt-1">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getResourceTypeColor(
                            item.resource_type
                          )}"
                        >
                          {item.resource_type}
                        </span>
                      </p>
                    </div>
                    {#if item.resource_type === "folder"}
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          handleEditFolder(item);
                        }}
                        class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        aria-label="Edit folder"
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
                    {/if}
                  </div>
                  <button
                    onclick={(e) => handleDeleteItem(item, e)}
                    class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all duration-200 p-1"
                    aria-label={$_("admin_space.actions.delete_item")}
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

                <div class="space-y-2">
                  {#if getDescription(item) !== "No description available"}
                    <p
                      class="text-xs text-gray-600 line-clamp-2"
                      class:text-right={$isRTL}
                    >
                      {getDescription(item)}
                    </p>
                  {/if}

                  <div
                    class="flex items-center justify-between text-xs text-gray-500"
                  >
                    <div
                      class="flex items-center space-x-2"
                      class:space-x-reverse={$isRTL}
                    >
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {item
                          .attributes?.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'}"
                      >
                        {item.attributes?.is_active
                          ? $_("status.active")
                          : $_("status.inactive")}
                      </span>
                    </div>

                    {#if item.attributes?.created_at}
                      <span class:text-right={$isRTL}>
                        {formatDate(item.attributes.created_at)}
                      </span>
                    {/if}
                  </div>

                  {#if item.attributes?.owner_shortname}
                    <div
                      class="flex items-center space-x-2 text-xs text-gray-500"
                      class:space-x-reverse={$isRTL}
                      class:flex-row-reverse={$isRTL}
                    >
                      <div
                        class="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center"
                      >
                        <span class="text-xs font-medium text-gray-600">
                          {item.attributes.owner_shortname
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <span>{item.attributes.owner_shortname}</span>
                    </div>
                  {/if}

                  {#if item.subpath && item.subpath !== "/"}
                    <p
                      class="text-xs text-blue-600 mt-1 truncate"
                      class:text-right={$isRTL}
                    >
                      {item.subpath}
                    </p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if showCreateFolderModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">
            {isEditMode
              ? $_("admin_space.modal.edit.title")
              : $_("admin_space.modal.create.title")}
          </h3>
          <p class="modal-subtitle">
            {isEditMode
              ? $_("admin_space.modal.edit.subtitle")
              : $_("admin_space.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_space.modal.close")}
        >
          <svg
            class="w-6 h-6"
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
      </div>

      <div class="modal-content">
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

        <div class="form-section">
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
      </div>

      <div class="modal-footer" class:flex-row-reverse={$isRTL}>
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
      </div>
    </div>
  </div>
{/if}

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

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 80rem;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    border-radius: 16px 16px 0 0;
    flex-shrink: 0;
  }

  .rtl .modal-header {
    flex-direction: row-reverse;
  }

  .modal-header-content {
    flex: 1;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .modal-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .modal-close-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-close-btn:hover {
    background: #f3f4f6;
    color: #374151;
    transform: scale(1.05);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-height: 0;
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

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
    border-radius: 0 0 16px 16px;
    flex-shrink: 0;
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

  @media (max-width: 1024px) {
    .modal-container {
      max-width: 95vw;
      margin: 0.5rem;
    }

    .modal-header {
      padding: 1rem 1.5rem;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .modal-container {
      max-width: 100vw;
      max-height: 100vh;
      margin: 0;
      border-radius: 0;
    }

    .modal-header {
      padding: 1rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .rtl .modal-header {
      align-items: flex-end;
    }

    .modal-header-content {
      flex: none;
      width: 100%;
    }

    .modal-close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }

    .rtl .modal-close-btn {
      right: auto;
      left: 1rem;
    }

    .modal-content {
      padding: 1rem;
    }

    .modal-footer {
      padding: 1rem;
      flex-direction: column-reverse;
    }

    .rtl .modal-footer {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }

  .modal-content::-webkit-scrollbar {
    width: 8px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>
