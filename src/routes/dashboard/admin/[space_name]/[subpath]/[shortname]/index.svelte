<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import {
    getCatalogItem,
    deleteEntity,
    updateEntity,
    getMyEntities,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { Dmart, ResourceType, RequestType } from "@edraj/tsdmart";
  import { writable } from "svelte/store";
  $goto;
  const isLoading = writable(false);
  const itemData = writable(null);
  const error = writable(null);
  const spaceName = writable("");
  const subpath = writable("");
  const itemShortname = writable("");
  const actualSubpath = writable("");
  const breadcrumbs = writable([]);
  const showEditModal = writable(false);
  const activeTab = writable("overview");
  let spaceNameValue = $state("");
  let subpathValue = "";
  let itemShortnameValue = $state("");
  let actualSubpathValue = $state("");
  let breadcrumbsValue = [];
  const authorRelatedEntries = writable([]);
  let authorRelatedEntriesValue = $state([]);
  let itemDataValue = $state(null);
  const editForm = writable({
    title: "",
    content: "",
    tags: [],
    tagsString: "",
    is_active: true,
  });

  let editFormValue = $state({
    title: "",
    content: "",
    tags: [],
    tagsString: "",
    is_active: true,
  });
  onMount(async () => {
    await initializeContent();
  });

  function subscribeStore(store, callback) {
    return store.subscribe(callback);
  }

  async function initializeContent() {
    subscribeStore(params, async (value) => {
      spaceNameValue = value.space_name;
      subpathValue = value.subpath;
      itemShortnameValue = value.shortname;

      spaceName.set(spaceNameValue);
      subpath.set(subpathValue);
      itemShortname.set(itemShortnameValue);

      actualSubpathValue = subpathValue.replace(/-/g, "/");
      actualSubpath.set(actualSubpathValue);

      const pathParts = actualSubpathValue
        .split("/")
        .filter((part) => part.length > 0);
      breadcrumbsValue = [
        { name: "Admin", path: "/dashboard/admin" },
        { name: spaceNameValue, path: `/dashboard/admin/${spaceNameValue}` },
      ];

      let currentUrlPath = "";
      pathParts.forEach((part, index) => {
        currentUrlPath += (index === 0 ? "" : "-") + part;
        breadcrumbsValue.push({
          name: part,
          path: `/dashboard/admin/${spaceNameValue}/${currentUrlPath}`,
        });
      });

      breadcrumbsValue.push({
        name: itemShortnameValue,
        path: null,
      });

      breadcrumbs.set(breadcrumbsValue);

      if (actualSubpathValue === "authors") {
        await loadAuthorRelatedEntries();
      }
    });

    await loadItemData();
  }

  async function loadAuthorRelatedEntries() {
    try {
      const entries = await getMyEntities(itemShortnameValue);
      authorRelatedEntriesValue = entries;
      authorRelatedEntries.set(entries);
    } catch (err) {
      console.error("Error fetching author related entries:", err);
    }
  }

  async function loadItemData() {
    isLoading.set(true);
    error.set(null);
    itemData.set(null);

    try {
      const response = await getCatalogItem(
        spaceNameValue,
        actualSubpathValue,
        itemShortnameValue,
        ResourceType.content,
        "managed"
      );

      if (response && response.uuid) {
        itemDataValue = response;
        itemData.set(response);

        const title =
          response.payload?.body?.title ||
          response.displayname ||
          response.shortname ||
          "";
        const content =
          response.payload?.body?.content || response.description || "";
        const tags = response.tags || [];
        const tagsString = tags.join(", ");

        editFormValue = {
          title: typeof title === "string" ? title : getDisplayName(response),
          content:
            typeof content === "string" ? content : getDescription(response),
          tags: tags,
          tagsString: tagsString,
          is_active: response.is_active,
        };
        editForm.set(editFormValue);
      } else {
        console.error("Invalid response structure:", response);
        error.set("Invalid response structure");
      }
    } catch (err) {
      console.error("Error fetching admin item data:", err);
      error.set(err.message || "Failed to load item data");
    } finally {
      isLoading.set(false);
    }
  }

  async function handleUpdateItem(event) {
    event?.preventDefault();
    try {
      const tagsArray = editFormValue.tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const entityData = {
        title: editFormValue.title,
        tags: tagsArray,
        content: editFormValue.content,
        is_active: editFormValue.is_active,
      };

      const response = await updateEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        entityData
      );

      if (response) {
        showEditModal.set(false);
        await loadItemData();
      } else {
        console.error("Update failed: No response received");
        error.set("Failed to update item");
      }
    } catch (err) {
      console.error("Error updating item:", err);
      error.set(err.message || "Failed to update item");
    }
  }

  async function handleDeleteItem() {
    if (!confirm(`Are you sure you want to delete "${itemShortnameValue}"?`)) {
      return;
    }

    try {
      const success = await deleteEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue
      );

      if (success) {
        $goto("/dashboard/admin/[space_name]/[subpath]", {
          space_name: spaceNameValue,
          subpath: actualSubpathValue,
        });
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }

  function getDisplayName(item) {
    if (item?.displayname) {
      return (
        item.displayname[$locale] ||
        item.displayname.en ||
        item.displayname.ar ||
        item.shortname
      );
    }
    return item?.shortname || "Unnamed Item";
  }

  function getDescription(item) {
    if (item?.description) {
      return (
        item.description[$locale] ||
        item.description.en ||
        item.description.ar ||
        "No description available"
      );
    }
    return "No description available";
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function navigateToBreadcrumb(path) {
    if (path) {
      $goto(path);
    }
  }

  function goBack() {
    $goto("/dashboard/admin/[space_name]/[subpath]", {
      space_name: spaceNameValue,
      subpath: subpathValue,
    });
  }

  function setActiveTab(tab) {
    activeTab.set(tab);
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-6 py-4 max-w-7xl">
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
        <div class="flex items-center space-x-4">
          <button
            onclick={goBack}
            class="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
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
            Back
          </button>
          <div class="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {itemDataValue
                ? getDisplayName(itemDataValue)
                : itemShortnameValue}
            </h1>
            <p class="text-gray-600">Admin Management Panel</p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            onclick={() => showEditModal.set(true)}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Edit Item
          </button>
          <button
            onclick={handleDeleteItem}
            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Delete Item
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-6 py-6 max-w-7xl">
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
          Error Loading Item
        </h3>
        <p class="text-gray-600">{$error}</p>
      </div>
    {:else if $itemData}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8 px-6">
            <button
              onclick={() => setActiveTab("overview")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Overview
            </button>
            <button
              onclick={() => setActiveTab("content")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Content
            </button>
            <button
              onclick={() => setActiveTab("relationships")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'relationships'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Relationships
            </button>
            <button
              onclick={() => setActiveTab("attachments")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'attachments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Attachments
            </button>
            {#if actualSubpathValue === "authors"}
              <button
                onclick={() => setActiveTab("author-entries")}
                class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
                'author-entries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              >
                Author Related Entries
              </button>
            {/if}
            <button
              onclick={() => setActiveTab("metadata")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'metadata'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Metadata
            </button>
          </nav>
        </div>

        <div class="p-6">
          {#if $activeTab === "overview"}
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                  Basic Information
                </h3>
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table class="min-w-full divide-y divide-gray-200">
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-1/4"
                          >UUID</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                          >{itemDataValue.uuid}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Shortname</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >{itemDataValue.shortname}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Display Name</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {#if itemDataValue.displayname}
                            <div class="space-y-1">
                              {#each Object.entries(itemDataValue.displayname) as [lang, name]}
                                <div class="flex items-center space-x-2">
                                  <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                    >{lang}</span
                                  >
                                  <span>{name}</span>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <span class="text-gray-400">Not set</span>
                          {/if}
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Description</td
                        >
                        <td class="px-6 py-4 text-sm text-gray-500">
                          {#if itemDataValue.description}
                            <div class="space-y-1">
                              {#each Object.entries(itemDataValue.description) as [lang, desc]}
                                <div class="flex items-start space-x-2">
                                  <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-0.5"
                                    >{lang}</span
                                  >
                                  <span class="flex-1">{desc || "Empty"}</span>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <span class="text-gray-400">Not set</span>
                          {/if}
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Status</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {itemDataValue.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'}"
                          >
                            <div
                              class="w-1.5 h-1.5 rounded-full mr-1.5 {itemDataValue.is_active
                                ? 'bg-green-400'
                                : 'bg-red-400'}"
                            ></div>
                            {itemDataValue.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Tags</td
                        >
                        <td class="px-6 py-4 text-sm text-gray-500">
                          {#if itemDataValue.tags && itemDataValue.tags.length > 0}
                            <div class="flex flex-wrap gap-1">
                              {#each itemDataValue.tags as tag}
                                {#if tag.trim()}
                                  <span
                                    class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                                    >{tag}</span
                                  >
                                {/if}
                              {/each}
                            </div>
                          {:else}
                            <span class="text-gray-400">No tags</span>
                          {/if}
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Owner</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >{itemDataValue.owner_shortname}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Created</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >{formatDate(itemDataValue.created_at)}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >Updated</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >{formatDate(itemDataValue.updated_at)}</td
                        >
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          {/if}

          {#if $activeTab === "content"}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-gray-900">
                Content & Payload
              </h3>

              {#if itemDataValue.payload}
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table class="min-w-full divide-y divide-gray-200">
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-1/4"
                          >Content Type</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {itemDataValue.payload.content_type}
                          </span>
                        </td>
                      </tr>
                      {#if itemDataValue.payload.checksum}
                        <tr>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                            >Checksum</td
                          >
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                            >{itemDataValue.payload.checksum}</td
                          >
                        </tr>
                      {/if}
                      <tr>
                        <td
                          class="px-6 py-4 text-sm font-medium text-gray-900 bg-gray-50 align-top"
                          >Content Body</td
                        >
                        <td class="px-6 py-4 text-sm text-gray-500">
                          {#if itemDataValue.payload.content_type === "html"}
                            <div class="prose max-w-none">
                              {@html itemDataValue.payload.body}
                            </div>
                          {:else if itemDataValue.payload.content_type === "json"}
                            <pre
                              class="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto">{JSON.stringify(
                                itemDataValue.payload.body,
                                null,
                                2
                              )}</pre>
                          {:else}
                            <div class="bg-gray-50 p-4 rounded-lg">
                              <pre
                                class="text-xs whitespace-pre-wrap">{itemDataValue
                                  .payload.body}</pre>
                            </div>
                          {/if}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              {:else}
                <div class="text-center py-8 text-gray-500">
                  <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p class="mt-2">No content available</p>
                </div>
              {/if}
            </div>
          {/if}

          {#if $activeTab === "relationships"}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-gray-900">Relationships</h3>

              {#if itemDataValue.relationships && itemDataValue.relationships.length > 0}
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >Role</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >Related To</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >Type</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >Space</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >UUID</th
                        >
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      {#each itemDataValue.relationships as relationship}
                        <tr>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                          >
                            <span
                              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {relationship.attributes?.role || "N/A"}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {relationship.related_to?.shortname || "N/A"}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            <span
                              class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {relationship.related_to?.resource_type ||
                                relationship.related_to?.type ||
                                "N/A"}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {relationship.related_to?.space_name || "N/A"}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                          >
                            {relationship.related_to?.uuid || "N/A"}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <div class="text-center py-8 text-gray-500">
                  <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <p class="mt-2">No relationships defined</p>
                </div>
              {/if}
            </div>
          {/if}

          {#if $activeTab === "attachments"}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-gray-900">Attachments</h3>

              {#if itemDataValue.attachments && typeof itemDataValue.attachments === "object"}
                {#each Object.entries(itemDataValue.attachments) as [type, attachmentsArr]}
                  {#if attachmentsArr && (attachmentsArr as any[]).length > 0}
                    <div>
                      <h4
                        class="text-md font-medium text-gray-800 mb-3 capitalize"
                      >
                        {type} Attachments
                      </h4>
                      <div
                        class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <table class="min-w-full divide-y divide-gray-200">
                          <thead class="bg-gray-50">
                            <tr>
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Name</th
                              >
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Display Name</th
                              >
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Size</th
                              >
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Type</th
                              >
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Created</th
                              >
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Status</th
                              >
                            </tr>
                          </thead>
                          <tbody class="bg-white divide-y divide-gray-200">
                            {#each attachmentsArr as any[] as attachmentTyped}
                              {#if typeof attachmentTyped === "object" && attachmentTyped}
                                {@const attachment = attachmentTyped as {
                                  attributes?: {
                                    payload?: {
                                      body?: string;
                                      bytesize?: number;
                                      content_type?: string;
                                    };
                                    displayname?: Record<string, string>;
                                    created_at?: string;
                                    is_active?: boolean;
                                  };
                                  shortname?: string;
                                }}
                                <tr>
                                  <td
                                    class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                                  >
                                    {attachment.attributes?.payload?.body ||
                                      attachment.shortname}
                                  </td>
                                  <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                  >
                                    {#if attachment.attributes?.displayname}
                                      {Object.values(
                                        attachment.attributes.displayname
                                      )[0]}
                                    {:else}
                                      <span class="text-gray-400">N/A</span>
                                    {/if}
                                  </td>
                                  <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                  >
                                    {attachment.attributes?.payload?.bytesize
                                      ? formatBytes(
                                          attachment.attributes.payload.bytesize
                                        )
                                      : "N/A"}
                                  </td>
                                  <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                  >
                                    <span
                                      class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800"
                                    >
                                      {attachment.attributes?.payload
                                        ?.content_type || "unknown"}
                                    </span>
                                  </td>
                                  <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                  >
                                    {formatDate(
                                      attachment.attributes?.created_at
                                    )}
                                  </td>
                                  <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                  >
                                    <span
                                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {attachment
                                        .attributes?.is_active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'}"
                                    >
                                      {attachment.attributes?.is_active
                                        ? "Active"
                                        : "Inactive"}
                                    </span>
                                  </td>
                                </tr>
                              {/if}
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  {/if}
                {/each}
              {:else}
                <div class="text-center py-8 text-gray-500">
                  <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  <p class="mt-2">No attachments found</p>
                </div>
              {/if}
            </div>
          {/if}

          {#if $activeTab === "metadata"}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-gray-900">
                System Metadata
              </h3>

              <div
                class="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <table class="min-w-full divide-y divide-gray-200">
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-1/4"
                        >Full Path</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                      >
                        {spaceNameValue}/{actualSubpathValue}/{itemShortnameValue}
                      </td>
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        >Space Name</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >{spaceNameValue}</td
                      >
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        >Subpath</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >{actualSubpathValue}</td
                      >
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        >Resource Type</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {itemDataValue.resource_type || "content"}
                        </span>
                      </td>
                    </tr>
                    {#if itemDataValue.acl}
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          >ACL Entries</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {itemDataValue.acl.length} entries
                        </td>
                      </tr>
                    {/if}
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        >Relationships Count</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        {itemDataValue.relationships
                          ? itemDataValue.relationships.length
                          : 0}
                      </td>
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        >Attachments Count</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        {#if itemDataValue.attachments}
                          {Object.values(itemDataValue.attachments).reduce(
                            (total: number, attachments) =>
                              total + ((attachments as any[])?.length || 0),
                            0
                          )}
                        {:else}
                          0
                        {/if}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h4 class="text-md font-medium text-gray-800 mb-3">
                  Raw JSON Data
                </h4>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre
                    class="text-xs text-gray-700 overflow-x-auto">{JSON.stringify(
                      itemDataValue,
                      null,
                      2
                    )}</pre>
                </div>
              </div>
            </div>
          {/if}
          {#if $activeTab === "author-entries"}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-gray-900">
                Author Related Entries
              </h3>

              {#if authorRelatedEntriesValue && authorRelatedEntriesValue.length > 0}
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Shortname
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Display Name
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Space
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
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      {#each authorRelatedEntriesValue as entry}
                        <tr>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                          >
                            {entry.shortname}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {getDisplayName(entry)}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {entry.space_name || "N/A"}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            <span
                              class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {entry.resource_type || "content"}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            <span
                              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {entry.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'}"
                            >
                              <div
                                class="w-1.5 h-1.5 rounded-full mr-1.5 {entry.is_active
                                  ? 'bg-green-400'
                                  : 'bg-red-400'}"
                              ></div>
                              {entry.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {formatDate(entry.created_at)}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <div class="text-center py-8 text-gray-500">
                  <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p class="mt-2">No author related entries found</p>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {:else}
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Item Not Found</h3>
        <p class="text-gray-600">
          The requested item could not be found or you don't have access to it.
        </p>
      </div>
    {/if}
  </div>
</div>

{#if $showEditModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_consider_explicit_label -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onclick={() => showEditModal.set(false)}
  >
    <div
      class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      onclick={(event) => event.stopPropagation()}
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-semibold text-gray-900">Edit Item</h3>
        <button
          onclick={() => showEditModal.set(false)}
          class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
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
            />
          </svg>
        </button>
      </div>
      <form class="space-y-5" onsubmit={handleUpdateItem}>
        <div>
          <label
            for="editTitle"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Title
          </label>
          <input
            id="editTitle"
            type="text"
            bind:value={editFormValue.title}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter title"
            required
          />
        </div>

        <div>
          <label
            for="editContent"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Content
          </label>
          <textarea
            id="editContent"
            bind:value={editFormValue.content}
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            placeholder="Enter content"
          ></textarea>
        </div>

        <div>
          <label
            for="editTags"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Tags (comma-separated)
          </label>
          <input
            id="editTags"
            type="text"
            bind:value={editFormValue.tagsString}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="tag1, tag2, tag3"
          />
        </div>

        <div class="flex items-center">
          <input
            id="editIsActive"
            type="checkbox"
            bind:checked={editFormValue.is_active}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="editIsActive" class="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>

        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onclick={() => showEditModal.set(false)}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
