<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params } from "@roxi/routify";
  import { getMyEntities } from "@/lib/dmart_services/dmart_services";
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
    ($locale) => $locale === "ar" || $locale === "ku",
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
          entity.space_name?.toLowerCase().includes(search),
      );
    }

    if (resourceTypeFilter !== "all") {
      filtered = filtered.filter(
        (entity) => entity.resource_type === resourceTypeFilter,
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

<div class="min-h-screen bg-gray-50/30" class:rtl={$isRTL}>
  <div class="container mx-auto px-6 py-10 max-w-7xl">
    <!-- Header -->
    <div
      class="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
    >
      <div>
        <h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
          {$_("my_entries.title")}
        </h1>
        <p class="text-gray-500 text-[15px]">
          {$_("my_entries.subtitle")}
        </p>
      </div>
      <button
        aria-label={$_("my_entries.create_new")}
        onclick={createNewEntry}
        class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-200 text-sm"
      >
        <PlusOutline class="w-4 h-4" />
        {$_("my_entries.create_new")}
      </button>
    </div>

    <!-- Top Bar (Search & Filters) -->
    <div
      class="bg-white rounded-2xl border border-gray-100 p-3 mb-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col md:flex-row gap-3"
    >
      <!-- Search -->
      <div class="relative flex-grow min-w-[200px]">
        <SearchOutline
          class="absolute left-4 top-1/2 transform -translate-y-1/2 w-[18px] h-[18px] text-gray-400"
        />
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("route_labels.placeholder_search_entries")}
          class="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400"
        />
      </div>

      <!-- Resource Type Filter -->
      <div class="relative min-w-[150px] md:max-w-[180px]">
        <select
          bind:value={resourceTypeFilter}
          onchange={handleFilterChange}
          class="w-full appearance-none px-4 py-2.5 bg-gray-50/50 border border-transparent rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
        >
          <option value="all">{$_("my_entries.filter.all_types")}</option>
          <option value="content"
            >{$_("my_entries.resource_type.content")}</option
          >
          <option value="media">{$_("my_entries.resource_type.media")}</option>
          <option value="folder">{$_("my_entries.resource_type.folder")}</option
          >
        </select>
        <div
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400"
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
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>

      <!-- Space Filter -->
      <div class="relative min-w-[150px] md:max-w-[200px]">
        <LayersSolid
          class="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
        />
        <select
          bind:value={spaceFilter}
          onchange={handleFilterChange}
          class="w-full appearance-none pl-11 pr-10 py-2.5 bg-gray-50/50 border border-transparent rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
        >
          <option value="all">{$_("my_entries.filter.all_spaces")}</option>
          {#each availableSpaces as space}
            <option value={space.shortname}>
              {getLocalizedSpaceName(space)} ({space.entryCount})
            </option>
          {/each}
        </select>
        <div
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400"
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
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>

      <!-- Sort By -->
      <div class="relative min-w-[150px] md:max-w-[180px]">
        <select
          bind:value={sortBy}
          onchange={handleSortChange}
          class="w-full appearance-none px-4 py-2.5 bg-gray-50/50 border border-transparent rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
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
        <div
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400"
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
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>
    </div>

    <!-- Active Filters Display -->
    {#if spaceFilter !== "all" || statusFilter !== "all" || resourceTypeFilter !== "all" || searchTerm.trim()}
      <div class="mb-6 flex flex-wrap gap-2 items-center">
        {#if searchTerm.trim()}
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200"
          >
            {$_("my_entries.filter.search")}: {searchTerm}
            <button
              onclick={() => {
                searchTerm = "";
                handleSearch();
              }}
              class="ml-1.5 hover:text-gray-900"
            >
              <svg
                class="w-3.5 h-3.5"
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
          </span>
        {/if}
        {#if resourceTypeFilter !== "all"}
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200"
          >
            {$_("my_entries.filter.type")}: {resourceTypeFilter}
            <button
              onclick={() => {
                resourceTypeFilter = "all";
                handleFilterChange();
              }}
              class="ml-1.5 hover:text-gray-900"
            >
              <svg
                class="w-3.5 h-3.5"
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
          </span>
        {/if}
        {#if spaceFilter !== "all"}
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200"
          >
            {$_("my_entries.filter.space")}: {spaceFilter}
            <button
              onclick={() => {
                spaceFilter = "all";
                handleFilterChange();
              }}
              class="ml-1.5 hover:text-gray-900"
            >
              <svg
                class="w-3.5 h-3.5"
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
          </span>
        {/if}
        <button
          onclick={clearAllFilters}
          class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 ml-2"
        >
          {$_("my_entries.clear_all")}
        </button>
      </div>
    {/if}

    {#if isLoading}
      <div class="flex justify-center items-center py-32">
        <div
          class="animate-spin rounded-full h-10 w-10 border-2 border-indigo-200 border-t-indigo-600"
        ></div>
      </div>
    {:else}
      <!-- Stats Summary -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div
          class="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between"
        >
          <div>
            <p
              class="text-[13px] font-bold text-gray-400 uppercase tracking-wide mb-1"
            >
              {$_("my_entries.total_entries")}
            </p>
            <p class="text-4xl font-extrabold text-gray-900">
              {formatNumberInText(entities.length, $locale)}
            </p>
          </div>
          <div
            class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
          </div>
        </div>

        <div
          class="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between"
        >
          <div>
            <p
              class="text-[13px] font-bold text-gray-400 uppercase tracking-wide mb-1"
            >
              {$_("my_entries.spaces_used")}
            </p>
            <p class="text-4xl font-extrabold text-[#00d084]">
              {formatNumberInText(
                new Set(entities.map((e) => e.space_name)).size,
                $locale,
              )}
            </p>
          </div>
          <div
            class="w-12 h-12 bg-[#00d084]/10 rounded-2xl flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-[#00d084]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              ></path>
            </svg>
          </div>
        </div>
      </div>

      {#if filteredEntities.length === 0}
        <div
          class="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm mt-8"
        >
          <svg
            class="w-12 h-12 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            ></path>
          </svg>
          <h3 class="text-xl font-bold text-gray-900">
            {entities.length === 0
              ? $_("my_entries.no_entries_found")
              : $_("my_entries.no_matching_entries")}
          </h3>
          <p class="text-gray-500 mt-2">
            {entities.length === 0
              ? $_("my_entries.create_first_description")
              : $_("my_entries.adjust_filters_description")}
          </p>
          {#if entities.length === 0}
            <button
              onclick={createNewEntry}
              class="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-semibold transition-colors shadow-sm text-sm inline-flex items-center gap-2"
            >
              <PlusOutline class="w-4 h-4" />
              {$_("my_entries.create_first_entry")}
            </button>
          {/if}
        </div>
      {:else}
        <!-- Entries Table -->
        <div
          class="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden"
        >
          <div class="overflow-x-auto">
            <table class="w-full text-left whitespace-nowrap">
              <thead>
                <tr class="border-b border-gray-100">
                  <th
                    class="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white"
                  >
                    {$_("my_entries.table.entry")}
                  </th>
                  <th
                    class="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white"
                  >
                    {$_("my_entries.table.type")}
                  </th>
                  <th
                    class="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white"
                  >
                    {$_("my_entries.table.space")}
                  </th>
                  <th
                    class="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white"
                  >
                    {$_("my_entries.table.status")}
                  </th>
                  <th
                    class="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white"
                  >
                    {$_("my_entries.table.engagement")}
                  </th>
                  <th
                    class="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white"
                  >
                    {$_("my_entries.table.updated")}
                  </th>
                  <th
                    class="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right bg-white"
                  >
                    {$_("my_entries.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                {#each filteredEntities as entity}
                  <tr class="hover:bg-gray-50/50 transition-colors group">
                    <!-- ENTRY -->
                    <td class="px-8 py-5 flex items-start gap-4">
                      <div
                        class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5"
                      >
                        <svg
                          class="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          ></path>
                        </svg>
                      </div>
                      <div class="min-w-0 max-w-[280px]">
                        <h3
                          class="text-[14px] font-bold text-gray-900 truncate tracking-tight"
                        >
                          {entity.title || $_("my_entries.untitled")}
                        </h3>
                        <p
                          class="text-[12px] text-gray-400 truncate mt-0.5 font-medium"
                        >
                          #{entity.tags?.join(" #") ||
                            $_("my_entries.tags.general")}
                        </p>
                      </div>
                    </td>

                    <!-- TYPE -->
                    <td class="px-6 py-5">
                      {#if entity.resource_type === "media"}
                        <span
                          class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-600"
                        >
                          {$_("my_entries.resource_type.media")}
                        </span>
                      {:else if entity.resource_type === "content"}
                        <span
                          class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-600"
                        >
                          {$_("my_entries.resource_type.content")}
                        </span>
                      {:else if entity.resource_type === "json"}
                        <span
                          class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-600"
                        >
                          {$_("my_entries.resource_type.json")}
                        </span>
                      {:else if entity.resource_type === "poll"}
                        <span
                          class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-pink-50 text-pink-600"
                        >
                          {$_("my_entries.resource_type.poll")}
                        </span>
                      {:else if entity.resource_type === "template"}
                        <span
                          class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-600"
                        >
                          {$_("my_entries.resource_type.template")}
                        </span>
                      {:else}
                        <span
                          class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600"
                        >
                          {entity.resource_type ||
                            $_("my_entries.resource_type.unknown")}
                        </span>
                      {/if}
                    </td>

                    <!-- SPACE -->
                    <td class="px-6 py-5">
                      <span
                        class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#f1f5f9] text-[#64748b]"
                      >
                        {entity.space_name}
                      </span>
                    </td>

                    <!-- STATUS -->
                    <td class="px-6 py-5">
                      {#if entity.is_active && entity.state !== "pending" && entity.state !== "rejected"}
                        <div
                          class="flex items-center gap-1.5 text-[12px] font-extrabold text-[#00d084]"
                        >
                          <div
                            class="w-1.5 h-1.5 rounded-full bg-[#00d084]"
                          ></div>
                          {$_("my_entries.status.active")}
                        </div>
                      {:else}
                        <div
                          class="flex items-center gap-1.5 text-[12px] font-extrabold text-orange-400"
                        >
                          <div
                            class="w-1.5 h-1.5 rounded-full bg-orange-400"
                          ></div>
                          {$_("my_entries.status.draft")}
                        </div>
                      {/if}
                    </td>

                    <!-- ENGAGEMENT -->
                    <td class="px-6 py-5">
                      <div
                        class="flex items-center gap-3 text-[13px] font-medium text-gray-400"
                      >
                        <div class="flex items-center gap-1">
                          <svg
                            class="w-4 h-4 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            ></path>
                          </svg>
                          {formatNumberInText(entity.reaction, $locale) || 0}
                        </div>
                        <div class="flex items-center gap-1">
                          <svg
                            class="w-4 h-4 text-blue-400"
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
                          {formatNumberInText(entity.comment, $locale) || 0}
                        </div>
                      </div>
                    </td>

                    <!-- UPDATED -->
                    <td class="px-6 py-5 text-[12px] font-medium text-gray-400">
                      {entity.updated_at.replace(",", "")}
                    </td>

                    <!-- ACTIONS -->
                    <td class="px-8 py-5 text-right">
                      <div
                        class="flex items-center justify-end gap-3"
                      >
                        <button
                          onclick={() => viewEntity(entity)}
                          class="flex items-center gap-1 text-[12px] font-bold text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <EyeOutline class="w-4 h-4" />
                          {$_("my_entries.actions.view")}
                        </button>
                        <button
                          onclick={() => editEntity(entity)}
                          class="flex items-center gap-1 text-[12px] font-bold text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <EditOutline class="w-4 h-4" />
                          {$_("my_entries.actions.edit")}
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div
            class="py-4 border-t border-gray-50 text-center text-xs font-semibold text-indigo-400 bg-white"
          >
            {$_("my_entries.showing")}
            {filteredEntities.length}
            {$_("my_entries.of")}
            {entities.length}
            {$_("my_entries.entries")}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
