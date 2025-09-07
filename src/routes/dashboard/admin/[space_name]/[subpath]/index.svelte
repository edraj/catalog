<script lang="ts">
    import {onMount} from "svelte";
    import {goto, params} from "@roxi/routify";
    import {deleteEntity, getAvatar, getSpaceContents,} from "@/lib/dmart_services";
    import {Diamonds} from "svelte-loading-spinners";
    import {_, locale} from "@/i18n";
    import {Dmart, RequestType, ResourceType} from "@edraj/tsdmart";
    import {derived, writable} from "svelte/store";
    import MetaForm from "@/components/forms/MetaForm.svelte";
    import FolderForm from "@/components/forms/FolderForm.svelte";
    import Avatar from "@/components/Avatar.svelte";
    import {formatNumber} from "@/lib/helpers";
    import SchemaForm from "@/components/forms/SchemaForm.svelte";

    $goto;

  let isLoading = writable(false);
  let isLoadingMore = writable(false);
  let allContents = writable([]);
  let displayedContents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let subpath = "";
  let actualSubpath = writable("");
  let breadcrumbs = $state([]);

  let currentOffset = $state(0);
  let itemsPerLoad = $state(20);
  let totalItemsCount = $state(0);
  let hasMoreItems = $state(true);
  let isInitialLoad = $state(true);
  let containTemplates = $state(false);
  const itemsPerLoadOptions = [20, 50, 100];

  // let currentDisplayCount = $state(itemsPerLoad);

  let filteredContents = $state([]);

  let searchQuery = $state("");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let selectedType = $state("all");
  let selectedStatus = $state("all");

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

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

  async function initializeContent() {
    spaceName = $params.space_name;
    subpath = $params.subpath;
    $actualSubpath = subpath.replace(/-/g, "/");

    const pathParts = $actualSubpath
      .split("/")
      .filter((part) => part.length > 0);
    breadcrumbs = [
      { name: $_("admin_content.breadcrumb.admin"), path: "/dashboard/admin" },
      { name: spaceName, path: `/dashboard/admin/${spaceName}` },
    ];

    let currentPath = "";
    let currentUrlPath = "";
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      currentUrlPath += (index === 0 ? "" : "-") + part;
      breadcrumbs.push({
        name: part,
        path:
          index === pathParts.length - 1
            ? null
            : `/dashboard/admin/${spaceName}/${currentUrlPath}`,
      });
    });

    currentOffset = 0;
    hasMoreItems = true;
    await loadContents(true);
  }

  onMount(async () => {
    await initializeContent();
  });

  // The initialization should only happen on mount, not on every param change

  async function loadContents(reset = false) {
    if (reset && $isLoading) return;
    if (!reset && ($isLoadingMore || !hasMoreItems)) return;

    if (reset) {
      $isLoading = true;
      currentOffset = 0;
      $allContents = [];
      filteredContents = [];
      displayedContents = [];
      isInitialLoad = true;
    } else {
      $isLoadingMore = true;
    }

    error = null;

    try {
      const parent = await getSpaceContents(
        spaceName,
        "/",
        "managed",
        100,
        0,
        true
      );
      for (const item of parent?.records) {
        if (
          item?.attributes?.payload?.body?.content_schema_shortnames?.includes(
            "templates"
          ) &&
          item?.shortname == `${$actualSubpath}`
        ) {
          containTemplates = true;
        }
      }
      const response = await getSpaceContents(
        spaceName,
        `/${$actualSubpath}`,
        "managed",
        itemsPerLoad,
        currentOffset
      );

      if (response && response.records) {
        const enhancedItems = await Promise.all(
          response.records.map(async (item) => {
            let avatarUrl = "";
            try {
              const result = getAvatar(item.attributes?.owner_shortname);
              avatarUrl = result instanceof Promise ? await result : result;
            } catch {
              avatarUrl = "";
            }
            return { ...item, avatarUrl };
          })
        );

        if (reset) {
          $allContents = enhancedItems;
        } else {
          $allContents = [...$allContents, ...enhancedItems];
        }

        currentOffset += itemsPerLoad;
        hasMoreItems = enhancedItems.length === itemsPerLoad;

        if (reset) {
          totalItemsCount = enhancedItems.length;
        }

        applyFilters();
      } else {
        if (reset) {
          $allContents = [];
          filteredContents = [];
          displayedContents = [];
          totalItemsCount = 0;
          hasMoreItems = false;
        }
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = $_("admin_content.error.failed_load_contents");
      if (reset) {
        $allContents = [];
        filteredContents = [];
        displayedContents = [];
        totalItemsCount = 0;
        hasMoreItems = false;
      }
    } finally {
      if (reset) {
        $isLoading = false;
        isInitialLoad = false;
      } else {
        $isLoadingMore = false;
      }
    }
  }

  function applyFilters() {
    let filtered = [...$allContents];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getDisplayName(item).toLowerCase();
        const shortname = item.shortname.toLowerCase();
        const description = getDescription(item).toLowerCase();
        const owner = (item.attributes?.owner_shortname || "").toLowerCase();

        return (
          displayName.includes(query) ||
          shortname.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
      });
    }

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.resource_type === selectedType);
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => {
        const isActive = item.attributes?.is_active;
        return selectedStatus === "active" ? isActive : !isActive;
      });
    }

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = getDisplayName(a).toLowerCase();
          bValue = getDisplayName(b).toLowerCase();
          break;
        case "type":
          aValue = a.resource_type;
          bValue = b.resource_type;
          break;
        case "owner":
          aValue = (a.attributes?.owner_shortname || "").toLowerCase();
          bValue = (b.attributes?.owner_shortname || "").toLowerCase();
          break;
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.created_at || 0);
          break;
        case "updated":
          aValue = new Date(a.attributes?.updated_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        default:
          aValue = a.shortname.toLowerCase();
          bValue = b.shortname.toLowerCase();
      }

      let result;
      if (aValue > bValue) result = 1;
      else if (aValue < bValue) result = -1;
      else result = 0;

      return sortOrder === "desc" ? -result : result;
    });

    filteredContents = filtered;
    // Reset display count when filters change
    // currentDisplayCount = itemsPerLoad;
    updateDisplayedContents();
  }

  function updateDisplayedContents() {
    displayedContents = filteredContents;
  }

  function loadMoreItems() {
    if ($isLoadingMore || !hasMoreItems) return;
    loadContents(false);
  }

  function handleItemsPerLoadChange(newItemsPerLoad) {
    itemsPerLoad = newItemsPerLoad;
    loadContents(true);
  }

  function handleItemClick(item) {
    if (item.resource_type === "folder") {
      const newSubpath = `${subpath}-${item.shortname}`;
      $goto("/dashboard/admin/[space_name]/[subpath]", {
        space_name: spaceName,
        subpath: newSubpath,
      });
    } else {
      $goto(
        "/dashboard/admin/[space_name]/[subpath]/[shortname]/[resource_type]",
        {
          space_name: spaceName,
          subpath: subpath,
          shortname: item.shortname,
          resource_type: item.resource_type,
        }
      );
    }
  }

  function handleCreateItem() {
    if (containTemplates) {
      $goto("/dashboard/admin/[space_name]/[subpath]/create", {
        space_name: spaceName,
        subpath: $actualSubpath,
      });
    } else {
      $goto("/entries/create", {
        space_name: spaceName,
        subpath: $actualSubpath,
      });
    }
  }

  async function handleDeleteItem(item, event) {
    event.stopPropagation();

    if (
      !confirm(
        $_("admin_content.confirm.delete_item", {
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
        `/${$actualSubpath}`,
        item.resource_type
      );
      if (success) {
        await loadContents(true);
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }

  function getItemIcon(item) {
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

  function getResourceTypeColor(resourceType) {
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

  function getDisplayName(item) {
    if (item.attributes?.displayname) {
      return (
        item.attributes.displayname.ar ||
        item.attributes.displayname.en ||
        item.shortname
      );
    }
    return item.shortname;
  }

  function getDescription(item) {
    if (item.attributes?.description) {
      return (
        item.attributes.description.ar || item.attributes.description.en || ""
      );
    }
    return "";
  }

  function formatDate(dateString) {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale);
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} ${$_("catalog_contents.time.minutes_ago")}`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} ${$_("catalog_contents.time.hours_ago")}`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)} ${$_("catalog_contents.time.days_ago")}`;
    return formatDate(dateString);
  }

  function navigateToBreadcrumb(path) {
    if (path) {
      $goto(path);
    }
  }

  function clearFilters() {
    searchQuery = "";
    selectedType = "all";
    selectedStatus = "all";
    sortBy = "name";
    sortOrder = "asc";
    // currentDisplayCount = itemsPerLoad;
    applyFilters();
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    applyFilters();
  }

  function handleCardTagClick(event, tag) {
    event.stopPropagation();
    // Admin pages don't have tag filtering like catalog pages
  }

  const filteredContentsDerived = $derived.by(() => {
    let filtered = [...$allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getDisplayName(item).toLowerCase();
        const shortname = item.shortname.toLowerCase();
        const description = getDescription(item).toLowerCase();
        const owner = (item.attributes?.owner_shortname || "").toLowerCase();

        return (
          displayName.includes(query) ||
          shortname.includes(query) ||
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
          aValue = a.resource_type;
          bValue = b.resource_type;
          break;
        case "owner":
          aValue = (a.attributes?.owner_shortname || "").toLowerCase();
          bValue = (b.attributes?.owner_shortname || "").toLowerCase();
          break;
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.created_at || 0);
          break;
        case "updated":
          aValue = new Date(a.attributes?.updated_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        default:
          aValue = a.shortname.toLowerCase();
          bValue = b.shortname.toLowerCase();
      }

      let result;
      if (aValue > bValue) result = 1;
      else if (aValue < bValue) result = -1;
      else result = 0;

      return sortOrder === "desc" ? -result : result;
    });

    return filtered;
  });

  const displayedContentsDerived = $derived.by(() => {
    return filteredContents;
  });

  const totalItemsDerived = $derived.by(() => filteredContents.length);

  const hasMoreItemsDerived = $derived.by(() => hasMoreItems);

  let isCreatingFolder = $state(false);
  let metaContent: any = $state({});
  let showCreateFolderModal = $state(false);
  let validateMetaForm = $state(null);
  let folderContent = $state({
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
  });

  function handleCreateFolder() {
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

  async function handleSaveFolder(event) {
    event.preventDefault();
    isCreatingFolder = true;

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: ResourceType.folder,
            shortname: metaContent.shortname || "auto",
            subpath: `/${$actualSubpath}`,
            attributes: {
              displayname: metaContent.displayname,
              description: metaContent.description,
              payload: {
                body: folderContent,
                content_type: "json",
              },
            },
          },
        ],
      });

      if (response) {
        showCreateFolderModal = false;
        await loadContents(true);
      } else {
        alert($_("admin_content.error.create_folder_failed"));
      }
    } catch (err) {
      console.error("Error creating folder:", err);
      alert($_("admin_content.error.create_folder_error") + ": " + err.message);
    } finally {
      isCreatingFolder = false;
    }
  }

  let showCreateSchemaModal = $state(false);
  let schemaContent = $state({});
  let isCreatingSchema = $state(false);

  function handleCreateSchema() {
    schemaContent = {};
    showCreateSchemaModal = true;
  }

  async function handleSaveschema(event) {
    event.preventDefault();
    isCreatingSchema = true;
    console.log("-------------", schemaContent);

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: ResourceType.schema,
            shortname: metaContent.shortname || "auto",
            subpath: `/${$actualSubpath}`,
            attributes: {
              displayname: metaContent.displayname,
              description: metaContent.description,
              payload: {
                body: schemaContent,
                content_type: "json",
              },
            },
          },
        ],
      });

      if (response) {
        showCreateSchemaModal = false;
        await loadContents(true);
      } else {
        alert($_("admin_content.error.create_schema_failed"));
      }
    } catch (err) {
      console.error("Error creating schema:", err);
      alert($_("admin_content.error.create_schema_error") + ": " + err.message);
    } finally {
      isCreatingSchema = false;
    }
  }
</script>

<div class="admin-contents-page" class:rtl={$isRTL}>
  <div class="header-section">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <nav class="flex mb-4" aria-label={$_("admin_content.breadcrumb.label")}>
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          {#each breadcrumbs as crumb, index}
            <li class="inline-flex items-center">
              {#if index > 0}
                <svg
                  class="breadcrumb-separator"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
              {/if}
              {#if crumb.path}
                <button
                  onclick={() => navigateToBreadcrumb(crumb.path)}
                  class="breadcrumb-link"
                  aria-label={crumb.name}
                >
                  {crumb.name}
                </button>
              {:else}
                <span class="breadcrumb-current">
                  {crumb.name}
                </span>
              {/if}
            </li>
          {/each}
        </ol>
      </nav>

      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">
            {$_("admin_content.title", {
              values: {
                name:
                  breadcrumbs[breadcrumbs.length - 1]?.name ||
                  $actualSubpath.split("/").pop(),
              },
            })}
          </h1>
          <p class="page-description">
            {$_("admin_content.subtitle", {
              values: { spaceName, subpath: $actualSubpath },
            })}
          </p>
        </div>

        <div
          class="flex items-center space-x-3"
          class:space-x-reverse={$isRTL}
          class:flex-row-reverse={$isRTL}
        >
          {#if $actualSubpath !== "/" && $actualSubpath !== ""}
            <button
              onclick={handleCreateItem}
              class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              aria-label={$_("admin_content.actions.create_new_item")}
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
                  d="M12 4v16m8-8H4m4-8h8v8H8z"
                />
              </svg>
              {$_("admin_content.actions.create_new_item")}
            </button>

            <button
              onclick={handleCreateFolder}
              class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              class:flex-row-reverse={$isRTL}
              aria-label={$_("admin_content.actions.create_folder")}
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
                  d="M3 7h4l2-2h8l2 2h2v10H3V7z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 10v4m2-2h-4"
                />
              </svg>
              {$_("admin_content.actions.create_folder")}
            </button>
            {#if $actualSubpath === "schema"}
              <button
                onclick={handleCreateSchema}
                class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                class:flex-row-reverse={$isRTL}
                aria-label={$_("admin_content.actions.create_schema")}
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
                    d="M16 18l6-6-6-6M8 6l-6 6 6 6"
                  />
                </svg>
                {$_("admin_content.actions.create_schema")}
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if $isLoading || isInitialLoad}
      <div class="loading-state">
        <Diamonds color="#3b82f6" size="60" unit="px" />
        <p class="loading-text">{$_("admin_content.loading")}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">
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
        <h3 class="error-title">
          {$_("admin_content.error.title")}
        </h3>
        <p class="error-message">{error}</p>
        <button onclick={() => loadContents(true)} class="retry-button">
          {$_("admin_content.error.try_again")}
        </button>
      </div>
    {:else}
      <div class="search-filter-section">
        <div class="search-filter-header">
          <h2 class="section-title">{$_("admin_content.filters.title")}</h2>
          {#if searchQuery || selectedType !== "all" || selectedStatus !== "all"}
            <button onclick={clearFilters} class="clear-all-filters-button">
              {$_("admin_content.filters.clear_all")}
            </button>
          {/if}
        </div>

        <div class="search-filter-controls">
          <div class="filter-controls">
            <div class="filter-group">
              <label class="filter-label" for="sort-by"
                >{$_("admin_content.filters.sort_by")}</label
              >
              <div class="sort-controls">
                <select
                  bind:value={sortBy}
                  class="filter-select sort-select"
                  aria-label={$_("admin_content.filters.sort_by")}
                  onchange={() => applyFilters()}
                  id="sort-by"
                >
                  {#each sortOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <button
                  onclick={toggleSortOrder}
                  class="sort-order-button"
                  title={$_("admin_content.filters.toggle_sort")}
                  aria-label={$_("admin_content.filters.toggle_sort")}
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {#if sortOrder === "asc"}
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                      ></path>
                    {:else}
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l-4-4"
                      ></path>
                    {/if}
                  </svg>
                </button>
              </div>
            </div>

            <div class="filter-group">
              <label class="filter-label" for="type-select"
                >{$_("admin_item_detail.relationships.headers.type")}</label
              >
              <select
                bind:value={selectedType}
                class="filter-select"
                onchange={() => applyFilters()}
                id="type-select"
              >
                {#each typeOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label" for="status-select"
                >{$_("admin_dashboard.table.status")}</label
              >
              <select
                bind:value={selectedStatus}
                class="filter-select"
                onchange={() => applyFilters()}
                id="status-select"
              >
                {#each statusOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label" for="items-per-load"
                >{$_("admin_content.infinite_scroll.items_per_load")}</label
              >
              <select
                bind:value={itemsPerLoad}
                onchange={(e) =>
                  handleItemsPerLoadChange(
                    parseInt((e.target as HTMLSelectElement).value)
                  )}
                class="filter-select"
                aria-label={$_("admin_content.infinite_scroll.items_per_load")}
                id="items-per-load"
              >
                {#each itemsPerLoadOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="search-input-group">
            <div class="search-input-wrapper">
              <svg
                class="search-icon"
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
              <label for="search-input"></label>
              <input
                type="text"
                bind:value={searchQuery}
                placeholder={$_("admin_content.search.placeholder")}
                class="search-input"
                aria-label={$_("admin_content.search.label")}
                oninput={() => applyFilters()}
              />
              {#if searchQuery}
                <button
                  onclick={() => {
                    searchQuery = "";
                    applyFilters();
                  }}
                  class="clear-search-button"
                  aria-label={$_("admin_content.search.clear")}
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
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              {/if}
            </div>
          </div>
        </div>

        <div class="results-summary">
          <div class="results-info">
            {$_("admin_content.infinite_scroll.showing_of", {
              values: {
                displayed: formatNumber(
                  displayedContentsDerived.length,
                  $locale
                ),
                total: formatNumber(totalItemsDerived, $locale),
              },
            })}
            {#if searchQuery}
              {$_("admin_content.results.for_query", {
                values: { query: searchQuery },
              })}
            {/if}
          </div>
        </div>
      </div>

      {#if totalItemsDerived !== 0}
        <div class="card-list-container">
          <div class="card-list">
            {#each displayedContentsDerived as item, index}
              <div
                class="admin-content-card"
                onclick={() => handleItemClick(item)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleItemClick(item);
                  }
                }}
              >
                <div class="card-avatar">
                  {#if item.attributes?.owner_shortname}
                    {#await getAvatar(item.attributes?.owner_shortname) then avatar}
                      <Avatar
                        src={avatar}
                        size="40"
                        alt={item.attributes?.owner_shortname}
                      />
                    {/await}
                    <div class="avatar-fallback">
                      {item.attributes?.owner_shortname.charAt(0).toUpperCase()}
                    </div>
                  {:else}
                    <div class="avatar-unknown">
                      <span class="text-sm font-medium text-gray-600">?</span>
                    </div>
                  {/if}
                </div>

                <div class="card-content">
                  <div class="card-header">
                    <h3 class="card-title">
                      <span class="title-icon">{getItemIcon(item)}</span>
                      {getDisplayName(item)}
                    </h3>
                    <span
                      class="resource-type-badge {getResourceTypeColor(
                        item.resource_type
                      )}"
                    >
                      {item.resource_type}
                    </span>
                  </div>

                  <div class="card-meta">
                    <span class="meta-text"
                      >{$_("admin_content.card.managed_by")}</span
                    >
                    <span class="meta-author">
                      {item.attributes?.owner_shortname || $_("common.unknown")}
                    </span>
                    <span class="meta-separator">•</span>
                    <span class="meta-time">
                      {formatRelativeTime(item.attributes?.created_at)}
                    </span>
                  </div>

                  {#if getDescription(item)}
                    <div class="card-description">
                      <p class="description-text">
                        {getDescription(item)}
                      </p>
                    </div>
                  {/if}

                  <div class="card-details">
                    <div class="detail-item">
                      <span class="detail-label"
                        >{$_("admin_dashboard.table.status")} :</span
                      >
                      <span
                        class="status-badge {item.attributes?.is_active
                          ? 'status-active'
                          : 'status-inactive'}"
                      >
                        {item.attributes?.is_active
                          ? $_("admin_content.status.active")
                          : $_("admin_content.status.inactive")}
                      </span>
                    </div>
                    {#if item.subpath && item.subpath !== "/"}
                      <div class="detail-item">
                        <span class="detail-label"
                          >{$_("admin_content.card.path")} :</span
                        >
                        <span class="detail-value">{item.subpath}</span>
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="card-actions">
                  <div class="action-buttons">
                    {#if item.resource_type === "folder"}
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        class="action-button open-button"
                        title={$_("admin_content.actions.open")}
                        aria-label={$_("admin_content.actions.open")}
                      >
                        <svg
                          class="action-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          ></path>
                        </svg>
                      </button>
                    {:else}
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        class="action-button view-button"
                        title={$_("admin_content.actions.view")}
                        aria-label={$_("admin_content.actions.view")}
                      >
                        <svg
                          class="action-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          ></path>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          ></path>
                        </svg>
                      </button>
                    {/if}

                    <button
                      onclick={(e) => handleDeleteItem(item, e)}
                      class="action-button delete-button"
                      title={$_("admin_content.actions.delete")}
                      aria-label={$_("admin_content.actions.delete")}
                    >
                      <svg
                        class="action-icon"
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
                </div>
              </div>
            {/each}
          </div>

          {#if hasMoreItemsDerived}
            <div class="load-more-section">
              <div class="load-more-info">
                <span class="load-more-text">
                  {$_("admin_content.infinite_scroll.showing_of", {
                    values: {
                      displayed: formatNumber(
                        displayedContentsDerived.length,
                        $locale
                      ),
                      total: formatNumber(totalItemsDerived, $locale),
                    },
                  })}
                </span>
              </div>
              <button
                onclick={loadMoreItems}
                disabled={$isLoadingMore}
                class="load-more-button"
                aria-label={$_("admin_content.infinite_scroll.load_more")}
              >
                {#if $isLoadingMore}
                  <div class="load-more-spinner">
                    <Diamonds color="#ffffff" size="20" unit="px" />
                  </div>
                  {$_("admin_content.infinite_scroll.loading")}
                {:else}
                  <svg
                    class="load-more-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    ></path>
                  </svg>
                  {$_("admin_content.infinite_scroll.load_more")}
                {/if}
              </button>
            </div>
          {:else if displayedContentsDerived.length > 0}
            <div class="end-of-results">
              <div class="end-of-results-icon">
                <svg
                  class="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <p class="end-of-results-text">
                {$_("admin_content.infinite_scroll.end_of_results")}
              </p>
              <p class="end-of-results-count">
                {$_("admin_content.infinite_scroll.total_items", {
                  values: { count: totalItemsDerived },
                })}
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">
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
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
          </div>
          <h3 class="empty-title">
            {$_("admin_content.empty.title")}
          </h3>
          <p class="empty-message">
            {searchQuery || selectedType !== "all" || selectedStatus !== "all"
              ? $_("admin_content.empty.no_matches")
              : $_("admin_content.empty.description")}
          </p>
          {#if searchQuery || selectedType !== "all" || selectedStatus !== "all"}
            <button onclick={clearFilters} class="clear-filters-button">
              {$_("admin_content.filters.clear_all")}
            </button>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showCreateFolderModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.modal.create.title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
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
              {$_("admin_content.modal.basic_info.title")}
            </h4>
            <p class="section-description">
              {$_("admin_content.modal.basic_info.description")}
            </p>
          </div>
          <MetaForm
            bind:formData={metaContent}
            bind:validateFn={validateMetaForm}
            isCreate={true}
          />
        </div>

        <div class="form-section">
          <div class="section-header" class:text-right={$isRTL}>
            <h4 class="section-title">
              {$_("admin_content.modal.folder_config.title")}
            </h4>
            <p class="section-description">
              {$_("admin_content.modal.folder_config.description")}
            </p>
          </div>
          <FolderForm bind:content={folderContent} on:foo={handleSaveFolder} />
        </div>
      </div>

      <div class="modal-footer" class:flex-row-reverse={$isRTL}>
        <button
          type="button"
          onclick={() => (showCreateFolderModal = false)}
          class="btn btn-secondary"
          disabled={isCreatingFolder}
        >
          {$_("admin_content.modal.cancel")}
        </button>
        <button
          onclick={handleSaveFolder}
          class="btn btn-primary"
          disabled={isCreatingFolder}
        >
          {#if isCreatingFolder}
            <div class="spinner"></div>
            {$_("admin_content.modal.creating")}
          {:else}
            {$_("admin_content.modal.create_folder")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCreateSchemaModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.modal.create.title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateSchemaModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
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

      <form onsubmit={handleSaveschema}>
        <div class="modal-content">
          <div class="form-section">
            <div class="section-header" class:text-right={$isRTL}>
              <h4 class="section-title">
                {$_("admin_content.modal.basic_info.title")}
              </h4>
              <p class="section-description">
                {$_("admin_content.modal.basic_info.description")}
              </p>
            </div>
            <MetaForm
              bind:formData={metaContent}
              bind:validateFn={validateMetaForm}
              isCreate={true}
            />
          </div>

          <div class="form-section">
            <div class="section-header" class:text-right={$isRTL}>
              <h4 class="section-title">
                {$_("admin_content.modal.basic_info.title")}
              </h4>
              <p class="section-description">
                {$_("admin_content.modal.basic_info.description")}
              </p>
            </div>
            <SchemaForm bind:content={schemaContent} />
          </div>
        </div>

        <div class="modal-footer" class:flex-row-reverse={$isRTL}>
          <button
            type="button"
            onclick={() => (showCreateSchemaModal = false)}
            class="btn btn-secondary"
            disabled={isCreatingSchema}
          >
            {$_("admin_content.modal.cancel")}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isCreatingSchema}
          >
            {#if isCreatingSchema}
              <div class="spinner"></div>
              {$_("admin_content.modal.creating")}
            {:else}
              {$_("admin_content.actions.create_schema")}
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .admin-contents-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
  }

  .rtl {
    direction: rtl;
  }

  /* Header Section */
  .header-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .rtl .header-content {
    text-align: right;
  }

  .header-info {
    flex: 1;
  }

  .page-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }

  .page-description {
    color: #64748b;
    font-size: 1.125rem;
  }

  /* Breadcrumb Styles */
  .breadcrumb-separator {
    width: 1rem;
    height: 1rem;
    color: #9ca3af;
    margin: 0 0.5rem;
  }

  .rtl .breadcrumb-separator {
    transform: rotate(180deg);
  }

  .breadcrumb-link {
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: none;
    background: none;
    cursor: pointer;
  }

  .breadcrumb-link:hover {
    color: #2563eb;
    background-color: rgba(59, 130, 246, 0.1);
    text-decoration: underline;
  }

  .breadcrumb-current {
    color: #1f2937;
    font-weight: 600;
    font-size: 0.875rem;
    background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
    padding: 0.5rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  /* State Components */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5rem 0;
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    color: #64748b;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .error-icon,
  .empty-icon {
    width: 6rem;
    height: 6rem;
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .empty-icon {
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    border: 1px solid rgba(107, 114, 128, 0.2);
  }

  .error-title,
  .empty-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .error-message,
  .empty-message {
    color: #64748b;
    font-size: 1.125rem;
    margin-bottom: 1.5rem;
  }

  .retry-button,
  .clear-filters-button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-radius: 0.5rem;
    font-weight: 500;
    border: 1px solid rgba(37, 99, 235, 0.3);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    cursor: pointer;
  }

  .retry-button:hover,
  .clear-filters-button:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
  }

  .search-filter-section {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .search-filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
  }

  .clear-all-filters-button {
    font-size: 0.875rem;
    color: #ef4444;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .clear-all-filters-button:hover {
    color: #dc2626;
    text-decoration: underline;
  }

  .search-filter-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .search-input-group {
    flex: 1;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    width: 1.25rem;
    height: 1.25rem;
    color: #9ca3af;
    z-index: 1;
    left: 0.75rem;
  }

  .rtl .search-icon {
    left: auto;
    right: 0.75rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.75rem;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.875rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .rtl .search-input {
    padding: 0.75rem 2.75rem 0.75rem 1rem;
    text-align: right;
  }

  .search-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .clear-search-button {
    position: absolute;
    color: #9ca3af;
    transition: color 0.2s ease;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    right: 0.75rem;
  }

  .rtl .clear-search-button {
    right: auto;
    left: 0.75rem;
  }

  .clear-search-button:hover {
    color: #6b7280;
    background-color: rgba(107, 114, 128, 0.1);
  }

  /* Filter Controls */
  .filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: end;
  }

  .rtl .filter-controls {
    flex-direction: row-reverse;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 140px;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .rtl .filter-label {
    text-align: right;
  }

  .filter-select {
    padding: 0.75rem 1rem;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.875rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .rtl .filter-select {
    text-align: right;
  }

  .filter-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .sort-controls {
    display: flex;
    gap: 0.5rem;
  }

  .rtl .sort-controls {
    flex-direction: row-reverse;
  }

  .sort-select {
    flex: 1;
  }

  .sort-order-button {
    padding: 0.75rem;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.95);
    color: #6b7280;
    transition: all 0.2s ease;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .sort-order-button:hover {
    background: rgba(249, 250, 251, 0.95);
    color: #374151;
  }

  .sort-order-button:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  /* Results Summary */
  .results-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    margin-top: 1.5rem;
  }

  .results-info {
    font-size: 0.875rem;
    color: #64748b;
  }

  .card-list-container {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .card-list {
    divide-y: 1px solid rgba(148, 163, 184, 0.1);
  }

  .admin-content-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
    cursor: pointer;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .admin-content-card:last-child {
    border-bottom: none;
  }

  .admin-content-card:hover {
    background: rgba(59, 130, 246, 0.02);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .card-avatar {
    flex-shrink: 0;
    position: relative;
  }

  .avatar-fallback {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    border-radius: 50%;
    display: none;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1.125rem;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .avatar-unknown {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Content Section */
  .card-content {
    flex: 1;
    min-width: 0;
  }

  .rtl .card-content {
    text-align: right;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.2s ease;
    flex: 1;
  }

  .admin-content-card:hover .card-title {
    color: #2563eb;
  }

  .title-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .resource-type-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .meta-text {
    color: #9ca3af;
  }

  .meta-author {
    font-weight: 500;
    color: #374151;
  }

  .meta-separator {
    color: #d1d5db;
  }

  .meta-time {
    color: #64748b;
  }

  .card-description {
    margin-bottom: 0.75rem;
  }

  .description-text {
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .detail-label {
    color: #6b7280;
    font-weight: 500;
  }

  .detail-value {
    color: #374151;
    font-family: monospace;
    background: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-active {
    background: #dcfce7;
    color: #166534;
  }

  .status-inactive {
    background: #fee2e2;
    color: #991b1b;
  }

  /* Actions Section */
  .card-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 175, 0.3);
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-icon {
    width: 1.125rem;
    height: 1.125rem;
  }

  .open-button:hover,
  .view-button:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .delete-button:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  /* Load More Section */
  .load-more-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .load-more-info {
    text-align: center;
  }

  .load-more-text {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }

  .load-more-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 2rem;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    border: 1px solid rgba(37, 99, 235, 0.3);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    cursor: pointer;
    min-width: 140px;
    justify-content: center;
  }

  .load-more-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  }

  .load-more-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .load-more-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .load-more-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
  }

  .load-more-button:hover:not(:disabled) .load-more-icon {
    transform: translateY(2px);
  }

  /* End of Results */
  .end-of-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    text-align: center;
  }

  .end-of-results-icon {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .end-of-results-text {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .end-of-results-count {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  /* Modal Styles */
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
    overflow: scroll;
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

  @media (min-width: 640px) {
    .search-filter-controls {
      flex-direction: column;
      gap: 1.5rem;
    }

    .search-input-group {
      flex: 2;
    }

    .filter-controls {
      flex: 1;
      justify-content: flex-start;
    }

    .rtl .filter-controls {
      justify-content: flex-end;
    }

    .results-summary {
      flex-direction: row;
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

  @media (max-width: 768px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .search-filter-controls {
      gap: 1rem;
    }

    .filter-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .rtl .filter-controls {
      flex-direction: column;
    }

    .filter-group {
      min-width: auto;
    }

    .results-summary {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }

    .rtl .results-summary {
      align-items: flex-end;
    }

    .admin-content-card {
      padding: 1rem;
      gap: 0.75rem;
    }

    .card-avatar .avatar-fallback,
    .card-avatar .avatar-unknown {
      width: 2.5rem;
      height: 2.5rem;
    }

    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .rtl .card-header {
      align-items: flex-end;
    }

    .card-actions {
      align-items: stretch;
    }

    .action-buttons {
      justify-content: center;
    }

    .load-more-button {
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
    }

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
