<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  $goto;

  let isLoading = $state(true);
  let contents = $state([]);
  let error = $state(null);
  let spaceName = $state("");

  onMount(async () => {
    spaceName = $params.space_name;

    try {
      const response = await getSpaceContents(spaceName, "/");

      console.log(`Contents for space ${spaceName}:`, response);

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
  });

  function handleItemClick(item: any) {
    if (item.resource_type === "folder" || item.subpath !== "/") {
      const subpath =
        item.subpath === "/"
          ? item.shortname
          : `${item.subpath}/${item.shortname}`;
      $goto(`/catalogs/{space_name}/{subpath}`, {
        space_name: spaceName,
        subpath: subpath,
      });
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
    $goto("/catalogs");
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
              class="w-12 h-12 mr-2"
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
          </button>
          <div class="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 capitalize">
              {spaceName} Space
            </h1>
            <p class="text-gray-600">
              Browse contents and navigate through folders
            </p>
          </div>
        </div>
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
          This space appears to be empty or you don't have access to view its
          contents.
        </p>
      </div>
    {:else}
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each contents as item}
          <div
            class="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer transition-all duration-200 p-4"
            onclick={() => handleItemClick(item)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleItemClick(item);
              }
            }}
          >
            <div class="flex items-start space-x-3">
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
            </div>
          </div>
        {/each}
      </div>

      <div
        class="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Space Summary</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center">
            <p class="text-2xl font-bold text-blue-600">{contents.length}</p>
            <p class="text-sm text-gray-500">Total Items</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-green-600">
              {contents.filter((item) => item.resource_type === "folder")
                .length}
            </p>
            <p class="text-sm text-gray-500">Folders</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-purple-600">
              {contents.filter((item) => item.resource_type === "content")
                .length}
            </p>
            <p class="text-sm text-gray-500">Content</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-orange-600">
              {contents.filter(
                (item) => !["folder", "content"].includes(item.resource_type)
              ).length}
            </p>
            <p class="text-sm text-gray-500">Other</p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Focus styles for accessibility */
  [role="button"]:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
</style>
