<script lang="ts">
  import { goto, params } from "@roxi/routify";
  import {
    deleteEntity,
    getAvatar,
    getEntity,
    getSpaceContents,
  } from "@/lib/dmart_services";
  import { createFolder } from "@/lib/dmart_services/entries";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { Dmart, RequestType, ResourceType, QueryType } from "@edraj/tsdmart";
  import { derived, writable } from "svelte/store";
  import MetaForm from "@/components/forms/MetaForm.svelte";
  import FolderForm from "@/components/forms/FolderForm.svelte";
  import Avatar from "@/components/Avatar.svelte";
  import {formatNumber, getParentPath} from "@/lib/helpers";
  import SchemaForm from "@/components/forms/SchemaForm.svelte";
  import CreateTemplateModal from "@/components/CreateTemplateModal.svelte";
  import WorkflowForm from "@/components/forms/WorkflowForm.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog.svelte";

  $goto;

  let isLoading = writable(false);
  let isLoadingMore = writable(false);
  let allContents = writable([]);
  let displayedContents = $state([]);
  let folderMetadata = $state(null);
  let error = $state(null);
  let spaceName = $state("");
  let subpath = "";
  let actualSubpath = writable("");
  let breadcrumbs = $state([]);

  let currentOffset = $state(0);
  let itemsPerLoad = $state(20);
  let totalItemsCount = $state(0);
  let hasMoreItems = $state(true);
  let isInitialLoad = $state(true);
  let containTemplates = $state(false);
  const itemsPerLoadOptions = [20, 50, 100];

  // let currentDisplayCount = $state(itemsPerLoad);

  let filteredContents = $state([]);

  // Bulk selection state
  let selectedItems = $state(new Set<string>());
  let isBulkDeleting = $state(false);
  let showBulkDeleteConfirm = $state(false);
  let showBulkTrashConfirm = $state(false);

  let searchQuery = $state("");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let selectedType = $state("all");
  let selectedStatus = $state("all");

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  const typeOptions = [
    { value: "all", label: $_("admin_dashboard.filters.all") },
    { value: "folder", label: $_("admin_dashboard.filters.folder") },
    { value: "content", label: $_("admin_dashboard.filters.content") },
    { value: "post", label: $_("admin_dashboard.filters.post") },
    { value: "ticket", label: $_("admin_dashboard.filters.ticket") },
    { value: "user", label: $_("admin_dashboard.filters.user") },
    { value: "media", label: $_("admin_dashboard.filters.media") },
  ];

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

  async function initializeContent() {
    spaceName = $params.space_name;
    subpath = $params.subpath;
    if (!subpath) return;
    $actualSubpath = subpath.replace(/-/g, "/");

    const pathParts = $actualSubpath
      .split("/")
      .filter((part) => part.length > 0);
    breadcrumbs = [
      { name: $_("admin_content.breadcrumb.admin"), path: "/dashboard/admin" },
      { name: spaceName, path: `/dashboard/admin/${spaceName}` },
    ];

    let currentPath = "";
    let currentUrlPath = "";
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      currentUrlPath += (index === 0 ? "" : "-") + part;
      breadcrumbs.push({
        name: part,
        path:
          index === pathParts.length - 1
            ? null
            : `/dashboard/admin/${spaceName}/${currentUrlPath}`,
      });
    });

    currentOffset = 0;
    hasMoreItems = true;
    await loadContents(true);
  }

  let _prevSubpath = "";
  let _prevSpaceName = "";

  $effect(() => {
    const currentSubpath = $params.subpath;
    const currentSpaceName = $params.space_name;

    // Re-initialize whenever the routing params actually change
    if (
      currentSubpath !== _prevSubpath ||
      currentSpaceName !== _prevSpaceName
    ) {
      _prevSubpath = currentSubpath;
      _prevSpaceName = currentSpaceName;
      initializeContent();
    }
  });

  async function loadContents(reset = false) {
    if (reset && $isLoading) return;
    if (!reset && ($isLoadingMore || !hasMoreItems)) return;

    if (reset) {
      $isLoading = true;
      currentOffset = 0;
      $allContents = [];
      filteredContents = [];
      displayedContents = [];
      isInitialLoad = true;
    } else {
      $isLoadingMore = true;
    }

    error = null;

    try {
      if (reset) {
        // Fetch current folder metadata
        const pathParts = $actualSubpath.split("/").filter((p) => p);
        const folderShortname = pathParts.pop();
        const parentPath = "/" + pathParts.join("/");

        if (folderShortname) {
          folderMetadata = await getEntity(
            folderShortname,
            spaceName,
            parentPath,
            ResourceType.folder,
            "managed",
          );
        } else {
          folderMetadata = null;
        }
      }

      const parent = await getSpaceContents(
        spaceName,
        "/",
        "managed",
        100,
        0,
        false,
      );
      for (const item of parent?.records) {
        if (
          item?.attributes?.payload?.body?.content_schema_shortnames?.includes(
            "templates",
          ) &&
          item?.shortname == `${$actualSubpath}`
        ) {
          containTemplates = true;
        }
      }
      const response = await getSpaceContents(
        spaceName,
        `/${$actualSubpath}`,
        "managed",
        itemsPerLoad,
        currentOffset,
        true,
      );

      if (response && response.records) {
        const enhancedItems = await Promise.all(
          response.records.map(async (item) => {
            let avatarUrl = "";
            try {
              const result = getAvatar(item.attributes?.owner_shortname);
              avatarUrl = result instanceof Promise ? await result : result;
            } catch {
              avatarUrl = "";
            }
            return { ...item, avatarUrl };
          }),
        );

        if (reset) {
          $allContents = enhancedItems;
        } else {
          $allContents = [...$allContents, ...enhancedItems];
        }

        currentOffset += itemsPerLoad;
        hasMoreItems = enhancedItems.length === itemsPerLoad;

        if (reset) {
          totalItemsCount = enhancedItems.length;
        }

        applyFilters();
      } else {
        if (reset) {
          $allContents = [];
          filteredContents = [];
          displayedContents = [];
          totalItemsCount = 0;
          hasMoreItems = false;
        }
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = $_("admin_content.error.failed_load_contents");
      if (reset) {
        $allContents = [];
        filteredContents = [];
        displayedContents = [];
        totalItemsCount = 0;
        hasMoreItems = false;
      }
    } finally {
      if (reset) {
        $isLoading = false;
        isInitialLoad = false;
      } else {
        $isLoadingMore = false;
      }
    }
  }

  function applyFilters() {
    let filtered = [...$allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getDisplayName(item).toLowerCase();
        const shortname = item.shortname.toLowerCase();
        const description = getDescription(item).toLowerCase();
        const owner = (item.attributes?.owner_shortname || "").toLowerCase();

        return (
          displayName.includes(query) ||
          shortname.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
      });
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.resource_type === selectedType);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => {
        const isActive = item.attributes?.is_active;
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
        case "type":
          aValue = a.resource_type;
          bValue = b.resource_type;
          break;
        case "owner":
          aValue = (a.attributes?.owner_shortname || "").toLowerCase();
          bValue = (b.attributes?.owner_shortname || "").toLowerCase();
          break;
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.created_at || 0);
          break;
        case "updated":
          aValue = new Date(a.attributes?.updated_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        default:
          aValue = a.shortname.toLowerCase();
          bValue = b.shortname.toLowerCase();
      }

      let result;
      if (aValue > bValue) result = 1;
      else if (aValue < bValue) result = -1;
      else result = 0;

      return sortOrder === "desc" ? -result : result;
    });

    filteredContents = filtered;
    // currentDisplayCount = itemsPerLoad;
    updateDisplayedContents();
  }

  function updateDisplayedContents() {
    displayedContents = filteredContents;
  }

  function loadMoreItems() {
    if ($isLoadingMore || !hasMoreItems) return;
    loadContents(false);
  }

  function handleItemsPerLoadChange(newItemsPerLoad) {
    itemsPerLoad = newItemsPerLoad;
    loadContents(true);
  }

  function handleItemClick(item) {
    if (item.resource_type === "folder") {
      const newSubpath = `${subpath}-${item.shortname}`;
      $goto("/dashboard/admin/[space_name]/[subpath]", {
        space_name: spaceName,
        subpath: newSubpath,
      });
    } else {
      $goto(
        "/dashboard/admin/[space_name]/[subpath]/[shortname]/[resource_type]",
        {
          space_name: spaceName,
          subpath: subpath,
          shortname: item.shortname,
          resource_type: item.resource_type,
        },
      );
    }
  }

  let showCreateTemplateModal = $state(false);

  function handleCreateItem() {
    if (subpath === "templates") {
      $goto("/dashboard/templates", {
        space_name: spaceName,
        subpath: $actualSubpath,
      });
      // showCreateTemplateModal = true;
    } else {
      $goto("/entries/create", {
        space_name: spaceName,
        subpath: $actualSubpath,
      });
    }
  }

  function handleTemplateModalClose() {
    showCreateTemplateModal = false;
    loadContents(true);
  }

  // Delete confirmation dialog state
  let showDeleteDialog = $state(false);
  let itemToDelete: any = $state(null);
  let isDeletingItem = $state(false);

  function openDeleteDialog(item, event) {
    event.stopPropagation();
    itemToDelete = item;
    showDeleteDialog = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
    itemToDelete = null;
    isDeletingItem = false;
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) return;

    isDeletingItem = true;
    try {
      const success = await deleteEntity(
        itemToDelete.shortname,
        spaceName,
        `/${$actualSubpath}`,
        itemToDelete.resource_type,
      );
      if (success) {
        successToastMessage($_("toast.item_deleted"));
        await loadContents(true);
        closeDeleteDialog();
      } else {
        errorToastMessage($_("toast.item_delete_failed"));
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      errorToastMessage($_("toast.item_delete_failed") + ": " + err.message);
    } finally {
      isDeletingItem = false;
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

  function getDescription(item) {
    if (item.attributes?.description) {
      return (
        item.attributes.description.ar || item.attributes.description.en || ""
      );
    }
    return "";
  }

  function formatDate(dateString) {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale);
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} ${$_("catalog_contents.time.minutes_ago")}`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} ${$_("catalog_contents.time.hours_ago")}`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)} ${$_("catalog_contents.time.days_ago")}`;
    return formatDate(dateString);
  }

  function navigateToBreadcrumb(path) {
    if (path) {
      $goto(`/dashboard/admin/[space_name]`, {
        space_name: spaceName,
      });
    }
  }

  function clearFilters() {
    searchQuery = "";
    selectedType = "all";
    selectedStatus = "all";
    sortBy = "name";
    sortOrder = "asc";
    // currentDisplayCount = itemsPerLoad;
    applyFilters();
  }

  // Bulk selection functions
  function toggleItemSelection(shortname: string) {
    if (selectedItems.has(shortname)) {
      selectedItems.delete(shortname);
    } else {
      selectedItems.add(shortname);
    }
    selectedItems = new Set(selectedItems);
  }

  function toggleAllItems() {
    if (selectedItems.size === displayedContents.length) {
      selectedItems.clear();
    } else {
      selectedItems = new Set(displayedContents.map(item => item.shortname));
    }
    selectedItems = new Set(selectedItems);
  }

  function clearSelection() {
    selectedItems.clear();
    selectedItems = new Set();
  }

  async function handleBulkDelete() {
    if (selectedItems.size === 0) return;

    isBulkDeleting = true;
    let successCount = 0;
    let failCount = 0;

    try {
      for (const shortname of selectedItems) {
        const item = displayedContents.find(i => i.shortname === shortname);
        if (item) {
          try {
            const success = await deleteEntity(
              item.shortname,
              spaceName,
              `/${$actualSubpath}`,
              item.resource_type,
            );
            if (success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        successToastMessage($_("admin_content.bulk_actions.delete_success", { count: successCount }));
      }
      if (failCount > 0) {
        errorToastMessage($_("admin_content.bulk_actions.delete_failed", { count: failCount }));
      }

      clearSelection();
      await loadContents(true);
    } catch (err) {
      console.error("Error in bulk delete:", err);
      errorToastMessage($_("admin_content.bulk_actions.delete_error"));
    } finally {
      isBulkDeleting = false;
    }
  }

  async function handleBulkTrash() {
    if (selectedItems.size === 0) return;

    isBulkDeleting = true;
    let successCount = 0;
    let failCount = 0;

    try {
      for (const shortname of selectedItems) {
        const item = displayedContents.find(i => i.shortname === shortname);
        if (item) {
          try {
            // TODO: Replace with actual trashEntity function when available
            const success = await deleteEntity(
              item.shortname,
              spaceName,
              `/${$actualSubpath}`,
              item.resource_type,
            );
            if (success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        successToastMessage($_("admin_content.bulk_actions.trash_success", { count: successCount }));
      }
      if (failCount > 0) {
        errorToastMessage($_("admin_content.bulk_actions.trash_failed", { count: failCount }));
      }

      clearSelection();
      await loadContents(true);
    } catch (err) {
      console.error("Error in bulk trash:", err);
      errorToastMessage($_("admin_content.bulk_actions.trash_error"));
    } finally {
      isBulkDeleting = false;
    }
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    applyFilters();
  }

  function handleCardTagClick(event, tag) {
    event.stopPropagation();
  }

  const filteredContentsDerived = $derived.by(() => {
    let filtered = [...$allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getDisplayName(item).toLowerCase();
        const shortname = item.shortname.toLowerCase();
        const description = getDescription(item).toLowerCase();
        const owner = (item.attributes?.owner_shortname || "").toLowerCase();

        return (
          displayName.includes(query) ||
          shortname.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
      });
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.resource_type === selectedType);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => {
        const isActive = item.attributes?.is_active;
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
        case "type":
          aValue = a.resource_type;
          bValue = b.resource_type;
          break;
        case "owner":
          aValue = (a.attributes?.owner_shortname || "").toLowerCase();
          bValue = (b.attributes?.owner_shortname || "").toLowerCase();
          break;
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.created_at || 0);
          break;
        case "updated":
          aValue = new Date(a.attributes?.updated_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        default:
          aValue = a.shortname.toLowerCase();
          bValue = b.shortname.toLowerCase();
      }

      let result;
      if (aValue > bValue) result = 1;
      else if (aValue < bValue) result = -1;
      else result = 0;

      return sortOrder === "desc" ? -result : result;
    });

    return filtered;
  });

  const displayedContentsDerived = $derived.by(() => {
    return filteredContents;
  });

  const totalItemsDerived = $derived.by(() => filteredContents.length);

  const hasMoreItemsDerived = $derived.by(() => hasMoreItems);

  let isCreatingFolder = $state(false);
  let metaContent: any = $state({});
  let showCreateFolderModal = $state(false);
  let validateMetaForm = $state(null);
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
    event.preventDefault();
    isCreatingFolder = true;

    try {
      const data = {
        shortname: metaContent.shortname || "auto",
        displayname: metaContent.displayname,
        description: metaContent.description,
        folderContent: folderContent,
        is_active: true,
      };
      const response = await createFolder(spaceName, $actualSubpath, data);

      if (response) {
        showCreateFolderModal = false;
        successToastMessage($_("toast.folder_created"));
        await loadContents(true);
      } else {
        errorToastMessage($_("toast.folder_create_failed"));
      }
    } catch (err) {
      console.error("Error creating folder:", err);
      errorToastMessage($_("toast.folder_create_failed") + ": " + err.message);
    } finally {
      isCreatingFolder = false;
    }
  }

  let showCreateSchemaModal = $state(false);
  let schemaContent = $state({});
  let isCreatingSchema = $state(false);
  let showCreateWorkflowModal = $state(false);
  let workflowContent = $state({});
  let isCreatingWorkflow = $state(false);

  // Column Settings
  let showColumnSettingsModal = $state(false);
  let editingIndexAttributes = $state([]);
  let isSavingColumns = $state(false);

  function handleOpenColumnSettings() {
    editingIndexAttributes = JSON.parse(JSON.stringify(indexAttributes));
    if (editingIndexAttributes.length === 0) {
      editingIndexAttributes = [
        { key: "displayname", name: "Display Name" },
        { key: "status", name: "Status" },
        { key: "author", name: "Author" },
        { key: "updated_at", name: "Last Modified" },
      ];
    }
    showColumnSettingsModal = true;
  }

  function addColumnSetting() {
    editingIndexAttributes = [...editingIndexAttributes, { key: "", name: "" }];
  }

  function removeColumnSetting(index) {
    editingIndexAttributes = editingIndexAttributes.filter((_, i) => i !== index);
  }

  async function handleUpdateColumns() {
    isSavingColumns = true;
    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.update,
        records: [
          {
            resource_type: ResourceType.folder,
            shortname: folderMetadata.shortname,
            subpath: getParentPath(subpath),
            attributes: {
              payload: {
                ...folderMetadata?.payload,
                body: {
                  ...folderMetadata?.payload?.body,
                  index_attributes: editingIndexAttributes.filter(
                    (a) => a.key.trim() && a.name.trim(),
                  ),
                },
              },
            },
          },
        ],
      });

      if (response && response.status === "success") {
        showColumnSettingsModal = false;
        successToastMessage($_("toast.folder_updated"));
        await loadContents(true);
      } else {
        errorToastMessage($_("toast.folder_update_failed"));
      }
    } catch (err) {
      console.error("Error updating columns:", err);
      errorToastMessage($_("toast.folder_update_failed") + ": " + err.message);
    } finally {
      isSavingColumns = false;
    }
  }

  function handleCreateSchema() {
    schemaContent = {};
    showCreateSchemaModal = true;
  }

  function handleCreateWorkflow() {
    workflowContent = {
      name: "",
      states: [],
      illustration: "",
      initial_state: [],
    };
    showCreateWorkflowModal = true;
  }

  async function handleSaveschema(event) {
    event.preventDefault();
    isCreatingSchema = true;

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: ResourceType.schema,
            shortname: metaContent.shortname || "auto",
            subpath: `/${$actualSubpath}`,
            attributes: {
              displayname: metaContent.displayname,
              description: metaContent.description,
              payload: {
                body: schemaContent,
                content_type: "json",
              },
              is_active: true,
            },
          },
        ],
      });

      if (response) {
        showCreateSchemaModal = false;
        successToastMessage($_("toast.schema_created"));
        await loadContents(true);
      } else {
        errorToastMessage($_("toast.schema_create_failed"));
      }
    } catch (err) {
      console.error("Error creating schema:", err);
      errorToastMessage($_("toast.schema_create_failed") + ": " + err.message);
    } finally {
      isCreatingSchema = false;
    }
  }

  async function handleSaveWorkflow(event) {
    event.preventDefault();
    isCreatingWorkflow = true;

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
          {
            resource_type: ResourceType.content,
            shortname: metaContent.shortname || "auto",
            subpath: `/${$actualSubpath}`,
            attributes: {
              displayname:
                metaContent.displayname ||
                ({
                  ar: (workflowContent as any).name || "",
                  en: (workflowContent as any).name || "",
                } as any),
              description: metaContent.description || {},
              payload: {
                body: workflowContent,
                content_type: "json",
              },
              is_active: true,
            },
          },
        ],
      });

      if (response) {
        showCreateWorkflowModal = false;
        successToastMessage($_("toast.workflow_created"));
        await loadContents(true);
      } else {
        errorToastMessage($_("toast.workflow_create_failed"));
      }
    } catch (err) {
      console.error("Error creating workflow:", err);
      errorToastMessage($_("toast.workflow_create_failed") + ": " + err.message);
    } finally {
      isCreatingWorkflow = false;
    }
  }
  const indexAttributes = $derived(
    folderMetadata?.payload?.body?.index_attributes || [],
  );

  function getAttributeValue(item, key) {
    if (!item) return "";
    if (!key) return "";
    if (key === "displayname") return getDisplayName(item);
    if (key === "status") {
      return item.attributes?.is_active
        ? $_("admin_content.status.active")
        : $_("admin_content.status.inactive");
    }
    if (key === "author") return item.attributes?.owner_shortname || "Unknown";
    if (key === "updated_at" || key === "created_at") {
      return formatDate(item.attributes?.[key]);
    }

    const findValue = (obj, k) => {
      if (!obj || typeof obj !== "object") return undefined;
      if (obj[k] !== undefined) return obj[k];
      const tk = k.toLowerCase();
      const foundKey = Object.keys(obj).find((ok) => ok.toLowerCase() === tk);
      return foundKey ? obj[foundKey] : undefined;
    };

    let value;
    if (key.includes(".")) {
      const parts = key.split(".");
      let current = item;
      for (const part of parts) {
        current = findValue(current, part);
        if (current === undefined || current === null) break;
      }
      value = current;
    } else {
      value =
        findValue(item.attributes?.payload?.body, key) ??
        findValue(item.attributes?.payload, key) ??
        findValue(item.attributes, key) ??
        findValue(item, key);
    }

    if (value === null || value === undefined) return "";

    if (typeof value === "object" && !Array.isArray(value)) {
      const localized = value[$locale] || value.en || value.ar || value.ku;
      if (localized !== undefined) return String(localized);
      return JSON.stringify(value);
    }

    return String(value);
  }
</script>

<div class="min-h-screen bg-gray-50" class:rtl={$isRTL}>
  <div class="bg-gray-50">
    <div class="container mx-auto px-4 py-8 max-w-6xl">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-4">
          <button
            onclick={() =>
              navigateToBreadcrumb(breadcrumbs[1]?.path || "/dashboard/admin")}
            class="w-10 h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center transition-colors shadow-sm"
            aria-label="Go back"
          >
            <svg
              class="w-5 h-5"
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
                {#each breadcrumbs as crumb, index}
                  <li class="inline-flex items-center">
                    {#if index > 0}
                      <svg
                        class="w-4 h-4 mx-1 text-gray-400"
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
              {$_("admin_content.title", {
                values: {
                  name:
                    breadcrumbs[breadcrumbs.length - 1]?.name ||
                    $actualSubpath.split("/").pop(),
                },
              })}
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-3">
          {#if $actualSubpath !== "/" && $actualSubpath !== ""}
            {#if $actualSubpath !== "schema"}
              <button
                onclick={handleCreateFolder}
                class="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors duration-200 flex items-center gap-2 shadow-sm"
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
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v4m2-2h-4"
                  ></path>
                </svg>
                {$_("admin_content.actions.create_folder")}
              </button>

              <button
                onclick={handleCreateItem}
                class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium transition-colors duration-200 flex items-center gap-2 shadow-sm"
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
                    d="M12 4v16m8-8H4m4-8h8v8H8z"
                  ></path>
                </svg>
                {$_("admin_content.actions.create_new_item")}
              </button>
            {/if}

            {#if $actualSubpath === "schema"}
              <button
                onclick={handleCreateSchema}
                class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
              >
                {$_("admin_content.actions.create_schema")}
              </button>
            {/if}
            {#if $actualSubpath === "workflows"}
              <button
                onclick={handleCreateWorkflow}
                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold transition-colors shadow-sm"
              >
                Workflow
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 pb-12 max-w-6xl">
    {#if $isLoading || isInitialLoad}
      <div class="flex justify-center py-16">
        <Diamonds color="#4f46e5" size="60" unit="px" />
      </div>
    {:else if error}
      <div
        class="bg-white rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-12 text-center max-w-lg mx-auto"
      >
        <div
          class="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8"
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
        <h3 class="text-xl font-bold text-gray-900 mb-2">
          {$_("admin_content.error.title")}
        </h3>
        <p class="text-gray-500 mb-6">{error}</p>
        <button
          onclick={() => loadContents(true)}
          class="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
        >
          {$_("admin_content.error.try_again")}
        </button>
      </div>
    {:else}
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div
          class="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-6"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500"
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Total Items</p>
              <h3 class="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(totalItemsDerived, $locale)}
              </h3>
            </div>
          </div>
        </div>
        <div
          class="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-6"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500"
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Active Items</p>
              <h3 class="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(
                  $allContents.filter((i) => i.attributes?.is_active).length,
                  $locale,
                )}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Container -->
      <div
        class="bg-white rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden"
      >
        <!-- Search and Filters Bar -->
        <div class="p-6 border-b border-gray-100">
          <div
            class="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div class="relative max-w-sm flex-1">
              <div
                class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"
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
                type="text"
                bind:value={searchQuery}
                oninput={() => applyFilters()}
                placeholder={$_("admin_content.search.placeholder")}
                class="block w-full pl-11 pr-10 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
              />
              {#if searchQuery}
                <button
                  onclick={() => {
                    searchQuery = "";
                    applyFilters();
                  }}
                  class="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg
                    class="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors"
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

            <div class="flex flex-wrap items-center gap-3">
              <select
                bind:value={selectedType}
                onchange={() => applyFilters()}
                class="bg-gray-50 border-none text-sm font-medium text-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {#each typeOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>

              <select
                bind:value={selectedStatus}
                onchange={() => applyFilters()}
                class="bg-gray-50 border-none text-sm font-medium text-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {#each statusOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>

              <select
                bind:value={sortBy}
                onchange={() => applyFilters()}
                class="bg-gray-50 border-none text-sm font-medium text-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {#each sortOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>

              <button
                onclick={toggleSortOrder}
                class="p-2.5 bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                title={$_("admin_content.filters.toggle_sort")}
              >
                <svg
                  class="w-5 h-5 {sortOrder === 'desc'
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

              <button
                onclick={handleOpenColumnSettings}
                class="p-2.5 bg-gray-50 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                title="Column Settings"
              >
                <svg
                  class="w-5 h-5"
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
              </button>
            </div>
          </div>
        </div>

        <!-- Bulk Actions Topbar -->
        {#if selectedItems.size > 0}
          <div class="bulk-actions-bar" class:rtl={$isRTL}>
            <div class="bulk-actions-content">
              <div class="bulk-actions-info">
                <span class="bulk-actions-count">
                  {selectedItems.size} {$_("admin_content.bulk_actions.items_selected")}
                </span>
              </div>
              <div class="bulk-actions-buttons">
                <button
                  onclick={clearSelection}
                  class="bulk-btn bulk-btn-secondary"
                  disabled={isBulkDeleting}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {$_("admin_content.bulk_actions.clear_selection")}
                </button>
                <button
                  onclick={() => showBulkTrashConfirm = true}
                  class="bulk-btn bulk-btn-warning"
                  disabled={isBulkDeleting}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {$_("admin_content.bulk_actions.trash")}
                </button>
                <button
                  onclick={() => showBulkDeleteConfirm = true}
                  class="bulk-btn bulk-btn-danger"
                  disabled={isBulkDeleting}
                >
                  {#if isBulkDeleting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {$_("admin_content.bulk_actions.deleting")}
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {$_("admin_content.bulk_actions.delete")}
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        {#if displayedContents.length === 0}
          <div class="text-center py-16">
            <div
              class="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400"
            >
              <svg
                class="w-8 h-8"
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
            <h3 class="text-lg font-bold text-gray-900 mb-2">
              {$_("admin_content.empty.title")}
            </h3>
            <p class="text-gray-500 mb-6">
              {searchQuery || selectedType !== "all" || selectedStatus !== "all"
                ? $_("admin_content.empty.no_matches")
                : $_("admin_content.empty.description")}
            </p>
            {#if searchQuery || selectedType !== "all" || selectedStatus !== "all"}
              <button
                onclick={clearFilters}
                class="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {$_("admin_content.filters.clear_all")}
              </button>
            {/if}
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-gray-50/50 border-b border-gray-100">
                  <th class="px-4 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedItems.size > 0 && selectedItems.size === displayedContents.length}
                      indeterminate={selectedItems.size > 0 && selectedItems.size < displayedContents.length}
                      onchange={toggleAllItems}
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      aria-label={$_("admin_content.bulk_actions.select_all")}
                    />
                  </th>
                  {#if indexAttributes && indexAttributes.length > 0 && indexAttributes.some(attr => attr && Object.keys(attr).length > 0)}
                    {#each indexAttributes as attr}
                      <th
                        class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {attr.name}
                      </th>
                    {/each}
                  {:else}
                    <th
                      class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >Shortname</th
                    >
                    <th
                      class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >Schema</th
                    >
                    <th
                      class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >Status</th
                    >
                    <th
                      class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >Created At</th
                    >
                    <th
                      class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >Updated At</th
                    >
                  {/if}
                  <th
                    class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >Actions</th
                  >
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                {#each displayedContents as item}
                  <tr
                    class="hover:bg-gray-50/50 transition-colors group cursor-pointer {selectedItems.has(item.shortname) ? 'bg-indigo-50/30' : ''}"
                    onclick={() => handleItemClick(item)}
                  >
                    <td class="px-4 py-4" onclick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.shortname)}
                        onchange={() => toggleItemSelection(item.shortname)}
                        class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        aria-label={$_("admin_content.bulk_actions.select_item", { name: getDisplayName(item) })}
                      />
                    </td>
                    {#if indexAttributes && indexAttributes.length > 0 && indexAttributes.some(attr => attr && Object.keys(attr).length > 0)}
                      {#each indexAttributes as attr}
                        <td class="px-6 py-4">
                          {#if attr.key === "displayname"}
                            <div class="flex flex-col">
                              <span
                                class="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1.5 {getResourceTypeColor(
                                  item.resource_type,
                                )}"
                              >
                                {item.resource_type}
                              </span>
                              <div class="flex items-center gap-2">
                                <span class="text-lg text-gray-400"
                                  >{getItemIcon(item)}</span
                                >
                                <span
                                  class="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs"
                                  >{getDisplayName(item)}</span
                                >
                              </div>
                            </div>
                          {:else if attr.key === "status"}
                            <span
                              class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium {item
                                .attributes?.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'}"
                            >
                              <span
                                class="w-1.5 h-1.5 rounded-full {item.attributes
                                  ?.is_active
                                  ? 'bg-emerald-500'
                                  : 'bg-red-500'} mr-1.5"
                              ></span>
                              {item.attributes?.is_active
                                ? $_("admin_content.status.active")
                                : $_("admin_content.status.inactive")}
                            </span>
                          {:else if attr.key === "author"}
                            <div class="flex items-center gap-2">
                              {#if item.attributes?.owner_shortname}
                                {#await getAvatar(item.attributes?.owner_shortname) then avatar}
                                  {#if typeof avatar === "string" && avatar.trim() !== ""}
                                    <img
                                      src={avatar}
                                      alt={item.attributes?.owner_shortname}
                                      class="w-6 h-6 rounded-full object-cover"
                                    />
                                  {:else}
                                    <div
                                      class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600"
                                    >
                                      {item.attributes?.owner_shortname
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                  {/if}
                                {:catch}
                                  <div
                                    class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600"
                                  >
                                    {item.attributes?.owner_shortname
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                {/await}
                                <span class="text-sm font-medium text-gray-700"
                                  >{item.attributes?.owner_shortname}</span
                                >
                              {:else}
                                <div
                                  class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-400"
                                >
                                  ?
                                </div>
                                <span class="text-sm text-gray-500"
                                  >{$_("common.unknown")}</span
                                >
                              {/if}
                            </div>
                          {:else}
                            <span class="text-sm text-gray-500 font-medium"
                              >{getAttributeValue(item, attr.key)}</span
                            >
                          {/if}
                        </td>
                      {/each}
                    {:else}
                      <td class="px-6 py-4">
                        <div class="flex flex-col">
                          <span
                            class="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1.5 {getResourceTypeColor(
                              item.resource_type,
                            )}"
                          >
                            {item.resource_type}
                          </span>
                          <div class="flex items-center gap-2">
                            <span class="text-lg text-gray-400"
                              >{getItemIcon(item)}</span
                            >
                            <span
                              class="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs"
                              >{item.shortname}</span
                            >
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="text-sm text-gray-500 font-medium"
                          >{item.attributes?.schema_shortname || "-"}</span
                        >
                      </td>
                      <td class="px-6 py-4">
                        <span
                          class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium {item
                            .attributes?.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'}"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full {item.attributes
                              ?.is_active
                              ? 'bg-emerald-500'
                              : 'bg-red-500'} mr-1.5"
                          ></span>
                          {item.attributes?.is_active
                            ? $_("admin_content.status.active")
                            : $_("admin_content.status.inactive")}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <span class="text-sm text-gray-500 font-medium"
                          >{formatDate(item.attributes?.created_at)}</span
                        >
                      </td>
                      <td class="px-6 py-4">
                        <span class="text-sm text-gray-500 font-medium"
                          >{formatDate(item.attributes?.updated_at)}</span
                        >
                      </td>
                    {/if}
                    <td class="px-6 py-4">
                      <div
                        class="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {#if item.resource_type === "folder"}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            class="text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5"
                          >
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              ></path></svg
                            > Open
                          </button>
                        {:else}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            class="text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5"
                          >
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              ></path><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              ></path></svg
                            > View
                          </button>
                        {/if}
                        <button
                          onclick={(e) => openDeleteDialog(item, e)}
                          class="text-[12px] font-semibold text-red-500 hover:text-red-700 flex items-center gap-1.5"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path></svg
                          > Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if hasMoreItemsDerived}
            <div class="p-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onclick={loadMoreItems}
                disabled={$isLoadingMore}
                class="w-full py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
              >
                {$isLoadingMore
                  ? $_("admin_content.infinite_scroll.loading")
                  : $_("admin_content.infinite_scroll.load_more")}
              </button>
            </div>
          {:else if displayedContents.length > 0}
            <div
              class="p-4 border-t border-gray-100 bg-gray-50 text-center text-sm font-medium text-gray-500"
            >
              {$_("admin_content.infinite_scroll.end_of_results")} ({totalItemsDerived}
              total)
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Bulk Delete Confirmation Dialog -->
{#if showBulkDeleteConfirm}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.bulk_actions.confirm_delete_title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.bulk_actions.confirm_delete_message", { count: selectedItems.size })}
          </p>
        </div>
        <button
          onclick={() => showBulkDeleteConfirm = false}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-footer">
        <button
          onclick={() => showBulkDeleteConfirm = false}
          class="btn btn-secondary"
          disabled={isBulkDeleting}
        >
          {$_("common.cancel")}
        </button>
        <button
          onclick={async () => {
            showBulkDeleteConfirm = false;
            await handleBulkDelete();
          }}
          class="btn btn-danger"
          disabled={isBulkDeleting}
        >
          {#if isBulkDeleting}
            <div class="spinner"></div>
            {$_("admin_content.bulk_actions.deleting")}
          {:else}
            {$_("admin_content.bulk_actions.confirm_delete")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Bulk Trash Confirmation Dialog -->
{#if showBulkTrashConfirm}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.bulk_actions.confirm_trash_title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.bulk_actions.confirm_trash_message", { count: selectedItems.size })}
          </p>
        </div>
        <button
          onclick={() => showBulkTrashConfirm = false}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-footer">
        <button
          onclick={() => showBulkTrashConfirm = false}
          class="btn btn-secondary"
          disabled={isBulkDeleting}
        >
          {$_("common.cancel")}
        </button>
        <button
          onclick={async () => {
            showBulkTrashConfirm = false;
            await handleBulkTrash();
          }}
          class="btn btn-warning"
          disabled={isBulkDeleting}
        >
          {#if isBulkDeleting}
            <div class="spinner"></div>
            {$_("admin_content.bulk_actions.trashing")}
          {:else}
            {$_("admin_content.bulk_actions.confirm_trash")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCreateFolderModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.modal.create.title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
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

      <div class="modal-content">
        <div class="form-section">
          <div class="section-header" class:text-right={$isRTL}>
            <h4 class="section-title">
              {$_("admin_content.modal.basic_info.title")}
            </h4>
            <p class="section-description">
              {$_("admin_content.modal.basic_info.description")}
            </p>
          </div>
          <MetaForm
            bind:formData={metaContent}
            bind:validateFn={validateMetaForm}
            isCreate={true}
            fullWidth={true}
          />
        </div>

        <div class="form-section">
          <div class="section-header" class:text-right={$isRTL}>
            <h4 class="section-title">
              {$_("admin_content.modal.folder_config.title")}
            </h4>
            <p class="section-description">
              {$_("admin_content.modal.folder_config.description")}
            </p>
          </div>
          <FolderForm
            bind:content={folderContent}
            space_name={spaceName}
            on:submit={handleSaveFolder}
          />
        </div>
      </div>

      <div class="modal-footer" class:flex-row-reverse={$isRTL}>
        <button
          type="button"
          onclick={() => (showCreateFolderModal = false)}
          class="btn btn-secondary"
          disabled={isCreatingFolder}
        >
          {$_("admin_content.modal.cancel")}
        </button>
        <button
          onclick={handleSaveFolder}
          class="btn btn-primary"
          disabled={isCreatingFolder}
        >
          {#if isCreatingFolder}
            <div class="spinner"></div>
            {$_("admin_content.modal.creating")}
          {:else}
            {$_("admin_content.modal.create_folder")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCreateSchemaModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.modal.create.title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateSchemaModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
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

      <form
        onsubmit={(event) => {
          event.preventDefault();
          handleSaveschema(event);
        }}
      >
        <div class="modal-content">
          <div class="form-section">
            <div class="section-header" class:text-right={$isRTL}>
              <h4 class="section-title">
                {$_("admin_content.modal.basic_info.title")}
              </h4>
              <p class="section-description">
                {$_("admin_content.modal.basic_info.description")}
              </p>
            </div>
            <MetaForm
              bind:formData={metaContent}
              bind:validateFn={validateMetaForm}
              isCreate={true}
              fullWidth={true}
            />
          </div>

          <div class="form-section">
            <div class="section-header" class:text-right={$isRTL}>
              <h4 class="section-title">Schema Definition</h4>
              <p class="section-description">
                Define the JSON schema structure for this resource.
              </p>
            </div>
            <SchemaForm bind:content={schemaContent} />
          </div>
        </div>

        <div class="modal-footer" class:flex-row-reverse={$isRTL}>
          <button
            type="button"
            onclick={() => (showCreateSchemaModal = false)}
            class="btn btn-secondary"
            disabled={isCreatingSchema}
          >
            {$_("admin_content.modal.cancel")}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isCreatingSchema}
          >
            {#if isCreatingSchema}
              <div class="spinner"></div>
              {$_("admin_content.modal.creating")}
            {:else}
              {$_("admin_content.actions.create_schema")}
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showCreateWorkflowModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">{$_("admin_content.modal.create.title")}</h3>
          <p class="modal-subtitle">
            {$_("admin_content.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateWorkflowModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_content.modal.close")}
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

      <form
        onsubmit={(event) => {
          event.preventDefault();
          handleSaveWorkflow(event);
        }}
      >
        <div class="modal-content">
          <div class="form-section">
            <div class="section-header" class:text-right={$isRTL}>
              <h4 class="section-title">
                {$_("admin_content.modal.basic_info.title")}
              </h4>
              <p class="section-description">
                {$_("admin_content.modal.basic_info.description")}
              </p>
            </div>
            <MetaForm
              bind:formData={metaContent}
              bind:validateFn={validateMetaForm}
              isCreate={true}
              fullWidth={true}
            />
          </div>

          <div class="form-section">
            <div class="section-header" class:text-right={$isRTL}>
              <h4 class="section-title">Workflow Definition</h4>
              <p class="section-description">
                Define the workflow states and transitions.
              </p>
            </div>
            <WorkflowForm bind:content={workflowContent} />
          </div>
        </div>

        <div class="modal-footer" class:flex-row-reverse={$isRTL}>
          <button
            type="button"
            onclick={() => (showCreateWorkflowModal = false)}
            class="btn btn-secondary"
            disabled={isCreatingWorkflow}
          >
            {$_("admin_content.modal.cancel")}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isCreatingWorkflow}
          >
            {#if isCreatingWorkflow}
              <div class="spinner"></div>
              {$_("admin_content.modal.creating")}
            {:else}
              {$_("admin_content.actions.create_workflow")}
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Column Settings Modal -->
{#if showColumnSettingsModal}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
  >
    <div
      class="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 modal-container"
    >
      <div
        class="p-6 border-b border-gray-100 flex items-center justify-between bg-white modal-header"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              ></path>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              ></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Column Settings</h2>
        </div>
        <button
          onclick={() => (showColumnSettingsModal = false)}
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors modal-close-btn"
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

      <div class="p-6 max-h-[60vh] overflow-y-auto bg-gray-50/30 modal-content">
        <div class="space-y-4">
          {#each editingIndexAttributes as attr, i}
            <div
              class="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
            >
              <div class="flex-1 grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label
                    class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1"
                    >Label Name</label
                  >
                  <input
                    type="text"
                    bind:value={attr.name}
                    placeholder="e.g. Server Name"
                    class="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div class="space-y-1.5">
                  <label
                    class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1"
                    >Data Key</label
                  >
                  <input
                    type="text"
                    bind:value={attr.key}
                    placeholder="e.g. server_name"
                    class="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
              <button
                onclick={() => removeColumnSetting(i)}
                class="mt-6 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove Column"
              >
                <svg
                  class="w-5 h-5"
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
          {/each}
        </div>

        <button
          onclick={addColumnSetting}
          class="w-full mt-6 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2"
        >
          <svg
            class="w-5 h-5"
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
          Add New Column
        </button>
      </div>

      <div
        class="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-white modal-footer"
      >
        <button
          onclick={() => (showColumnSettingsModal = false)}
          class="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          {$_("common.cancel")}
        </button>
        <button
          onclick={handleUpdateColumns}
          disabled={isSavingColumns}
          class="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {#if isSavingColumns}
            <div
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
            {$_("common.saving") || "Saving..."}
          {:else}
            {$_("common.save_changes") || "Save Changes"}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<DeleteConfirmationDialog
  bind:open={showDeleteDialog}
  title={$_("delete")}
  itemName={itemToDelete ? getDisplayName(itemToDelete) : ""}
  itemType={itemToDelete?.resource_type || "item"}
  isDeleting={isDeletingItem}
  onConfirm={handleConfirmDelete}
  onCancel={closeDeleteDialog}
/>

<style>
  .rtl {
    direction: rtl;
  }

  .rtl .header-content {
    text-align: right;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
  }

  .rtl .search-icon {
    left: auto;
    right: 0.75rem;
  }

  .rtl .search-input {
    padding: 0.75rem 2.75rem 0.75rem 1rem;
    text-align: right;
  }

  .search-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .rtl .clear-search-button {
    right: auto;
    left: 0.75rem;
  }

  .clear-search-button:hover {
    color: #6b7280;
    background-color: rgba(107, 114, 128, 0.1);
  }

  .rtl .filter-controls {
    flex-direction: row-reverse;
  }


  .rtl .filter-label {
    text-align: right;
  }

  .rtl .filter-select {
    text-align: right;
  }


  .rtl .sort-controls {
    flex-direction: row-reverse;
  }

  .sort-select {
    flex: 1;
  }

  .admin-content-card:hover .card-title {
    color: #2563eb;
  }

  /* Modal Styles */
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
    overflow: scroll;
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 80rem;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    border-radius: 16px 16px 0 0;
    flex-shrink: 0;
  }

  .rtl .modal-header {
    flex-direction: row-reverse;
  }

  .modal-header-content {
    flex: 1;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .modal-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .modal-close-btn {
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
    flex-shrink: 0;
  }

  .modal-close-btn:hover {
    background: #f3f4f6;
    color: #374151;
    transform: scale(1.05);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-height: 0;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.75rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
    border-radius: 0 0 16px 16px;
    flex-shrink: 0;
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
    min-width: 120px;
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
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
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

  @media (min-width: 640px) {
    .search-filter-controls {
      flex-direction: column;
      gap: 1.5rem;
    }

    .search-input-group {
      flex: 2;
    }

    .filter-controls {
      flex: 1;
      justify-content: flex-start;
    }

    .rtl .filter-controls {
      justify-content: flex-end;
    }

    .results-summary {
      flex-direction: row;
    }
  }
  @media (max-width: 1024px) {
    .modal-container {
      max-width: 95vw;
      margin: 0.5rem;
    }

    .modal-header {
      padding: 1rem 1.5rem;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .search-filter-controls {
      gap: 1rem;
    }

    .filter-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .rtl .filter-controls {
      flex-direction: column;
    }

    .filter-group {
      min-width: auto;
    }

    .results-summary {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }

    .rtl .results-summary {
      align-items: flex-end;
    }

    .admin-content-card {
      padding: 1rem;
      gap: 0.75rem;
    }

    .card-avatar .avatar-fallback,
    .card-avatar .avatar-unknown {
      width: 2.5rem;
      height: 2.5rem;
    }

    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .rtl .card-header {
      align-items: flex-end;
    }

    .card-actions {
      align-items: stretch;
    }

    .action-buttons {
      justify-content: center;
    }

    .load-more-button {
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
    }

    .modal-container {
      max-width: 95vw;
      margin: 0.5rem;
    }

    .modal-header {
      padding: 1rem 1.5rem;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .modal-container {
      max-width: 100vw;
      max-height: 100vh;
      margin: 0;
      border-radius: 0;
    }

    .modal-header {
      padding: 1rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .rtl .modal-header {
      align-items: flex-end;
    }

    .modal-header-content {
      flex: none;
      width: 100%;
    }

    .modal-close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }

    .rtl .modal-close-btn {
      right: auto;
      left: 1rem;
    }

    .modal-content {
      padding: 1rem;
    }

    .modal-footer {
      padding: 1rem;
      flex-direction: column-reverse;
    }

    .rtl .modal-footer {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }

  .modal-content::-webkit-scrollbar {
    width: 8px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Bulk Actions Bar */
  .bulk-actions-bar {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 0.875rem 1.25rem;
    margin: 1rem 0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .bulk-actions-bar.rtl {
    direction: rtl;
  }

  .bulk-actions-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .bulk-actions-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .bulk-actions-count {
    color: #1f2937;
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .bulk-actions-buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .bulk-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
    cursor: pointer;
    border: none;
  }

  .bulk-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .bulk-btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
  }

  .bulk-btn-secondary:hover:not(:disabled) {
    background-color: #e5e7eb;
  }

  .bulk-btn-warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(217, 119, 6, 0.2);
  }

  .bulk-btn-warning:hover:not(:disabled) {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(217, 119, 6, 0.3);
  }

  .bulk-btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
  }

  .bulk-btn-danger:hover:not(:disabled) {
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
  }

  /* Row selection highlight */
  tr.bg-indigo-50\/30 {
    background-color: rgba(238, 242, 255, 0.5);
  }

  /* Button styles for modal */
  .btn-warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(217, 119, 6, 0.2);
  }

  .btn-warning:hover:not(:disabled) {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(217, 119, 6, 0.3);
  }

  @media (max-width: 640px) {
    .bulk-actions-content {
      flex-direction: column;
      align-items: stretch;
    }

    .bulk-actions-buttons {
      justify-content: stretch;
    }

    .bulk-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>
