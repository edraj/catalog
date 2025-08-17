<script lang="ts">
  import { onMount } from "svelte";
  import {
    getSpaces,
    createSpace,
    editSpace,
    deleteSpace,
    searchInCatalog,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { user } from "@/stores/user";
  import MetaForm from "@/components/forms/MetaForm.svelte";
  import { derived } from "svelte/store";
  import { formatNumberInText } from "@/lib/helpers";
  $goto;
  let isLoading = $state(true);
  let spaces = $state([]);
  let displayedSpaces = $state([]);
  let debounceTimer;
  let error = $state(null);
  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );
  let showCreateModal = $state(false);
  let newSpaceName = $state("");
  let newDisplayName = $state("");
  let newDescription = $state("");
  let isCreating = $state(false);
  let createError = $state(null);

  let showEditModal = $state(false);
  let editingSpace = $state(null);
  let editSpaceName = $state("");
  let editDisplayName = $state("");
  let editDescription = $state("");
  let editIsActive = $state(true);
  let isEditing = $state(false);
  let editError = $state(null);

  let showDeleteModal = $state(false);
  let deletingSpace = $state(null);
  let isDeleting = $state(false);

  let metaContent: any = $state({});
  let validateMetaForm = $state(null);

  let editMetaContent: any = $state({});
  let validateEditMetaForm = $state(null);

  let searchQuery = $state("");
  let selectedStatus = $state("all");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let isSearchActive = $state(false);

  let searchResults = $state([]);
  let isSearching = $state(false);
  let searchTimeout: number;

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
  onMount(async () => {
    try {
      const response = await getSpaces(false, "managed");
      spaces = response.records || [];
      performSearch("");
    } catch (err) {
      console.error("Error fetching spaces:", err);
      error = "Failed to load spaces";
    } finally {
      isLoading = false;
    }
  });

  async function performSearch(query: string) {
    if (!query.trim()) {
      searchResults = [];
      applyFilters();
      return;
    }

    isSearching = true;
    try {
      const results = await searchInCatalog(query.trim());

      searchResults = results;

      const sortedResults = [...searchResults];
      sortedResults.sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
          case "name":
            aValue = getDisplayName(a).toLowerCase();
            bValue = getDisplayName(b).toLowerCase();
            break;
          case "created":
            aValue = new Date(a.attributes?.created_at || 0);
            bValue = new Date(b.attributes?.created_at || 0);
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

      displayedSpaces = sortedResults;
      isSearchActive = true;
    } catch (err) {
      console.error("Error performing search:", err);
      searchResults = [];
      displayedSpaces = [];
    } finally {
      isSearching = false;
    }
  }

  function handleRecordClick(record: any) {
    if (record.resource_type === "space") {
      handleSpaceClick(record);
      return;
    }
    const encodedSubpath = encodeURIComponent(record.subpath);

    $goto(
      "/dashboard/admin/[space_name]/[subpath]/[shortname]/[resource_type]",
      {
        space_name: record.attributes?.space_name,
        subpath: encodedSubpath,
        shortname: record.shortname,
        resource_type: record.resource_type,
      }
    );
  }

  function handleSearchInput() {
    performSearch(searchQuery);
  }

  export function debounce(fn: () => void, delay = 1000) {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(fn, delay);
  }

  function applyFilters() {
    if (searchQuery.trim()) {
      return;
    }

    let filtered = [...spaces];

    if (selectedStatus !== "all") {
      filtered = filtered.filter((space) => {
        const isActive = space.attributes?.is_active;
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
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.created_at || 0);
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

    displayedSpaces = filtered;
    isSearchActive = selectedStatus !== "all";
  }

  function clearFilters() {
    searchQuery = "";
    selectedStatus = "all";
    sortBy = "name";
    sortOrder = "asc";
    searchResults = [];
    applyFilters();
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      applyFilters();
    }
  }

  $effect(() => {
    if (!searchQuery.trim()) {
      searchResults = [];
      applyFilters();
    }
  });

  // $effect(() => {
  //   if (searchQuery.trim()) {
  //     performSearch(searchQuery);
  //   } else {
  //     applyFilters();
  //   }
  // });

  function handleSpaceClick(space: any) {
    $goto(`/dashboard/admin/[space_name]`, {
      space_name: space.shortname,
    });
  }

  function openCreateModal() {
    showCreateModal = true;
    newSpaceName = "";
    newDisplayName = "";
    newDescription = "";
    createError = null;
  }

  function closeCreateModal() {
    showCreateModal = false;
    newSpaceName = "";
    newDisplayName = "";
    newDescription = "";
    createError = null;
  }

  function openEditModal(space: any) {
    editingSpace = space;
    editSpaceName = space.shortname;
    editDisplayName = getDisplayName(space);
    editDescription = getDescription(space);
    editIsActive = space.attributes?.is_active ?? true;

    editMetaContent = {
      shortname: space.shortname,
      displayname: space.attributes?.displayname || {
        [$locale]: getDisplayName(space),
        en: getDisplayName(space),
      },
      description: space.attributes?.description || {
        [$locale]: getDescription(space),
        en: getDescription(space),
      },
    };

    showEditModal = true;
    editError = null;
  }

  function closeEditModal() {
    showEditModal = false;
    editingSpace = null;
    editSpaceName = "";
    editDisplayName = "";
    editDescription = "";
    editIsActive = true;
    editMetaContent = {};
    editError = null;
  }

  function openDeleteModal(space: any) {
    deletingSpace = space;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deletingSpace = null;
  }

  async function handleCreateSpace() {
    if (!validateMetaForm()) {
      createError = "Please fill all required fields in the meta form.";
      return;
    }

    isCreating = true;
    createError = null;

    try {
      const { shortname, displayname, description } = metaContent;
      const create = await createSpace({
        shortname,
        displayname,
        description,
      });

      if (create === undefined) {
        createError = "Please give a valid shortname for the space.";
        return;
      }

      const response = await getSpaces(false, "managed");

      spaces = response.records || [];

      closeCreateModal();
    } catch (err) {
      console.error("Error creating space:", err);
      createError = "Failed to create space. Please try again.";
    } finally {
      isCreating = false;
    }
  }

  async function handleEditSpace() {
    if (!validateEditMetaForm()) {
      editError = "Please fill all required fields in the meta form.";
      return;
    }

    isEditing = true;
    editError = null;

    try {
      const { displayname, description } = editMetaContent;

      await editSpace(editingSpace.shortname, {
        is_active: editIsActive,
        displayname,
        description,
      });

      const response = await getSpaces(false, "managed");
      spaces = response.records || [];

      closeEditModal();
    } catch (err) {
      console.error("Error editing space:", err);
      editError = "Failed to update space. Please try again.";
    } finally {
      isEditing = false;
    }
  }

  async function handleDeleteSpace() {
    if (!deletingSpace) return;

    isDeleting = true;

    try {
      await deleteSpace(deletingSpace.shortname);

      const response = await getSpaces(false, "managed");
      spaces = response.records || [];

      closeDeleteModal();
    } catch (err) {
      console.error("Error deleting space:", err);
    } finally {
      isDeleting = false;
    }
  }

  function getDisplayName(space: any): string {
    const displayname = space.attributes?.displayname;
    if (displayname) {
      return (
        displayname[$locale] ||
        displayname.en ||
        displayname.ar ||
        space.attributes?.payload?.body?.title ||
        space.shortname
      );
    }
    return (
      space.attributes?.payload?.body?.title ||
      space.shortname ||
      "Unnamed Space"
    );
  }

  function getDescription(space: any): string {
    const description = space.attributes?.description;

    if (description) {
      const selectedDescription =
        description[$locale] ||
        description.en ||
        description.ar ||
        space.attributes?.payload?.body?.content ||
        "No description available";

      return cleanHtmlContent(selectedDescription);
    }

    if (
      space.resource_type === "ticket" &&
      space.attributes?.payload?.body?.content
    ) {
      return cleanHtmlContent(space.attributes.payload.body.content);
    }

    if (space.attributes?.payload?.body) {
      const htmlContent = space.attributes.payload.body;
      if (typeof htmlContent === "string") {
        return cleanHtmlContent(htmlContent);
      }
    }

    return "No description available";
  }

  function cleanHtmlContent(htmlContent: string): string {
    if (typeof htmlContent !== "string") {
      return "No description available";
    }

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    let textContent = tempDiv.textContent || tempDiv.innerText || "";

    textContent = textContent
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return textContent.length > 200
      ? textContent.substring(0, 200) + "..."
      : textContent;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="min-h-screen bg-gray-50" class:rtl={$isRTL}>
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">
          {$_("admin_dashboard.title")}
        </h1>
        <p class="text-xl text-gray-600 max-w-3xl mx-auto">
          {$_("admin_dashboard.welcome", {
            values: { name: $user.localized_displayname },
          })}
        </p>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="flex justify-center py-16">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else if $error}
      <div class="text-center py-16">
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
          {$_("admin_dashboard.error.title")}
        </h3>
        <p class="text-gray-600">{$error}</p>
      </div>
    {:else if spaces.length === 0}
      <div class="text-center py-16">
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          {$_("admin_dashboard.empty.title")}
        </h3>
        <p class="text-gray-600 mb-6">
          {$_("admin_dashboard.empty.description")}
        </p>
        <button
          onclick={openCreateModal}
          class="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200"
          aria-label={$_("admin_dashboard.actions.create_first")}
        >
          <svg
            class="w-5 h-5 mr-2"
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
          {$_("admin_dashboard.actions.create_first")}
        </button>
      </div>
    {:else}
      <div class="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-purple-100 mx-4 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="ml-6" class:mr-6={$isRTL} class:ml-0={$isRTL}>
              <p class="text-sm font-medium text-gray-500">
                {$_("admin_dashboard.stats.total_spaces")}
              </p>
              <p class="text-2xl font-semibold text-gray-900">
                {formatNumberInText(spaces.length, $locale)}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-green-100 mx-4 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-green-600"
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
            </div>
            <div class="ml-6" class:mr-6={$isRTL} class:ml-0={$isRTL}>
              <p class="text-sm font-medium text-gray-500">
                {$_("admin_dashboard.stats.active_spaces")}
              </p>
              <p class="text-2xl font-semibold text-gray-900">
                {formatNumberInText(
                  spaces.filter((s) => s.attributes?.is_active).length,
                  $locale
                )}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-blue-100 rounded-lg mx-4 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="ml-6" class:mr-6={$isRTL} class:ml-0={$isRTL}>
              <p class="text-sm font-medium text-gray-500">
                {$_("admin_dashboard.stats.admin_access")}
              </p>
              <p class="text-2xl font-semibold text-gray-900">
                {$_("admin_dashboard.stats.full")}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-orange-100 mx-4 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="ml-6" class:mr-6={$isRTL} class:ml-0={$isRTL}>
              <p class="text-sm font-medium text-gray-500">
                {$_("admin_dashboard.stats.role")}
              </p>
              <p class="text-2xl font-semibold text-gray-900">
                {$_("admin_dashboard.stats.super_admin")}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
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
                        displayedSpaces.length,
                        $locale
                      ),
                    },
                  })}
                </h2>
                <p class="text-sm text-gray-600">
                  {#if searchQuery.trim()}
                    Showing {formatNumberInText(
                      displayedSpaces.length,
                      $locale
                    )} search results for "{searchQuery}"
                  {:else if isSearchActive}
                    Showing {formatNumberInText(
                      displayedSpaces.length,
                      $locale
                    )} of {formatNumberInText(spaces.length, $locale)} spaces
                  {:else}
                    {$_("admin_dashboard.admin_access_description")}
                  {/if}
                </p>
              </div>
              <button
                onclick={openCreateModal}
                class="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200"
                aria-label={$_("admin_dashboard.actions.create_space")}
              >
                <svg
                  class="w-4 h-4 mr-2"
                  class:ml-2={$isRTL}
                  class:mr-0={$isRTL}
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
                {$_("admin_dashboard.actions.create_space")}
              </button>
            </div>
          </div>

          <div class="p-6 bg-gray-50 border-b border-gray-200">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <input
                    id="search"
                    type="text"
                    bind:value={searchQuery}
                    oninput={() => debounce(handleSearchInput)}
                    placeholder={$_("search_filters.search_placeholder")}
                    class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  />
                  {#if isSearching}
                    <div class="absolute inset-y-0 right-8 flex items-center">
                      <Diamonds color="#8b5cf6" size="16" unit="px" />
                    </div>
                  {/if}
                  {#if searchQuery}
                    <button
                      onclick={() => {
                        searchQuery = "";
                        searchResults = [];
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
                  disabled={searchQuery.trim() !== ""}
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {#each statusOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>

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
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
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

            {#if isSearchActive}
              <div class="mt-4 flex items-center justify-between">
                <div class="text-sm text-gray-600">
                  {#if searchQuery.trim()}
                    Showing {displayedSpaces.length} search results
                    {$_("search_filters.results_for", {
                      values: { query: searchQuery },
                    })}
                  {:else}
                    {$_("search_filters.results_count", {
                      values: {
                        displayed: displayedSpaces.length,
                        total: spaces.length,
                      },
                    })}
                  {/if}
                </div>
                <button
                  onclick={clearFilters}
                  class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
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

          {#if displayedSpaces.length === 0 && (isSearchActive || searchQuery.trim())}
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                {searchQuery.trim()
                  ? `No spaces found for "${searchQuery}"`
                  : $_("search_filters.no_results.title")}
              </h3>
              <p class="text-gray-500 mb-4">
                {searchQuery.trim()
                  ? "Try adjusting your search terms or browse all spaces"
                  : $_("search_filters.no_results.description")}
              </p>
              <button
                onclick={clearFilters}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-600 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                aria-label={searchQuery.trim()
                  ? "Clear search"
                  : $_("search_filters.no_results.action")}
              >
                {searchQuery.trim()
                  ? "Clear search"
                  : $_("search_filters.no_results.action")}
              </button>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      class:text-right={$isRTL}
                    >
                      {$_("admin_dashboard.table.space")}
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      class:text-right={$isRTL}
                    >
                      {$_("admin_dashboard.table.status")}
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      class:text-right={$isRTL}
                    >
                      {$_("admin_dashboard.table.owner")}
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      class:text-right={$isRTL}
                    >
                      {$_("admin_dashboard.table.created")}
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      class:text-right={$isRTL}
                    >
                      {$_("admin_dashboard.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each displayedSpaces as space, index}
                    <tr
                      class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                      onclick={() => handleRecordClick(space)}
                      role="button"
                      tabindex="0"
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleRecordClick(space);
                        }
                      }}
                    >
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div
                          class="flex items-center"
                          class:flex-row-reverse={$isRTL}
                        >
                          <div class="flex-shrink-0 h-12 w-12 mx-4">
                            <div
                              class="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md"
                            >
                              <span class="text-white font-bold text-lg">
                                {space.shortname
                                  ? space.shortname.charAt(0).toUpperCase()
                                  : "S"}
                              </span>
                            </div>
                          </div>
                          <div
                            class="ml-6"
                            class:mr-6={$isRTL}
                            class:ml-0={$isRTL}
                          >
                            <div class="text-sm font-semibold text-gray-900">
                              {getDisplayName(space)}
                            </div>
                            <div
                              class="text-sm text-gray-500 max-w-xs truncate"
                            >
                              {getDescription(space)}
                            </div>
                            <div
                              class="text-xs text-purple-600 font-medium mt-1"
                            >
                              {space.shortname}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {space
                            .attributes?.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'}"
                        >
                          <div
                            class="w-1.5 h-1.5 rounded-full mr-1.5 {space
                              .attributes?.is_active
                              ? 'bg-green-400'
                              : 'bg-red-400'}"
                            class:ml-1.5={$isRTL}
                            class:mr-0={$isRTL}
                          ></div>
                          {space.attributes?.is_active
                            ? $_("admin_dashboard.status.active")
                            : $_("admin_dashboard.status.inactive")}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div
                          class="flex items-center"
                          class:flex-row-reverse={$isRTL}
                        >
                          <div
                            class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2"
                            class:ml-2={$isRTL}
                            class:mr-0={$isRTL}
                          >
                            <span class="text-xs font-medium text-gray-600">
                              {space.attributes?.owner_shortname
                                ? space.attributes.owner_shortname
                                    .charAt(0)
                                    .toUpperCase()
                                : "U"}
                            </span>
                          </div>
                          <span class="text-sm text-gray-900">
                            {space.attributes?.owner_shortname ||
                              $_("common.unknown")}
                          </span>
                        </div>
                      </td>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        {formatDate(space.attributes?.created_at)}
                      </td>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium"
                      >
                        <button
                          onclick={(e) => {
                            e.stopPropagation();
                            handleSpaceClick(space);
                          }}
                          class="text-purple-600 hover:text-purple-900 transition-colors duration-200 mx-2"
                          aria-label={$_("admin_dashboard.actions.manage")}
                        >
                          {$_("admin_dashboard.actions.manage")}
                        </button>
                        <button
                          onclick={(e) => {
                            e.stopPropagation();
                            openEditModal(space);
                          }}
                          class="text-blue-600 hover:text-blue-900 transition-colors duration-200 mx-2"
                          aria-label={$_("admin_dashboard.actions.edit")}
                        >
                          {$_("admin_dashboard.actions.edit")}
                        </button>
                        <button
                          onclick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(space);
                          }}
                          class="text-red-600 hover:text-red-900 transition-colors duration-200 mx-2"
                          aria-label={$_("admin_dashboard.actions.delete")}
                        >
                          {$_("admin_dashboard.actions.delete")}
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Create Space Modal -->
{#if showCreateModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="flex items-center justify-between">
          <h3 class="modal-title create">
            {$_("admin_dashboard.modal.create.title")}
          </h3>
          <button
            onclick={closeCreateModal}
            class="modal-close"
            aria-label={$_("admin_dashboard.modal.close")}
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
        <p class="text-sm text-gray-600 mt-2">
          {$_("admin_dashboard.modal.create.description")}
        </p>
      </div>

      <div class="modal-content">
        <MetaForm
          bind:formData={metaContent}
          bind:validateFn={validateMetaForm}
          isCreate={true}
        />

        {#if $createError}
          <div class="error-message">
            <p class="error-text">{$createError}</p>
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <button
          onclick={closeCreateModal}
          class="btn btn-secondary"
          disabled={isCreating}
        >
          {$_("admin_dashboard.modal.cancel")}
        </button>
        <button
          onclick={handleCreateSpace}
          disabled={isCreating || !metaContent.shortname}
          class="btn btn-primary"
        >
          {#if isCreating}
            <div class="spinner"></div>
            {$_("admin_dashboard.modal.creating")}
          {:else}
            {$_("admin_dashboard.modal.create.button")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Space Modal -->
{#if showEditModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="flex items-center justify-between">
          <h3 class="modal-title edit">
            {$_("admin_dashboard.modal.edit.title")}
          </h3>
          <button
            onclick={closeEditModal}
            class="modal-close"
            aria-label={$_("admin_dashboard.modal.close")}
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
        <p class="text-sm text-gray-600 mt-2">
          {$_("admin_dashboard.modal.edit.description")}
        </p>
      </div>

      <div class="modal-content">
        <MetaForm
          bind:formData={$editMetaContent}
          bind:validateFn={$validateEditMetaForm}
          isCreate={false}
        />

        <div class="form-group">
          <div class="form-checkbox">
            <input
              type="checkbox"
              bind:checked={editIsActive}
              id="editIsActive"
            />
            <label for="editIsActive">
              {$_("admin_dashboard.modal.edit.space_active")}
            </label>
          </div>
        </div>

        {#if $editError}
          <div class="error-message">
            <p class="error-text">{$editError}</p>
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <button
          onclick={closeEditModal}
          class="btn btn-secondary"
          disabled={isEditing}
        >
          {$_("admin_dashboard.modal.cancel")}
        </button>
        <button
          onclick={handleEditSpace}
          disabled={isEditing || !$editMetaContent.get().shortname}
          class="btn btn-edit"
        >
          {#if isEditing}
            <div class="spinner"></div>
            {$_("admin_dashboard.modal.updating")}
          {:else}
            {$_("admin_dashboard.modal.edit.button")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Space Modal -->
{#if showDeleteModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="flex items-center justify-between">
          <h3 class="modal-title delete">
            {$_("admin_dashboard.modal.delete.title")}
          </h3>
          <button
            onclick={closeDeleteModal}
            class="modal-close"
            aria-label={$_("admin_dashboard.modal.close")}
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
      </div>

      <div class="modal-content">
        <div class="delete-warning">
          <div class="delete-warning-header">
            <div class="delete-icon">⚠️</div>
            <div>
              <h4>{$_("admin_dashboard.modal.delete.confirm")}</h4>
              <p>{$_("admin_dashboard.modal.delete.irreversible")}</p>
            </div>
          </div>
        </div>

        <div class="space-details">
          <p>
            <strong>{$_("admin_dashboard.modal.delete.space_label")}:</strong>
            {$deletingSpace ? getDisplayName($deletingSpace) : ""}
          </p>
          <p>
            <strong
              >{$_("admin_dashboard.modal.delete.shortname_label")}:</strong
            >
            {$deletingSpace ? $deletingSpace.shortname : ""}
          </p>
        </div>

        <div class="delete-final-warning">
          {$_("admin_dashboard.modal.delete.warning")}
        </div>

        <div class="modal-actions">
          <button
            onclick={closeDeleteModal}
            class="btn btn-secondary"
            disabled={isDeleting}
          >
            {$_("admin_dashboard.modal.cancel")}
          </button>
          <button
            onclick={handleDeleteSpace}
            disabled={isDeleting}
            class="btn btn-danger"
          >
            {#if isDeleting}
              <div class="spinner"></div>
              {$_("admin_dashboard.modal.deleting")}
            {:else}
              {$_("admin_dashboard.modal.delete.button")}
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .rtl {
    direction: rtl;
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
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    max-height: 90vh;
    overflow-y: auto;
    width: 100%;
    max-width: 500px;
    animation: slideIn 0.3s ease-out;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  .modal-header {
    padding: 1.5rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    border-radius: 16px 16px 0 0;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .modal-title.create::before {
    content: "✨";
    font-size: 1.5rem;
  }

  .modal-title.edit::before {
    content: "✏️";
    font-size: 1.5rem;
  }

  .modal-title.delete::before {
    content: "⚠️";
    font-size: 1.5rem;
  }

  .modal-close {
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
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
    transform: scale(1.05);
  }

  .modal-content {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }
  .form-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .rtl .form-checkbox {
    flex-direction: row-reverse;
  }

  .form-checkbox:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .form-checkbox input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    border-radius: 4px;
    border: 2px solid #d1d5db;
    background: white;
    accent-color: #8b5cf6;
  }

  .form-checkbox label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    margin: 0;
  }

  .error-message {
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fca5a5;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .error-text {
    font-size: 0.875rem;
    color: #dc2626;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rtl .error-text {
    flex-direction: row-reverse;
  }

  .error-text::before {
    content: "⚠️";
    font-size: 1rem;
  }

  .delete-warning {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fca5a5;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .delete-warning-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .rtl .delete-warning-header {
    flex-direction: row-reverse;
  }

  .delete-icon {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }

  .delete-warning h4 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #991b1b;
    margin: 0;
  }

  .delete-warning p {
    font-size: 0.875rem;
    color: #7f1d1d;
    margin: 0;
  }

  .space-details {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
    margin: 1rem 0;
  }

  .space-details p {
    font-size: 0.875rem;
    margin: 0.25rem 0;
  }

  .space-details strong {
    color: #374151;
  }

  .delete-final-warning {
    font-size: 0.875rem;
    color: #dc2626;
    font-weight: 500;
    text-align: center;
    padding: 0.75rem;
    background: #fef2f2;
    border-radius: 8px;
    border: 1px solid #fca5a5;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #f3f4f6;
    margin-top: 1.5rem;
    margin: 22px;
  }

  .rtl .modal-actions {
    flex-direction: row-reverse;
    justify-content: flex-start;
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
    min-width: 100px;
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
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    box-shadow: 0 4px 14px 0 rgba(139, 92, 246, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(139, 92, 246, 0.4);
  }

  .btn-edit {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .btn-edit:hover:not(:disabled) {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
  }

  .btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(239, 68, 68, 0.4);
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
  @media (max-width: 640px) {
    .modal-overlay {
      padding: 0.5rem;
    }

    .modal-container {
      max-width: 100%;
      border-radius: 12px;
    }

    .modal-header {
      padding: 1rem 1rem 0.75rem 1rem;
    }

    .modal-content {
      padding: 1rem;
    }

    .modal-actions {
      flex-direction: column-reverse;
    }

    .rtl .modal-actions {
      flex-direction: column-reverse;
    }

    .btn {
      width: 100%;
    }
  }
</style>
