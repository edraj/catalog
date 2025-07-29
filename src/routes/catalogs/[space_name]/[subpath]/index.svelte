<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getAvatar, getSpaceContents } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import Avatar from "@/components/Avatar.svelte";
  import { derived } from "svelte/store";
  $goto;

  let isLoading = $state(false);
  let allContents = $state([]);
  let paginatedContents = $state([]);
  let error = null;
  let spaceName = "";
  let subpath = "";
  let actualSubpath = "";
  let breadcrumbs = [];

  let currentPage = $state(1);
  let itemsPerPage = $state(10);
  let totalPages = $state(1);
  let totalItems = $state(0);
  let filteredContents = $state([]);

  let searchQuery = $state("");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );
  const itemsPerPageOptions = [10, 25, 50, 100];
  function getResourceTypes() {
    const types = [...new Set(allContents.map((item) => item.resource_type))];
    return types;
  }
  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
    { value: "owner", label: "Owner" },
    { value: "created", label: "Created Date" },
  ];

  async function initializeContent() {
    spaceName = $params.space_name;
    subpath = $params.subpath;
    actualSubpath = subpath.replace(/-/g, "/");

    const pathParts = actualSubpath
      .split("/")
      .filter((part) => part.length > 0);
    breadcrumbs = [
      { name: spaceName, path: `${spaceName}` },
      { name: spaceName, path: `/${spaceName}/${subpath}` },
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
            : `/${spaceName}/${subpath}/${currentUrlPath}`,
      });
    });

    currentPage = 1;
    await loadContents();
  }

  onMount(async () => {
    await initializeContent();
  });

  $effect(() => {
    if ($params.space_name && $params.subpath) {
      initializeContent();
    }
  });

  async function loadContents() {
    isLoading = true;
    error = null;

    try {
      const response = await getSpaceContents(
        spaceName,
        `/${actualSubpath}`,
        "public"
      );

      if (response && response.records) {
        allContents = await Promise.all(
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
        applyFilters();
      } else {
        allContents = [];
        filteredContents = [];
        updatePaginationDerived();
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = "Failed to load space contents";
      allContents = [];
      filteredContents = [];
      updatePaginationDerived();
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    let filtered = [...allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getDisplayName(item).toLowerCase();
        const shortname = item.shortname.toLowerCase();
        const description = (
          item.attributes?.description?.en ||
          item.attributes?.description?.ar ||
          ""
        ).toLowerCase();
        const owner = (item.attributes?.owner_shortname || "").toLowerCase();

        return (
          displayName.includes(query) ||
          shortname.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
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
    totalItems = filtered.length;
    currentPage = 1;
    updatePaginationDerived();
  }

  function updatePaginationDerived() {
    totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    paginatedContents = filteredContents.slice(startIndex, endIndex);
  }

  function handleItemsPerPageChange(newItemsPerPage) {
    itemsPerPage = newItemsPerPage;
    currentPage = 1;
    updatePaginationDerived();
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      updatePaginationDerived();
    }
  }

  function handleItemClick(item) {
    if (item.resource_type === "folder") {
      const newSubpath = `${subpath}-${item.shortname}`;
      $goto("/catalogs/[space_name]/[subpath]", {
        space_name: spaceName,
        subpath: newSubpath,
      });
    } else {
      $goto("/catalogs/[space_name]/[subpath]/[shortname]", {
        space_name: spaceName,
        subpath: subpath,
        shortname: item.shortname,
        resource_type: item.resource_type,
      });
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

  function getDisplayName(item) {
    if (item.attributes?.displayname) {
      return (
        item.attributes?.payload?.body?.title ||
        item.attributes.displayname.ar ||
        item.attributes.displayname.en ||
        item.shortname
      );
    }
    return item.attributes?.payload?.body?.title;
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  }

  function navigateToBreadcrumb(path) {
    if (path) {
      $goto(path);
    }
  }

  function getPageNumbers() {
    const pages = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 4) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 2);
      const end = Math.min(totalPages - 1, currentPage + 2);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 3) {
        pages.push("...");
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  }

  function clearFilters() {
    searchQuery = "";
    sortBy = "name";
    sortOrder = "asc";
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    applyFilters();
  }

  const filteredContentsDerived = $derived.by(() => {
    let filtered = [...allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getDisplayName(item).toLowerCase();
        const shortname = item.shortname.toLowerCase();
        const description = (
          item.attributes?.description?.en ||
          item.attributes?.description?.ar ||
          ""
        ).toLowerCase();
        const owner = (item.attributes?.owner_shortname || "").toLowerCase();

        return (
          displayName.includes(query) ||
          shortname.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
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

  const paginatedContentsDerived = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredContentsDerived.slice(startIndex, endIndex);
  });

  const totalItemsDerived = $derived.by(() => filteredContentsDerived.length);

  const totalPagesDerived = $derived.by(() =>
    Math.ceil(totalItemsDerived / itemsPerPage)
  );

  $effect(() => {
    if (currentPage > totalPagesDerived && totalPagesDerived > 0) {
      currentPage = totalPagesDerived;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }
  });
</script>

<div class="catalog-contents-page" class:rtl={$isRTL}>
  <div class="header-section">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <nav
        class="flex mb-4"
        aria-label={$_("catalog_contents.breadcrumb_label")}
      >
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
            {breadcrumbs[breadcrumbs.length - 1]?.name ||
              actualSubpath.split("/").pop()}
          </h1>
          <p class="page-description">
            {$_("catalog_contents.browse_contents")}
            <span class="space-name">{spaceName}</span>
            {#if actualSubpath !== ""}
              / <span class="subpath-name">{actualSubpath}</span>
            {/if}
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="loading-state">
        <Diamonds color="#3b82f6" size="60" unit="px" />
        <p class="loading-text">{$_("catalog_contents.loading")}</p>
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
          {$_("catalog_contents.error.title")}
        </h3>
        <p class="error-message">{error}</p>
        <button onclick={() => loadContents()} class="retry-button">
          {$_("catalog_contents.error.try_again")}
        </button>
      </div>
    {:else if totalItemsDerived === 0}
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
          {$_("catalog_contents.empty.title")}
        </h3>
        <p class="empty-message">
          {searchQuery
            ? $_("catalog_contents.empty.no_matches")
            : $_("catalog_contents.empty.folder_empty")}
        </p>
      </div>
    {:else}
      <div class="search-filter-section">
        <div class="search-filter-header">
          <h2 class="section-title">{$_("catalog_contents.filters.title")}</h2>
        </div>

        <div class="search-filter-controls">
          <div class="filter-controls">
            <div class="filter-group">
              <label class="filter-label"
                >{$_("catalog_contents.filters.sort_by")}</label
              >
              <div class="sort-controls">
                <select
                  bind:value={sortBy}
                  class="filter-select sort-select"
                  aria-label={$_("catalog_contents.filters.sort_by")}
                  onchange={applyFilters}
                >
                  {#each sortOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <button
                  onclick={toggleSortOrder}
                  class="sort-order-button"
                  title={$_("catalog_contents.filters.toggle_sort")}
                  aria-label={$_("catalog_contents.filters.toggle_sort")}
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
              <label class="filter-label"
                >{$_("catalog_contents.pagination.items_per_page")}</label
              >
              <select
                bind:value={itemsPerPage}
                onchange={(e) =>
                  handleItemsPerPageChange(
                    parseInt((e.target as HTMLSelectElement).value)
                  )}
                class="filter-select"
                aria-label={$_("catalog_contents.pagination.items_per_page")}
              >
                {#each itemsPerPageOptions as option}
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
              <input
                type="text"
                bind:value={searchQuery}
                placeholder={$_("catalog_contents.search.placeholder")}
                class="search-input"
                aria-label={$_("catalog_contents.search.label")}
                oninput={applyFilters}
              />
              {#if searchQuery}
                <button
                  onclick={() => {
                    searchQuery = "";
                    applyFilters();
                  }}
                  class="clear-search-button"
                  aria-label={$_("catalog_contents.search.clear")}
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
            {$_("catalog_contents.results.showing", {
              values: {
                start: (currentPage - 1) * itemsPerPage + 1,
                end: Math.min(currentPage * itemsPerPage, totalItemsDerived),
                total: totalItemsDerived,
              },
            })}
            {#if searchQuery}
              {$_("catalog_contents.results.for_query", {
                values: { query: searchQuery },
              })}
            {/if}
          </div>
        </div>
      </div>

      <div class="card-list-container">
        <div class="card-list">
          {#each paginatedContentsDerived as item, index}
            <div
              class="content-card"
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
                    {getDisplayName(item)}
                  </h3>
                </div>

                <div class="card-meta">
                  <span class="meta-text"
                    >{$_("catalog_contents.card.posted_by")}</span
                  >
                  <span class="meta-author">
                    {item.attributes?.owner_shortname || $_("common.unknown")}
                  </span>
                  <span class="meta-separator">•</span>
                  <span class="meta-time">
                    {formatRelativeTime(item.attributes?.created_at)}
                  </span>
                </div>

                {#if item.attributes?.description?.[$locale] || item.attributes?.description?.en || item.attributes?.description?.ar}
                  <div class="card-description">
                    {item.attributes.description[$locale] ||
                      item.attributes.description.en ||
                      item.attributes.description.ar ||
                      ""}
                  </div>
                {/if}
              </div>

              <div class="card-stats">
                <div class="stat-item">
                  <svg
                    class="stat-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    ></path>
                  </svg>
                  <span class="stat-number">
                    {item.attachments?.comment?.length || 0}
                  </span>
                </div>
                <div class="stat-item stat-reactions">
                  <svg
                    class="stat-icon"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                  <span class="stat-number"
                    >{item.attachments?.reaction?.length || 0}</span
                  >
                </div>
              </div>
            </div>
          {/each}
        </div>

        {#if totalPagesDerived > 1}
          <div class="pagination-section">
            <div class="pagination-info">
              {$_("catalog_contents.pagination.page_info", {
                values: {
                  current: currentPage,
                  total: totalPagesDerived,
                },
              })}
            </div>
            <nav class="pagination-nav">
              <button
                onclick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                class="pagination-button pagination-prev"
                aria-label={$_("catalog_contents.pagination.previous")}
              >
                {$_("catalog_contents.pagination.previous")}
              </button>

              {#each getPageNumbers() as page}
                {#if typeof page === "number"}
                  <button
                    onclick={() => goToPage(page)}
                    class="pagination-button {page === currentPage
                      ? 'pagination-current'
                      : 'pagination-number'}"
                    aria-label={$_("catalog_contents.pagination.page", {
                      values: { page },
                    })}
                  >
                    {page}
                  </button>
                {:else}
                  <span class="pagination-ellipsis">
                    {page}
                  </span>
                {/if}
              {/each}

              <button
                onclick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPagesDerived}
                class="pagination-button pagination-next"
                aria-label={$_("catalog_contents.pagination.next")}
              >
                {$_("catalog_contents.pagination.next")}
              </button>
            </nav>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .catalog-contents-page {
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

  .space-name {
    font-weight: 600;
    color: #2563eb;
  }

  .subpath-name {
    font-weight: 500;
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

  .retry-button {
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

  .content-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    transition: all 0.2s ease;
    cursor: pointer;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .content-card:last-child {
    border-bottom: none;
  }

  .content-card:hover {
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

  .content-card:hover .card-title {
    color: #2563eb;
  }

  .title-icon {
    font-size: 1rem;
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
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.5;
    margin-bottom: 0.75rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Stats Section */
  .card-stats {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: #64748b;
    padding: 0.375rem 0.75rem;
    background: rgba(248, 250, 252, 0.8);
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 175, 0.2);
  }

  .stat-reactions {
    color: #ef4444;
    background: rgba(254, 242, 242, 0.8);
    border-color: rgba(254, 202, 202, 0.5);
  }

  .stat-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .stat-number {
    font-weight: 600;
    min-width: 1.5rem;
    text-align: center;
  }

  /* Pagination */
  .pagination-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .pagination-info {
    font-size: 0.875rem;
    color: #64748b;
  }

  .pagination-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .pagination-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    border: 1px solid rgba(209, 213, 219, 0.8);
    background: rgba(255, 255, 255, 0.9);
    color: #64748b;
    cursor: pointer;
  }

  .pagination-button:hover:not(:disabled) {
    background: rgba(249, 250, 251, 0.9);
    border-color: rgba(156, 163, 175, 0.8);
  }

  .pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-current {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-color: #2563eb;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  .pagination-number {
    color: #374151;
  }

  .pagination-ellipsis {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
  }

  @media (min-width: 640px) {
    .search-filter-controls {
      right: 0;
      gap: 1.5rem;
    }

    .rtl .search-filter-controls {
      right: 0;
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

    .pagination-section {
      flex-direction: row;
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

    .content-card {
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

    .card-stats {
      flex-direction: row;
      align-items: center;
    }

    .pagination-section {
      flex-direction: column;
      gap: 1rem;
    }

    .rtl .pagination-section {
      flex-direction: column;
    }

    .pagination-nav {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
