<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { params } from "@roxi/routify";
  import { formatDate } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    ArrowLeftOutline,
    EditOutline,
    TrashBinOutline,
    CheckCircleSolid,
    CloseCircleSolid,
  } from "flowbite-svelte-icons";
  import { getEntity, deleteEntity } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";

  $goto;
  let item = $state(null);
  let isLoading = $state(true);
  let showDeleteModal = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  onMount(async () => {
    await loadItem();
  });

  async function loadItem() {
    isLoading = true;
    try {
      const response = await getEntity(
        $params.shortname,
        $params.space_name,
        $params.subpath,
        ResourceType.content,
        "managed",
        true,
        true
      );

      if (
        response &&
        response.status === "success" &&
        response.records &&
        response.records.length > 0
      ) {
        item = response.records[0];
      } else if (response && !response.status) {
        item = response;
      } else {
        errorToastMessage("Failed to load item");
      }
    } catch (error) {
      console.error("Error loading item:", error);
      errorToastMessage("Error loading item");
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    $goto("/sellers");
  }

  function editItem() {
    $goto("/sellers/[space_name]/[subpath]/[shortname]/[resource_type]/edit", {
      space_name: $params.space_name,
      subpath: $params.subpath,
      shortname: $params.shortname,
      resource_type: $params.resource_type,
    });
  }

  function openDeleteModal() {
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
  }

  async function confirmDelete() {
    try {
      await deleteEntity(
        $params.shortname,
        $params.space_name,
        $params.subpath,
        $params.resource_type
      );

      successToastMessage("Item deleted successfully");
      closeDeleteModal();
      goBack();
    } catch (error) {
      console.error("Error deleting item:", error);
      errorToastMessage("Failed to delete item");
    }
  }

  function getLocalizedDisplayName(item) {
    const displayname = item?.displayname;

    if (!displayname) {
      return item?.shortname || $_("seller_dashboard.untitled");
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item?.shortname || $_("seller_dashboard.untitled");
  }

  function getContent(item) {
    const payload = item?.payload;
    if (!payload || !payload.body) return null;

    return payload.body.content || payload.body;
  }

  function getItemType(content) {
    if (!content) return "unknown";

    if (content.product_id || content.category_id) {
      return "product";
    } else if (content.type && content.amount !== undefined) {
      return "coupon";
    } else if (content.country || content.city) {
      return "branch";
    } else if (content.product_ids || content.price !== undefined) {
      return "bundle";
    }

    return "unknown";
  }
</script>

<div class="view-container">
  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">
        {$_("seller_dashboard.loading") || "Loading..."}
      </p>
    </div>
  {:else if item}
    <!-- Header -->
    <div class="view-header">
      <button class="back-button" onclick={goBack}>
        <ArrowLeftOutline class="back-icon" />
        <span class="back-text">{$_("seller_dashboard.back") || "Back"}</span>
      </button>

      <div class="header-actions">
        <button class="action-button edit" onclick={editItem}>
          <EditOutline class="action-icon" />
          <span>{$_("seller_dashboard.edit") || "Edit"}</span>
        </button>
        <button class="action-button delete" onclick={openDeleteModal}>
          <TrashBinOutline class="action-icon" />
          <span>{$_("seller_dashboard.delete") || "Delete"}</span>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="view-content">
      <div class="content-header">
        <h1 class="content-title" class:rtl={$isRTL}>
          {getLocalizedDisplayName(item)}
        </h1>
        <p class="content-shortname">{item.shortname}</p>
      </div>

      <div class="content-body">
        {#if getItemType(getContent(item)) === "product"}
          {@const content = getContent(item)}
          <div class="info-section">
            <h2 class="section-title">
              {$_("seller_dashboard.product_details") || "Product Details"}
            </h2>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.product_id") || "Product ID"}:</span
                >
                <span class="info-value">{content.product_id || "N/A"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.category_id") || "Category ID"}:</span
                >
                <span class="info-value">{content.category_id || "N/A"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.price") || "Price"}:</span
                >
                <span class="info-value">${content.price || "0.00"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.stock") || "Stock"}:</span
                >
                <span class="info-value">{content.stock || 0}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.sku") || "SKU"}:</span
                >
                <span class="info-value">{content.sku || "N/A"}</span>
              </div>

              {#if content.specification_id}
                <div class="info-item">
                  <span class="info-label"
                    >{$_("seller_dashboard.specification") ||
                      "Specification"}:</span
                  >
                  <span class="info-value">{content.specification_id}</span>
                </div>
              {/if}
            </div>
          </div>
        {:else if getItemType(getContent(item)) === "coupon"}
          {@const content = getContent(item)}
          <div class="info-section">
            <h2 class="section-title">
              {$_("seller_dashboard.coupon_details") || "Coupon Details"}
            </h2>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.type") || "Type"}:</span
                >
                <span
                  class="info-value badge"
                  class:value-type={content.type === "value"}
                  class:percentage-type={content.type === "percentage"}
                >
                  {content.type === "value" ? "Fixed Value" : "Percentage"}
                </span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.amount") || "Amount"}:</span
                >
                <span class="info-value highlight"
                  >{content.type === "percentage"
                    ? `${content.amount}%`
                    : `$${content.amount}`}</span
                >
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.min_value") || "Minimum Value"}:</span
                >
                <span class="info-value">${content.min_value || "0.00"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.max_value") || "Maximum Value"}:</span
                >
                <span class="info-value"
                  >${content.max_value || "No limit"}</span
                >
              </div>
            </div>
          </div>
        {:else if getItemType(getContent(item)) === "branch"}
          {@const content = getContent(item)}
          <div class="info-section">
            <h2 class="section-title">
              {$_("seller_dashboard.branch_details") || "Branch Details"}
            </h2>

            <div class="info-grid">
              <div class="info-item full-width">
                <span class="info-label"
                  >{$_("seller_dashboard.branch_name") || "Branch Name"}:</span
                >
                <span class="info-value">{content.name || "N/A"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.country") || "Country"}:</span
                >
                <span class="info-value">{content.country || "N/A"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.state") || "State"}:</span
                >
                <span class="info-value">{content.state || "N/A"}</span>
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.city") || "City"}:</span
                >
                <span class="info-value">{content.city || "N/A"}</span>
              </div>

              <div class="info-item full-width">
                <span class="info-label"
                  >{$_("seller_dashboard.address") || "Address"}:</span
                >
                <span class="info-value">{content.address || "N/A"}</span>
              </div>
            </div>
          </div>
        {:else if getItemType(getContent(item)) === "bundle"}
          {@const content = getContent(item)}
          <div class="info-section">
            <h2 class="section-title">
              {$_("seller_dashboard.bundle_details") || "Bundle Details"}
            </h2>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.bundle_price") ||
                    "Bundle Price"}:</span
                >
                <span class="info-value highlight"
                  >${content.price || "0.00"}</span
                >
              </div>

              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.products_count") ||
                    "Products Count"}:</span
                >
                <span class="info-value"
                  >{content.product_ids?.length || 0} products</span
                >
              </div>

              {#if content.product_ids && content.product_ids.length > 0}
                <div class="info-item full-width">
                  <span class="info-label"
                    >{$_("seller_dashboard.products") || "Products"}:</span
                  >
                  <div class="product-list">
                    {#each content.product_ids as productId}
                      <span class="product-tag">{productId}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Metadata Section -->
        <div class="info-section">
          <h2 class="section-title">
            {$_("seller_dashboard.metadata") || "Metadata"}
          </h2>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label"
                >{$_("seller_dashboard.resource_type") ||
                  "Resource Type"}:</span
              >
              <span class="info-value">{item.resource_type}</span>
            </div>

            <div class="info-item">
              <span class="info-label"
                >{$_("seller_dashboard.created_at") || "Created At"}:</span
              >
              <span class="info-value">{formatDate(item.created_at)}</span>
            </div>

            <div class="info-item">
              <span class="info-label"
                >{$_("seller_dashboard.updated_at") || "Updated At"}:</span
              >
              <span class="info-value">{formatDate(item.updated_at)}</span>
            </div>

            {#if item.owner_shortname}
              <div class="info-item">
                <span class="info-label"
                  >{$_("seller_dashboard.owner") || "Owner"}:</span
                >
                <span class="info-value">{item.owner_shortname}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p class="empty-text">
        {$_("seller_dashboard.item_not_found") || "Item not found"}
      </p>
      <button class="back-button-large" onclick={goBack}>
        {$_("seller_dashboard.go_back") || "Go Back"}
      </button>
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div class="modal-container small" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.confirm_delete") || "Confirm Delete"}
        </h2>
        <button class="modal-close" onclick={closeDeleteModal}>
          <svg
            class="close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
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

      <div class="modal-body">
        <p class="delete-message">
          {$_("seller_dashboard.delete_confirmation_message") ||
            "Are you sure you want to delete"}
          <span class="delete-item-name">{getLocalizedDisplayName(item)}</span>?
        </p>
        <p class="delete-warning">
          {$_("seller_dashboard.delete_warning") ||
            "This action cannot be undone."}
        </p>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeDeleteModal}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button class="modal-button delete" onclick={confirmDelete}>
          {$_("seller_dashboard.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  * {
    box-sizing: border-box;
  }

  .view-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: white;
    font-size: 1.125rem;
    font-weight: 500;
  }

  /* Header */
  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.75rem;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateX(-4px);
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .action-button.edit {
    background: rgba(59, 130, 246, 0.2);
    border: 2px solid rgba(59, 130, 246, 0.4);
    color: white;
  }

  .action-button.edit:hover {
    background: rgba(59, 130, 246, 0.4);
    transform: translateY(-2px);
  }

  .action-button.delete {
    background: rgba(239, 68, 68, 0.2);
    border: 2px solid rgba(239, 68, 68, 0.4);
    color: white;
  }

  .action-button.delete:hover {
    background: rgba(239, 68, 68, 0.4);
    transform: translateY(-2px);
  }

  .action-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Content */
  .view-content {
    background: white;
    border-radius: 1.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .content-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
    color: white;
  }

  .content-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .content-title.rtl {
    text-align: right;
  }

  .content-shortname {
    font-size: 0.875rem;
    opacity: 0.9;
    font-family: monospace;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 0.5rem;
    display: inline-block;
  }

  .content-body {
    padding: 2rem;
  }

  /* Info Sections */
  .info-section {
    margin-bottom: 2rem;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1.5rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-item.full-width {
    grid-column: 1 / -1;
  }

  .info-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 1.125rem;
    font-weight: 500;
    color: #1f2937;
  }

  .info-value.highlight {
    color: #667eea;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .info-value.badge {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .info-value.value-type {
    background: #dbeafe;
    color: #1e40af;
  }

  .info-value.percentage-type {
    background: #dcfce7;
    color: #166534;
  }

  .product-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .product-tag {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 2rem;
  }

  .empty-text {
    color: white;
    font-size: 1.5rem;
    font-weight: 500;
  }

  .back-button-large {
    padding: 1rem 2rem;
    background: white;
    color: #667eea;
    border: none;
    border-radius: 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .back-button-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
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
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-container {
    background: white;
    border-radius: 1rem;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease;
  }

  .modal-container.small {
    max-width: 400px;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    transition: background 0.2s;
  }

  .modal-close:hover {
    background: #f3f4f6;
  }

  .close-icon {
    width: 1.5rem;
    height: 1.5rem;
    stroke: #6b7280;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .delete-message {
    font-size: 1rem;
    color: #4b5563;
    margin: 0 0 1rem 0;
  }

  .delete-item-name {
    font-weight: 700;
    color: #1f2937;
    background: #fef3c7;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
  }

  .delete-warning {
    font-size: 0.875rem;
    color: #dc2626;
    font-weight: 500;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .modal-button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-button.cancel {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    color: #374151;
  }

  .modal-button.cancel:hover {
    background: #e5e7eb;
  }

  .modal-button.delete {
    background: #dc2626;
    border: none;
    color: white;
  }

  .modal-button.delete:hover {
    background: #b91c1c;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .view-container {
      padding: 1rem;
    }

    .view-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      justify-content: stretch;
    }

    .action-button {
      flex: 1;
      justify-content: center;
    }

    .content-header {
      padding: 1.5rem;
    }

    .content-title {
      font-size: 1.5rem;
    }

    .content-body {
      padding: 1.5rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
