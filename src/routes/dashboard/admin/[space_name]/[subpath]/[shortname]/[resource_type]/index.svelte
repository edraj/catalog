<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto, params } from "@roxi/routify";
  import {
    deleteEntity,
    getEntity,
    getMyEntities,
    replaceEntity,
    getAvatar,
    checkCurrentUserReactedIdea,
  } from "@/lib/dmart_services/dmart_services";
  import {
    createComment,
    createReaction,
    deleteReactionComment,
  } from "@/lib/dmart_services/comments_reactions";
  import Avatar from "@/components/Avatar.svelte";
  import { user } from "@/stores/user";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
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
  import PlantUMLViewer from "@/components/PlantUMLViewer.svelte";
  import { getTemplate } from "@/lib/dmart_services/templates";
  import RelationshipModal from "@/components/management/RelationshipModal.svelte";
  import AttachmentModal from "@/components/management/AttachmentModal.svelte";
  import {
    PlusOutline,
    HeartSolid,
    MessagesSolid,
    TrashBinSolid,
  } from "flowbite-svelte-icons";

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
  const activeTab = writable("content");
  const showEditModal = writable(false);
  const showRelationshipModal = writable(false);
  const showAttachmentModal = writable(false);
  const showDeleteModal = writable(false);
  let isDeleting = writable(false);
  let htmlEditor: string = $state("");
  let markdownContent: string = $state("");
  let isTemplateBasedItem = $state(false);
  let templateEditorContent = $state("");
  let jsonEditorContent = $state({});
  let isSchemaBasedItem = $state(false);
  let schemaEditorContent = $state("");
  const editForm = writable({
    displayname: { en: "", ar: "", ku: "" },
    description: { en: "", ar: "", ku: "" },
    content: "",
    tags: [],
    newTag: "",
    is_active: true,
  });

  let editFormValue = $state({
    displayname: { en: "", ar: "", ku: "" },
    description: { en: "", ar: "", ku: "" },
    content: "",
    tags: [],
    newTag: "",
    is_active: true,
  });

  const jsonEditForm = writable({});

  let jsonEditFormValue = $state({});
  let relationshipsValue = $state([]);

  // Template rendering state
  let templateRenderedContent = $state("");
  let isLoadingTemplate = $state(false);
  let templateError = $state("");

  // Check if this is a template-based entry
  const isTemplateEntry = $derived(
    itemDataValue?.payload?.schema_shortname === "templates" &&
      !!itemDataValue?.payload?.body?.template &&
      !!itemDataValue?.payload?.body?.data,
  );

  $effect(() => {
    console.log({ isTemplateEntry });
  });

  // Load and render template content
  async function loadTemplateContent() {
    if (!isTemplateEntry || !$spaceName) return;

    isLoadingTemplate = true;
    templateError = "";

    try {
      const templateShortname = itemDataValue.payload.body.template;
      const templateData = itemDataValue.payload.body.data;

      // Try to get template from current space first
      let template = await getTemplate(
        $spaceName,
        templateShortname,
        "managed",
      );

      // If not found in current space, try applications space
      if (!template) {
        template = await getTemplate(
          "applications",
          templateShortname,
          "managed",
        );
      }

      if (!template) {
        templateError = `Template "${templateShortname}" not found`;
        templateRenderedContent = "";
        return;
      }

      // Get the template content
      let content = template?.payload?.body?.content || "";

      // Replace placeholders with data
      const renderedContent = renderTemplateWithData(content, templateData);
      console.log({
        D: template,
        content,
        renderedContent,
      });

      // Parse markdown to HTML
      templateRenderedContent = (await marked.parse(renderedContent)) as string;
    } catch (error) {
      console.error("Error loading template:", error);
      templateError = "Failed to load template content";
    } finally {
      isLoadingTemplate = false;
    }
  }

  function renderTemplateWithData(
    templateContent: string,
    data: Record<string, any>,
  ): string {
    if (!templateContent || !data) return templateContent;

    let result = templateContent;

    // Replace {{fieldName:type}} patterns with actual data
    const placeholderRegex = /\{\{(\w+)(?::(\w+))?\}\}/g;

    result = result.replace(placeholderRegex, (match, fieldName, fieldType) => {
      const value = data[fieldName];

      if (value === undefined || value === null) {
        return match; // Keep placeholder if data not found
      }

      return String(value);
    });

    return result;
  }

  // Comments and reactions state
  let comment = $state("");
  let userReactionEntry = $state(null);
  let counts = $state({
    reaction: 0,
    comment: 0,
  });

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
        relationshipsValue = response.relationships || [];

        // Load comments and reactions counts
        counts = {
          reaction: response.attachments?.reaction?.length || 0,
          comment: response.attachments?.comment?.length || 0,
        };

        // Check if current user has reacted
        if ($user?.shortname) {
          userReactionEntry = await checkCurrentUserReactedIdea(
            $user.shortname,
            itemShortnameValue,
            spaceNameValue,
            actualSubpathValue,
          );
        }

        const content = getItemContent(response);

        // Check if this is a schema-based item
        isSchemaBasedItem =
          response.payload?.schema_shortname === "meta_schema";

        if (response.payload?.content_type === "json") {
          if (isSchemaBasedItem) {
            schemaEditorContent = content;
          } else {
            jsonEditorContent = content;
            jsonEditFormValue = content;
          }
        }

        const tags = response.tags || [];

        editFormValue = {
          displayname: {
            en: response.displayname?.en || "",
            ar: response.displayname?.ar || "",
            ku: response.displayname?.ku || "",
          },
          description: {
            en: response.description?.en || "",
            ar: response.description?.ar || "",
            ku: response.description?.ku || "",
          },
          content:
            response.payload?.content_type === "json"
              ? JSON.stringify(content)
              : content || getDescription(response),
          tags: Array.isArray(tags) ? [...tags] : Array.from(tags),
          newTag: "",
          is_active: response.is_active,
        };
        editForm.set(editFormValue);

        isTemplateBasedItem =
          response.payload?.schema_shortname === "templates";

        if (isTemplateBasedItem) {
          templateEditorContent = content || "";
          // Load and render template content for display
          await loadTemplateContent();
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

      const contentType = itemDataValue?.payload?.content_type;
      let preparedContent = prepareContentForSave(htmlContent, contentType);

      const entityData = {
        displayname: editFormValue.displayname,
        description: editFormValue.description,
        tags: editFormValue.tags,
        is_active: editFormValue.is_active,
        payload: {
          content_type: contentType,
          body: preparedContent,
        },
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

  function handleDeleteItem() {
    showDeleteModal.set(true);
  }

  async function confirmDeleteItem() {
    isDeleting.set(true);
    try {
      const success = await deleteEntity(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
        $params.resource_type,
      );

      if (success) {
        showDeleteModal.set(false);
        $goto("/dashboard/admin/[space_name]/", {
          space_name: spaceNameValue,
          subpath: actualSubpathValue,
        });
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      errorToastMessage($_("admin_item_detail.error.delete_failed"));
    } finally {
      isDeleting.set(false);
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

  // Tags handlers
  function addTag() {
    if (editFormValue.newTag.trim() !== "") {
      editFormValue.tags = [...editFormValue.tags, editFormValue.newTag.trim()];
      editFormValue.newTag = "";
    }
  }

  function removeTag(index: number) {
    editFormValue.tags = editFormValue.tags.filter((_, i) => i !== index);
  }

  // Comments and reactions handlers
  async function handleAddComment() {
    if (!comment.trim()) return;

    const response = await createComment(
      spaceNameValue,
      actualSubpathValue,
      itemShortnameValue,
      comment,
    );

    if (response) {
      successToastMessage($_("entry_detail.comments.add_success"));
      comment = "";
      await loadItemData();
    } else {
      errorToastMessage($_("entry_detail.comments.add_error"));
    }
  }

  async function handleDeleteComment(commentShortname: string) {
    const response = await deleteReactionComment(
      ResourceType.comment,
      `${actualSubpathValue}/${itemShortnameValue}`,
      commentShortname,
      spaceNameValue,
    );

    if (response) {
      successToastMessage($_("entry_detail.comments.delete_success"));
      await loadItemData();
    } else {
      errorToastMessage($_("entry_detail.comments.delete_error"));
    }
  }

  async function handleReaction() {
    if (userReactionEntry) {
      // Remove reaction
      const response = await deleteReactionComment(
        ResourceType.reaction,
        `${actualSubpathValue}/${itemShortnameValue}`,
        userReactionEntry,
        spaceNameValue,
      );
      if (response) {
        userReactionEntry = null;
        successToastMessage($_("entry_detail.reactions.remove_success"));
        await loadItemData();
      } else {
        errorToastMessage($_("entry_detail.reactions.remove_error"));
      }
    } else {
      // Add reaction
      const response = await createReaction(
        itemShortnameValue,
        spaceNameValue,
        actualSubpathValue,
      );
      if (response) {
        successToastMessage($_("entry_detail.reactions.add_success"));
        await loadItemData();
      } else {
        errorToastMessage($_("entry_detail.reactions.add_error"));
      }
    }
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
              onclick={() => setActiveTab("content")}
              class="py-4 px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors {$activeTab ===
              'content'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}"
            >
              {$_("admin_item_detail.tabs.content")}
            </button>
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
                    {#if isTemplateEntry}
                      <!-- Template-based entry rendering -->
                      {#if isLoadingTemplate}
                        <div class="template-loading">
                          <div class="spinner"></div>
                          <span>Loading template...</span>
                        </div>
                      {:else if templateError}
                        <div class="template-error">
                          <p class="error-message">{templateError}</p>
                          <div class="fallback-data">
                            <h4>Template: {body.template}</h4>
                            <dl>
                              {#each Object.entries(body.data || {}) as [key, value]}
                                <dt>{key}:</dt>
                                <dd>{value}</dd>
                              {/each}
                            </dl>
                          </div>
                          <pre class="fallback-content">{JSON.stringify(
                              body,
                              null,
                              2,
                            )}</pre>
                        </div>
                      {:else}
                        <div class="markdown-preview" class:text-right={$isRTL}>
                          {@html templateRenderedContent}
                        </div>
                      {/if}
                    {:else if ct === "html"}
                      <div class="html-preview" class:text-right={$isRTL}>
                        {@html body}
                      </div>
                    {:else if ct === "json"}
                      {#if isSchemaBasedItem}
                        <div class="p-6">
                          <SchemaViewer content={body} />
                        </div>
                      {:else}
                        <div class="p-6">
                          <PlantUMLViewer
                            data={body}
                            title={itemDataValue?.displayname?.en ||
                              "JSON Content"}
                            type="json"
                            isAdmin={true}
                          />
                        </div>
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

              <!-- Comments and Reactions Section -->
              <div class="mt-10 pt-8 border-t border-gray-100">
                <!-- Action Buttons -->
                <div class="flex items-center gap-6 mb-6">
                  <button
                    onclick={handleReaction}
                    class="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 {userReactionEntry
                      ? 'bg-red-50 text-red-600'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}"
                  >
                    <HeartSolid
                      class="w-5 h-5 {userReactionEntry ? 'text-red-500' : ''}"
                    />
                    <span
                      >{userReactionEntry
                        ? $_("entry_detail.actions.unlike")
                        : $_("entry_detail.actions.like")}</span
                    >
                    <span class="text-sm opacity-75"
                      >({formatNumberInText(counts.reaction, $locale) ||
                        0})</span
                    >
                  </button>

                  <div class="flex items-center gap-2 text-gray-600">
                    <MessagesSolid class="w-5 h-5" />
                    <span>{$_("entry_detail.comments.title")}</span>
                    <span class="text-sm opacity-75"
                      >({formatNumberInText(counts.comment, $locale) ||
                        0})</span
                    >
                  </div>
                </div>

                <!-- Add Comment -->
                <div class="bg-gray-50/50 rounded-2xl p-6 mb-6">
                  <h4
                    class="text-sm font-semibold text-gray-900 mb-4"
                    class:text-right={$isRTL}
                  >
                    {$_("entry_detail.comments.title")}
                  </h4>
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <input
                        type="text"
                        bind:value={comment}
                        placeholder={$_("entry_detail.comments.placeholder")}
                        class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                        class:text-right={$isRTL}
                        onkeydown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                    </div>
                    <button
                      onclick={handleAddComment}
                      disabled={!comment.trim()}
                      class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
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
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Comments List -->
                {#if itemDataValue?.attachments?.comment && itemDataValue.attachments.comment.length > 0}
                  <div class="space-y-4">
                    {#each itemDataValue.attachments.comment as reply}
                      <div
                        class="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-sm transition-shadow"
                      >
                        <div class="flex gap-4">
                          <div class="flex-shrink-0">
                            {#await getAvatar(reply.attributes.owner_shortname) then avatar}
                              <Avatar src={avatar} size="44" />
                            {/await}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div
                              class="flex items-center justify-between gap-2 mb-2"
                            >
                              <div
                                class="flex items-center gap-2"
                                class:flex-row-reverse={$isRTL}
                              >
                                <span class="font-semibold text-gray-900">
                                  {reply.attributes?.displayname?.[$locale] ||
                                    reply.attributes?.displayname?.en ||
                                    reply.attributes?.displayname?.ar ||
                                    reply.attributes?.owner_shortname}
                                </span>
                                <span class="text-xs text-gray-400">
                                  {formatDate(reply.attributes.created_at)}
                                </span>
                              </div>
                              {#if reply.attributes.owner_shortname === $user?.shortname}
                                <button
                                  onclick={() =>
                                    handleDeleteComment(reply.shortname)}
                                  class="text-gray-400 hover:text-red-500 transition-colors p-1"
                                  aria-label={$_(
                                    "entry_detail.comments.delete_comment",
                                  )}
                                >
                                  <TrashBinSolid class="w-4 h-4" />
                                </button>
                              {/if}
                            </div>
                            <p
                              class="text-gray-700 text-sm leading-relaxed"
                              class:text-right={$isRTL}
                            >
                              {reply.attributes.payload?.body?.embedded ||
                                reply.attributes.payload?.body?.body ||
                                $_("entry_detail.no_content")}
                            </p>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="text-center py-10 bg-gray-50/50 rounded-2xl">
                    <MessagesSolid
                      class="w-12 h-12 mx-auto text-gray-300 mb-3"
                    />
                    <p class="text-gray-500 font-medium">
                      {$_("entry_detail.comments.no_comments")}
                    </p>
                    <p class="text-sm text-gray-400 mt-1">
                      {$_("entry_detail.comments.be_first")}
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
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

          {#if $activeTab === "relationships"}
            <div class="space-y-6">
              <div
                class="flex items-center justify-between"
                class:flex-row-reverse={$isRTL}
              >
                <h3
                  class="text-lg font-semibold text-gray-900"
                  class:text-right={$isRTL}
                >
                  {$_("admin_item_detail.relationships.title")}
                </h3>
                <button
                  onclick={() => showRelationshipModal.set(true)}
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <PlusOutline class="w-4 h-4" />
                  {$_("admin_item_detail.relationships.manage")}
                </button>
              </div>

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
                <div
                  class="flex items-center gap-3"
                  class:flex-row-reverse={$isRTL}
                >
                  <button
                    onclick={() => showAttachmentModal.set(true)}
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
                  >
                    <PlusOutline class="w-4 h-4" />
                    {$_("admin_item_detail.attachments.upload")}
                  </button>
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
          <div class="form-grid-vertical">
            <!-- Display Name Section -->
            <div class="form-section">
              <label class="form-label section-label" class:text-right={$isRTL}>
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
                {$_("admin_item_detail.edit_modal.fields.displayname")}
              </label>
              <div class="localized-inputs">
                <div class="localized-field">
                  <span class="lang-badge">EN</span>
                  <input
                    type="text"
                    bind:value={editFormValue.displayname.en}
                    class="form-input"
                    placeholder="English display name"
                  />
                </div>
                <div class="localized-field">
                  <span class="lang-badge">AR</span>
                  <input
                    type="text"
                    bind:value={editFormValue.displayname.ar}
                    class="form-input"
                    placeholder="Arabic display name"
                  />
                </div>
                <div class="localized-field">
                  <span class="lang-badge">KU</span>
                  <input
                    type="text"
                    bind:value={editFormValue.displayname.ku}
                    class="form-input"
                    placeholder="Kurdish display name"
                  />
                </div>
              </div>
            </div>

            <!-- Description Section -->
            <div class="form-section">
              <label class="form-label section-label" class:text-right={$isRTL}>
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
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                {$_("admin_item_detail.edit_modal.fields.description")}
              </label>
              <div class="localized-inputs">
                <div class="localized-field">
                  <span class="lang-badge">EN</span>
                  <textarea
                    bind:value={editFormValue.description.en}
                    class="form-input form-textarea"
                    placeholder="English description"
                    rows="2"
                  ></textarea>
                </div>
                <div class="localized-field">
                  <span class="lang-badge">AR</span>
                  <textarea
                    bind:value={editFormValue.description.ar}
                    class="form-input form-textarea"
                    placeholder="Arabic description"
                    rows="2"
                  ></textarea>
                </div>
                <div class="localized-field">
                  <span class="lang-badge">KU</span>
                  <textarea
                    bind:value={editFormValue.description.ku}
                    class="form-input form-textarea"
                    placeholder="Kurdish description"
                    rows="2"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Tags Section with Badge Behavior -->
            <div class="form-section">
              <label class="form-label section-label" class:text-right={$isRTL}>
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
              <div class="tag-input-wrapper">
                <div class="tag-input-row">
                  <input
                    type="text"
                    bind:value={editFormValue.newTag}
                    class="form-input tag-input"
                    placeholder={$_(
                      "admin_item_detail.edit_modal.placeholders.tags",
                    )}
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="add-tag-btn"
                    onclick={addTag}
                    disabled={!editFormValue.newTag.trim()}
                  >
                    <svg
                      class="btn-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add
                  </button>
                </div>
                {#if editFormValue.tags.length > 0}
                  <div class="tags-badges-container">
                    {#each editFormValue.tags as tag, index}
                      <span class="tag-badge">
                        {tag}
                        <button
                          type="button"
                          class="tag-remove-btn"
                          onclick={() => removeTag(index)}
                          aria-label="Remove tag"
                        >
                          <svg
                            class="remove-icon"
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
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <!-- Active Status -->
            <div class="form-section status-section">
              <div class="status-toggle-simple" class:rtl-toggle={$isRTL}>
                <button
                  type="button"
                  class="toggle-switch {editFormValue.is_active
                    ? 'active'
                    : ''}"
                  onclick={() => {
                    editFormValue.is_active = !editFormValue.is_active;
                  }}
                  aria-pressed={editFormValue.is_active}
                >
                  <div class="toggle-slider"></div>
                </button>
                <div class="status-info">
                  <span class="status-label">
                    {$_("admin_item_detail.edit_modal.fields.active")}
                  </span>
                  <span
                    class="status-value {editFormValue.is_active
                      ? 'active'
                      : 'inactive'}"
                  >
                    {editFormValue.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <!-- Content Editor -->
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
                    <div class="json-editor-with-preview">
                      <div class="json-editor-pane">
                        <JsonEditor
                          content={jsonEditorContent}
                          isEditMode={true}
                          on:contentChange={handleJsonContentChange}
                        />
                      </div>
                      <div class="plantuml-preview-pane">
                        <h4 class="preview-title">Preview</h4>
                        <PlantUMLViewer
                          data={jsonEditFormValue}
                          title="JSON Preview"
                          type="json"
                          isAdmin={true}
                        />
                      </div>
                    </div>
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

<!-- Relationship Management Modal -->
{#if $showRelationshipModal}
  <RelationshipModal
    bind:isOpen={$showRelationshipModal}
    bind:relationships={relationshipsValue}
    space_name={spaceNameValue}
    subpath={actualSubpathValue}
    resource_type={$params.resource_type}
    parent_shortname={itemShortnameValue}
  />
{/if}

<!-- Attachment Upload Modal -->
{#if $showAttachmentModal}
  <AttachmentModal
    bind:isOpen={$showAttachmentModal}
    space_name={spaceNameValue}
    subpath={actualSubpathValue}
    resource_type={$params.resource_type}
    parent_shortname={itemShortnameValue}
    onAttachmentCreated={loadItemData}
  />
{/if}

<!-- Delete Confirmation Modal -->
{#if $showDeleteModal}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={(e) => {
      if (e.target === e.currentTarget) showDeleteModal.set(false);
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') showDeleteModal.set(false);
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Modal Header -->
      <div class="bg-red-50 px-6 py-4 border-b border-red-100 rounded-t-2xl">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <h3
            id="delete-modal-title"
            class="text-lg font-semibold text-gray-900"
          >
            {$_("admin_item_detail.delete_modal.title")}
          </h3>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="px-6 py-5">
        <p class="text-gray-600">
          {$_("admin_item_detail.delete_modal.message", {
            values: { name: itemShortnameValue },
          })}
        </p>
        <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="text-sm text-amber-700">
              {$_("admin_item_detail.delete_modal.warning")}
            </p>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
        <button
          onclick={() => showDeleteModal.set(false)}
          disabled={$isDeleting}
          class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {$_("common.cancel")}
        </button>
        <button
          onclick={confirmDeleteItem}
          disabled={$isDeleting}
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          {#if $isDeleting}
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {$_("common.deleting")}
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {$_("common.delete")}
          {/if}
        </button>
      </div>
    </div>
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

  .admin-post-content-wrapper :global(.content-section) {
    margin: 0 !important;
  }

  .admin-post-content-wrapper :global(.post-content) {
    box-shadow: none !important;
  }

  /* JSON Editor with PlantUML Preview */
  .json-editor-with-preview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    height: 100%;
    min-height: 500px;
  }

  .json-editor-pane {
    overflow: auto;
  }

  .plantuml-preview-pane {
    border-left: 1px solid #e5e7eb;
    padding-left: 20px;
    overflow: auto;
  }

  .preview-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  @media (max-width: 1024px) {
    .json-editor-with-preview {
      grid-template-columns: 1fr;
    }

    .plantuml-preview-pane {
      border-left: none;
      border-top: 1px solid #e5e7eb;
      padding-left: 0;
      padding-top: 20px;
    }
  }

  /* Vertical Form Layout Styles */
  .form-grid-vertical {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-label {
    font-weight: 600;
    font-size: 14px;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .localized-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .localized-field {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .lang-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
    padding: 0 8px;
    background: #e5e7eb;
    color: #374151;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    text-transform: uppercase;
  }

  .localized-field .form-input {
    flex: 1;
  }

  .form-textarea {
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
  }

  /* Tags Input Styles */
  .tag-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tag-input-row {
    display: flex;
    gap: 8px;
  }

  .tag-input {
    flex: 1;
  }

  .add-tag-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
  }

  .add-tag-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .add-tag-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .add-tag-btn .btn-icon {
    width: 16px;
    height: 16px;
  }

  .tags-badges-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
  }

  .tag-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #dbeafe;
    color: #1e40af;
    font-size: 13px;
    font-weight: 500;
    border-radius: 20px;
    transition: background-color 0.2s;
  }

  .tag-badge:hover {
    background: #bfdbfe;
  }

  .tag-remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  .tag-remove-btn:hover {
    background: #3b82f6;
    color: white;
  }

  .tag-remove-btn .remove-icon {
    width: 12px;
    height: 12px;
  }

  /* Status Toggle Simple */
  .status-section {
    padding: 16px;
    background: #f9fafb;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
  }

  .status-toggle-simple {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status-toggle-simple .status-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-toggle-simple .status-label {
    font-weight: 600;
    font-size: 14px;
    color: #374151;
  }

  .status-toggle-simple .status-value {
    font-size: 13px;
    font-weight: 500;
  }

  .status-toggle-simple .status-value.active {
    color: #059669;
  }

  .status-toggle-simple .status-value.inactive {
    color: #dc2626;
  }

  /* Template loading and error states */
  .template-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #6b7280;
  }

  .template-loading .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .template-error {
    padding: 1rem;
  }

  .template-error .error-message {
    color: #dc2626;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .template-error .fallback-data {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .template-error .fallback-data h4 {
    margin: 0 0 0.75rem 0;
    color: #374151;
    font-size: 1rem;
  }

  .template-error .fallback-data dl {
    margin: 0;
  }

  .template-error .fallback-data dt {
    font-weight: 600;
    color: #4b5563;
    margin-top: 0.5rem;
  }

  .template-error .fallback-data dd {
    margin-left: 0;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .template-error .fallback-content {
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
</style>
