<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  import { Dmart, ResourceType, RequestType } from "@edraj/tsdmart";
  import { createEntity, deleteEntity } from "@/lib/dmart_services";
  import FolderForm from "@/routes/components/forms/FolderForm.svelte";
  $goto;

  let isLoading = $state(true);
  let contents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let showCreateFolderModal = $state(false);
  let actualSubpath = $state("");
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
  let isCreatingFolder = $state(false);

  onMount(async () => {
    spaceName = $params.space_name;
    actualSubpath = $params.subpath || "/";
    await loadContents();
  });

  async function loadContents() {
    isLoading = true;
    try {
      const response = await getSpaceContents(spaceName, "/", "managed");
      if (response && response.records) {
        contents = response.records;
      } else {
        contents = [];
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = "Failed to load space contents";
    } finally {
      isLoading = false;
    }
  }

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
    const folderData = event.detail;

    if (!folderData.title) {
      alert("Please enter a folder title");
      return;
    }

    isCreatingFolder = true;

    try {
      const entityData = {
        title: folderData.title,
        content: JSON.stringify(folderData),
        is_active: folderData.is_active,
        tags: folderData.tags || [],
      };

      const response = await createFolderEntity(
        entityData,
        spaceName,
        actualSubpath
      );

      if (response) {
        showCreateFolderModal = false;
        await loadContents();
      } else {
        alert("Failed to create folder");
      }
    } catch (err) {
      console.error("Error creating folder:", err);
      alert("Error creating folder: " + err.message);
    } finally {
      isCreatingFolder = false;
    }
  }

  async function createFolderEntity(data, spaceName, subpath) {
    let actionRequest;

    if (spaceName === "catalog") {
      actionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: ResourceType.ticket,
            shortname: "auto",
            subpath: subpath,
            attributes: {
              is_active: data.is_active,
              workflow_shortname: "catalog_idea_workflow",
              relationships: [],
              tags: data.tags,
              payload: {
                content_type: "folder",
                schema_shortname: "catelog_post",
                body: {
                  title: data.title,
                  content: data.content,
                },
              },
            },
          },
        ],
      };
    } else {
      actionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: ResourceType.content,
            shortname: "auto",
            subpath: subpath,
            attributes: {
              is_active: data.is_active,
              relationships: [],
              tags: data.tags,
              payload: {
                content_type: "folder",
                body: {
                  title: data.title,
                  content: data.content,
                },
              },
            },
          },
        ],
      };
    }

    const response = await Dmart.request(actionRequest);
    if (response.status == "success" && response.records.length > 0) {
      return response.records[0].shortname;
    }
    return null;
  }

  async function handleDeleteItem(item: any, event: Event) {
    event.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${item.shortname}"?`)) {
      return;
    }

    try {
      const success = await deleteEntity(
        item.shortname,
        spaceName,
        actualSubpath
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

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function goBack() {
    $goto("/dashboard/admin");
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <button
            onclick={goBack}
            class="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
            aria-label="Go back"
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
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
            Back to Admin
          </button>
          <div class="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 capitalize">
              Admin: {spaceName} Space
            </h1>
            <p class="text-gray-600">
              Full administrative access to manage all content
            </p>
          </div>
        </div>

        <button
          onclick={handleCreateFolder}
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
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

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="flex justify-center py-16">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else if error}
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
          Error Loading Contents
        </h3>
        <p class="text-gray-600">{error}</p>
      </div>
    {:else if contents.length === 0}
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
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          No Contents Found
        </h3>
        <p class="text-gray-600">
          This space appears to be empty. Create some folders to get started.
        </p>
      </div>
    {:else}
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each contents as item}
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
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-start space-x-3 flex-1 min-w-0">
                <div class="text-2xl">
                  {getItemIcon(item)}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-semibold text-gray-900 truncate">
                    {item.shortname}
                  </h3>
                  <p class="text-xs text-gray-500 mt-1">
                    {item.resource_type}
                  </p>
                </div>
              </div>

              <button
                onclick={(e) => handleDeleteItem(item, e)}
                class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all duration-200 p-1"
                aria-label="Delete item"
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

            {#if item.attributes?.created_at}
              <p class="text-xs text-gray-400 mt-1">
                {formatDate(item.attributes.created_at)}
              </p>
            {/if}
            {#if item.subpath && item.subpath !== "/"}
              <p class="text-xs text-blue-600 mt-1 truncate">
                {item.subpath}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showCreateFolderModal}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
  >
    <div
      class="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <div
        class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between"
      >
        <h3 class="text-lg font-semibold text-gray-900">Create New Folder</h3>
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          aria-label="Close modal"
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

      <div class="p-6">
        <div class="mb-4">
          <label
            for="folderTitle"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Folder Title *
          </label>
          <input
            id="folderTitle"
            type="text"
            bind:value={folderContent.title}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter folder title"
            required
          />
        </div>

        <FolderForm bind:content={folderContent} on:save={handleSaveFolder} />
      </div>

      <div
        class="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3"
      >
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
          disabled={isCreatingFolder}
        >
          Cancel
        </button>
        <button
          onclick={() => handleSaveFolder({ detail: folderContent })}
          class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
          disabled={isCreatingFolder}
        >
          {#if isCreatingFolder}
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Creating...
          {:else}
            Create Folder
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
