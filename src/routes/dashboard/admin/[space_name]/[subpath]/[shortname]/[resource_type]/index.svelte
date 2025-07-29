<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import {
    deleteEntity,
    updateEntity,
    getMyEntities,
    getEntity,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { ResourceType } from "@edraj/tsdmart";
  import { writable } from "svelte/store";
  import Attachment from "@/components/Attachments.svelte";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

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
        {
          name: $_("admin_item_detail.breadcrumb.admin"),
          path: "/dashboard/admin",
        },
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
      const response = await getEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        $params.resource_type,
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
        const tagsString = Array.from(tags).join(", ");

        editFormValue = {
          title: typeof title === "string" ? title : getDisplayName(response),
          content:
            typeof content === "string" ? content : getDescription(response),
          tags: Array.isArray(tags) ? tags : Array.from(tags),
          tagsString: tagsString,
          is_active: response.is_active,
        };
        editForm.set(editFormValue);
      } else {
        console.error("No valid response found for item:", itemShortnameValue);
        error.set($_("admin_item_detail.error.item_not_found"));
      }
    } catch (err) {
      console.error("Error fetching admin item data:", err);
      error.set(err.message || $_("admin_item_detail.error.failed_load_item"));
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
        $params.resource_type,
        entityData,
        $params.workflow_shortname,
        $params.schema_shortname
      );

      if (response) {
        showEditModal.set(false);
        await loadItemData();
      } else {
        console.error("Update failed: No response received");
        error.set($_("admin_item_detail.error.failed_update_item"));
      }
    } catch (err) {
      console.error("Error updating item:", err);
      error.set(
        err.message || $_("admin_item_detail.error.failed_update_item")
      );
    }
  }

  async function handleDeleteItem() {
    if (
      !confirm(
        $_("admin_item_detail.confirm.delete_item", {
          values: { name: itemShortnameValue },
        })
      )
    ) {
      return;
    }

    try {
      const success = await deleteEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        $params.resource_type
      );

      if (success) {
        $goto("/dashboard/admin/[space_name]/", {
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
    return item?.shortname || $_("admin_item_detail.unnamed_item");
  }

  function getDescription(item) {
    if (item?.description) {
      return (
        item.description[$locale] ||
        item.description.en ||
        item.description.ar ||
        $_("admin_item_detail.no_description")
      );
    }
    return $_("admin_item_detail.no_description");
  }

  function formatDate(dateString) {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleString($locale);
  }

  function formatBytes(bytes) {
    if (!bytes) return $_("admin_item_detail.file_size.zero_bytes");
    const k = 1024;
    const sizes = [
      $_("admin_item_detail.file_size.bytes"),
      $_("admin_item_detail.file_size.kb"),
      $_("admin_item_detail.file_size.mb"),
      $_("admin_item_detail.file_size.gb"),
    ];
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

<div class="min-h-screen bg-gray-50" class:rtl={$isRTL}>
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-6 py-4 max-w-7xl">
      <nav
        class="flex mb-4"
        class:flex-row-reverse={$isRTL}
        aria-label={$_("admin_item_detail.breadcrumb.label")}
      >
        <ol
          class="inline-flex items-center space-x-1 md:space-x-3"
          class:space-x-reverse={$isRTL}
        >
          {#each $breadcrumbs as crumb, index}
            <li class="inline-flex items-center">
              {#if index > 0}
                <svg
                  class="w-4 h-4 text-gray-400 mx-1"
                  class:rotate-180={$isRTL}
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

      <div
        class="flex items-center justify-between"
        class:flex-row-reverse={$isRTL}
      >
        <div
          class="flex items-center space-x-4"
          class:space-x-reverse={$isRTL}
          class:flex-row-reverse={$isRTL}
        >
          <button
            onclick={goBack}
            class="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
            class:flex-row-reverse={$isRTL}
          >
            <svg
              class="w-5 h-5 mr-2"
              class:mr-2={!$isRTL}
              class:ml-2={$isRTL}
              class:rotate-180={$isRTL}
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
            {$_("admin_item_detail.navigation.back")}
          </button>
          <div class="h-6 w-px bg-gray-300"></div>
          <div class:text-right={$isRTL}>
            <h1 class="text-2xl font-bold text-gray-900">
              {itemDataValue
                ? getDisplayName(itemDataValue)
                : itemShortnameValue}
            </h1>
            <p class="text-gray-600">{$_("admin_item_detail.subtitle")}</p>
          </div>
        </div>

        <div
          class="flex items-center space-x-3"
          class:space-x-reverse={$isRTL}
          class:flex-row-reverse={$isRTL}
        >
          <button
            onclick={() => showEditModal.set(true)}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            {$_("admin_item_detail.actions.edit_item")}
          </button>
          <button
            onclick={handleDeleteItem}
            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            {$_("admin_item_detail.actions.delete_item")}
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
      <div class="text-center py-16" class:text-right={$isRTL}>
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
          {$_("admin_item_detail.error.title")}
        </h3>
        <p class="text-gray-600">{$error}</p>
      </div>
    {:else if $itemData}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="border-b border-gray-200">
          <nav
            class="-mb-px flex space-x-8 px-6"
            class:space-x-reverse={$isRTL}
            class:flex-row-reverse={$isRTL}
          >
            <button
              onclick={() => setActiveTab("overview")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.overview")}
            </button>
            <button
              onclick={() => setActiveTab("content")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.content")}
            </button>
            <button
              onclick={() => setActiveTab("relationships")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'relationships'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.relationships")}
            </button>
            <button
              onclick={() => setActiveTab("attachments")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'attachments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.attachments")}
            </button>
            {#if actualSubpathValue === "authors"}
              <button
                onclick={() => setActiveTab("author-entries")}
                class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
                'author-entries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              >
                {$_("admin_item_detail.tabs.author_entries")}
              </button>
            {/if}
            <button
              onclick={() => setActiveTab("metadata")}
              class="py-4 px-1 border-b-2 font-medium text-sm {$activeTab ===
              'metadata'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.metadata")}
            </button>
          </nav>
        </div>

        <div class="p-6">
          {#if $activeTab === "overview"}
            <div class="space-y-6">
              <div>
                <h3
                  class="text-lg font-semibold text-gray-900 mb-4"
                  class:text-right={$isRTL}
                >
                  {$_("admin_item_detail.overview.basic_info")}
                </h3>
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-200"
                    class:rtl={$isRTL}
                  >
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-1/4"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.uuid")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                          class:text-right={$isRTL}>{itemDataValue.uuid}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.shortname")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
                          >{itemDataValue.shortname}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.display_name")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
                        >
                          {#if itemDataValue.displayname}
                            <div class="space-y-1">
                              {#each Object.entries(itemDataValue.displayname) as [lang, name]}
                                <div
                                  class="flex items-center space-x-2"
                                  class:space-x-reverse={$isRTL}
                                  class:flex-row-reverse={$isRTL}
                                >
                                  <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                    >{lang}</span
                                  >
                                  <span>{name}</span>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <span class="text-gray-400"
                              >{$_("admin_item_detail.not_set")}</span
                            >
                          {/if}
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.description")}</td
                        >
                        <td
                          class="px-6 py-4 text-sm text-gray-500"
                          class:text-right={$isRTL}
                        >
                          {#if itemDataValue.description}
                            <div class="space-y-1">
                              {#each Object.entries(itemDataValue.description) as [lang, desc]}
                                <div
                                  class="flex items-start space-x-2"
                                  class:space-x-reverse={$isRTL}
                                  class:flex-row-reverse={$isRTL}
                                >
                                  <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-0.5"
                                    >{lang}</span
                                  >
                                  <span class="flex-1"
                                    >{desc ||
                                      $_("admin_item_detail.empty")}</span
                                  >
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <span class="text-gray-400"
                              >{$_("admin_item_detail.not_set")}</span
                            >
                          {/if}
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.status")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
                        >
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {itemDataValue.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'}"
                            class:flex-row-reverse={$isRTL}
                          >
                            <div
                              class="w-1.5 h-1.5 rounded-full mr-1.5 {itemDataValue.is_active
                                ? 'bg-green-400'
                                : 'bg-red-400'}"
                              class:mr-1.5={!$isRTL}
                              class:ml-1.5={$isRTL}
                            ></div>
                            {itemDataValue.is_active
                              ? $_("admin_item_detail.status.active")
                              : $_("admin_item_detail.status.inactive")}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.tags")}</td
                        >
                        <td
                          class="px-6 py-4 text-sm text-gray-500"
                          class:text-right={$isRTL}
                        >
                          {#if itemDataValue.tags && itemDataValue.tags.length > 0}
                            <div
                              class="flex flex-wrap gap-1"
                              class:justify-end={$isRTL}
                            >
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
                            <span class="text-gray-400"
                              >{$_("admin_item_detail.no_tags")}</span
                            >
                          {/if}
                        </td>
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.owner")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
                          >{itemDataValue.owner_shortname}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.created")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
                          >{formatDate(itemDataValue.created_at)}</td
                        >
                      </tr>
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.fields.updated")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
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
              <h3
                class="text-lg font-semibold text-gray-900"
                class:text-right={$isRTL}
              >
                {$_("admin_item_detail.content.title")}
              </h3>

              {#if itemDataValue.payload}
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-200"
                    class:rtl={$isRTL}
                  >
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-1/4"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.content.content_type")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
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
                            class:text-right={$isRTL}
                            >{$_("admin_item_detail.content.checksum")}</td
                          >
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                            class:text-right={$isRTL}
                            >{itemDataValue.payload.checksum}</td
                          >
                        </tr>
                      {/if}
                      <tr>
                        <td
                          class="px-6 py-4 text-sm font-medium text-gray-900 bg-gray-50 align-top"
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.content.content_body")}</td
                        >
                        <td
                          class="px-6 py-4 text-sm text-gray-500"
                          class:text-right={$isRTL}
                        >
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
                <div
                  class="text-center py-8 text-gray-500"
                  class:text-right={$isRTL}
                >
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
                  <p class="mt-2">
                    {$_("admin_item_detail.content.no_content")}
                  </p>
                </div>
              {/if}
            </div>
          {/if}

          {#if $activeTab === "relationships"}
            <div class="space-y-6">
              <h3
                class="text-lg font-semibold text-gray-900"
                class:text-right={$isRTL}
              >
                {$_("admin_item_detail.relationships.title")}
              </h3>

              {#if itemDataValue.relationships && itemDataValue.relationships.length > 0}
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-200"
                    class:rtl={$isRTL}
                  >
                    <thead class="bg-gray-50">
                      <tr>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.role"
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.related_to"
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.type"
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.space"
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.uuid"
                          )}</th
                        >
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      {#each itemDataValue.relationships as relationship}
                        <tr>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                            class:text-right={$isRTL}
                          >
                            <span
                              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {relationship.attributes?.role ||
                                $_("common.not_available")}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            {relationship.related_to?.shortname ||
                              $_("common.not_available")}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            <span
                              class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {relationship.related_to?.resource_type ||
                                relationship.related_to?.type ||
                                $_("common.not_available")}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            {relationship.related_to?.space_name ||
                              $_("common.not_available")}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                            class:text-right={$isRTL}
                          >
                            {relationship.related_to?.uuid ||
                              $_("common.not_available")}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <div
                  class="text-center py-8 text-gray-500"
                  class:text-right={$isRTL}
                >
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
                  <p class="mt-2">
                    {$_("admin_item_detail.relationships.no_relationships")}
                  </p>
                </div>
              {/if}
            </div>
          {/if}

          {#if $activeTab === "attachments"}
            <div class="space-y-6">
              <div
                class="flex items-center justify-between"
                class:flex-row-reverse={$isRTL}
              >
                <h3
                  class="text-lg font-semibold text-gray-900"
                  class:text-right={$isRTL}
                >
                  {$_("admin_item_detail.attachments.title")}
                </h3>
                <div class="text-sm text-gray-500" class:text-right={$isRTL}>
                  {#if itemDataValue.attachments}
                    {$_("admin_item_detail.attachments.total_count", {
                      values: {
                        count: Number(
                          Object.values(itemDataValue.attachments).reduce(
                            (total: number, attachments) =>
                              total + ((attachments as any[])?.length || 0),
                            0
                          )
                        ),
                      },
                    })}
                  {:else}
                    {$_("admin_item_detail.attachments.zero_count")}
                  {/if}
                </div>
              </div>

              {#if itemDataValue.attachments && typeof itemDataValue.attachments === "object"}
                {#each Object.entries(itemDataValue.attachments) as [type, attachmentsArr]}
                  {#if attachmentsArr && (attachmentsArr as any[]).length > 0}
                    <div
                      class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div
                        class="bg-gray-50 px-6 py-4 border-b border-gray-200"
                      >
                        <h4
                          class="text-md font-medium text-gray-800 capitalize flex items-center gap-2"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                        >
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {type}
                          </span>
                          {$_("admin_item_detail.attachments.type_count", {
                            values: {
                              type: type,
                              count: (attachmentsArr as any[]).length,
                            },
                          })}
                        </h4>
                      </div>
                      <div class="p-6">
                        <Attachment
                          attachments={Object.values(attachmentsArr ?? [])}
                          resource_type={$params.resource_type}
                          space_name={spaceNameValue}
                          subpath={actualSubpathValue}
                          parent_shortname={itemShortnameValue}
                          isOwner={true}
                        />
                      </div>
                    </div>
                  {/if}
                {/each}
              {:else}
                <div
                  class="text-center py-8 text-gray-500"
                  class:text-right={$isRTL}
                >
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
                  <p class="mt-2">
                    {$_("admin_item_detail.attachments.no_attachments")}
                  </p>
                </div>
              {/if}
            </div>
          {/if}

          {#if $activeTab === "metadata"}
            <div class="space-y-6">
              <h3
                class="text-lg font-semibold text-gray-900"
                class:text-right={$isRTL}
              >
                {$_("admin_item_detail.metadata.title")}
              </h3>

              <div
                class="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <table
                  class="min-w-full divide-y divide-gray-200"
                  class:rtl={$isRTL}
                >
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-1/4"
                        class:text-right={$isRTL}
                        >{$_("admin_item_detail.metadata.full_path")}</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono"
                        class:text-right={$isRTL}
                      >
                        {spaceNameValue}/{actualSubpathValue}/{itemShortnameValue}
                      </td>
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        class:text-right={$isRTL}
                        >{$_("admin_item_detail.metadata.space_name")}</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        class:text-right={$isRTL}>{spaceNameValue}</td
                      >
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        class:text-right={$isRTL}
                        >{$_("admin_item_detail.metadata.subpath")}</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        class:text-right={$isRTL}>{actualSubpathValue}</td
                      >
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        class:text-right={$isRTL}
                        >{$_("admin_item_detail.metadata.resource_type")}</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        class:text-right={$isRTL}
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
                          class:text-right={$isRTL}
                          >{$_("admin_item_detail.metadata.acl_entries")}</td
                        >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          class:text-right={$isRTL}
                        >
                          {$_("admin_item_detail.metadata.entries_count", {
                            values: { count: itemDataValue.acl.length },
                          })}
                        </td>
                      </tr>
                    {/if}
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        class:text-right={$isRTL}
                        >{$_(
                          "admin_item_detail.metadata.relationships_count"
                        )}</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        class:text-right={$isRTL}
                      >
                        {itemDataValue.relationships
                          ? itemDataValue.relationships.length
                          : 0}
                      </td>
                    </tr>
                    <tr>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50"
                        class:text-right={$isRTL}
                        >{$_(
                          "admin_item_detail.metadata.attachments_count"
                        )}</td
                      >
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        class:text-right={$isRTL}
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
                <h4
                  class="text-md font-medium text-gray-800 mb-3"
                  class:text-right={$isRTL}
                >
                  {$_("admin_item_detail.metadata.raw_json")}
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
              <h3
                class="text-lg font-semibold text-gray-900"
                class:text-right={$isRTL}
              >
                {$_("admin_item_detail.author_entries.title")}
              </h3>

              {#if authorRelatedEntriesValue && authorRelatedEntriesValue.length > 0}
                <div
                  class="bg-white border border-gray-200 rounded-lg overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-200"
                    class:rtl={$isRTL}
                  >
                    <thead class="bg-gray-50">
                      <tr>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.shortname"
                          )}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.display_name"
                          )}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_("admin_item_detail.author_entries.headers.space")}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_("admin_item_detail.author_entries.headers.type")}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.status"
                          )}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.created"
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      {#each authorRelatedEntriesValue as entry}
                        <tr>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                            class:text-right={$isRTL}
                          >
                            {entry.shortname}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            {getDisplayName(entry)}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            {entry.space_name || $_("common.not_available")}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            <span
                              class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {entry.resource_type || "content"}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            <span
                              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {entry.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'}"
                              class:flex-row-reverse={$isRTL}
                            >
                              <div
                                class="w-1.5 h-1.5 rounded-full mr-1.5 {entry.is_active
                                  ? 'bg-green-400'
                                  : 'bg-red-400'}"
                                class:mr-1.5={!$isRTL}
                                class:ml-1.5={$isRTL}
                              ></div>
                              {entry.is_active
                                ? $_("admin_item_detail.status.active")
                                : $_("admin_item_detail.status.inactive")}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            class:text-right={$isRTL}
                          >
                            {formatDate(entry.created_at)}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <div
                  class="text-center py-8 text-gray-500"
                  class:text-right={$isRTL}
                >
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
                  <p class="mt-2">
                    {$_("admin_item_detail.author_entries.no_entries")}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="text-center py-16" class:text-right={$isRTL}>
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
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          {$_("admin_item_detail.not_found.title")}
        </h3>
        <p class="text-gray-600">
          {$_("admin_item_detail.not_found.description")}
        </p>
      </div>
    {/if}
  </div>
</div>

{#if $showEditModal}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onclick={() => showEditModal.set(false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      class:rtl={$isRTL}
      onclick={(event) => event.stopPropagation()}
    >
      <div
        class="flex justify-between items-center mb-6"
        class:flex-row-reverse={$isRTL}
      >
        <h3
          class="text-xl font-semibold text-gray-900"
          class:text-right={$isRTL}
        >
          {$_("admin_item_detail.edit_modal.title")}
        </h3>
        <button
          onclick={() => showEditModal.set(false)}
          class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          aria-label={$_("admin_item_detail.edit_modal.actions.cancel")}
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
            class:text-right={$isRTL}
          >
            {$_("admin_item_detail.edit_modal.fields.title")}
          </label>
          <input
            id="editTitle"
            type="text"
            bind:value={editFormValue.title}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            class:text-right={$isRTL}
            placeholder={$_("admin_item_detail.edit_modal.placeholders.title")}
            required
          />
        </div>

        <div>
          <label
            for="editContent"
            class="block text-sm font-medium text-gray-700 mb-2"
            class:text-right={$isRTL}
          >
            {$_("admin_item_detail.edit_modal.fields.content")}
          </label>
          <textarea
            id="editContent"
            bind:value={editFormValue.content}
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            class:text-right={$isRTL}
            placeholder={$_(
              "admin_item_detail.edit_modal.placeholders.content"
            )}
          ></textarea>
        </div>

        <div>
          <label
            for="editTags"
            class="block text-sm font-medium text-gray-700 mb-2"
            class:text-right={$isRTL}
          >
            {$_("admin_item_detail.edit_modal.fields.tags")}
          </label>
          <input
            id="editTags"
            type="text"
            bind:value={editFormValue.tagsString}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            class:text-right={$isRTL}
            placeholder={$_("admin_item_detail.edit_modal.placeholders.tags")}
          />
        </div>

        <div
          class="flex items-center"
          class:flex-row-reverse={$isRTL}
          class:justify-end={$isRTL}
        >
          <input
            id="editIsActive"
            type="checkbox"
            bind:checked={editFormValue.is_active}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            for="editIsActive"
            class="ml-2 block text-sm text-gray-900"
            class:ml-2={!$isRTL}
            class:mr-2={$isRTL}
          >
            {$_("admin_item_detail.edit_modal.fields.active")}
          </label>
        </div>

        <div
          class="flex justify-end space-x-3 pt-4 border-t border-gray-200"
          class:space-x-reverse={$isRTL}
          class:flex-row-reverse={$isRTL}
        >
          <button
            type="button"
            onclick={() => showEditModal.set(false)}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            {$_("admin_item_detail.edit_modal.actions.cancel")}
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            {$_("admin_item_detail.edit_modal.actions.save")}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .rtl {
    direction: rtl;
  }
</style>
