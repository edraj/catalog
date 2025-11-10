<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { ResourceType, ContentType } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    PlusOutline,
    EditOutline,
    TrashBinOutline,
  } from "flowbite-svelte-icons";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let categories = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedCategory = $state(null);
  let selectedParentFilter = $state("all");
  let expandedCategories = $state(new Set());

  let categoryForm = $state({
    displayname: "",
    description: "",
    parent_category_id: "",
    tags: [],
  });

  onMount(async () => {
    await loadCategories();
  });

  async function loadCategories() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "Ecommerce",
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        categories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Failed to load categories");
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    categoryForm = {
      displayname: "",
      description: "",
      parent_category_id: "",
      tags: [],
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(category) {
    selectedCategory = category;
    const content =
      category.attributes?.payload?.body?.content ||
      category.attributes?.payload?.body;
    categoryForm = {
      displayname: getLocalizedDisplayName(category),
      description: content?.description || "",
      parent_category_id: content?.parent_category_id || "",
      tags: category.attributes?.tags || [],
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedCategory = null;
  }

  function openDeleteModal(category) {
    selectedCategory = category;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedCategory = null;
  }

  async function handleCreateCategory() {
    if (!categoryForm.displayname.trim()) {
      errorToastMessage("Please enter a category name");
      return;
    }

    try {
      const categoryData = {
        displayname: categoryForm.displayname,
        description: categoryForm.description,
        body: {
          content: {
            name: categoryForm.displayname,
            description: categoryForm.description,
            parent_category_id: categoryForm.parent_category_id || null,
          },
          content_type: "json",
        },
        tags: categoryForm.tags,
        is_active: true,
      };

      await createEntity(
        categoryData,
        "Ecommerce",
        "/categories",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Category created successfully!");
      closeCreateModal();
      await loadCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      errorToastMessage("Failed to create category");
    }
  }

  async function handleUpdateCategory() {
    if (!categoryForm.displayname.trim()) {
      errorToastMessage("Please enter a category name");
      return;
    }

    if (!selectedCategory) return;

    try {
      const categoryData = {
        displayname: categoryForm.displayname,
        description: categoryForm.description,
        content: {
          name: categoryForm.displayname,
          description: categoryForm.description,
          parent_category_id: categoryForm.parent_category_id || null,
        },
        content_type: "json",
        tags: categoryForm.tags,
        is_active: true,
      };

      await updateEntity(
        selectedCategory.shortname,
        "Ecommerce",
        selectedCategory.subpath,
        selectedCategory.resource_type,
        categoryData,
        "",
        ""
      );

      successToastMessage("Category updated successfully!");
      closeEditModal();
      await loadCategories();
    } catch (error) {
      console.error("Error updating category:", error);
      errorToastMessage("Failed to update category");
    }
  }

  async function handleDeleteCategory() {
    if (!selectedCategory) return;

    try {
      await deleteEntity(
        selectedCategory.shortname,
        "Ecommerce",
        selectedCategory.subpath,
        selectedCategory.resource_type
      );

      successToastMessage("Category deleted successfully!");
      closeDeleteModal();
      await loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      errorToastMessage("Failed to delete category");
    }
  }

  function getLocalizedDisplayName(item) {
    const displayname = item?.attributes?.displayname;

    if (!displayname) {
      return item?.shortname || "Untitled";
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item?.shortname || "Untitled";
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString($locale);
  }

  function getCategoryParentId(category) {
    const content =
      category.attributes?.payload?.body?.content ||
      category.attributes?.payload?.body;
    return content?.parent_category_id || null;
  }

  function getParentCategoryName(parentId) {
    if (!parentId) return null;
    const parent = categories.find((c) => c.shortname === parentId);
    return parent ? getLocalizedDisplayName(parent) : parentId;
  }

  function isParentCategory(category) {
    return !getCategoryParentId(category);
  }

  function getSubCategories(parentId) {
    return categories.filter((c) => getCategoryParentId(c) === parentId);
  }

  function toggleCategory(categoryId) {
    console.log("Toggling category:", categoryId);
    if (expandedCategories.has(categoryId)) {
      expandedCategories.delete(categoryId);
      expandedCategories = new Set(expandedCategories);
    } else {
      expandedCategories.add(categoryId);
      expandedCategories = new Set(expandedCategories);
    }
    console.log("Expanded categories:", expandedCategories);
  }

  function isExpanded(categoryId) {
    return expandedCategories.has(categoryId);
  }

  const parentCategories = $derived.by(() => {
    return categories.filter((c) => isParentCategory(c));
  });

  const filteredCategories = $derived.by(() => {
    if (selectedParentFilter === "all") {
      return parentCategories;
    } else if (selectedParentFilter === "root") {
      return parentCategories;
    } else {
      return categories.filter(
        (c) => getCategoryParentId(c) === selectedParentFilter
      );
    }
  });
</script>

<div class="categories-page" class:rtl={$isRTL}>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1 class="page-title">
          {$_("admin_dashboard.categories") || "Categories"}
        </h1>
        <p class="page-description">
          {$_("admin_dashboard.categories_description") ||
            "Manage your product categories"}
        </p>
      </div>
      <button class="btn-create" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span>{$_("admin_dashboard.create_category") || "New Category"}</span>
      </button>
    </div>

    {#if !isLoading && categories.length > 0}
      <div class="filters">
        <label for="parent-filter"
          >{$_("common.filter_by_parent") || "Filter by Parent"}:</label
        >
        <select
          id="parent-filter"
          bind:value={selectedParentFilter}
          class="filter-select"
        >
          <option value="all"
            >{$_("common.all_categories") || "All Categories"}</option
          >
          <option value="root"
            >{$_("common.parent_categories_only") ||
              "Parent Categories Only"}</option
          >
          {#each parentCategories as parent}
            <option value={parent.shortname}
              >{getLocalizedDisplayName(parent)} ({$_(
                "common.sub_categories"
              ) || "Sub-categories"})</option
            >
          {/each}
        </select>
      </div>
    {/if}

    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if categories.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>{$_("admin_dashboard.no_categories") || "No categories yet"}</h3>
        <p>Create your first category to get started</p>
        <button class="btn-create-large" onclick={openCreateModal}>
          <PlusOutline size="sm" />
          {$_("admin_dashboard.create_first_category") || "Create Category"}
        </button>
      </div>
    {:else}
      <div class="categories-list">
        <div class="list-header">
          <div class="list-col col-name">Name</div>
          <div class="list-col col-description">Description</div>
          <div class="list-col col-date">Created</div>
          <div class="list-col col-actions">Actions</div>
        </div>
        {#each filteredCategories as category}
          {@const subCategories = getSubCategories(category.shortname)}
          {@const hasSubCategories = subCategories.length > 0}
          {@const expanded = isExpanded(category.shortname)}

          <!-- Parent Category Row -->
          <div
            class="list-row"
            class:has-children={hasSubCategories}
            class:sub-category={!isParentCategory(category)}
          >
            <div class="list-col col-name">
              <div class="name-content">
                {#if hasSubCategories}
                  <button
                    class="expand-button"
                    onclick={() => toggleCategory(category.shortname)}
                    title={expanded ? "Collapse" : "Expand"}
                  >
                    <span class="expand-icon" class:expanded>▶</span>
                  </button>
                {:else if !isParentCategory(category)}
                  <span class="sub-category-icon">↳</span>
                {/if}
                <div class="name-wrapper">
                  <span class="category-name"
                    >{getLocalizedDisplayName(category)}</span
                  >
                  <span class="category-shortname">{category.shortname}</span>
                </div>
                {#if hasSubCategories}
                  <span class="sub-count-badge">{subCategories.length}</span>
                {/if}
              </div>
            </div>
            <div class="list-col col-description">
              {category.attributes?.payload.body.content.description ||
                "No description"}
            </div>
            <div class="list-col col-date">
              {formatDate(category.attributes?.created_at)}
            </div>
            <div class="list-col col-actions">
              <button
                class="btn-icon"
                onclick={() => openEditModal(category)}
                title="Edit"
              >
                <EditOutline size="sm" />
              </button>
              <button
                class="btn-icon btn-delete"
                onclick={() => openDeleteModal(category)}
                title="Delete"
              >
                <TrashBinOutline size="sm" />
              </button>
            </div>
          </div>

          <!-- Sub-Categories (Collapsible) -->
          {#if hasSubCategories && expanded}
            {#each subCategories as subCategory}
              <div class="list-row sub-category">
                <div class="list-col col-name">
                  <div class="name-content">
                    <span class="sub-category-icon">↳</span>
                    <div class="name-wrapper">
                      <span class="category-name"
                        >{getLocalizedDisplayName(subCategory)}</span
                      >
                      <span class="category-shortname"
                        >{subCategory.shortname}</span
                      >
                    </div>
                  </div>
                </div>
                <div class="list-col col-description">
                  {subCategory.attributes?.payload.body.content.description ||
                    "No description"}
                </div>
                <div class="list-col col-date">
                  {formatDate(subCategory.attributes?.created_at)}
                </div>
                <div class="list-col col-actions">
                  <button
                    class="btn-icon"
                    onclick={() => openEditModal(subCategory)}
                    title="Edit"
                  >
                    <EditOutline size="sm" />
                  </button>
                  <button
                    class="btn-icon btn-delete"
                    onclick={() => openDeleteModal(subCategory)}
                    title="Delete"
                  >
                    <TrashBinOutline size="sm" />
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin_dashboard.create_category") || "Create Category"}</h2>
        <button class="modal-close" onclick={closeCreateModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="category-name"
            >{$_("common.name") || "Name"}
            <span class="required">*</span></label
          >
          <input
            id="category-name"
            type="text"
            bind:value={categoryForm.displayname}
            placeholder={$_("admin_dashboard.enter_category_name") ||
              "Enter category name"}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="parent-category"
            >{$_("common.parent_category") || "Parent Category"} ({$_(
              "common.optional"
            ) || "Optional"})</label
          >
          <select
            id="parent-category"
            bind:value={categoryForm.parent_category_id}
            class="form-input"
          >
            <option value=""
              >{$_("common.none_top_level") ||
                "None (Top-level category)"}</option
            >
            {#each parentCategories as parent}
              <option value={parent.shortname}
                >{getLocalizedDisplayName(parent)}</option
              >
            {/each}
          </select>
          <p class="form-hint">
            {$_("admin_dashboard.parent_category_hint") ||
              "Select a parent category to make this a sub-category"}
          </p>
        </div>
        <div class="form-group">
          <label for="category-description"
            >{$_("common.description") || "Description"}</label
          >
          <textarea
            id="category-description"
            bind:value={categoryForm.description}
            placeholder={$_("admin_dashboard.enter_category_description") ||
              "Enter category description"}
            class="form-textarea"
            rows="4"
          ></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeCreateModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleCreateCategory}>
          {$_("common.create") || "Create Category"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin_dashboard.edit_category") || "Edit Category"}</h2>
        <button class="modal-close" onclick={closeEditModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="edit-category-name"
            >{$_("common.name") || "Name"}
            <span class="required">*</span></label
          >
          <input
            id="edit-category-name"
            type="text"
            bind:value={categoryForm.displayname}
            placeholder={$_("admin_dashboard.enter_category_name") ||
              "Enter category name"}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="edit-parent-category"
            >{$_("common.parent_category") || "Parent Category"} ({$_(
              "common.optional"
            ) || "Optional"})</label
          >
          <select
            id="edit-parent-category"
            bind:value={categoryForm.parent_category_id}
            class="form-input"
          >
            <option value=""
              >{$_("common.none_top_level") ||
                "None (Top-level category)"}</option
            >
            {#each parentCategories.filter((p) => p.shortname !== selectedCategory?.shortname) as parent}
              <option value={parent.shortname}
                >{getLocalizedDisplayName(parent)}</option
              >
            {/each}
          </select>
          <p class="form-hint">
            {$_("admin_dashboard.parent_category_hint") ||
              "Select a parent category to make this a sub-category"}
          </p>
        </div>
        <div class="form-group">
          <label for="edit-category-description"
            >{$_("common.description") || "Description"}</label
          >
          <textarea
            id="edit-category-description"
            bind:value={categoryForm.description}
            placeholder={$_("admin_dashboard.enter_category_description") ||
              "Enter category description"}
            class="form-textarea"
            rows="4"
          ></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeEditModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleUpdateCategory}>
          {$_("common.save") || "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div class="modal-container small" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("common.confirm_delete") || "Delete Category"}</h2>
        <button class="modal-close" onclick={closeDeleteModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="delete-warning">
          <div class="warning-icon">⚠️</div>
          <p>
            {$_("admin_dashboard.delete_category_confirm") ||
              "Are you sure you want to delete this category?"}
          </p>
          <p class="category-name-highlight">
            {getLocalizedDisplayName(selectedCategory)}
          </p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" onclick={handleDeleteCategory}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .categories-page {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 2rem 1rem;
  }

  .rtl {
    direction: rtl;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .page-description {
    font-size: 0.95rem;
    color: #6b7280;
    margin: 0;
  }

  .btn-create {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-create:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .btn-create-large {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-create-large:hover {
    background: #1d4ed8;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
    background: white;
    border-radius: 1rem;
    padding: 3rem;
  }

  .empty-state {
    text-align: center;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: #6b7280;
    margin: 0 0 1.5rem 0;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-state p {
    color: #6b7280;
    font-size: 0.95rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    background: white;
    padding: 1rem 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
  }

  .filters label {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    color: #1a1a1a;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 220px;
  }

  .filter-select:hover {
    border-color: #9ca3af;
  }

  .filter-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .categories-list {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    background: #f9fafb;
    padding: 1rem;
    border-bottom: 2px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .list-row {
    display: flex;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    transition: background-color 0.15s;
    align-items: center;
  }

  .list-row:last-child {
    border-bottom: none;
  }

  .list-row:hover {
    background: #f9fafb;
  }

  .list-row.sub-category {
    background: #f8faff;
  }

  .list-row.sub-category:hover {
    background: #eff6ff;
  }

  .list-row.has-children {
    font-weight: 500;
  }

  .list-col {
    padding: 0 0.5rem;
    font-size: 0.875rem;
  }

  .col-name {
    flex: 0 0 25%;
    min-width: 0;
  }

  .col-description {
    flex: 0 0 40%;
    min-width: 0;
    color: #6b7280;
    line-height: 1.5;
  }

  .col-date {
    flex: 0 0 17%;
    min-width: 0;
    color: #6b7280;
    font-size: 0.8rem;
  }

  .col-actions {
    flex: 0 0 15%;
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .name-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .expand-button {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    transition: all 0.2s ease;
    border-radius: 0.25rem;
  }

  .expand-button:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .expand-icon {
    font-size: 0.75rem;
    transition: transform 0.2s ease;
    display: inline-block;
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .sub-category-icon {
    color: #2563eb;
    font-size: 1.2rem;
    font-weight: bold;
    flex-shrink: 0;
  }

  .name-wrapper {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .category-name {
    display: block;
    font-weight: 600;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .category-shortname {
    display: block;
    font-size: 0.75rem;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: 0.5rem;
  }

  @media (max-width: 1024px) {
    .col-description {
      flex: 0 0 30%;
    }

    .col-name {
      flex: 0 0 28%;
    }
  }

  @media (max-width: 768px) {
    .categories-list {
      overflow-x: auto;
    }

    .list-header,
    .list-row {
      min-width: 700px;
    }
  }

  @media (max-width: 480px) {
    .list-header,
    .list-row {
      font-size: 0.75rem;
      padding: 0.75rem;
    }

    .list-col {
      padding: 0 0.25rem;
    }
  }

  .sub-category-icon {
    color: #2563eb;
    font-size: 1.2rem;
    font-weight: bold;
  }

  .category-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
    line-height: 1.4;
  }

  .btn-icon {
    padding: 0.5rem;
    background: #f3f4f6;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .btn-icon.btn-delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-container {
    background: white;
    border-radius: 0.75rem;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-container.small {
    max-width: 420px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .required {
    color: #dc2626;
  }

  .form-hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #6b7280;
    font-style: italic;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    color: #1a1a1a;
    transition: all 0.2s;
    box-sizing: border-box;
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .delete-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .delete-warning p {
    color: #6b7280;
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .category-name-highlight {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 1.125rem;
    margin: 1rem 0 !important;
  }

  .warning-text {
    font-size: 0.875rem;
    color: #dc2626;
    margin-top: 1rem !important;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #f3f4f6;
  }

  .btn-secondary,
  .btn-primary,
  .btn-danger {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }

  .btn-danger:hover {
    background: #b91c1c;
  }

  @media (max-width: 768px) {
    .categories-page {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
      margin-bottom: 1.5rem;
    }

    .btn-create {
      width: 100%;
      justify-content: center;
    }

    .page-title {
      font-size: 1.5rem;
    }
  }
</style>
