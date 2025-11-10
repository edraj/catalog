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

  let products = $state([]);
  let categories = $state([]);
  let isLoading = $state(true);
  let isLoadingCategories = $state(false);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedProduct = $state(null);
  let selectedCategoryFilter = $state("all");

  let productForm = $state({
    displayname: "",
    description: "",
    parentCategory: "",
    category: "",
    price: "",
    tags: [],
  });

  onMount(async () => {
    await loadCategories();
    await loadProducts();
  });

  async function loadCategories() {
    isLoadingCategories = true;
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
      } else {
        console.error("No categories found in response:", response);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Failed to load categories");
    } finally {
      isLoadingCategories = false;
    }
  }

  async function loadProducts() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "Ecommerce",
        "products",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        products = response.records;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Failed to load products");
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    productForm = {
      displayname: "",
      description: "",
      parentCategory: "",
      category: "",
      price: "",
      tags: [],
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(product) {
    selectedProduct = product;
    const content =
      product.attributes?.payload?.body?.content ||
      product.attributes?.payload?.body;

    const categoryId = content?.category_id || "";
    const category = categories.find((c) => c.shortname === categoryId);
    const parentCategoryId = category ? getCategoryParentId(category) : "";

    productForm = {
      displayname: getLocalizedDisplayName(product),
      description: content?.description || "",
      parentCategory: parentCategoryId || "",
      category: parentCategoryId ? categoryId : "",
      price: content?.base_price?.toString() || "",
      tags:
        product.attributes?.tags?.filter(
          (tag) => !tag.startsWith("category:")
        ) || [],
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedProduct = null;
  }

  function openDeleteModal(product) {
    selectedProduct = product;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedProduct = null;
  }

  async function handleCreateProduct() {
    if (!productForm.displayname.trim()) {
      errorToastMessage("Please enter a product name");
      return;
    }

    if (!productForm.parentCategory) {
      errorToastMessage("Please select a category");
      return;
    }

    if (hasSubCategories(productForm.parentCategory)) {
      if (!productForm.category) {
        errorToastMessage("Please select a sub-category for this category");
        return;
      }
    }

    const finalCategoryId = getFinalCategoryId();
    if (!finalCategoryId) {
      errorToastMessage("Please select a category");
      return;
    }

    try {
      const productData = {
        displayname: productForm.displayname,
        description: productForm.description,
        body: {
          content: {
            name: productForm.displayname,
            description: productForm.description,
            category_id: finalCategoryId,
            base_price: productForm.price ? parseFloat(productForm.price) : 0,
          },
          content_type: "json",
        },
        tags: [...productForm.tags, `category:${finalCategoryId}`],
        is_active: true,
      };

      await createEntity(
        productData,
        "Ecommerce",
        "/products",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Product created successfully!");
      closeCreateModal();
      await loadProducts();
    } catch (error) {
      console.error("Error creating product:", error);
      errorToastMessage("Failed to create product");
    }
  }

  async function handleUpdateProduct() {
    if (!productForm.displayname.trim()) {
      errorToastMessage("Please enter a product name");
      return;
    }

    if (!productForm.parentCategory) {
      errorToastMessage("Please select a category");
      return;
    }

    if (hasSubCategories(productForm.parentCategory)) {
      if (!productForm.category) {
        errorToastMessage("Please select a sub-category for this category");
        return;
      }
    }

    const finalCategoryId = getFinalCategoryId();
    if (!finalCategoryId) {
      errorToastMessage("Please select a category");
      return;
    }

    if (!selectedProduct) return;

    try {
      const productData = {
        displayname: productForm.displayname,
        description: productForm.description,
        content: {
          name: productForm.displayname,
          description: productForm.description,
          category_id: finalCategoryId,
          base_price: productForm.price ? parseFloat(productForm.price) : 0,
        },
        content_type: "json",
        tags: [...productForm.tags, `category:${finalCategoryId}`],
        is_active: true,
      };

      await updateEntity(
        selectedProduct.shortname,
        "Ecommerce",
        selectedProduct.subpath,
        selectedProduct.resource_type,
        productData,
        "",
        ""
      );

      successToastMessage("Product updated successfully!");
      closeEditModal();
      await loadProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      errorToastMessage("Failed to update product");
    }
  }

  async function handleDeleteProduct() {
    if (!selectedProduct) return;

    try {
      await deleteEntity(
        selectedProduct.shortname,
        "Ecommerce",
        selectedProduct.subpath,
        selectedProduct.resource_type
      );

      successToastMessage("Product deleted successfully!");
      closeDeleteModal();
      await loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      errorToastMessage("Failed to delete product");
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

  function getProductCategory(product) {
    const content =
      product.attributes?.payload?.body?.content ||
      product.attributes?.payload?.body;
    return content?.category_id || null;
  }

  function getProductPrice(product) {
    const content =
      product.attributes?.payload?.body?.content ||
      product.attributes?.payload?.body;
    return content?.base_price || 0;
  }

  function getCategoryName(categoryId) {
    const category = categories.find((c) => c.shortname === categoryId);
    return category ? getLocalizedDisplayName(category) : categoryId;
  }

  function getCategoryParentId(category) {
    const content =
      category.attributes?.payload?.body?.content ||
      category.attributes?.payload?.body;
    return content?.parent_category_id || null;
  }

  function isParentCategory(category) {
    return !getCategoryParentId(category);
  }

  function getSubCategories(parentId) {
    return categories.filter((c) => getCategoryParentId(c) === parentId);
  }

  function hasSubCategories(categoryId) {
    return getSubCategories(categoryId).length > 0;
  }

  const parentCategories = $derived.by(() => {
    return categories.filter((c) => isParentCategory(c));
  });

  const availableSubCategories = $derived.by(() => {
    if (!productForm.parentCategory) return [];
    return getSubCategories(productForm.parentCategory);
  });

  function getFinalCategoryId() {
    if (productForm.category) {
      return productForm.category;
    } else if (productForm.parentCategory) {
      return productForm.parentCategory;
    }
    return "";
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString($locale);
  }

  const filteredProducts = $derived.by(() => {
    if (selectedCategoryFilter === "all") {
      return products;
    }
    return products.filter(
      (p) => getProductCategory(p) === selectedCategoryFilter
    );
  });
</script>

<div class="products-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.products") || "Products Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.products_description") ||
          "Manage products and their categories"}
      </p>
    </div>
    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span>{$_("admin_dashboard.create_product") || "Create Product"}</span>
    </button>
  </div>

  <div class="filters">
    <label for="category-filter"
      >{$_("common.filter_by_category") || "Filter by Category"}:</label
    >
    <select
      id="category-filter"
      bind:value={selectedCategoryFilter}
      class="filter-select"
    >
      <option value="all"
        >{$_("common.all_categories") || "All Categories"}</option
      >
      {#each categories as category}
        <option value={category.shortname}
          >{getLocalizedDisplayName(category)}</option
        >
      {/each}
    </select>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="empty-state">
      <p>
        {selectedCategoryFilter === "all"
          ? $_("admin_dashboard.no_products") || "No products found"
          : $_("admin_dashboard.no_products_in_category") ||
            "No products in this category"}
      </p>
      <button class="btn-create" onclick={openCreateModal}>
        {$_("admin_dashboard.create_first_product") || "Create First Product"}
      </button>
    </div>
  {:else}
    <div class="products-list">
      <div class="list-header">
        <div class="list-col col-name">Name</div>
        <div class="list-col col-description">Description</div>
        <div class="list-col col-category">Category</div>
        <div class="list-col col-price">Price</div>
        <div class="list-col col-actions">Actions</div>
      </div>
      {#each filteredProducts as product}
        <div class="list-row">
          <div class="list-col col-name">
            <span class="product-name">{getLocalizedDisplayName(product)}</span>
            <span class="product-shortname">{product.shortname}</span>
          </div>
          <div class="list-col col-description">
            {product.attributes?.payload?.body?.content?.description ||
              "No description"}
          </div>
          <div class="list-col col-category">
            <span class="category-badge"
              >{getCategoryName(getProductCategory(product))}</span
            >
          </div>
          <div class="list-col col-price">
            {getProductPrice(product) > 0
              ? `$${getProductPrice(product).toFixed(2)}`
              : "-"}
          </div>
          <div class="list-col col-actions">
            <button
              class="btn-icon"
              onclick={() => openEditModal(product)}
              title="Edit"
            >
              <EditOutline size="sm" />
            </button>
            <button
              class="btn-icon delete"
              onclick={() => openDeleteModal(product)}
              title="Delete"
            >
              <TrashBinOutline size="sm" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closeCreateModal}
    onkeydown={(e) => e.key === "Escape" && closeCreateModal()}
  >
    <div
      class="modal-container"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2>{$_("admin_dashboard.create_product") || "Create Product"}</h2>
        <button class="modal-close" onclick={closeCreateModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="product-name">{$_("common.name") || "Name"} *</label>
          <input
            id="product-name"
            type="text"
            bind:value={productForm.displayname}
            placeholder={$_("admin_dashboard.enter_product_name") ||
              "Enter product name"}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="product-category"
            >{$_("common.category") || "Category"} *</label
          >
          {#if isLoadingCategories}
            <div class="loading-message">Loading categories...</div>
          {:else if categories.length === 0}
            <div class="warning-message">
              <p>⚠️ No categories found. Please create categories first.</p>
              <button
                class="btn-link"
                onclick={() =>
                  window.open("/dashboard/admin/categories", "_blank")}
                type="button"
              >
                Go to Categories Management
              </button>
            </div>
          {:else}
            <select
              id="product-category"
              bind:value={productForm.parentCategory}
              class="form-input"
              onchange={() => {
                productForm.category = "";
              }}
            >
              <option value=""
                >{$_("common.select_category") || "Select a category"}</option
              >
              {#each parentCategories as category}
                <option value={category.shortname}
                  >{getLocalizedDisplayName(category)}</option
                >
              {/each}
            </select>

            {#if productForm.parentCategory && hasSubCategories(productForm.parentCategory)}
              <div class="sub-category-section">
                <label for="product-sub-category"
                  >{$_("common.sub_category") || "Sub-category"} *</label
                >
                <select
                  id="product-sub-category"
                  bind:value={productForm.category}
                  class="form-input"
                >
                  <option value=""
                    >{$_("common.select_sub_category") ||
                      "Select a sub-category"}</option
                  >
                  {#each availableSubCategories as subCategory}
                    <option value={subCategory.shortname}
                      >{getLocalizedDisplayName(subCategory)}</option
                    >
                  {/each}
                </select>
              </div>
            {/if}
          {/if}
        </div>
        <div class="form-group">
          <label for="product-description"
            >{$_("common.description") || "Description"}</label
          >
          <textarea
            id="product-description"
            bind:value={productForm.description}
            placeholder={$_("admin_dashboard.enter_product_description") ||
              "Enter product description"}
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <label for="product-price"
            >{$_("common.base_price") || "Base Price (Optional)"}</label
          >
          <input
            id="product-price"
            type="number"
            step="0.01"
            min="0"
            bind:value={productForm.price}
            placeholder="0.00"
            class="form-input"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeCreateModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleCreateProduct}>
          {$_("common.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closeEditModal}
    onkeydown={(e) => e.key === "Escape" && closeEditModal()}
  >
    <div
      class="modal-container"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2>{$_("admin_dashboard.edit_product") || "Edit Product"}</h2>
        <button class="modal-close" onclick={closeEditModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="edit-product-name">{$_("common.name") || "Name"} *</label>
          <input
            id="edit-product-name"
            type="text"
            bind:value={productForm.displayname}
            placeholder={$_("admin_dashboard.enter_product_name") ||
              "Enter product name"}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="edit-product-category"
            >{$_("common.category") || "Category"} *</label
          >
          {#if isLoadingCategories}
            <div class="loading-message">Loading categories...</div>
          {:else if categories.length === 0}
            <div class="warning-message">
              <p>⚠️ No categories found. Please create categories first.</p>
              <button
                class="btn-link"
                onclick={() =>
                  window.open("/dashboard/admin/categories", "_blank")}
                type="button"
              >
                Go to Categories Management
              </button>
            </div>
          {:else}
            <select
              id="edit-product-category"
              bind:value={productForm.parentCategory}
              class="form-input"
              onchange={() => {
                productForm.category = "";
              }}
            >
              <option value=""
                >{$_("common.select_category") || "Select a category"}</option
              >
              {#each parentCategories as category}
                <option value={category.shortname}
                  >{getLocalizedDisplayName(category)}</option
                >
              {/each}
            </select>

            {#if productForm.parentCategory && hasSubCategories(productForm.parentCategory)}
              <div class="sub-category-section">
                <label for="edit-product-sub-category"
                  >{$_("common.sub_category") || "Sub-category"} *</label
                >
                <select
                  id="edit-product-sub-category"
                  bind:value={productForm.category}
                  class="form-input"
                >
                  <option value=""
                    >{$_("common.select_sub_category") ||
                      "Select a sub-category"}</option
                  >
                  {#each availableSubCategories as subCategory}
                    <option value={subCategory.shortname}
                      >{getLocalizedDisplayName(subCategory)}</option
                    >
                  {/each}
                </select>
              </div>
            {/if}
          {/if}
        </div>
        <div class="form-group">
          <label for="edit-product-description"
            >{$_("common.description") || "Description"}</label
          >
          <textarea
            id="edit-product-description"
            bind:value={productForm.description}
            placeholder={$_("admin_dashboard.enter_product_description") ||
              "Enter product description"}
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <label for="edit-product-price"
            >{$_("common.base_price") || "Base Price (Optional)"}</label
          >
          <input
            id="edit-product-price"
            type="number"
            step="0.01"
            min="0"
            bind:value={productForm.price}
            placeholder="0.00"
            class="form-input"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeEditModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleUpdateProduct}>
          {$_("common.save") || "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closeDeleteModal}
    onkeydown={(e) => e.key === "Escape" && closeDeleteModal()}
  >
    <div
      class="modal-container small"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2>{$_("common.confirm_delete") || "Confirm Delete"}</h2>
        <button class="modal-close" onclick={closeDeleteModal}>&times;</button>
      </div>
      <div class="modal-body">
        <p>
          {$_("admin_dashboard.delete_product_confirm") ||
            "Are you sure you want to delete this product?"}
        </p>
        <p class="product-name-highlight">
          {getLocalizedDisplayName(selectedProduct)}
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" onclick={handleDeleteProduct}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .products-page {
    min-height: 100vh;
    padding: 2.5rem;
    background: #ffffff;
  }

  .rtl {
    direction: rtl;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #1f2937;
  }

  .page-description {
    font-size: 1rem;
    margin: 0;
    color: #6b7280;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    background: #ffffff;
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .filters label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
    color: #1f2937;
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.2s;
    min-width: 200px;
  }

  .filter-select:hover {
    border-color: #9ca3af;
  }

  .filter-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .btn-create {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-create:hover {
    background: #2563eb;
  }

  .btn-create:active {
    background: #1d4ed8;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }

  .loading-state p,
  .empty-state p {
    color: #6b7280;
    font-size: 1rem;
  }

  .loading-spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* List Styles */
  .products-list {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
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

  .list-col {
    padding: 0 0.5rem;
    font-size: 0.875rem;
  }

  .col-name {
    flex: 0 0 20%;
    min-width: 0;
  }

  .col-description {
    flex: 0 0 35%;
    min-width: 0;
    color: #6b7280;
    line-height: 1.5;
  }

  .col-category {
    flex: 0 0 15%;
    min-width: 0;
  }

  .col-price {
    flex: 0 0 15%;
    min-width: 0;
    color: #1f2937;
    font-weight: 500;
  }

  .col-actions {
    flex: 0 0 15%;
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .product-name {
    display: block;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-shortname {
    display: block;
    font-size: 0.75rem;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .category-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .btn-icon {
    padding: 0.5rem;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    background: #f9fafb;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    background: #f3f4f6;
  }

  .btn-icon.delete {
    color: #dc2626;
  }

  .btn-icon.delete:hover {
    background: #fee2e2;
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
  }

  .modal-container {
    background: white;
    border-radius: 0.5rem;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  }

  .modal-container.small {
    max-width: 400px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
  }

  .modal-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
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
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .sub-category-section {
    margin-top: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .sub-category-section label {
    color: #2563eb;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #1f2937;
    transition: all 0.2s;
    box-sizing: border-box;
    background: white;
  }

  .form-input:hover,
  .form-textarea:hover {
    border-color: #9ca3af;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-textarea {
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
  }

  .product-name-highlight {
    font-weight: 600;
    color: #1f2937;
    margin: 0.75rem 0 0 0;
    font-size: 1rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn-secondary,
  .btn-primary,
  .btn-danger {
    padding: 0.625rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: #f9fafb;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #f3f4f6;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-primary:active {
    background: #1d4ed8;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }

  .btn-danger:hover {
    background: #b91c1c;
  }

  .btn-danger:active {
    background: #991b1b;
  }

  .loading-message {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    color: #6b7280;
    text-align: center;
    font-size: 0.875rem;
  }

  .warning-message {
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 0.375rem;
    color: #92400e;
  }

  .warning-message p {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
  }

  .btn-link {
    background: none;
    border: none;
    color: #3b82f6;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: 0.875rem;
    transition: color 0.2s;
  }

  .btn-link:hover {
    color: #2563eb;
  }

  .modal-container::-webkit-scrollbar {
    width: 6px;
  }

  .modal-container::-webkit-scrollbar-track {
    background: #f3f4f6;
  }

  .modal-container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  .modal-container::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  @media (max-width: 1024px) {
    .col-description {
      flex: 0 0 30%;
    }

    .col-name {
      flex: 0 0 25%;
    }
  }

  @media (max-width: 768px) {
    .products-page {
      padding: 1.5rem;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-select {
      width: 100%;
    }

    .products-list {
      overflow-x: auto;
    }

    .list-header,
    .list-row {
      min-width: 700px;
    }

    .modal-container {
      width: 95%;
    }

    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1.25rem;
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
</style>
