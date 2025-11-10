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

  let specifications = $state([]);
  let products = $state([]);
  let isLoading = $state(true);
  let isLoadingProducts = $state(false);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedSpecification = $state(null);
  let selectedProductFilter = $state("all");

  let specificationForm = $state({
    displayname: "",
    product: "",
    attributes: {},
    customAttributes: [{ key: "", value: "" }],
  });

  onMount(async () => {
    await loadProducts();
    await loadSpecifications();
  });

  async function loadProducts() {
    isLoadingProducts = true;
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
      isLoadingProducts = false;
    }
  }

  async function loadSpecifications() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "Ecommerce",
        "product_specifications",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        specifications = response.records;
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Failed to load specifications");
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    specificationForm = {
      displayname: "",
      product: "",
      attributes: {},
      customAttributes: [{ key: "", value: "" }],
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(specification) {
    selectedSpecification = specification;
    const content =
      specification.attributes?.payload?.body?.content ||
      specification.attributes?.payload?.body;
    const attributes = content?.attributes || {};

    const customAttributes = Object.entries(attributes).map(([key, value]) => ({
      key,
      value: value.toString(),
    }));

    specificationForm = {
      displayname: getLocalizedDisplayName(specification),
      product: content?.product_id || "",
      attributes: attributes,
      customAttributes:
        customAttributes.length > 0
          ? customAttributes
          : [{ key: "", value: "" }],
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedSpecification = null;
  }

  function openDeleteModal(specification) {
    selectedSpecification = specification;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedSpecification = null;
  }

  function addCustomAttribute() {
    specificationForm.customAttributes = [
      ...specificationForm.customAttributes,
      { key: "", value: "" },
    ];
  }

  function removeCustomAttribute(index) {
    specificationForm.customAttributes =
      specificationForm.customAttributes.filter((_, i) => i !== index);
  }

  async function handleCreateSpecification() {
    if (!specificationForm.displayname.trim()) {
      errorToastMessage("Please enter a specification name");
      return;
    }

    if (!specificationForm.product) {
      errorToastMessage("Please select a product");
      return;
    }

    const attributes = {};
    specificationForm.customAttributes.forEach((attr) => {
      if (attr.key && attr.value) {
        attributes[attr.key] = attr.value;
      }
    });

    if (Object.keys(attributes).length === 0) {
      errorToastMessage("Please add at least one attribute");
      return;
    }

    try {
      const specificationData = {
        displayname: specificationForm.displayname,
        body: {
          content: {
            name: specificationForm.displayname,
            product_id: specificationForm.product,
            attributes: attributes,
          },
          content_type: "json",
        },
        tags: [`product:${specificationForm.product}`],
        is_active: true,
      };

      await createEntity(
        specificationData,
        "Ecommerce",
        "/product_specifications",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Specification created successfully!");
      closeCreateModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error creating specification:", error);
      errorToastMessage("Failed to create specification");
    }
  }

  async function handleUpdateSpecification() {
    if (!specificationForm.displayname.trim()) {
      errorToastMessage("Please enter a specification name");
      return;
    }

    if (!specificationForm.product) {
      errorToastMessage("Please select a product");
      return;
    }

    const attributes = {};
    specificationForm.customAttributes.forEach((attr) => {
      if (attr.key && attr.value) {
        attributes[attr.key] = attr.value;
      }
    });

    if (Object.keys(attributes).length === 0) {
      errorToastMessage("Please add at least one attribute");
      return;
    }

    if (!selectedSpecification) return;

    try {
      const specificationData = {
        displayname: specificationForm.displayname,
        content: {
          name: specificationForm.displayname,
          product_id: specificationForm.product,
          attributes: attributes,
        },
        content_type: "json",
        tags: [`product:${specificationForm.product}`],
        is_active: true,
      };

      await updateEntity(
        selectedSpecification.shortname,
        "Ecommerce",
        selectedSpecification.subpath,
        selectedSpecification.resource_type,
        specificationData,
        "",
        ""
      );

      successToastMessage("Specification updated successfully!");
      closeEditModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error updating specification:", error);
      errorToastMessage("Failed to update specification");
    }
  }

  async function handleDeleteSpecification() {
    if (!selectedSpecification) return;

    try {
      await deleteEntity(
        selectedSpecification.shortname,
        "Ecommerce",
        selectedSpecification.subpath,
        selectedSpecification.resource_type
      );

      successToastMessage("Specification deleted successfully!");
      closeDeleteModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error deleting specification:", error);
      errorToastMessage("Failed to delete specification");
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

  function getSpecificationProduct(specification) {
    const content =
      specification.attributes?.payload?.body?.content ||
      specification.attributes?.payload?.body;
    return content?.product_id || null;
  }

  function getProductName(productId) {
    const product = products.find((p) => p.shortname === productId);
    return product ? getLocalizedDisplayName(product) : productId;
  }

  function getSpecificationAttributes(specification) {
    const content =
      specification.attributes?.payload?.body?.content ||
      specification.attributes?.payload?.body;
    return content?.attributes || {};
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString($locale);
  }

  const filteredSpecifications = $derived.by(() => {
    if (selectedProductFilter === "all") {
      return specifications;
    }
    return specifications.filter(
      (s) => getSpecificationProduct(s) === selectedProductFilter
    );
  });
</script>

<div class="specifications-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.product_specifications") ||
          "Product Specifications Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.specifications_description") ||
          "Manage product variations and specifications"}
      </p>
    </div>
    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span
        >{$_("admin_dashboard.create_specification") ||
          "Create Specification"}</span
      >
    </button>
  </div>

  <div class="filters">
    <label for="product-filter"
      >{$_("common.filter_by_product") || "Filter by Product"}:</label
    >
    <select
      id="product-filter"
      bind:value={selectedProductFilter}
      class="filter-select"
    >
      <option value="all">{$_("common.all_products") || "All Products"}</option>
      {#each products as product}
        <option value={product.shortname}
          >{getLocalizedDisplayName(product)}</option
        >
      {/each}
    </select>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if filteredSpecifications.length === 0}
    <div class="empty-state">
      <p>
        {selectedProductFilter === "all"
          ? $_("admin_dashboard.no_specifications") || "No specifications found"
          : $_("admin_dashboard.no_specifications_for_product") ||
            "No specifications for this product"}
      </p>
      <button class="btn-create" onclick={openCreateModal}>
        {$_("admin_dashboard.create_first_specification") ||
          "Create First Specification"}
      </button>
    </div>
  {:else}
    <div class="specifications-grid">
      {#each filteredSpecifications as specification}
        <div class="specification-card">
          <div class="specification-header">
            <h3 class="specification-name">
              {getLocalizedDisplayName(specification)}
            </h3>
            <div class="specification-actions">
              <button
                class="btn-icon"
                onclick={() => openEditModal(specification)}
                title="Edit"
              >
                <EditOutline size="sm" />
              </button>
              <button
                class="btn-icon delete"
                onclick={() => openDeleteModal(specification)}
                title="Delete"
              >
                <TrashBinOutline size="sm" />
              </button>
            </div>
          </div>
          <div class="specification-product">
            <span class="product-label"
              >{$_("common.product") || "Product"}:</span
            >
            <span class="product-badge"
              >{getProductName(getSpecificationProduct(specification))}</span
            >
          </div>
          <div class="specification-attributes">
            <h4 class="attributes-title">
              {$_("common.attributes") || "Attributes"}:
            </h4>
            <div class="attributes-list">
              {#each Object.entries(getSpecificationAttributes(specification)) as [key, value]}
                <div class="attribute-item">
                  <span class="attribute-key">{key}:</span>
                  <span class="attribute-value">{value}</span>
                </div>
              {/each}
            </div>
          </div>
          <div class="specification-meta">
            <span class="meta-item">Shortname: {specification.shortname}</span>
            <span class="meta-item"
              >Created: {formatDate(specification.attributes?.created_at)}</span
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-container large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {$_("admin_dashboard.create_specification") || "Create Specification"}
        </h2>
        <button class="modal-close" onclick={closeCreateModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="specification-name">{$_("common.name") || "Name"} *</label
          >
          <input
            id="specification-name"
            type="text"
            bind:value={specificationForm.displayname}
            placeholder={$_("admin_dashboard.enter_specification_name") ||
              "Enter specification name (e.g., 'iPhone 15 - 128GB - Blue')"}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="specification-product"
            >{$_("common.product") || "Product"} *</label
          >
          {#if isLoadingProducts}
            <div class="loading-message">Loading products...</div>
          {:else if products.length === 0}
            <div class="warning-message">
              <p>⚠️ No products found. Please create products first.</p>
              <button
                class="btn-link"
                onclick={() =>
                  window.open("/dashboard/admin/products", "_blank")}
                type="button"
              >
                Go to Products Management
              </button>
            </div>
          {:else}
            <select
              id="specification-product"
              bind:value={specificationForm.product}
              class="form-input"
            >
              <option value=""
                >{$_("common.select_product") || "Select a product"}</option
              >
              {#each products as product}
                <option value={product.shortname}
                  >{getLocalizedDisplayName(product)}</option
                >
              {/each}
            </select>
          {/if}
        </div>
        <div class="form-group">
          <label>{$_("common.attributes") || "Attributes"} *</label>
          <p class="form-help">
            {$_("admin_dashboard.attributes_help") ||
              "Define the variations (e.g., Color: Blue, Storage: 128GB)"}
          </p>
          {#each specificationForm.customAttributes as attr, index}
            <div class="attribute-row">
              <input
                type="text"
                bind:value={attr.key}
                placeholder={$_("common.attribute_name") ||
                  "Attribute name (e.g., Color)"}
                class="form-input attribute-key-input"
              />
              <input
                type="text"
                bind:value={attr.value}
                placeholder={$_("common.attribute_value") ||
                  "Value (e.g., Blue)"}
                class="form-input attribute-value-input"
              />
              <button
                class="btn-icon-small delete"
                onclick={() => removeCustomAttribute(index)}
                disabled={specificationForm.customAttributes.length === 1}
                title="Remove"
              >
                <TrashBinOutline size="xs" />
              </button>
            </div>
          {/each}
          <button class="btn-add-attribute" onclick={addCustomAttribute}>
            <PlusOutline size="xs" />
            <span>{$_("common.add_attribute") || "Add Attribute"}</span>
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeCreateModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleCreateSpecification}>
          {$_("common.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-container large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {$_("admin_dashboard.edit_specification") || "Edit Specification"}
        </h2>
        <button class="modal-close" onclick={closeEditModal}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="edit-specification-name"
            >{$_("common.name") || "Name"} *</label
          >
          <input
            id="edit-specification-name"
            type="text"
            bind:value={specificationForm.displayname}
            placeholder={$_("admin_dashboard.enter_specification_name") ||
              "Enter specification name (e.g., 'iPhone 15 - 128GB - Blue')"}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="edit-specification-product"
            >{$_("common.product") || "Product"} *</label
          >
          {#if isLoadingProducts}
            <div class="loading-message">Loading products...</div>
          {:else if products.length === 0}
            <div class="warning-message">
              <p>⚠️ No products found. Please create products first.</p>
              <button
                class="btn-link"
                onclick={() =>
                  window.open("/dashboard/admin/products", "_blank")}
                type="button"
              >
                Go to Products Management
              </button>
            </div>
          {:else}
            <select
              id="edit-specification-product"
              bind:value={specificationForm.product}
              class="form-input"
            >
              <option value=""
                >{$_("common.select_product") || "Select a product"}</option
              >
              {#each products as product}
                <option value={product.shortname}
                  >{getLocalizedDisplayName(product)}</option
                >
              {/each}
            </select>
          {/if}
        </div>
        <div class="form-group">
          <label>{$_("common.attributes") || "Attributes"} *</label>
          <p class="form-help">
            {$_("admin_dashboard.attributes_help") ||
              "Define the variations (e.g., Color: Blue, Storage: 128GB)"}
          </p>
          {#each specificationForm.customAttributes as attr, index}
            <div class="attribute-row">
              <input
                type="text"
                bind:value={attr.key}
                placeholder={$_("common.attribute_name") ||
                  "Attribute name (e.g., Color)"}
                class="form-input attribute-key-input"
              />
              <input
                type="text"
                bind:value={attr.value}
                placeholder={$_("common.attribute_value") ||
                  "Value (e.g., Blue)"}
                class="form-input attribute-value-input"
              />
              <button
                class="btn-icon-small delete"
                onclick={() => removeCustomAttribute(index)}
                disabled={specificationForm.customAttributes.length === 1}
                title="Remove"
              >
                <TrashBinOutline size="xs" />
              </button>
            </div>
          {/each}
          <button class="btn-add-attribute" onclick={addCustomAttribute}>
            <PlusOutline size="xs" />
            <span>{$_("common.add_attribute") || "Add Attribute"}</span>
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeEditModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleUpdateSpecification}>
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
        <h2>{$_("common.confirm_delete") || "Confirm Delete"}</h2>
        <button class="modal-close" onclick={closeDeleteModal}>&times;</button>
      </div>
      <div class="modal-body">
        <p>
          {$_("admin_dashboard.delete_specification_confirm") ||
            "Are you sure you want to delete this specification?"}
        </p>
        <p class="specification-name-highlight">
          {getLocalizedDisplayName(selectedSpecification)}
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" onclick={handleDeleteSpecification}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .specifications-page {
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

  .specifications-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .specification-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: box-shadow 0.2s;
  }

  .specification-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .specification-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 1rem;
  }

  .specification-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    flex: 1;
    line-height: 1.4;
  }

  .specification-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
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

  .specification-product {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .product-label {
    font-weight: 600;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .product-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .specification-attributes {
    margin-bottom: 1rem;
  }

  .attributes-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .attributes-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .attribute-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .attribute-key {
    font-weight: 600;
    color: #4b5563;
  }

  .attribute-value {
    color: #6b7280;
  }

  .specification-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .meta-item {
    font-size: 0.75rem;
    color: #9ca3af;
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

  .modal-container.large {
    max-width: 600px;
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

  .form-help {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0.25rem 0 0.75rem 0;
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

  .attribute-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .attribute-key-input {
    flex: 1;
  }

  .attribute-value-input {
    flex: 1;
  }

  .btn-icon-small {
    padding: 0.625rem;
    background: #f9fafb;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon-small:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .btn-icon-small.delete {
    color: #dc2626;
  }

  .btn-icon-small.delete:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-icon-small:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-add-attribute {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #ffffff;
    border: 1px dashed #d1d5db;
    border-radius: 0.375rem;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    justify-content: center;
  }

  .btn-add-attribute:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .specification-name-highlight {
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

  /* Scrollbar Styling */
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

  @media (max-width: 768px) {
    .specifications-page {
      padding: 1.5rem;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .specifications-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .modal-container {
      width: 95%;
    }

    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1.25rem;
    }

    .attribute-row {
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .filters {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-select {
      width: 100%;
    }
  }
</style>
