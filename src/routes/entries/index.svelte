<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params } from "@roxi/routify";
  import { getMyEntities } from "@/lib/dmart_services";
  import {
    formatDate,
    formatNumberInText,
    truncateString,
  } from "@/lib/helpers";
  import { errorToastMessage } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    ClockOutline,
    EditOutline,
    EyeOutline,
    FilterOutline,
    FolderOutline,
    HeartSolid,
    MessagesSolid,
    PhoneOutline,
    PlusOutline,
    SearchOutline,
    TagOutline,
  } from "flowbite-svelte-icons";

  $goto;
  let entities = $state([]);
  let filteredEntities = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let resourceTypeFilter = $state("all");
  let sortBy = $state("updated_at");
  let sortOrder = $state("desc");

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function getLocalizedDisplayName(entity) {
    const displayname = entity.attributes?.displayname;

    // If displayname is null or undefined, use shortname as fallback
    if (!displayname) {
      return entity.shortname || $_("my_entries.untitled");
    }

    // If displayname is a string (not an object), return it directly
    if (typeof displayname === "string") {
      return displayname;
    }

    // If displayname is an object with localized names
    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || entity.shortname || $_("my_entries.untitled");
  }

  function getContentPreview(entity) {
    const payload = entity.attributes?.payload;
    if (!payload || !payload.body) return "";

    const body = payload.body;

    // Handle different content types
    if (entity.resource_type === "content") {
      // For HTML content type, body is a string
      if (payload.content_type === "html" && typeof body === "string") {
        return body;
      }

      // For JSON content type, body might be an object
      if (payload.content_type === "json") {
        if (typeof body === "object") {
          // Try to extract meaningful text from JSON object
          if (body.body && typeof body.body === "string") {
            return body.body;
          }
          // If it's an empty object or complex structure, return a summary
          return JSON.stringify(body).substring(0, 100) + "...";
        }
        if (typeof body === "string") {
          return body;
        }
      }

      // For other content types or if body is a string
      if (typeof body === "string") {
        return body;
      }
    }

    return "";
  }

  function getResourceTypeIcon(resourceType) {
    switch (resourceType) {
      case "content":
        return EditOutline;
      case "media":
        return PhoneOutline;
      case "folder":
        return FolderOutline;
      default:
        return EditOutline;
    }
  }

  function getResourceTypeColor(resourceType) {
    switch (resourceType) {
      case "content":
        return "bg-blue-100 text-blue-800";
      case "media":
        return "bg-purple-100 text-purple-800";
      case "folder":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  onMount(async () => {
    await fetchEntities();
  });

  $effect(() => {
    if ($params.space_name && $params.subpath && $params.shortname) {
      fetchEntities();
    }
    if (searchTerm !== undefined) {
      handleSearch();
    }
  });

  async function fetchEntities() {
    isLoading = true;
    try {
      const response = await getMyEntities();
      console.log("Fetched entities:", response);

      const rawEntities = response?.records || response || [];

      entities = rawEntities.map((entity) => ({
        resource_type: entity?.resource_type || "",
        shortname: entity.shortname,
        uuid: entity?.uuid,
        title: getLocalizedDisplayName(entity),
        content: getContentPreview(entity),
        tags: entity.attributes?.tags || [],
        state: entity.attributes?.state || null,
        is_active: entity.attributes?.is_active !== false,
        created_at: entity.attributes?.created_at
          ? formatDate(entity.attributes.created_at)
          : "",
        updated_at: entity.attributes?.updated_at
          ? formatDate(entity.attributes.updated_at)
          : "",
        raw_created_at: entity.attributes?.created_at || "",
        raw_updated_at: entity.attributes?.updated_at || "",
        space_name: entity.attributes?.space_name || "",
        subpath: entity?.subpath || "",
        owner_shortname: entity.attributes?.owner_shortname || "",
        comment: entity.attachments?.comment?.length ?? 0,
        reaction: entity.attachments?.reaction?.length ?? 0,
        // Store the full entity for debugging
        _raw: entity,
      }));
    } catch (error) {
      console.error("Error fetching entities:", error);
      errorToastMessage($_("my_entries.error.fetch_failed"));
      entities = [];
    } finally {
      isLoading = false;
      filterAndSortEntities();
    }
  }

  function filterAndSortEntities() {
    let filtered = [...entities];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (entity) =>
          entity.title?.toLowerCase().includes(search) ||
          entity.content?.toLowerCase().includes(search) ||
          entity.tags?.some((tag) => tag.toLowerCase().includes(search)) ||
          entity.resource_type?.toLowerCase().includes(search)
      );
    }

    if (resourceTypeFilter !== "all") {
      filtered = filtered.filter(
        (entity) => entity.resource_type === resourceTypeFilter
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((entity) => {
        switch (statusFilter) {
          case "active":
            return entity.is_active === true;
          case "inactive":
            return entity.is_active === false;
          case "pending":
            return entity.state === "pending";
          case "approved":
            return entity.state === "approved";
          case "rejected":
            return entity.state === "rejected";
          default:
            return true;
        }
      });
    }

    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "title":
          aValue = a.title || "";
          bValue = b.title || "";
          break;
        case "created_at":
          aValue = new Date(a.raw_created_at);
          bValue = new Date(b.raw_created_at);
          break;
        case "reactions":
          aValue = a.reaction || 0;
          bValue = b.reaction || 0;
          break;
        case "comments":
          aValue = a.comment || 0;
          bValue = b.comment || 0;
          break;
        default:
          aValue = new Date(a.raw_updated_at);
          bValue = new Date(b.raw_updated_at);
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    filteredEntities = filtered;
  }

  function handleSearch() {
    filterAndSortEntities();
  }

  function handleFilterChange() {
    filterAndSortEntities();
  }

  function handleSortChange() {
    filterAndSortEntities();
  }

  function viewEntity(entity) {
    $goto("/entries/[space_name]/[subpath]/[shortname]/[resource_type]", {
      shortname: entity.shortname,
      space_name: entity.space_name,
      subpath: entity.subpath,
      resource_type: entity.resource_type,
    });
  }

  function editEntity(entity) {
    $goto("/entries/[space_name]/[subpath]/[shortname]/[resource_type]/edit", {
      shortname: entity.shortname,
      space_name: entity.space_name,
      subpath: entity.subpath,
      resource_type: entity.resource_type,
    });
  }

  function createNewEntry() {
    $goto("/entries/create");
  }

  function getStatusBadge(entity) {
    if (!entity.is_active) {
      return {
        text: $_("my_entries.status.draft"),
        class: "bg-gray-100 text-gray-800",
      };
    } else if (entity.state === "pending") {
      return {
        text: $_("my_entries.status.pending"),
        class: "bg-yellow-100 text-yellow-800",
      };
    } else if (entity.state === "approved") {
      return {
        text: $_("my_entries.status.published"),
        class: "bg-green-100 text-green-800",
      };
    } else if (entity.state === "rejected") {
      return {
        text: $_("my_entries.status.rejected"),
        class: "bg-red-100 text-red-800",
      };
    } else {
      return {
        text: $_("my_entries.status.active"),
        class: "bg-blue-100 text-blue-800",
      };
    }
  }
</script>

<div
  class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50"
  class:rtl={$isRTL}
>
  <div class="container mx-auto px-6 py-8 max-w-7xl">
    <div class="mb-8">
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div>
          <h1 class="text-4xl hero-title">{$_("my_entries.title")}</h1>
          <p class="text-gray-600 text-lg">
            {$_("my_entries.subtitle")}
          </p>
        </div>

        <button
          aria-label={$_("my_entries.create_new")}
          onclick={createNewEntry}
          class="btn-primary inline-flex items-center"
        >
          <PlusOutline class="mx-2 w-5 h-5" />
          {$_("my_entries.create_new")}
        </button>
      </div>
    </div>

    <!-- Updated filters to include resource type filter -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Search -->
        <div class="relative">
          <SearchOutline
            class="absolute top-1/2 transform -translate-y-1/2 w-5 h-5 ms-2 text-gray-400 search-icon"
          />
          <label for="search-input" class="visually-hidden"></label>
          <input
            type="text"
            bind:value={searchTerm}
            placeholder={$_("my_entries.search.placeholder")}
            class="w-full search-input py-3 pl-8 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        <!-- Resource Type Filter -->
        <select
          bind:value={resourceTypeFilter}
          onchange={handleFilterChange}
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
        >
          <option value="all">All Types</option>
          <option value="content">Content</option>
          <option value="media">Media</option>
          <option value="folder">Folder</option>
        </select>

        <!-- Status Filter -->
        <div class="relative">
          <FilterOutline
            class="absolute top-1/2 transform -translate-y-1/2 w-5 h-5 ms-2 text-gray-400 filter-icon"
          />
          <select
            bind:value={statusFilter}
            onchange={handleFilterChange}
            class="w-full filter-select py-3 pl-8 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
          >
            <option value="all">{$_("my_entries.filter.all_status")}</option>
            <option value="active">{$_("my_entries.filter.published")}</option>
            <option value="inactive">{$_("my_entries.filter.draft")}</option>
            <option value="pending">{$_("my_entries.filter.pending")}</option>
            <option value="approved">{$_("my_entries.filter.approved")}</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <!-- Sort By -->
        <select
          bind:value={sortBy}
          onchange={handleSortChange}
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white sort-select"
        >
          <option value="updated_at"
            >{$_("my_entries.sort.last_updated")}</option
          >
          <option value="created_at"
            >{$_("my_entries.sort.date_created")}</option
          >
          <option value="title">{$_("my_entries.sort.title")}</option>
          <option value="reactions">{$_("my_entries.sort.reactions")}</option>
          <option value="comments">{$_("my_entries.sort.comments")}</option>
        </select>

        <!-- Sort Order -->
        <select
          bind:value={sortOrder}
          onchange={handleSortChange}
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white sort-order-select"
        >
          <option value="desc">{$_("my_entries.sort.newest_first")}</option>
          <option value="asc">{$_("my_entries.sort.oldest_first")}</option>
        </select>
      </div>
    </div>

    {#if isLoading}
      <div class="flex justify-center items-center py-20">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
          ></div>
          <p class="text-gray-600 text-lg">{$_("my_entries.loading")}</p>
        </div>
      </div>
    {:else if filteredEntities.length === 0}
      <div class="text-center py-20">
        <h3 class="text-2xl font-semibold text-gray-900 my-3">
          {entities.length === 0
            ? $_("my_entries.empty.no_entries")
            : $_("my_entries.empty.no_matches")}
        </h3>
        <p class="text-gray-600 mb-8 max-w-md mx-auto">
          {entities.length === 0
            ? $_("my_entries.empty.no_entries_description")
            : $_("my_entries.empty.no_matches_description")}
        </p>
        {#if entities.length === 0}
          <button
            aria-label={$_("my_entries.create_new")}
            onclick={createNewEntry}
            class="inline-flex items-center btn-primary"
          >
            {$_("my_entries.create_first")}
          </button>
        {/if}
      </div>
    {:else}
      <!-- Stats Summary -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between stats-item">
            <div>
              <p class="text-sm font-medium text-gray-600">
                {$_("my_entries.stats.total_entries")}
              </p>
              <p class="text-3xl font-bold text-gray-900">
                {formatNumberInText(entities.length, $locale)}
              </p>
            </div>
            <div
              class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center"
            >
              <EditOutline class="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between stats-item">
            <div>
              <p class="text-sm font-medium text-gray-600">
                {$_("my_entries.stats.published")}
              </p>
              <p class="text-3xl font-bold text-green-600">
                {formatNumberInText(
                  entities.filter((e) => e.is_active && e.state === "approved")
                    .length,
                  $locale
                )}
              </p>
            </div>
            <div
              class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"
            >
              <EyeOutline class="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between stats-item">
            <div>
              <p class="text-sm font-medium text-gray-600">
                {$_("my_entries.stats.total_reactions")}
              </p>
              <p class="text-3xl font-bold text-red-500">
                {formatNumberInText(
                  entities.reduce((sum, e) => sum + (e.reaction || 0), 0),
                  $locale
                )}
              </p>
            </div>
            <div
              class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"
            >
              <HeartSolid class="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between stats-item">
            <div>
              <p class="text-sm font-medium text-gray-600">
                {$_("my_entries.stats.total_comments")}
              </p>
              <p class="text-3xl font-bold text-blue-600">
                {formatNumberInText(
                  entities.reduce((sum, e) => sum + (e.comment || 0), 0),
                  $locale
                )}
              </p>
            </div>
            <div
              class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"
            >
              <MessagesSolid class="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <!-- Entries Table -->
      <div
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="w-full entries-table">
            <thead class="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider table-header"
                >
                  {$_("my_entries.table.entry")}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider table-header"
                >
                  Type
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider table-header"
                >
                  {$_("my_entries.table.status")}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider table-header"
                >
                  {$_("my_entries.table.engagement")}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider table-header"
                >
                  {$_("my_entries.table.updated")}
                </th>
                <th
                  class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider table-header-actions"
                >
                  {$_("my_entries.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each filteredEntities as entity, index}
                {@const SvelteComponent = getResourceTypeIcon(
                  entity.resource_type
                )}
                <tr
                  class="hover:bg-gray-50 transition-colors duration-150 group"
                >
                  <td class="px-6 py-4">
                    <div class="flex items-start space-x-4 entry-content">
                      <!-- Added resource type icon -->
                      <div class="flex-shrink-0 mt-1">
                        <SvelteComponent class="w-5 h-5 text-gray-400" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <h3
                          class="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors duration-150 line-clamp-2"
                        >
                          {entity.title || $_("my_entries.untitled")}
                        </h3>
                        {#if entity.content}
                          <p class="text-sm text-gray-600 mt-1 line-clamp-2">
                            {@html truncateString(entity.content)}
                          </p>
                        {/if}
                        {#if entity.tags && entity.tags.length > 0}
                          <div class="flex flex-wrap gap-1 mt-2 tags-container">
                            {#each entity.tags.slice(0, 3) as tag}
                              <span
                                class="inline-flex items-center px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium"
                              >
                                <TagOutline class="w-3 h-3 tag-icon-inline" />
                                {tag}
                              </span>
                            {/each}
                            {#if entity.tags.length > 3}
                              <span
                                class="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium"
                              >
                                {$_("my_entries.tags.more", {
                                  values: {
                                    count: formatNumberInText(
                                      entity.tags.length - 3,
                                      $locale
                                    ),
                                  },
                                })}
                              </span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>

                  <!-- Added resource type column -->
                  <td class="px-6 py-4">
                    <span
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {getResourceTypeColor(
                        entity.resource_type
                      )}"
                    >
                      {entity.resource_type}
                    </span>
                  </td>

                  <td class="px-6 py-4">
                    <span
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium {getStatusBadge(
                        entity
                      ).class}"
                    >
                      {getStatusBadge(entity).text}
                    </span>
                  </td>

                  <td class="px-6 py-4">
                    <div
                      class="flex items-center space-x-4 text-sm engagement-stats"
                    >
                      <div class="flex items-center text-red-500">
                        <HeartSolid class="w-4 h-4 engagement-icon" />
                        <span class="font-medium"
                          >{formatNumberInText(entity.reaction, $locale) ||
                            0}</span
                        >
                      </div>
                      <div class="flex items-center text-blue-500">
                        <MessagesSolid class="w-4 h-4 engagement-icon" />
                        <span class="font-medium"
                          >{formatNumberInText(entity.comment, $locale) ||
                            0}</span
                        >
                      </div>
                    </div>
                  </td>

                  <td class="px-6 py-4">
                    <div
                      class="flex items-center text-sm text-gray-600 date-info"
                    >
                      <ClockOutline class="w-4 h-4 date-icon" />
                      {entity.updated_at}
                    </div>
                  </td>

                  <td class="px-6 py-4 text-right">
                    <div
                      class="flex items-center justify-end space-x-2 action-buttons"
                    >
                      <button
                        aria-label={$_("my_entries.actions.view")}
                        onclick={() => viewEntity(entity)}
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors duration-150"
                      >
                        <EyeOutline class="w-4 h-4 action-icon" />
                        {$_("my_entries.actions.view")}
                      </button>
                      <button
                        aria-label={$_("my_entries.actions.edit")}
                        onclick={() => editEntity(entity)}
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                      >
                        <EditOutline class="w-4 h-4 action-icon" />
                        {$_("my_entries.actions.edit")}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Results Summary -->
      <div class="mt-6 text-center text-sm text-gray-600">
        {$_("my_entries.results.showing", {
          values: {
            filtered: formatNumberInText(filteredEntities.length, $locale),
            total: formatNumberInText(entities.length, $locale),
          },
        })}
      </div>
    {/if}
  </div>
</div>

<style>
  .rtl {
    direction: rtl;
  }

  .rtl .search-icon {
    left: auto;
    right: 0.75rem;
  }

  .rtl .filter-icon {
    left: auto;
    right: 0.75rem;
  }

  .rtl .search-input {
    padding-left: 1rem;
    padding-right: 2.75rem;
    text-align: right;
  }

  .rtl .filter-select {
    padding-left: 1rem;
    padding-right: 2.75rem;
    text-align: right;
  }

  .rtl .sort-select,
  .rtl .sort-order-select {
    text-align: right;
  }

  .rtl .table-header {
    text-align: right;
  }

  .rtl .table-header-actions {
    text-align: left;
  }

  .rtl .tag-icon-inline {
    margin-right: 0;
    margin-left: 0.25rem;
  }

  .rtl .engagement-icon {
    margin-right: 0;
    margin-left: 0.25rem;
  }

  .rtl .date-icon {
    margin-right: 0;
    margin-left: 0.5rem;
  }

  .rtl .action-icon {
    margin-right: 0;
    margin-left: 0.25rem;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    font-size: 1.1rem;
    width: 20%;
    height: 20%;
  }

  .hero-title {
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  @media (max-width: 768px) {
    .rtl .stats-item {
      flex-direction: row;
    }

    .rtl .entry-content {
      flex-direction: column;
      space-x-reverse: 0;
    }

    .rtl .engagement-stats {
      flex-direction: row;
      space-x-reverse: 0;
    }

    .rtl .action-buttons {
      flex-direction: row;
      space-x-reverse: 0;
      justify-content: flex-start;
    }
  }
</style>
