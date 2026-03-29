<script lang="ts">
  import { onMount } from "svelte";
  import {
    createSpace,
    deleteSpace,
    editSpace,
    getSpaces,
    searchInCatalog,
    checkApplicationsFolders,
    createApplicationsFolders,
  } from "@/lib/dmart_services/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { user } from "@/stores/user";
  import MetaForm from "@/components/forms/MetaForm.svelte";
  import { Modal } from "flowbite-svelte";
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
    ($locale) => $locale === "ar" || $locale === "ku",
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
  // Applications folders check
  let missingFolders = $state([]);
  let missingWorkflow = $state(false);
  let missingReportSchema = $state(false);
  let missingWorkflowSchema = $state(false);
  let checkingFolders = $state(true);
  let fixingFolders = $state(false);
  let foldersFixed = $state(false);
  let workflowCreated = $state(false);
  let reportSchemaCreated = $state(false);
  let workflowSchemaCreated = $state(false);

  onMount(async () => {
    try {
      const response = await getSpaces(false, "managed");
      spaces = response.records || [];
      performSearch("");

      // Check if applications folders exist
      await checkFolders();
    } catch (err) {
      console.error("Error fetching spaces:", err);
      error = "Failed to load spaces";
    } finally {
      isLoading = false;
    }
  });

  async function checkFolders() {
    checkingFolders = true;
    console.log("Checking application folders...");
    try {
      const result = await checkApplicationsFolders("managed");
      console.log("checkApplicationsFolders result:", result);
      if (!result.exists && result.error !== "permission_denied") {
        missingFolders = result.missing || [];
        missingWorkflow = result.missingWorkflow || false;
        missingReportSchema = result.missingReportSchema || false;
        missingWorkflowSchema = result.missingWorkflowSchema || false;
        console.log("Missing resources detected:", {
          missingFolders,
          missingWorkflow,
          missingReportSchema,
          missingWorkflowSchema,
        });
      } else {
        missingFolders = [];
        missingWorkflow = false;
        missingReportSchema = false;
        missingWorkflowSchema = false;
      }
    } catch (err) {
      console.error("Error checking folders:", err);
      missingFolders = [];
      missingWorkflow = false;
      missingReportSchema = false;
      missingWorkflowSchema = false;
    } finally {
      checkingFolders = false;
    }
  }

  async function handleFixFolders() {
    fixingFolders = true;
    console.log("Starting fix folders process...");
    try {
      const result = await createApplicationsFolders("managed");
      console.log("createApplicationsFolders result:", result);
      if (result.success) {
        console.log("Fix successful, updating state...");
        foldersFixed = true;
        missingFolders = [];
        missingWorkflow = false;
        missingReportSchema = false;
        missingWorkflowSchema = false;
        workflowCreated = result.workflowCreated || false;
        reportSchemaCreated = result.reportSchemaCreated || false;
        workflowSchemaCreated = result.workflowSchemaCreated || false;
        console.log("State updated after fix:", {
          foldersFixed,
          workflowCreated,
          reportSchemaCreated,
          workflowSchemaCreated,
        });
      } else {
        // Some folders may have failed
        console.log("Fix partially failed:", result);
        missingFolders = result.failed || [];
        missingWorkflow = result.workflowFailed || false;
        missingReportSchema = result.reportSchemaFailed || false;
        missingWorkflowSchema = result.workflowSchemaFailed || false;
      }
    } catch (err) {
      console.error("Error creating folders:", err);
    } finally {
      fixingFolders = false;
    }
  }

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
      },
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
  <div class="bg-gray-50">
    <div class="container mx-auto px-4 py-8 max-w-[1200px]">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">
          {$_("route_labels.admin_dashboard_title")}
        </h1>
        <p class="text-sm text-gray-500 max-w-3xl mx-auto">
          {$_("route_labels.admin_dashboard_welcome")}
        </p>
      </div>
    </div>
  </div>

  <div class="mx-auto  pb-8 max-w-[1200px]">
    <!-- Missing Folders Warning -->
    {#if !checkingFolders && (missingFolders.length > 0 || missingWorkflow || missingReportSchema || missingWorkflowSchema) && !foldersFixed}
      <div class="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <svg
              class="w-5 h-5 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-amber-800 mb-1">
              Missing Application Resources
            </h3>
            <p class="text-sm text-amber-700 mb-3">
              {#if missingFolders.length > 0}
                The following folders are missing in the <strong
                  >applications</strong
                >
                space:
                <span class="font-medium">{missingFolders.join(", ")}</span>.
              {/if}
              {#if missingWorkflow}
                {#if missingFolders.length > 0}<br />{/if}
                The <strong>report_workflow</strong> is missing in the workflows
                folder.
              {/if}
              {#if missingReportSchema}
                {#if missingFolders.length > 0 || missingWorkflow}<br />{/if}
                The <strong>report</strong> schema is missing in the schema folder.
              {/if}
              {#if missingWorkflowSchema}
                {#if missingFolders.length > 0 || missingWorkflow || missingReportSchema}<br
                  />{/if}
                The <strong>workflow</strong> schema is missing in the schema folder.
              {/if}
              <br />These are required for reports, polls, and surveys to
              function properly.
            </p>
            <button
              onclick={handleFixFolders}
              disabled={fixingFolders}
              class="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if fixingFolders}
                <Diamonds color="#ffffff" size="16" unit="px" />
                Creating...
              {:else}
                <svg
                  class="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create Missing Resources
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Folders Fixed Success Message -->
    {#if foldersFixed}
      <div class="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <svg
              class="w-5 h-5 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-green-800">
              Resources Created Successfully
            </h3>
            <p class="text-sm text-green-700">
              All required folders, workflows, and schemas have been created in
              the applications space.
              {#if workflowCreated}
                <br /><span class="font-medium">report_workflow</span> has been set
                up with default states.
              {/if}
              {#if reportSchemaCreated}
                <br /><span class="font-medium">report</span> schema has been created.
              {/if}
              {#if workflowSchemaCreated}
                <br /><span class="font-medium">workflow</span> schema has been created.
              {/if}
            </p>
          </div>
        </div>
      </div>
    {/if}
    {#if isLoading}
      <div class="flex justify-center py-16">
        <Diamonds color="#8b5cf6" size="60" unit="px" />
      </div>
    {:else if error}
      <div class="text-center py-16">
        <div
          class="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4"
        >
          <svg
            class="w-8 h-8 text-red-500"
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
        <h3 class="text-lg font-medium text-gray-900 mb-1">
          {$_("admin_dashboard.error.title")}
        </h3>
        <p class="text-sm text-gray-500">{error}</p>
      </div>
    {:else if spaces.length === 0}
      <div class="text-center py-16">
        <div
          class="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"
        >
          <svg
            class="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-1">
          {$_("admin_dashboard.empty.title")}
        </h3>
        <p class="text-sm text-gray-500 mb-6">
          {$_("admin_dashboard.empty.description")}
        </p>
        <button
          onclick={openCreateModal}
          class="inline-flex items-center px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors duration-200"
          aria-label={$_("admin_dashboard.actions.create_first")}
        >
          <svg
            class="w-4 h-4 mr-2"
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
      <div class="mb-8 flex justify-center gap-4">
        <!-- Total Spaces -->
        <div
          class="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-4 w-60 py-6"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-2"
            >
              <svg
                class="w-5 h-5 text-purple-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-400">Total Spaces</p>
              <p class="text-xl font-bold text-gray-900 mt-0.5">
                {formatNumberInText(spaces.length, $locale)}
              </p>
            </div>
          </div>
        </div>

        <!-- Active Spaces -->
        <div
          class="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-4 w-60 py-6"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-2"
            >
              <svg
                class="w-5 h-5 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-400">Active Spaces</p>
              <p class="text-xl font-bold text-gray-900 mt-0.5">
                {formatNumberInText(
                  spaces.filter((s) => s.attributes?.is_active).length,
                  $locale,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden"
      >
        <div class="p-6 pb-4">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-base font-semibold text-gray-900">
                Manage Spaces ({formatNumberInText(
                  displayedSpaces.length,
                  $locale,
                )})
              </h2>
              <!--              <p class="text-xs text-gray-400 mt-1">-->
              <!--                Administrative access to all spaces-->
              <!--              </p>-->
            </div>
            <button
              onclick={openCreateModal}
              class="inline-flex items-center px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors duration-200"
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
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              Create Space
            </button>
          </div>

          <!-- Filters row -->
          <div class="flex items-end gap-4 mb-2">
            <!-- Search Input -->
            <div class="flex-1 max-w-sm">
              <label
                for="search"
                class="block text-xs font-medium text-gray-400 mb-1.5"
              >
                Search Spaces
              </label>
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
                  id="search"
                  type="text"
                  bind:value={searchQuery}
                  oninput={() => debounce(handleSearchInput)}
                  placeholder={$_(
                    "route_labels.placeholder_search_by_name_desc",
                  )}
                  class="block w-full pl-9 pr-8 py-2 text-sm border-none bg-gray-50 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
                />
                {#if isSearching}
                  <div class="absolute inset-y-0 right-2 flex items-center">
                    <Diamonds color="#6366f1" size="14" unit="px" />
                  </div>
                {:else if searchQuery}
                  <button
                    onclick={() => {
                      searchQuery = "";
                      searchResults = [];
                    }}
                    class="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      class="h-4 w-4"
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

            <!-- Status Filter -->
            <div class="w-32">
              <label
                for="status-filter"
                class="block text-xs font-medium text-gray-400 mb-1.5 ml-1"
              >
                Status
              </label>
              <select
                id="status-filter"
                bind:value={selectedStatus}
                onchange={applyFilters}
                class="block w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-lg text-gray-700 focus:ring-2 focus:ring-indigo-500"
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

            <!-- Sort Option -->
            <div class="w-32">
              <label
                for="sort-by"
                class="block text-xs font-medium text-gray-400 mb-1.5 ml-1"
              >
                Sort By
              </label>
              <select
                id="sort-by"
                bind:value={sortBy}
                onchange={() => applyFilters()}
                class="block w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-lg text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                {#each sortOptions as option}
                  <option value={option.value}
                    >{option.label === "Name"
                      ? option.label
                      : option.label}</option
                  >
                {/each}
              </select>
            </div>

            <!-- Sort Direction Toggle -->
            <div class="pb-[1px]">
              <button
                onclick={toggleSortOrder}
                class="h-9 w-9 flex items-center justify-center bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-indigo-500"
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
        <div class="px-6 pb-6">
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
                  stroke-width="1.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
              <h3 class="text-sm font-medium text-gray-900 mb-1">
                {searchQuery.trim()
                  ? `No spaces found for "${searchQuery}"`
                  : $_("search_filters.no_results.title")}
              </h3>
              <p class="text-xs text-gray-500 mb-4">
                {searchQuery.trim()
                  ? "Try adjusting your search terms or browse all spaces"
                  : $_("search_filters.no_results.description")}
              </p>
              <button
                onclick={clearFilters}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {searchQuery.trim()
                  ? "Clear search"
                  : $_("search_filters.no_results.action")}
              </button>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th
                      class="px-2 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-2/5 uppercase"
                    >
                      SPACE
                    </th>
                    <th
                      class="px-2 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/6 uppercase"
                    >
                      STATUS
                    </th>
                    <th
                      class="px-2 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/6 uppercase"
                    >
                      OWNER
                    </th>
                    <th
                      class="px-2 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/6 uppercase"
                    >
                      CREATED
                    </th>
                    <th
                      class="px-2 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-auto uppercase"
                    >
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  {#each displayedSpaces as space}
                    <tr
                      class="group cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onclick={() => handleRecordClick(space)}
                      role="button"
                      tabindex="0"
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleRecordClick(space);
                        }
                      }}
                    >
                      <td class="px-2 py-4">
                        <div class="flex items-start">
                          <div class="flex-shrink-0 mt-0.5">
                            <div
                              class="h-8 w-8 rounded-[10px] bg-indigo-500 flex items-center justify-center shadow-sm"
                              style="background-color: {[
                                '#6366f1',
                                '#8b5cf6',
                                '#ec4899',
                                '#f59e0b',
                                '#10b981',
                              ][space.shortname.length % 5]}"
                            >
                              <span class="text-white font-medium text-sm">
                                {space.shortname
                                  ? space.shortname.charAt(0).toUpperCase()
                                  : "S"}
                              </span>
                            </div>
                          </div>
                          <div class="ml-3 min-w-0">
                            <div
                              class="text-[13px] font-semibold text-gray-900 truncate"
                            >
                              {getDisplayName(space)}
                            </div>
                            <div
                              class="text-[11px] text-gray-400 truncate mt-0.5"
                            >
                              {getDescription(space)}
                            </div>
                            <div
                              class="text-[11px] text-indigo-500 truncate mt-0.5"
                            >
                              {space.shortname}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="px-2 py-4">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium {space
                            .attributes?.is_active
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'}"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full mr-1.5 {space
                              .attributes?.is_active
                              ? 'bg-emerald-400'
                              : 'bg-rose-400'}"
                          ></span>
                          {space.attributes?.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td class="px-2 py-4">
                        <div class="flex items-center">
                          <div
                            class="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center mr-2 border border-gray-200"
                          >
                            <span class="text-[10px] font-medium text-gray-500">
                              {space.attributes?.owner_shortname
                                ? space.attributes.owner_shortname
                                    .charAt(0)
                                    .toUpperCase()
                                : "U"}
                            </span>
                          </div>
                          <span class="text-[12px] text-gray-500">
                            {space.attributes?.owner_shortname ||
                              $_("common.unknown")}
                          </span>
                        </div>
                      </td>
                      <td class="px-2 py-4 text-[12px] text-gray-400">
                        {formatDate(space.attributes?.created_at)}
                      </td>
                      <td class="px-2 py-4">
                        <div class="flex items-center justify-end gap-3">
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleSpaceClick(space);
                            }}
                            class="inline-flex items-center text-[12px] font-medium text-indigo-500 hover:text-indigo-600"
                          >
                            <svg
                              class="w-3.5 h-3.5 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                              ></path>
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              ></path>
                            </svg>
                            Manage
                          </button>
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              openEditModal(space);
                            }}
                            class="inline-flex items-center text-[12px] font-medium text-blue-500 hover:text-blue-600"
                          >
                            <svg
                              class="w-3.5 h-3.5 mr-1"
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
                            Edit
                          </button>
                          {#if space.shortname !== "management"}
                            <button
                              onclick={(e) => {
                                e.stopPropagation();
                                openDeleteModal(space);
                              }}
                              class="inline-flex items-center text-[12px] font-medium text-rose-500 hover:text-rose-600"
                            >
                              <svg
                                class="w-3.5 h-3.5 mr-1"
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
                              Delete
                            </button>
                          {/if}
                        </div>
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
<Modal
  title={$_("admin_dashboard.modal.create.title")}
  bind:open={showCreateModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <p class="text-sm text-gray-600 mb-4">
    {$_("admin_dashboard.modal.create.description")}
  </p>
  <MetaForm
    bind:formData={metaContent}
    bind:validateFn={validateMetaForm}
    isCreate={true}
  />

  {#if createError}
    <div class="error-message mt-4">
      <p class="error-text">{createError}</p>
    </div>
  {/if}

  {#snippet footer()}
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
  {/snippet}
</Modal>

<!-- Edit Space Modal -->
<Modal
  title="✏️ {$_('admin_dashboard.modal.edit.title')}"
  bind:open={showEditModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <p class="text-sm text-gray-600 mb-4">
    {$_("admin_dashboard.modal.edit.description")}
  </p>
  <MetaForm
    bind:formData={editMetaContent}
    bind:validateFn={validateEditMetaForm}
    isCreate={false}
  />

  <div class="form-group mt-4">
    <div class="form-checkbox">
      <label for="editIsActive"></label>
      <input type="checkbox" bind:checked={editIsActive} id="editIsActive" />
      <label for="editIsActive">
        {$_("admin_dashboard.modal.edit.space_active")}
      </label>
    </div>
  </div>

  {#if editError}
    <div class="error-message mt-4">
      <p class="error-text">{editError}</p>
    </div>
  {/if}

  {#snippet footer()}
    <button
      onclick={closeEditModal}
      class="btn btn-secondary"
      disabled={isEditing}
    >
      {$_("admin_dashboard.modal.cancel")}
    </button>
    <button
      onclick={handleEditSpace}
      disabled={isEditing || !editMetaContent.shortname}
      class="btn btn-edit"
    >
      {#if isEditing}
        <div class="spinner"></div>
        {$_("admin_dashboard.modal.updating")}
      {:else}
        {$_("admin_dashboard.modal.edit.button")}
      {/if}
    </button>
  {/snippet}
</Modal>

<!-- Delete Space Modal -->
<Modal
  title="⚠️ {$_('admin_dashboard.modal.delete.title')}"
  bind:open={showDeleteModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
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
      {deletingSpace ? getDisplayName(deletingSpace) : ""}
    </p>
    <p>
      <strong>{$_("admin_dashboard.modal.delete.shortname_label")}:</strong>
      {deletingSpace ? deletingSpace.shortname : ""}
    </p>
  </div>

  <div class="delete-final-warning">
    {$_("admin_dashboard.modal.delete.warning")}
  </div>

  {#snippet footer()}
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
  {/snippet}
</Modal>

<style>
  .rtl {
    direction: rtl;
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
</style>
