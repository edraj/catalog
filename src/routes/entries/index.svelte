<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getMyEntities } from "@/lib/dmart_services";
  import { formatDate, renderStateString, truncateString } from "@/lib/helpers";
  import { errorToastMessage } from "@/lib/toasts_messages";
  import { user } from "@/stores/user";
  import { _ } from "@/i18n";
  import {
    PlusOutline,
    EditOutline,
    EyeOutline,
    HeartSolid,
    MessagesSolid,
    ClockOutline,
    TagOutline,
    SearchOutline,
    FilterOutline,
  } from "flowbite-svelte-icons";

  $goto;
  $params;
  let entities: any[] = $state([]);
  let filteredEntities: any[] = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let sortBy = $state("updated_at");
  let sortOrder = $state("desc");

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
      const rawEntities = await getMyEntities();

      entities = rawEntities.map((entity) => ({
        resource_type: entity?.resource_type || "",
        shortname: entity.shortname,
        uuid: entity?.uuid,
        title:
          entity.attributes?.payload?.body?.title ||
          entity.attributes?.displayname?.en ||
          "Untitled",
        content: entity.attributes?.payload?.body?.content || "",
        tags: entity.attributes?.tags || [],
        state: entity.attributes?.state || "unknown",
        is_active: entity.attributes?.is_active || false,
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
      }));
    } catch (error) {
      console.error("Error fetching entities:", error);
      errorToastMessage("An error occurred while fetching your entries");
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
          entity.tags?.some((tag) => tag.toLowerCase().includes(search))
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

  function viewEntity(entity: any) {
    $goto("/entries/[space_name]/[subpath]/[shortname]/[resource_type]", {
      shortname: entity.shortname,
      space_name: entity.space_name,
      subpath: entity.subpath,
      resource_type: entity.resource_type,
    });
  }

  function editEntity(entity: any) {
    $goto("/entries/[shortname]/edit", { shortname: entity.shortname });
  }

  function createNewEntry() {
    $goto("/entries/create");
  }

  function getStatusBadge(entity: any) {
    if (!entity.is_active) {
      return { text: "Draft", class: "bg-gray-100 text-gray-800" };
    } else if (entity.state === "pending") {
      return { text: "Pending", class: "bg-yellow-100 text-yellow-800" };
    } else if (entity.state === "approved") {
      return { text: "Published", class: "bg-green-100 text-green-800" };
    } else if (entity.state === "rejected") {
      return { text: "Rejected", class: "bg-red-100 text-red-800" };
    } else {
      return { text: "Active", class: "bg-blue-100 text-blue-800" };
    }
  }
</script>

<div
  class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50"
>
  <div class="container mx-auto px-6 py-8 max-w-7xl">
    <div class="mb-8">
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div>
          <h1 class="text-4xl hero-title">My Entries</h1>
          <p class="text-gray-600 text-lg">
            Manage and track your content submissions
          </p>
        </div>

        <button
          onclick={createNewEntry}
          class="btn-primary inline-flex items-center"
        >
          <PlusOutline class="mx-2 w-5 h-5" />
          Create New Entry
        </button>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Search -->
        <div class="relative">
          <SearchOutline
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          />
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Search entries..."
            class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        <!-- Status Filter -->
        <div class="relative">
          <FilterOutline
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          />
          <select
            bind:value={statusFilter}
            onchange={handleFilterChange}
            class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Published</option>
            <option value="inactive">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        <!-- Sort By -->
        <select
          bind:value={sortBy}
          onchange={handleSortChange}
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
        >
          <option value="updated_at">Last Updated</option>
          <option value="created_at">Date Created</option>
          <option value="title">Title</option>
          <option value="reactions">Reactions</option>
          <option value="comments">Comments</option>
        </select>

        <!-- Sort Order -->
        <select
          bind:value={sortOrder}
          onchange={handleSortChange}
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>
    </div>

    {#if isLoading}
      <div class="flex justify-center items-center py-20">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
          ></div>
          <p class="text-gray-600 text-lg">Loading your entries...</p>
        </div>
      </div>
    {:else if filteredEntities.length === 0}
      <div class="text-center py-20">
        <h3 class="text-2xl font-semibold text-gray-900 my-3">
          {entities.length === 0 ? "No entries yet" : "No matching entries"}
        </h3>
        <p class="text-gray-600 mb-8 max-w-md mx-auto">
          {entities.length === 0
            ? "Start creating your first entry to share your ideas and content with the world."
            : "Try adjusting your search or filter criteria to find what you're looking for."}
        </p>
        {#if entities.length === 0}
          <button
            onclick={createNewEntry}
            class="inline-flex items-center btn-primary"
          >
            Create Your First Entry
          </button>
        {/if}
      </div>
    {:else}
      <!-- Stats Summary -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Total Entries</p>
              <p class="text-3xl font-bold text-gray-900">{entities.length}</p>
            </div>
            <div
              class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center"
            >
              <EditOutline class="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Published</p>
              <p class="text-3xl font-bold text-green-600">
                {entities.filter((e) => e.is_active && e.state === "approved")
                  .length}
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
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Total Reactions</p>
              <p class="text-3xl font-bold text-red-500">
                {entities.reduce((sum, e) => sum + (e.reaction || 0), 0)}
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
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Total Comments</p>
              <p class="text-3xl font-bold text-blue-600">
                {entities.reduce((sum, e) => sum + (e.comment || 0), 0)}
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
          <table class="w-full">
            <thead class="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Entry
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Engagement
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Updated
                </th>
                <th
                  class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each filteredEntities as entity, index}
                <tr
                  class="hover:bg-gray-50 transition-colors duration-150 group"
                >
                  <td class="px-6 py-4">
                    <div class="flex items-start space-x-4">
                      <div class="flex-1 min-w-0">
                        <h3
                          class="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors duration-150 line-clamp-2"
                        >
                          {entity.title || "Untitled"}
                        </h3>
                        {#if entity.content}
                          <p class="text-sm text-gray-600 mt-1 line-clamp-2">
                            {@html truncateString(entity.content)}
                          </p>
                        {/if}
                        {#if entity.tags && entity.tags.length > 0}
                          <div class="flex flex-wrap gap-1 mt-2">
                            {#each entity.tags.slice(0, 3) as tag}
                              <span
                                class="inline-flex items-center px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium"
                              >
                                <TagOutline class="w-3 h-3 mr-1" />
                                {tag}
                              </span>
                            {/each}
                            {#if entity.tags.length > 3}
                              <span
                                class="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium"
                              >
                                +{entity.tags.length - 3} more
                              </span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
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
                    <div class="flex items-center space-x-4 text-sm">
                      <div class="flex items-center text-red-500">
                        <HeartSolid class="w-4 h-4 mr-1" />
                        <span class="font-medium">{entity.reaction || 0}</span>
                      </div>
                      <div class="flex items-center text-blue-500">
                        <MessagesSolid class="w-4 h-4 mr-1" />
                        <span class="font-medium">{entity.comment || 0}</span>
                      </div>
                    </div>
                  </td>

                  <td class="px-6 py-4">
                    <div class="flex items-center text-sm text-gray-600">
                      <ClockOutline class="w-4 h-4 mr-2" />
                      {entity.updated_at}
                    </div>
                  </td>

                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end space-x-2">
                      <button
                        onclick={() => viewEntity(entity)}
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors duration-150"
                      >
                        <EyeOutline class="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button
                        onclick={() => editEntity(entity)}
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                      >
                        <EditOutline class="w-4 h-4 mr-1" />
                        Edit
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
        Showing {filteredEntities.length} of {entities.length} entries
      </div>
    {/if}
  </div>
</div>

<style>
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
</style>
