<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto, params } from "@roxi/routify";
  import {
    deleteEntity,
    getEntity,
    getMyEntities,
    replaceEntity,
  } from "@/lib/dmart_services/dmart_services";
  import { ContentType, ResourceType } from "@edraj/tsdmart";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived, writable } from "svelte/store";
  import Attachment from "@/components/Attachments.svelte";
  import HtmlEditor from "@/components/editors/HtmlEditor.svelte";
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import { formatNumberInText } from "@/lib/helpers";
  import { marked } from "marked";
  import TemplateEditor from "@/components/editors/TemplateEditor.svelte";
  import JsonEditor from "@/components/editors/JsonEditor.svelte";
  import SchemaForm from "@/components/forms/SchemaForm.svelte";
  import SchemaViewer from "@/components/forms/SchemaViewer.svelte";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  const isLoading = writable(false);
  const itemData = writable(null);
  const error = writable(null);
  const spaceName = writable("");
  const subpath = writable("");
  const itemShortname = writable("");
  const actualSubpath = writable("");
  let unsubscribeParams: () => void;
  const breadcrumbs = writable([]);
  let spaceNameValue = $state("");
  let subpathValue = "";
  let itemShortnameValue = $state("");
  let actualSubpathValue = $state("");
  let breadcrumbsValue = [];
  const authorRelatedEntries = writable([]);
  let authorRelatedEntriesValue = $state([]);
  let itemDataValue = $state(null);
  const activeTab = writable("overview");
  const showEditModal = writable(false);
  let htmlEditor: string = $state("");
  let markdownContent: string = $state("");
  let isTemplateBasedItem = $state(false);
  let templateEditorContent = $state("");
  let jsonEditorContent = $state({});
  let isSchemaBasedItem = $state(false);
  let schemaEditorContent = $state("");
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

  const jsonEditForm = writable({});

  let jsonEditFormValue = $state({});

  function getItemContent(item) {
    if (!item?.payload) return "";

    const contentType = item.payload.content_type;

    if (contentType === "html") {
      return item.payload.body || "";
    } else if (contentType === "json") {
      if (item.payload.body && typeof item.payload.body === "object") {
        return item.payload.body;
      }
      return {};
    }

    return item.payload.body || "";
  }

  function prepareContentForSave(content, originalContentType) {
    if (originalContentType === "json") {
      if (isSchemaBasedItem) {
        return schemaEditorContent;
      }
      return jsonEditFormValue;
    }

    return content || "";
  }

  function handleJsonContentChange(event) {
    jsonEditorContent = event.detail;
    jsonEditFormValue = jsonEditorContent;
    jsonEditForm.update((form) => ({
      ...form,
      content: jsonEditFormValue,
    }));
  }

  // function handleSchemaContentChange(newContent) {
  //   schemaEditorContent = newContent;
  //   editFormValue.content = JSON.stringify(newContent);
  //   editForm.update((form) => ({ ...form, content: editFormValue.content }));
  // }

  onMount(async () => {
    await initializeContent();
  });

  onDestroy(() => {
    if (unsubscribeParams) unsubscribeParams();
  });

  function subscribeStore(store, callback) {
    return store.subscribe(callback);
  }

  async function initializeContent() {
    unsubscribeParams = subscribeStore(params, async (value) => {
      spaceNameValue = value.space_name;
      subpathValue = value.subpath;
      itemShortnameValue = value.shortname;

      spaceName.set(spaceNameValue);
      subpath.set(subpathValue);
      itemShortname.set(itemShortnameValue);

      if (!subpathValue) return;

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

    try {
      const response = await getEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        $params.resource_type || ResourceType.content,
        "managed", // Default scope for admin
        true,
        true,
      );

      if (response) {
        itemDataValue = response;
        itemData.set(response);

        let title =
          (response as any).payload?.body?.title ||
          (response as any).payload?.title ||
          (response as any).title;

        if (!title || title.trim() === "") {
          title = getDisplayName(response);
        }
        const currentDisplayName = response.displayname?.[$locale] || "";

        const content = getItemContent(response);

        // Check if this is a schema-based item
        isSchemaBasedItem =
          response.payload?.schema_shortname === "meta_schema";

        if (response.payload?.content_type === "json") {
          if (isSchemaBasedItem) {
            schemaEditorContent = content;
          } else {
            jsonEditorContent = content;
          }
        }

        const tags = response.tags || [];
        const tagsString = Array.from(tags).join(", ");

        editFormValue = {
          title: currentDisplayName,
          content:
            response.payload?.content_type === "json"
              ? JSON.stringify(content)
              : content || getDescription(response),
          tags: Array.isArray(tags) ? tags : Array.from(tags),
          tagsString: tagsString,
          is_active: response.is_active,
        };
        editForm.set(editFormValue);

        isTemplateBasedItem =
          response.payload?.schema_shortname === "templates";

        if (isTemplateBasedItem) {
          templateEditorContent = content || "";
        }

        const ct = response.payload?.content_type;
        htmlEditor = ct === ContentType.json ? "" : content || "";
        markdownContent = ct === ContentType.markdown ? content || "" : "";
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

  function handleTemplateContentChange(newContent) {
    templateEditorContent = newContent;
    htmlEditor = newContent;
    editFormValue.content = newContent;
    editForm.update((form) => ({ ...form, content: newContent }));
  }

  async function handleUpdateItem(event) {
    event.preventDefault();

    try {
      let htmlContent;

      if (itemDataValue?.payload?.content_type === "json") {
        if (isSchemaBasedItem) {
          htmlContent = JSON.stringify(schemaEditorContent);
        } else {
          htmlContent = JSON.stringify(jsonEditorContent);
        }
      } else {
        const ct = itemDataValue?.payload?.content_type;
        if (ct === "markdown" || ct === "md") {
          htmlContent = markdownContent || editFormValue.content || "";
        } else {
          htmlContent =
            htmlEditor || editFormValue.content || templateEditorContent;
        }
      }

      const tagsArray = editFormValue.tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const updatedDisplayname = {
        ...itemDataValue.displayname,
        [$locale]: editFormValue.title,
      };

      const contentType = itemDataValue?.payload?.content_type;
      let preparedContent = prepareContentForSave(htmlContent, contentType);

      const entityData = {
        displayname: updatedDisplayname,
        tags: tagsArray,
        content: preparedContent,
        is_active: editFormValue.is_active,
        content_type: contentType,
      };

      const response = await replaceEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        $params.resource_type || ResourceType.content,
        entityData,
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
        err.message || $_("admin_item_detail.error.failed_update_item"),
      );
    }
  }

  async function handleDeleteItem() {
    if (
      !confirm(
        $_("admin_item_detail.confirm.delete_item", {
          values: { name: itemShortnameValue },
        }),
      )
    ) {
      return;
    }

    try {
      const success = await deleteEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        $params.resource_type,
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
      const localeDisplay = item.displayname[$locale]?.trim();
      const enDisplay = item.displayname.en?.trim();
      const arDisplay = item.displayname.ar?.trim();

      return localeDisplay || enDisplay || arDisplay || item.shortname;
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

  function navigateToBreadcrumb(path) {
    const pathSegments = path.split("/").filter((segment) => segment !== "");

    if (
      pathSegments.length === 2 &&
      pathSegments[0] === "dashboard" &&
      pathSegments[1] === "admin"
    ) {
      $goto("/dashboard/admin");
    } else if (
      pathSegments.length === 3 &&
      pathSegments[0] === "dashboard" &&
      pathSegments[1] === "admin"
    ) {
      const spaceName = pathSegments[2];
      $goto(`/dashboard/admin/[space_name]`, {
        space_name: spaceName,
      });
    } else if (
      pathSegments.length === 4 &&
      pathSegments[0] === "dashboard" &&
      pathSegments[1] === "admin"
    ) {
      const spaceName = pathSegments[2];
      const subpath = pathSegments[3];
      $goto(`/dashboard/admin/[space_name]/[subpath]`, {
        space_name: spaceName,
        subpath: subpath,
      });
    } else if (
      pathSegments.length === 5 &&
      pathSegments[0] === "dashboard" &&
      pathSegments[1] === "admin"
    ) {
      const spaceName = pathSegments[2];
      const subpath = pathSegments[3];
      const shortname = pathSegments[4];
      $goto(
        `/dashboard/admin/[space_name]/[subpath]/[shortname]/[resource_type]`,
        {
          space_name: spaceName,
          subpath: subpath,
          shortname: shortname,
          resource_type: $params.resource_type,
        },
      );
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
  <div class="bg-gray-50">
    <div class="container mx-auto px-6 py-6 max-w-7xl">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-4">
          <button
            onclick={goBack}
            class="w-10 h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center transition-colors shadow-sm"
            aria-label={`Go back`}
          >
            <svg
              class="w-5 h-5 flex-shrink-0"
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
          </button>

          <div>
            <nav
              class="flex text-sm text-gray-500 font-medium mb-1"
              aria-label="Breadcrumb"
            >
              <ol class="inline-flex items-center space-x-2">
                {#each $breadcrumbs as crumb, index}
                  <li class="inline-flex items-center">
                    {#if index > 0}
                      <svg
                        class="w-4 h-4 mx-1 text-gray-400"
                        class:rotate-180={$isRTL}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        ></path>
                      </svg>
                    {/if}
                    {#if crumb.path}
                      <button
                        onclick={() => navigateToBreadcrumb(crumb.path)}
                        class="hover:text-indigo-600 transition-colors"
                      >
                        {crumb.name}
                      </button>
                    {:else}
                      <span class="text-gray-900">{crumb.name}</span>
                    {/if}
                  </li>
                {/each}
              </ol>
            </nav>
            <h1 class="text-2xl font-bold text-gray-900">
              {itemDataValue
                ? getDisplayName(itemDataValue)
                : itemShortnameValue}
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            onclick={() => showEditModal.set(true)}
            class="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <svg
              class="w-4 h-4 text-gray-500"
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
            {$_("admin_item_detail.actions.edit_item")}
          </button>
          <button
            onclick={handleDeleteItem}
            class="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
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
      <div
        class="bg-white rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 mb-6 overflow-hidden"
      >
        <div class="border-b border-gray-100 bg-gray-50/30">
          <nav
            class="flex px-6 overflow-x-auto hide-scrollbar"
            class:flex-row-reverse={$isRTL}
          >
            <button
              onclick={() => setActiveTab("overview")}
              class="py-4 px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors {$activeTab ===
              'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.overview")}
            </button>
            <button
              onclick={() => setActiveTab("content")}
              class="py-4 px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors {$activeTab ===
              'content'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.content")}
            </button>
            <button
              onclick={() => setActiveTab("relationships")}
              class="py-4 px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors {$activeTab ===
              'relationships'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.relationships")}
            </button>
            <button
              onclick={() => setActiveTab("attachments")}
              class="py-4 px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors {$activeTab ===
              'attachments'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.attachments")}
            </button>
            {#if actualSubpathValue === "authors"}
              <button
                onclick={() => setActiveTab("author-entries")}
                class="py-4 px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors {$activeTab ===
                'author-entries'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}"
              >
                {$_("admin_item_detail.tabs.author_entries")}
              </button>
            {/if}
          </nav>
        </div>

        <div class="p-8">
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
                  class="bg-white border border-gray-100 rounded-2xl overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-100"
                    class:rtl={$isRTL}
                  >
                    <tbody class="bg-white divide-y divide-gray-100">
                      <tr>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50 w-1/4"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50/50"
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
            <div class="space-y-4">
              <h3
                class="text-lg font-semibold text-gray-900"
                class:text-right={$isRTL}
              >
                {$_("admin_item_detail.content.title")}
              </h3>

              {#if itemDataValue.payload}
                {@const ct = itemDataValue.payload.content_type}
                {@const body = itemDataValue.payload.body}

                <div class="rounded-2xl border border-gray-100 overflow-hidden">
                  <!-- content-type badge -->
                  <div
                    class="bg-gray-50/60 px-5 py-3 border-b border-gray-100 flex items-center gap-2"
                  >
                    <span class="text-xs font-medium text-gray-500"
                      >Content type:</span
                    >
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >{ct}</span
                    >
                  </div>

                  <div class="p-6">
                    {#if ct === "html"}
                      <div class="html-preview" class:text-right={$isRTL}>
                        {@html body}
                      </div>
                    {:else if ct === "json"}
                      {#if isSchemaBasedItem}
                        <SchemaViewer content={body} />
                      {:else}
                        <pre
                          class="bg-gray-50 rounded-xl p-4 text-xs overflow-x-auto text-gray-700 leading-relaxed">{JSON.stringify(
                            body,
                            null,
                            2,
                          )}</pre>
                      {/if}
                    {:else}
                      <!-- Default parse string as Markdown (covers "markdown", "md", or missing type) -->
                      {#if typeof body === "string"}
                        <div class="markdown-preview" class:text-right={$isRTL}>
                          {@html marked(body)}
                        </div>
                      {:else}
                        <!-- Fallback for unexpected non-string bodies without a known type -->
                        <pre
                          class="bg-gray-50 rounded-xl p-4 text-xs whitespace-pre-wrap text-gray-700">{JSON.stringify(
                            body,
                          )}</pre>
                      {/if}
                    {/if}
                  </div>
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
                  class="bg-white border border-gray-100 rounded-2xl overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-100"
                    class:rtl={$isRTL}
                  >
                    <thead class="bg-gray-50/50">
                      <tr>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.role",
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.related_to",
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.type",
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.space",
                          )}</th
                        >
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                          >{$_(
                            "admin_item_detail.relationships.headers.uuid",
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
                        count: formatNumberInText(
                          Number(
                            Object.values(itemDataValue.attachments).reduce(
                              (total, attachments) =>
                                (typeof total === "number" ? total : 0) +
                                (Array.isArray(attachments)
                                  ? (attachments as any[]).length
                                  : 0),
                              0,
                            ),
                          ),
                          $locale,
                        ),
                      },
                    })}
                  {:else}
                    {$_("admin_item_detail.attachments.zero_count")}
                  {/if}
                </div>
              </div>

              {#if itemDataValue.attachments && typeof itemDataValue.attachments === "object"}
                {#each Object.entries(itemDataValue.attachments) as [type, attachmentsArrRaw]}
                  {#if Array.isArray(attachmentsArrRaw) && attachmentsArrRaw.length > 0}
                    {@const attachmentsArr = attachmentsArrRaw as any[]}
                    <div
                      class="bg-white border border-gray-100 rounded-2xl overflow-hidden"
                    >
                      <div
                        class="bg-gray-50/50 px-6 py-4 border-b border-gray-100"
                      >
                        <h4
                          class="text-md font-medium text-gray-800 capitalize flex items-center gap-2"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                        >
                          {#if type === "comment" || type === "reply"}
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
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                              />
                            </svg>
                          {:else if type === "reaction"}
                            <svg
                              class="w-5 h-5 text-yellow-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          {:else if type === "share"}
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
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                              />
                            </svg>
                          {:else if type === "media"}
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
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          {:else}
                            <svg
                              class="w-5 h-5 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                              />
                            </svg>
                          {/if}

                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            class:bg-blue-100={type === "comment"}
                            class:text-blue-800={type === "comment"}
                            class:bg-yellow-100={type === "reaction"}
                            class:text-yellow-800={type === "reaction"}
                            class:bg-green-100={type === "media"}
                            class:text-green-800={type === "media"}
                            class:bg-gray-100={type !== "comment" &&
                              type !== "reaction" &&
                              type !== "media"}
                            class:text-gray-800={type !== "comment" &&
                              type !== "reaction" &&
                              type !== "media"}
                          >
                            {formatNumberInText(attachmentsArr.length, $locale)}
                          </span>
                          {$_("admin_item_detail.attachments.type_count", {
                            values: {
                              type: type,
                              count: formatNumberInText(
                                attachmentsArr.length,
                                $locale,
                              ),
                            },
                          })}
                        </h4>
                      </div>

                      <div class="p-6">
                        {#if type === "comment" || type === "reply"}
                          <div class="space-y-4">
                            {#each attachmentsArr as comment}
                              <div
                                class="bg-gray-50 rounded-lg p-4 border border-gray-200"
                              >
                                <div
                                  class="flex items-start justify-between mb-2"
                                >
                                  <div
                                    class="flex items-center space-x-2"
                                    class:space-x-reverse={$isRTL}
                                  >
                                    <div
                                      class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center"
                                    >
                                      <svg
                                        class="w-4 h-4 text-white"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fill-rule="evenodd"
                                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                          clip-rule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <div>
                                      <p
                                        class="text-sm font-medium text-gray-900"
                                      >
                                        {comment.attributes.owner_shortname ||
                                          "Unknown User"}
                                      </p>
                                      <p class="text-xs text-gray-500">
                                        {new Date(
                                                comment.attributes.created_at,
                                        ).toLocaleDateString()} at {new Date(
                                              comment.attributes.created_at,
                                      ).toLocaleTimeString()}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    class="text-xs text-gray-400 bg-white px-2 py-1 rounded"
                                  >
                                    {comment.attributes.payload?.body?.state ||
                                      "comment"}
                                  </span>
                                </div>

                                <div class="mt-3">
                                  <h5
                                    class="text-sm font-medium text-gray-800 mb-2"
                                  >
                                    {comment?.attributes?.displayname?.ar ||
                                      comment?.attributes?.displayname?.en ||
                                      comment?.attributes?.payload?.body
                                        ?.body ||
                                      comment.shortname ||
                                      ""}
                                  </h5>

                                  <div
                                    class="flex items-center justify-between"
                                  >
                                    <div
                                      class="flex items-center space-x-3 text-xs text-gray-500"
                                    >
                                      {#if comment.attributes.payload?.bytesize}
                                        <span
                                          >Size: {comment.attributes.payload
                                            .bytesize} bytes</span
                                        >
                                      {/if}
                                    </div>

                                    <div class="flex items-center space-x-2">
                                      <span
                                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                      >
                                        {comment.resource_type}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            {/each}
                          </div>
                        {:else if type === "reaction"}
                          <div class="space-y-3">
                            {#each attachmentsArr as reaction}
                              <div
                                class="bg-yellow-50 rounded-lg p-4 border border-yellow-200"
                              >
                                <div class="flex items-center justify-between">
                                  <div
                                    class="flex items-center space-x-3"
                                    class:space-x-reverse={$isRTL}
                                  >
                                    <div
                                      class="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center"
                                    >
                                      <svg
                                        class="w-5 h-5 text-yellow-800"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fill-rule="evenodd"
                                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                          clip-rule="evenodd"
                                        />
                                      </svg>
                                    </div>

                                    <div>
                                      <div
                                        class="flex items-center space-x-2 mb-1"
                                      >
                                        <span
                                          class="text-sm font-medium text-gray-900"
                                        >
                                          {reaction.attributes
                                            .owner_shortname || "Anonymous"}
                                        </span>
                                        <span class="text-xs text-gray-500">
                                          reacted
                                        </span>
                                      </div>
                                      <p class="text-xs text-gray-500">
                                        {new Date(
                                          reaction.attributes.created_at,
                                        ).toLocaleDateString()} at {new Date(
                                          reaction.attributes.created_at,
                                        ).toLocaleTimeString()}
                                      </p>
                                    </div>
                                  </div>

                                  <div class="text-right">
                                    <p class="text-xs text-gray-400 mb-1">
                                      ID: {reaction.shortname}
                                    </p>
                                    <span
                                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                                    >
                                      {reaction.resource_type}
                                    </span>
                                  </div>
                                </div>

                                {#if reaction.attributes.updated_at !== reaction.attributes.created_at}
                                  <div
                                    class="mt-2 pt-2 border-t border-yellow-200"
                                  >
                                    <p class="text-xs text-gray-500">
                                      Last updated: {new Date(
                                        reaction.attributes.updated_at,
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {:else if type === "share"}
                          <div class="space-y-3">
                            {#each attachmentsArr as share}
                              <div
                                class="bg-purple-50 rounded-lg p-4 border border-purple-200"
                              >
                                <div class="flex items-center justify-between">
                                  <div
                                    class="flex items-center space-x-3"
                                    class:space-x-reverse={$isRTL}
                                  >
                                    <div
                                      class="w-10 h-10 bg-purple-400 rounded-full flex items-center justify-center"
                                    >
                                      <svg
                                        class="w-5 h-5 text-purple-800"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                          stroke-width="2"
                                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                                        />
                                      </svg>
                                    </div>

                                    <div>
                                      <div
                                        class="flex items-center space-x-2 mb-1"
                                      >
                                        <span
                                          class="text-sm font-medium text-gray-900"
                                        >
                                          {share.attributes.owner_shortname ||
                                            "Anonymous"}
                                        </span>
                                        <span class="text-xs text-gray-500">
                                          shared
                                        </span>
                                      </div>
                                      <p class="text-xs text-gray-500">
                                        {new Date(
                                          share.attributes.created_at,
                                        ).toLocaleDateString()} at {new Date(
                                          share.attributes.created_at,
                                        ).toLocaleTimeString()}
                                      </p>
                                    </div>
                                  </div>

                                  <div class="text-right">
                                    <p class="text-xs text-gray-400 mb-1">
                                      ID: {share.shortname}
                                    </p>
                                    <span
                                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                                    >
                                      {share.resource_type}
                                    </span>
                                  </div>
                                </div>

                                {#if share.attributes.payload?.shared_with}
                                  <div
                                    class="mt-2 pt-2 border-t border-purple-200"
                                  >
                                    <p class="text-xs text-gray-500">
                                      Shared with: {share.attributes.payload
                                        .shared_with}
                                    </p>
                                  </div>
                                {/if}

                                {#if share.attributes.updated_at !== share.attributes.created_at}
                                  <div
                                    class="mt-2 pt-2 border-t border-purple-200"
                                  >
                                    <p class="text-xs text-gray-500">
                                      Last updated: {new Date(
                                        share.attributes.updated_at,
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <Attachment
                            attachments={Object.values(attachmentsArr ?? [])}
                            resource_type={$params.resource_type}
                            space_name={spaceNameValue}
                            subpath={actualSubpathValue}
                            parent_shortname={itemShortnameValue}
                            isOwner={true}
                          />
                        {/if}
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
                  class="bg-white border border-gray-100 rounded-2xl overflow-hidden"
                >
                  <table
                    class="min-w-full divide-y divide-gray-100"
                    class:rtl={$isRTL}
                  >
                    <thead class="bg-gray-50/50">
                      <tr>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.shortname",
                          )}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.display_name",
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
                            "admin_item_detail.author_entries.headers.status",
                          )}
                        </th>
                        <th
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          class:text-right={$isRTL}
                        >
                          {$_(
                            "admin_item_detail.author_entries.headers.created",
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 2 0 01-2 2z"
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 2 0 01-2 2z"
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
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        showEditModal.set(false);
      }
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        showEditModal.set(false);
      }
    }}
  >
    <section class="modal-container" class:rtl={$isRTL} role="document">
      <div class="modal-header" class:rtl={$isRTL}>
        <div class="header-content">
          <div class="header-text">
            <h3 class="modal-title" class:text-right={$isRTL}>
              {$_("admin_item_detail.edit_modal.title")}
            </h3>
          </div>
          <button
            onclick={() => showEditModal.set(false)}
            class="close-button"
            aria-label={$_("admin_item_detail.edit_modal.actions.cancel")}
          >
            <svg
              class="close-icon"
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
      </div>

      <div class="modal-content">
        <form class="modal-form" onsubmit={handleUpdateItem}>
          <div class="form-grid">
            <div class="form-column">
              <div class="form-group">
                <label
                  for="editTitle"
                  class="form-label"
                  class:text-right={$isRTL}
                  class:rtl-label={$isRTL}
                >
                  <svg
                    class="label-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  {$_("admin_item_detail.edit_modal.fields.title")}
                </label>
                <input
                  id="editTitle"
                  type="text"
                  bind:value={editFormValue.title}
                  class="form-input"
                  class:text-right={$isRTL}
                  placeholder={$_(
                    "admin_item_detail.edit_modal.placeholders.title",
                  )}
                />
              </div>

              <div class="form-group">
                <label
                  for="editTags"
                  class="form-label"
                  class:text-right={$isRTL}
                  class:rtl-label={$isRTL}
                >
                  <svg
                    class="label-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  {$_("admin_item_detail.edit_modal.fields.tags")}
                </label>
                <input
                  id="editTags"
                  type="text"
                  bind:value={editFormValue.tagsString}
                  class="form-input"
                  class:text-right={$isRTL}
                  placeholder={$_(
                    "admin_item_detail.edit_modal.placeholders.tags",
                  )}
                />
                <p class="form-hint" class:text-right={$isRTL}>
                  Separate tags with commas (e.g., tag1, tag2, tag3)
                </p>
              </div>

              <div class="status-container">
                <div class="status-toggle" class:rtl-toggle={$isRTL}>
                  <div class="toggle-wrapper">
                    <label for="editIsActive"></label>
                    <input
                      id="editIsActive"
                      type="checkbox"
                      bind:checked={editFormValue.is_active}
                      class="toggle-input"
                    />
                    <button
                      type="button"
                      class="toggle-switch {editFormValue.is_active
                        ? 'active'
                        : ''}"
                      onclick={() => {
                        editFormValue.is_active = !editFormValue.is_active;
                      }}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          editFormValue.is_active = !editFormValue.is_active;
                        }
                      }}
                      aria-pressed={editFormValue.is_active}
                      aria-label="Toggle active status"
                    >
                      <div class="toggle-slider"></div>
                    </button>
                  </div>
                  <div class="status-info" class:rtl-info={$isRTL}>
                    <label
                      for="editIsActive"
                      class="status-label"
                      class:rtl-status-label={$isRTL}
                    >
                      <svg
                        class="label-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      {$_("admin_item_detail.edit_modal.fields.active")}
                    </label>
                    <p class="status-description" class:text-right={$isRTL}>
                      {editFormValue.is_active
                        ? "Item is currently active"
                        : "Item is currently inactive"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="editor-column">
              <div class="editor-group">
                <label
                  for="editContent"
                  class="form-label"
                  class:text-right={$isRTL}
                  class:rtl-label={$isRTL}
                >
                  <svg
                    class="label-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 2 0 01-2 2z"
                    />
                  </svg>
                  {$_("admin_item_detail.edit_modal.fields.content")}
                </label>
                <div class="editor-container">
                  {#if isTemplateBasedItem}
                    <TemplateEditor
                      content={templateEditorContent}
                      space_name={spaceNameValue}
                      on:contentChange={(e) =>
                        handleTemplateContentChange(e.detail)}
                    />
                  {:else if isSchemaBasedItem}
                    <SchemaForm bind:content={schemaEditorContent} />
                  {:else if itemDataValue?.payload?.content_type === "json"}
                    <JsonEditor
                      content={jsonEditorContent}
                      isEditMode={true}
                      on:contentChange={handleJsonContentChange}
                    />
                  {:else if itemDataValue?.payload?.content_type === "markdown" || itemDataValue?.payload?.content_type === "md"}
                    <MarkdownEditor bind:content={markdownContent} />
                  {:else}
                    <HtmlEditor
                      bind:content={htmlEditor}
                      resource_type={$params.resource_type}
                      space_name={spaceNameValue}
                      subpath={actualSubpathValue}
                      parent_shortname={itemShortnameValue}
                      uid="main-editor"
                      isEditMode={true}
                      attachments={itemDataValue?.attachments || []}
                      changed={() => {
                        console.log("Content changed:", htmlEditor);
                      }}
                    />
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <div class="actions-container" class:rtl-actions={$isRTL}>
              <button
                type="button"
                onclick={() => showEditModal.set(false)}
                class="cancel-button"
                aria-label={`Cancel editing item`}
              >
                <svg
                  class="button-icon"
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
                {$_("admin_item_detail.edit_modal.actions.cancel")}
              </button>
              <!-- Removed onclick handler from submit button to rely on form onsubmit -->
              <button
                aria-label={`Save changes`}
                type="submit"
                class="save-button"
              >
                <svg
                  class="button-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {$_("admin_item_detail.edit_modal.actions.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  </div>
{/if}

<style>
  .markdown-preview,
  .html-preview {
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
    background: white;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* Headings */
  .markdown-preview :global(h1),
  .html-preview :global(h1),
  .markdown-preview :global(h2),
  .html-preview :global(h2),
  .markdown-preview :global(h3),
  .html-preview :global(h3),
  .markdown-preview :global(h4),
  .html-preview :global(h4),
  .markdown-preview :global(h5),
  .html-preview :global(h5),
  .markdown-preview :global(h6),
  .html-preview :global(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.25;
    color: #111827;
  }

  .markdown-preview :global(h1),
  .html-preview :global(h1) {
    font-size: 2em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #e5e7eb;
  }
  .markdown-preview :global(h2),
  .html-preview :global(h2) {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #e5e7eb;
  }
  .markdown-preview :global(h3),
  .html-preview :global(h3) {
    font-size: 1.25em;
  }
  .markdown-preview :global(h4),
  .html-preview :global(h4) {
    font-size: 1em;
  }
  .markdown-preview :global(h5),
  .html-preview :global(h5) {
    font-size: 0.875em;
  }
  .markdown-preview :global(h6),
  .html-preview :global(h6) {
    font-size: 0.85em;
    color: #6b7280;
  }

  /* Paragraphs and Inline Text */
  .markdown-preview :global(p),
  .html-preview :global(p) {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .markdown-preview :global(a),
  .html-preview :global(a) {
    color: #2563eb;
    text-decoration: none;
  }
  .markdown-preview :global(a:hover),
  .html-preview :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-preview :global(strong),
  .html-preview :global(strong) {
    font-weight: 600;
  }

  /* Lists */
  .markdown-preview :global(ul),
  .html-preview :global(ul),
  .markdown-preview :global(ol),
  .html-preview :global(ol) {
    margin-top: 0;
    margin-bottom: 1rem;
    padding-left: 2em;
  }
  .markdown-preview :global(ul),
  .html-preview :global(ul) {
    list-style-type: disc;
  }
  .markdown-preview :global(ol),
  .html-preview :global(ol) {
    list-style-type: decimal;
  }

  .markdown-preview :global(li),
  .html-preview :global(li) {
    margin-top: 0.25em;
  }

  /* Blockquotes */
  .markdown-preview :global(blockquote),
  .html-preview :global(blockquote) {
    margin: 0 0 1rem;
    padding: 0 1em;
    color: #6b7280;
    border-left: 0.25em solid #e5e7eb;
  }

  /* Code and Preformatted Text */
  .markdown-preview :global(code),
  .html-preview :global(code) {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    background-color: #f3f4f6;
    border-radius: 6px;
  }

  .markdown-preview :global(pre),
  .html-preview :global(pre) {
    padding: 1rem;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f3f4f6;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  .markdown-preview :global(pre code),
  .html-preview :global(pre code) {
    padding: 0;
    background-color: transparent;
    border-radius: 0;
  }

  /* Tables */
  .markdown-preview :global(table),
  .html-preview :global(table) {
    display: block;
    width: 100%;
    width: max-content;
    max-width: 100%;
    overflow: auto;
    margin-top: 0;
    margin-bottom: 1rem;
    border-spacing: 0;
    border-collapse: collapse;
  }

  .markdown-preview :global(table th),
  .html-preview :global(table th),
  .markdown-preview :global(table td),
  .html-preview :global(table td) {
    padding: 6px 13px;
    border: 1px solid #e5e7eb;
  }

  .markdown-preview :global(table tr:nth-child(2n)),
  .html-preview :global(table tr:nth-child(2n)) {
    background-color: #f9fafb;
  }

  /* RTL Support */
  .rtl .markdown-preview,
  .rtl .html-preview {
    text-align: right;
  }

  .rtl .markdown-preview :global(ul),
  .rtl .html-preview :global(ul),
  .rtl .markdown-preview :global(ol),
  .rtl .html-preview :global(ol) {
    padding-left: 0;
    padding-right: 2em;
  }

  .rtl .markdown-preview :global(blockquote),
  .rtl .html-preview :global(blockquote) {
    border-left: none;
    border-right: 0.25em solid #e5e7eb;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }

  .modal-container {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 80rem;
    max-height: 90vh;
    overflow: hidden;
    overflow: hidden;
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    padding: 2rem;
    color: white;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .modal-subtitle {
    color: rgba(219, 234, 254, 0.9);
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
  }

  .close-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .close-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .modal-content {
    overflow-y: auto;
    max-height: calc(90vh - 140px);
  }

  .modal-form {
    padding: 2rem;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-column {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .form-column {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
  }

  .editor-column {
    grid-column: span 1;
    width: 100%;
  }

  .form-group,
  .editor-group {
    position: relative;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.75rem;
    cursor: pointer;
  }

  .label-icon {
    width: 1rem;
    height: 1rem;
    color: #6b7280;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    background: rgba(249, 250, 251, 0.5);
    font-size: 0.875rem;
    transition: all 0.2s ease;
    outline: none;
  }

  .form-input:hover {
    background: white;
    border-color: #d1d5db;
  }

  .form-input:focus {
    background: white;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-hint {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .status-container {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.25rem;
  }

  .status-toggle {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .rtl-toggle {
    justify-content: flex-end;
  }

  .toggle-wrapper {
    position: relative;
  }

  .toggle-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .toggle-switch {
    width: 3rem;
    height: 1.5rem;
    background: #d1d5db;
    border-radius: 9999px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: background-color 0.2s ease;
    cursor: pointer;
    position: relative;
    border: none;
    outline: none;
  }

  .toggle-switch.active {
    background: #3b82f6;
  }

  .toggle-switch:focus {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1.25rem;
    height: 1.25rem;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;
  }

  .toggle-switch.active .toggle-slider {
    transform: translateX(1.5rem);
  }

  .status-info {
    flex: 1;
  }

  .rtl-info {
    margin-right: 0;
    margin-left: 1rem;
  }

  .status-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    cursor: pointer;
    margin-bottom: 0.25rem;
  }

  .status-description {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  .editor-container {
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: border-color 0.2s ease;
    height: 500px; /* Increased from 600px with max-height 500px */
    min-height: 500px;
    overflow-y: auto;
  }

  .editor-container:hover {
    border-color: #d1d5db;
  }

  .modal-actions {
    margin-top: 2.5rem;
    padding-top: 2rem;
    border-top: 1px solid #e5e7eb;
  }

  .actions-container {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .cancel-button,
  .save-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    outline: none;
  }

  .cancel-button {
    background: white;
    color: #374151;
    border: 2px solid #e5e7eb;
  }

  .cancel-button:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .cancel-button:focus {
    box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
  }

  .save-button {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: 2px solid transparent;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
    padding: 0.75rem 2rem;
  }

  .save-button:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.4);
    transform: translateY(-1px);
  }

  .save-button:focus {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .button-icon {
    width: 1rem;
    height: 1rem;
  }

  /* RTL Support */

  .rtl .form-grid {
    direction: rtl;
  }

  .rtl .actions-container {
    direction: rtl;
  }

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .modal-container {
      margin: 0.5rem;
      max-height: 98vh;
    }

    .modal-header {
      padding: 1.5rem;
    }

    .modal-title {
      font-size: 1.25rem;
    }

    .modal-form {
      padding: 1.5rem;
    }

    .form-grid {
      gap: 1.5rem;
    }

    .form-column {
      gap: 1.25rem;
    }

    .actions-container {
      flex-direction: column;
      gap: 0.75rem;
    }

    .cancel-button,
    .save-button {
      width: 100%;
      justify-content: center;
    }
  }

  .form-input,
  .toggle-switch,
  .cancel-button,
  .save-button {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Focus states for accessibility */
  .form-input:focus,
  .toggle-switch:focus-within,
  .cancel-button:focus,
  .save-button:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }
  .rtl {
    direction: rtl;
  }
</style>
