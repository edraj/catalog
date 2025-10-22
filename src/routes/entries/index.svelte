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
    FolderOutline,
    HeartSolid,
    MessagesSolid,
    PhoneOutline,
    PlusOutline,
    SearchOutline,
    TagOutline,
    LayersSolid,
  } from "flowbite-svelte-icons";

  $goto;
  let entities = $state([]);
  let filteredEntities = $state([]);
  let availableSpaces = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let resourceTypeFilter = $state("all");
  let spaceFilter = $state("all");
  let sortBy = $state("updated_at");
  let sortOrder = $state("desc");

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function getLocalizedDisplayName(entity) {
    const displayname = entity.attributes?.displayname;

    if (!displayname) {
      return entity.shortname || $_("my_entries.untitled");
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || entity.shortname || $_("my_entries.untitled");
  }

  function getLocalizedSpaceName(space) {
    const displayname = space.attributes?.displayname;

    if (!displayname) {
      return space.shortname;
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || space.shortname;
  }

  function getContentPreview(entity) {
    const payload = entity.attributes?.payload;
    if (!payload || !payload.body) return "";

    const body = payload.body;

    if (entity.resource_type === "content") {
      if (payload.content_type === "html" && typeof body === "string") {
        return body;
      }

      if (payload.content_type === "json") {
        if (typeof body === "object") {
          if (body.body && typeof body.body === "string") {
            return body.body;
          }
          return JSON.stringify(body).substring(0, 100) + "...";
        }
        if (typeof body === "string") {
          return body;
        }
      }

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

  function extractUserSpaces() {
    availableSpaces = [];

    if (!entities || entities.length === 0) {
      return;
    }

    const spaceCountMap = new Map();

    entities.forEach((entity) => {
      if (entity.space_name) {
        const count = spaceCountMap.get(entity.space_name) || 0;
        spaceCountMap.set(entity.space_name, count + 1);
      }
    });

    availableSpaces = Array.from(spaceCountMap.keys())
      .sort()
      .map((spaceName) => ({
        shortname: spaceName,
        entryCount: spaceCountMap.get(spaceName),
        attributes: {
          displayname: spaceName,
        },
      }));
  }

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
        _raw: entity,
      }));
    } catch (error) {
      console.error("Error fetching entities:", error);
      errorToastMessage($_("my_entries.error.fetch_failed"));
      entities = [];
    } finally {
      isLoading = false;
      extractUserSpaces();
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
          entity.resource_type?.toLowerCase().includes(search) ||
          entity.space_name?.toLowerCase().includes(search)
      );
    }

    if (resourceTypeFilter !== "all") {
      filtered = filtered.filter(
        (entity) => entity.resource_type === resourceTypeFilter
      );
    }

    if (spaceFilter !== "all") {
      filtered = filtered.filter((entity) => entity.space_name === spaceFilter);
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

  function filterBySpace(spaceName) {
    spaceFilter = spaceName;
    filterAndSortEntities();
  }

  function clearAllFilters() {
    searchTerm = "";
    spaceFilter = "all";
    resourceTypeFilter = "all";
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

    <!-- Updated filters to include resource type and space filters -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

        <!-- Space Filter -->
        <div class="relative">
          <LayersSolid
            class="absolute top-1/2 transform -translate-y-1/2 w-5 h-5 ms-2 text-gray-400 space-icon"
          />
          <select
            bind:value={spaceFilter}
            onchange={handleFilterChange}
            class="w-full space-select py-3 pl-8 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
          >
            <option value="all">All Spaces</option>
            {#each availableSpaces as space}
              <option value={space.shortname}>
                {getLocalizedSpaceName(space)} ({space.entryCount})
              </option>
            {/each}
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
      </div>

      <!-- Active Filters Display -->
      {#if spaceFilter !== "all" || statusFilter !== "all" || resourceTypeFilter !== "all" || searchTerm.trim()}
        <div class="mt-4 flex flex-wrap gap-2 items-center">
          <span class="text-sm font-medium text-gray-600">Active filters:</span>

          {#if searchTerm.trim()}
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
            >
              Search: "{searchTerm}"
              <button
                onclick={() => {
                  searchTerm = "";
                  handleSearch();
                }}
                class="ml-2 hover:bg-blue-200 rounded-full p-1"
              >
                ×
              </button>
            </span>
          {/if}

          {#if spaceFilter !== "all"}
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
            >
              Space: {spaceFilter}
              <button
                onclick={() => {
                  spaceFilter = "all";
                  handleFilterChange();
                }}
                class="ml-2 hover:bg-purple-200 rounded-full p-1"
              >
                ×
              </button>
            </span>
          {/if}

          {#if resourceTypeFilter !== "all"}
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
            >
              Type: {resourceTypeFilter}
              <button
                onclick={() => {
                  resourceTypeFilter = "all";
                  handleFilterChange();
                }}
                class="ml-2 hover:bg-green-200 rounded-full p-1"
              >
                ×
              </button>
            </span>
          {/if}

          {#if statusFilter !== "all"}
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800"
            >
              Status: {statusFilter}
              <button
                onclick={() => {
                  statusFilter = "all";
                  handleFilterChange();
                }}
                class="ml-2 hover:bg-yellow-200 rounded-full p-1"
              >
                ×
              </button>
            </span>
          {/if}

          <button
            onclick={clearAllFilters}
            class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-150"
          >
            Clear all
          </button>
        </div>
      {/if}
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
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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
              <p class="text-sm font-medium text-gray-600">Spaces Used</p>
              <p class="text-3xl font-bold text-purple-600">
                {formatNumberInText(
                  new Set(entities.map((e) => e.space_name)).size,
                  $locale
                )}
              </p>
            </div>
            <div
              class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"
            >
              <LayersSolid class="w-6 h-6 text-purple-600" />
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
                  Space
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
                    <button
                      aria-label="Filter by space {entity.space_name}"
                      onclick={() => filterBySpace(entity.space_name)}
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors duration-150 cursor-pointer"
                    >
                      {entity.space_name}
                    </button>
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

  .rtl .space-icon {
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

  .rtl .space-select {
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
