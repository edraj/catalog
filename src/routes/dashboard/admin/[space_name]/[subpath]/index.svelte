<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  import { Dmart, ResourceType, RequestType } from "@edraj/tsdmart";
  import { writable } from "svelte/store";
  $goto;
  let isLoading = writable(false);
  let allContents = writable([]);
  let paginatedContents = writable([]);
  let error = writable(null);

  let actualSubpath = "";
  let breadcrumbs = writable([]);
  let showCreateModal = writable(false);
  let newItemName = writable("");
  let newItemType = writable("content");

  let currentPage = writable(1);
  let itemsPerPage = writable(25);
  let totalPages = writable(1);
  let totalItems = writable(0);

  let spaceName = "";
  let subpath = "";

  const itemsPerPageOptions = [10, 25, 50, 100];

  async function initializeContent() {
    spaceName = $params.space_name;
    subpath = $params.subpath;

    actualSubpath = subpath.replace(/-/g, "/");

    const pathParts = actualSubpath
      .split("/")
      .filter((part) => part.length > 0);
    breadcrumbs.set([
      { name: "Admin", path: "/dashboard/admin" },
      { name: spaceName, path: `/dashboard/admin/${spaceName}` },
    ]);

    let currentPath = "";
    let currentUrlPath = "";
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      currentUrlPath += (index === 0 ? "" : "-") + part;
      breadcrumbs.update((prev) => [
        ...prev,
        {
          name: part,
          path:
            index === pathParts.length - 1
              ? null
              : `/dashboard/admin/${spaceName}/${currentUrlPath}`,
        },
      ]);
    });

    currentPage.set(1);
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
    isLoading.set(true);
    error.set(null);

    try {
      const response = await getSpaceContents(
        spaceName,
        `/${actualSubpath}`,
        "managed"
      );

      if (response && response.records) {
        allContents.set(response.records);
        totalItems.set(response.records.length);
        updatePagination();
      } else {
        allContents.set([]);
        totalItems.set(0);
        updatePagination();
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error.set("Failed to load space contents");
      allContents.set([]);
      totalItems.set(0);
      updatePagination();
    } finally {
      isLoading.set(false);
    }
  }

  function updatePagination() {
    totalPages.set(Math.ceil($totalItems / $itemsPerPage));
    if ($currentPage > $totalPages) {
      currentPage.set(Math.max(1, $totalPages));
    }

    const startIndex = ($currentPage - 1) * $itemsPerPage;
    const endIndex = startIndex + $itemsPerPage;
    paginatedContents.set($allContents.slice(startIndex, endIndex));
  }

  function handleItemsPerPageChange(newItemsPerPage) {
    itemsPerPage.set(newItemsPerPage);
    currentPage.set(1);
    updatePagination();
  }

  function goToPage(page) {
    if (page >= 1 && page <= $totalPages) {
      currentPage.set(page);
      updatePagination();
    }
  }

  function handleItemClick(item) {
    if (item.resource_type === "folder") {
      const newSubpath = `${subpath}-${item.shortname}`;
      $goto("/dashboard/admin/[space_name]/[subpath]", {
        space_name: spaceName,
        subpath: newSubpath,
      });
    } else {
      $goto("/dashboard/admin/[space_name]/[subpath]/[shortname]", {
        space_name: spaceName,
        subpath: subpath,
        shortname: item.shortname,
      });
    }
  }

  async function handleCreateItem() {
    if (!$newItemName.trim()) return;

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: $newItemType as ResourceType,
            shortname: $newItemName,
            subpath: `/${actualSubpath}`,
            attributes: {
              is_active: true,
              displayname: {
                en: $newItemName,
                ar: $newItemName,
              },
              description: {
                en: `Created via admin panel`,
                ar: `تم إنشاؤه عبر لوحة الإدارة`,
              },
            },
          },
        ],
      });

      if (response.status === "success") {
        showCreateModal.set(false);
        newItemName.set("");
        await loadContents();
      }
    } catch (err) {
      console.error("Error creating item:", err);
    }
  }

  async function handleDeleteItem(item, event) {
    event.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${item.shortname}"?`)) {
      return;
    }

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.delete,
        records: [
          {
            resource_type: item.resource_type,
            shortname: item.shortname,
            subpath: item.subpath || `/${actualSubpath}`,
            attributes: {},
          },
        ],
      });

      if (response.status === "success") {
        await loadContents();
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

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function navigateToBreadcrumb(path) {
    if (path) {
      $goto(path);
    }
  }

  function getPageNumbers() {
    const pages = [];
    const maxVisiblePages = 7;

    if ($totalPages <= maxVisiblePages) {
      for (let i = 1; i <= $totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if ($currentPage > 4) {
        pages.push("...");
      }

      const start = Math.max(2, $currentPage - 2);
      const end = Math.min($totalPages - 1, $currentPage + 2);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if ($currentPage < $totalPages - 3) {
        pages.push("...");
      }

      if ($totalPages > 1) {
        pages.push($totalPages);
      }
    }

    return pages;
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <nav class="flex mb-4" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          {#each $breadcrumbs as crumb, index}
            <li class="inline-flex items-center">
              {#if index > 0}
                <svg
                  class="w-4 h-4 text-gray-400 mx-1"
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
                  class="text-gray-500 hover:text-gray-700 transition-colors duration-200 text-sm"
                >
                  {crumb.name}
                </button>
              {:else}
                <span class="text-gray-900 font-medium text-sm"
                  >{crumb.name}</span
                >
              {/if}
            </li>
          {/each}
        </ol>
      </nav>

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            Admin: {$breadcrumbs[$breadcrumbs.length - 1]?.name ||
              actualSubpath.split("/").pop()}
          </h1>
          <p class="text-gray-600">
            Managing contents in {spaceName}/{actualSubpath}
          </p>
        </div>

        <div class="flex items-center space-x-3">
          {#if !$isLoading && $totalItems > 0}
            <div class="flex items-center space-x-2">
              <span class="text-sm text-gray-700">Show:</span>
              <select
                bind:value={$itemsPerPage}
                onchange={(e) =>
                  handleItemsPerPageChange(
                    parseInt((e.target as HTMLSelectElement).value)
                  )}
                class="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {#each itemsPerPageOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
              <span class="text-sm text-gray-700">per page</span>
            </div>
          {/if}

          <button
            onclick={() => showCreateModal.set(true)}
            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Create New Item
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if $isLoading}
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
          Error Loading Contents
        </h3>
        <p class="text-gray-600">{$error}</p>
      </div>
    {:else if $totalItems === 0}
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
          This folder appears to be empty. Create some content to get started.
        </p>
      </div>
    {:else}
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">
              Admin Contents ({$totalItems} items)
            </h2>
            <div class="text-sm text-gray-500">
              Showing {($currentPage - 1) * $itemsPerPage + 1} to {Math.min(
                $currentPage * $itemsPerPage,
                $totalItems
              )} of {$totalItems} items
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Type
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Owner
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each $paginatedContents as item, index}
                <tr
                  class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                  onclick={() => handleItemClick(item)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleItemClick(item);
                    }
                  }}
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-10 w-10">
                        <div
                          class="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center"
                        >
                          <span class="text-white text-lg">
                            {getItemIcon(item)}
                          </span>
                        </div>
                      </div>
                      <div class="ml-6">
                        <div class="text-sm font-medium text-gray-900">
                          {getDisplayName(item)}
                        </div>
                        <div class="text-xs text-purple-600 font-medium">
                          {item.shortname}
                        </div>
                        {#if item.attributes?.description?.ar || item.attributes?.description?.en}
                          <div class="text-sm text-gray-500 max-w-xs truncate">
                            {item.attributes.description.ar ||
                              item.attributes.description.en ||
                              ""}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getResourceTypeColor(
                        item.resource_type
                      )}"
                    >
                      {item.resource_type}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {item
                        .attributes?.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'}"
                    >
                      <div
                        class="w-1.5 h-1.5 rounded-full mr-1.5 {item.attributes
                          ?.is_active
                          ? 'bg-green-400'
                          : 'bg-red-400'}"
                      ></div>
                      {item.attributes?.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div class="flex items-center">
                      <div
                        class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center mr-2"
                      >
                        <span class="text-xs font-medium text-gray-600">
                          {item.attributes?.owner_shortname
                            ? item.attributes.owner_shortname
                                .charAt(0)
                                .toUpperCase()
                            : "U"}
                        </span>
                      </div>
                      <span class="text-sm text-gray-900">
                        {item.attributes?.owner_shortname || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.attributes?.created_at)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex items-center space-x-2">
                      {#if item.resource_type === "folder"}
                        <button
                          onclick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                          class="text-blue-600 hover:text-blue-900 transition-colors duration-200 mx-4"
                        >
                          Open
                        </button>
                      {:else}
                        <button
                          onclick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                          class="text-green-600 hover:text-green-900 transition-colors duration-200"
                        >
                          View
                        </button>
                      {/if}
                      <button
                        onclick={(e) => handleDeleteItem(item, e)}
                        class="text-red-600 hover:text-red-900 transition-colors duration-200 mx-4"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if $totalPages > 1}
          <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div class="flex items-center justify-between">
              <div class="text-sm text-gray-700">
                Page {$currentPage} of {$totalPages}
              </div>

              <nav class="flex items-center space-x-1">
                <button
                  onclick={() => goToPage($currentPage - 1)}
                  disabled={$currentPage === 1}
                  class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Previous
                </button>

                {#each getPageNumbers() as page}
                  {#if typeof page === "number"}
                    <button
                      onclick={() => goToPage(page)}
                      class="px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 {page ===
                      $currentPage
                        ? 'bg-blue-600 text-white border border-blue-600'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}"
                    >
                      {page}
                    </button>
                  {:else}
                    <span class="px-3 py-2 text-sm font-medium text-gray-500">
                      {page}
                    </span>
                  {/if}
                {/each}

                <button
                  onclick={() => goToPage($currentPage + 1)}
                  disabled={$currentPage === $totalPages}
                  class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if $showCreateModal}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-semibold mb-4">Create New Item</h3>

      <div class="space-y-4">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 mb-1"
            for="itemName"
          >
            Item Name
          </label>
          <input
            id="itemName"
            type="text"
            bind:value={$newItemName}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter item name"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-gray-700 mb-1"
            for="itemType"
          >
            Item Type
          </label>
          <select
            id="itemType"
            bind:value={$newItemType}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="content">Content</option>
            <option value="folder">Folder</option>
            <option value="ticket">Ticket</option>
            <option value="media">Media</option>
          </select>
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        <button
          onclick={() => showCreateModal.set(false)}
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          onclick={handleCreateItem}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
        >
          Create
        </button>
      </div>
    </div>
  </div>
{/if}
