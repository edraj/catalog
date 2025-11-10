<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { params } from "@roxi/routify";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { ArrowLeftOutline, CheckCircleSolid } from "flowbite-svelte-icons";
  import { getEntity, updateEntity } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";

  $goto;
  let item = $state(null);
  let isLoading = $state(true);
  let isSaving = $state(false);

  // Form data based on item type
  let productForm = $state({
    price: "",
    stock: "",
    sku: "",
  });

  let couponForm = $state({
    type: "value",
    minValue: "",
    maxValue: "",
    amount: "",
  });

  let branchForm = $state({
    name: "",
    country: "",
    state: "",
    city: "",
    address: "",
  });

  let bundleForm = $state({
    price: "",
  });

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
        "managed"
      );

      if (
        response &&
        response.status === "success" &&
        response.records &&
        response.records.length > 0
      ) {
        item = response.records[0];
        populateForm();
      } else if (response && !response.status) {
        item = response;
        populateForm();
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

  function populateForm() {
    const content = getContent(item);
    if (!content) return;

    const itemType = getItemType(content);

    if (itemType === "product") {
      productForm = {
        price: content.price?.toString() || "",
        stock: content.stock?.toString() || "",
        sku: content.sku || "",
      };
    } else if (itemType === "coupon") {
      couponForm = {
        type: content.type || "value",
        minValue: content.min_value?.toString() || "",
        maxValue: content.max_value?.toString() || "",
        amount: content.amount?.toString() || "",
      };
    } else if (itemType === "branch") {
      branchForm = {
        name: content.name || "",
        country: content.country || "",
        state: content.state || "",
        city: content.city || "",
        address: content.address || "",
      };
    } else if (itemType === "bundle") {
      bundleForm = {
        price: content.price?.toString() || "",
      };
    }
  }

  function goBack() {
    $goto("/sellers/[space_name]/[subpath]/[shortname]/[resource_type]", {
      space_name: $params.space_name,
      subpath: $params.subpath,
      shortname: $params.shortname,
      resource_type: $params.resource_type,
    });
  }

  async function saveChanges() {
    const content = getContent(item);
    if (!content) return;

    const itemType = getItemType(content);
    let updatedContent = { ...content };

    if (itemType === "product") {
      if (!productForm.price || !productForm.stock) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock),
        sku: productForm.sku,
      };
    } else if (itemType === "coupon") {
      if (!couponForm.amount || !couponForm.minValue) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        type: couponForm.type,
        amount: parseFloat(couponForm.amount),
        min_value: parseFloat(couponForm.minValue),
        max_value: couponForm.maxValue ? parseFloat(couponForm.maxValue) : null,
      };
    } else if (itemType === "branch") {
      if (
        !branchForm.name ||
        !branchForm.country ||
        !branchForm.state ||
        !branchForm.city ||
        !branchForm.address
      ) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        name: branchForm.name,
        country: branchForm.country,
        state: branchForm.state,
        city: branchForm.city,
        address: branchForm.address,
      };
    } else if (itemType === "bundle") {
      if (!bundleForm.price) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        price: parseFloat(bundleForm.price),
      };
    }

    isSaving = true;
    try {
      await updateEntity(
        item.shortname,
        $params.space_name,
        $params.subpath,
        ResourceType.content,
        {
          attributes: {
            payload: {
              content_type: "json",
              schema_shortname: "meta_schema",
              body: {
                content: updatedContent,
              },
            },
          },
        },
        "",
        ""
      );

      successToastMessage("Item updated successfully");
      goBack();
    } catch (error) {
      console.error("Error updating item:", error);
      errorToastMessage("Failed to update item");
    } finally {
      isSaving = false;
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

<div class="edit-container">
  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">
        {$_("seller_dashboard.loading") || "Loading..."}
      </p>
    </div>
  {:else if item}
    <!-- Header -->
    <div class="edit-header">
      <button class="back-button" onclick={goBack}>
        <ArrowLeftOutline class="back-icon" />
        <span class="back-text">{$_("seller_dashboard.back") || "Back"}</span>
      </button>

      <button class="save-button" onclick={saveChanges} disabled={isSaving}>
        {#if isSaving}
          <div class="mini-spinner"></div>
        {:else}
          <CheckCircleSolid class="save-icon" />
        {/if}
        <span
          >{isSaving
            ? $_("seller_dashboard.saving") || "Saving..."
            : $_("seller_dashboard.save_changes") || "Save Changes"}</span
        >
      </button>
    </div>

    <!-- Content -->
    <div class="edit-content">
      <div class="content-header">
        <h1 class="content-title" class:rtl={$isRTL}>
          {$_("seller_dashboard.edit") || "Edit"}: {getLocalizedDisplayName(
            item
          )}
        </h1>
        <p class="content-shortname">{item.shortname}</p>
      </div>

      <div class="content-body">
        {#if getItemType(getContent(item)) === "product"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.price") || "Price"} *</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={productForm.price}
                placeholder={$_("seller_dashboard.enter_price") ||
                  "Enter price"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.stock") || "Stock"} *</span>
              </label>
              <input
                type="number"
                min="0"
                bind:value={productForm.stock}
                placeholder={$_("seller_dashboard.enter_stock") ||
                  "Enter stock quantity"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.sku") || "SKU"}</span>
              </label>
              <input
                type="text"
                bind:value={productForm.sku}
                placeholder={$_("seller_dashboard.enter_sku") || "Enter SKU"}
                class="form-input"
                class:rtl={$isRTL}
              />
            </div>
          </form>
        {:else if getItemType(getContent(item)) === "coupon"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.coupon_type") || "Coupon Type"} *</span
                >
              </label>
              <select
                bind:value={couponForm.type}
                class="form-select"
                class:rtl={$isRTL}
              >
                <option value="value"
                  >{$_("seller_dashboard.fixed_value") || "Fixed Value"}</option
                >
                <option value="percentage"
                  >{$_("seller_dashboard.percentage") || "Percentage"}</option
                >
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.amount") || "Amount"} *</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.amount}
                placeholder={couponForm.type === "percentage"
                  ? "e.g., 20 for 20%"
                  : "e.g., 10 for $10"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.min_value") || "Minimum Value"} *</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.minValue}
                placeholder={$_("seller_dashboard.enter_min_value") ||
                  "Enter minimum value"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.max_value") || "Maximum Value"}</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.maxValue}
                placeholder={$_("seller_dashboard.enter_max_value") ||
                  "Enter maximum value (optional)"}
                class="form-input"
                class:rtl={$isRTL}
              />
            </div>
          </form>
        {:else if getItemType(getContent(item)) === "branch"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.branch_name") || "Branch Name"} *</span
                >
              </label>
              <input
                type="text"
                bind:value={branchForm.name}
                placeholder={$_("seller_dashboard.enter_branch_name") ||
                  "Enter branch name"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.country") || "Country"} *</span>
              </label>
              <input
                type="text"
                bind:value={branchForm.country}
                placeholder={$_("seller_dashboard.enter_country") ||
                  "Enter country"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.state") || "State"} *</span>
              </label>
              <input
                type="text"
                bind:value={branchForm.state}
                placeholder={$_("seller_dashboard.enter_state") ||
                  "Enter state"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.city") || "City"} *</span>
              </label>
              <input
                type="text"
                bind:value={branchForm.city}
                placeholder={$_("seller_dashboard.enter_city") || "Enter city"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.address") || "Address"} *</span>
              </label>
              <textarea
                bind:value={branchForm.address}
                placeholder={$_("seller_dashboard.enter_address") ||
                  "Enter full address"}
                class="form-textarea"
                class:rtl={$isRTL}
                rows="3"
                required
              ></textarea>
            </div>
          </form>
        {:else if getItemType(getContent(item)) === "bundle"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.bundle_price") || "Bundle Price"} *</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={bundleForm.price}
                placeholder={$_("seller_dashboard.enter_price") ||
                  "Enter price"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="info-note">
              <svg
                class="info-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" stroke-width="2" />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 16v-4M12 8h.01"
                />
              </svg>
              <p>
                {$_("seller_dashboard.bundle_products_note") ||
                  "Note: Bundle products cannot be changed after creation. To modify the products, please create a new bundle."}
              </p>
            </div>
          </form>
        {/if}

        <div class="form-footer">
          <p class="required-note">
            * {$_("seller_dashboard.required_fields") || "Required fields"}
          </p>
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

<style>
  * {
    box-sizing: border-box;
  }

  .edit-container {
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
  .edit-header {
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

  .save-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(34, 197, 94, 0.9);
    border: 2px solid rgba(34, 197, 94, 1);
    border-radius: 0.75rem;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .save-button:hover:not(:disabled) {
    background: rgba(34, 197, 94, 1);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
  }

  .save-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mini-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Content */
  .edit-content {
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

  /* Form Styles */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-label.rtl {
    flex-direction: row-reverse;
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 1rem;
    color: #1f2937;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-input.rtl,
  .form-select.rtl,
  .form-textarea.rtl {
    text-align: right;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }

  .info-note {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    margin-top: 1rem;
  }

  .info-icon {
    width: 1.5rem;
    height: 1.5rem;
    stroke: #3b82f6;
    flex-shrink: 0;
  }

  .info-note p {
    margin: 0;
    font-size: 0.875rem;
    color: #1e40af;
    line-height: 1.5;
  }

  .form-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .required-note {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
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

  /* Responsive */
  @media (max-width: 768px) {
    .edit-container {
      padding: 1rem;
    }

    .edit-header {
      flex-direction: column;
      align-items: stretch;
    }

    .save-button {
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
  }
</style>
