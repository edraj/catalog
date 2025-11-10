<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate } from "@/lib/helpers";
  import { errorToastMessage } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    FolderOutline,
    TagOutline,
    LayersSolid,
  } from "flowbite-svelte-icons";
  import { user } from "@/stores/user";
  import { ResourceType } from "@edraj/tsdmart";
  import { getSpaceContents, createEntity } from "@/lib/dmart_services";
  import { successToastMessage } from "@/lib/toasts_messages";

  $goto;
  let folders = $state([]);
  let items = $state([]);
  let filteredItems = $state([]);
  let selectedFolder = $state<string | null>(null);
  let isLoading = $state(true);
  let searchTerm = $state("");
  let categoryFilter = $state("all");
  let filterCategories = $state([]);

  let showAddItemModal = $state(false);
  let categories = $state([]);
  let products = $state([]);
  let specifications = $state([]);
  let selectedCategory = $state("");
  let selectedProduct = $state("");
  let variationPrices = $state<
    Record<string, { price: string; stock: string; sku: string }>
  >({});
  let isLoadingCategories = $state(false);
  let isLoadingProducts = $state(false);
  let isLoadingSpecifications = $state(false);

  let showCouponModal = $state(false);
  let couponForm = $state({
    type: "value",
    minValue: "",
    maxValue: "",
    amount: "",
  });

  let showBranchModal = $state(false);
  let branchForm = $state({
    name: "",
    country: "",
    state: "",
    city: "",
    address: "",
  });

  let showBundleModal = $state(false);
  let bundleForm = $state({
    selectedProducts: [],
    price: "",
  });
  let sellerProducts = $state([]);
  let filteredSellerProducts = $state([]);
  let isLoadingSellerProducts = $state(false);
  let bundleProductSearch = $state("");
  let bundleCategoryFilter = $state("all");
  let productCategories = $state([]);

  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToEdit = $state(null);
  let itemToDelete = $state(null);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  onMount(async () => {
    await loadFolders();
    await loadFilterCategories();
  });

  async function loadFolders() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "Ecommerce",
        "sellers",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        folders = response.records.filter(
          (record) => record.resource_type === "folder"
        );
      }
    } catch (error) {
      console.error("Error loading folders:", error);
      errorToastMessage(
        $_("seller_dashboard.error_loading_folders") || "Error loading folders"
      );
    } finally {
      isLoading = false;
    }
  }

  async function loadFolderContents(folderShortname: string) {
    isLoading = true;
    selectedFolder = folderShortname;
    try {
      const response = await getSpaceContents(
        "Ecommerce",
        `sellers/${folderShortname}`,
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        items = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading folder contents:", error);
      errorToastMessage(
        $_("seller_dashboard.error_loading_contents") ||
          "Error loading folder contents"
      );
    } finally {
      isLoading = false;
    }
  }

  function goBackToFolders() {
    selectedFolder = null;
    items = [];
    filteredItems = [];
  }

  async function loadFilterCategories() {
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
        filterCategories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  function applyFilters() {
    let result = [...items];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter((item) => {
        const displayName = getLocalizedDisplayName(item).toLowerCase();
        const shortname = item.shortname?.toLowerCase() || "";
        return displayName.includes(search) || shortname.includes(search);
      });
    }

    if (categoryFilter !== "all") {
      result = result.filter((item) => {
        const payload = item.attributes?.payload;
        if (!payload || !payload.body) return false;

        const body = payload.body;
        const content = body.content || body;

        return content?.category_id === categoryFilter;
      });
    }

    filteredItems = result;
  }

  function getLocalizedDisplayName(item) {
    const displayname = item.attributes?.displayname;

    if (!displayname) {
      return item.shortname || $_("seller_dashboard.untitled");
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item.shortname || $_("seller_dashboard.untitled");
  }

  function getContentPreview(item) {
    const payload = item.attributes?.payload;
    if (!payload || !payload.body) return "";

    const body = payload.body;

    if (item.resource_type === "content") {
      if (payload.content_type === "html" && typeof body === "string") {
        return body;
      }

      if (payload.content_type === "json") {
        if (typeof body === "object") {
          const content = body.content || body;

          if (content.product_id && content.price !== undefined) {
            return `Product: ${content.product_id} | Price: $${content.price} | Stock: ${content.stock || 0} | SKU: ${content.sku || "N/A"}`;
          }

          if (
            content.type &&
            content.amount !== undefined &&
            content.min_value !== undefined
          ) {
            const amountDisplay =
              content.type === "percentage"
                ? `${content.amount}%`
                : `$${content.amount}`;
            const maxDisplay = content.max_value
              ? ` | Max: $${content.max_value}`
              : "";
            return `Coupon: ${content.type} - ${amountDisplay} | Min: $${content.min_value}${maxDisplay}`;
          }

          if (content.name && content.city && content.country) {
            return `Branch: ${content.name} | ${content.city}, ${content.state ? content.state + ", " : ""}${content.country}`;
          }

          if (
            content.product_ids &&
            Array.isArray(content.product_ids) &&
            content.price !== undefined
          ) {
            return `Bundle: ${content.product_ids.length} products | Price: $${content.price}`;
          }

          if (
            content.product_id &&
            content.price !== undefined &&
            !content.category_id
          ) {
            return `Bundle: Product ${content.product_id} | Price: $${content.price}`;
          }

          if (body.description && typeof body.description === "string") {
            return body.description;
          }

          return JSON.stringify(content).substring(0, 100) + "...";
        }
      }
    }

    return "";
  }

  function getResourceTypeLabel(resourceType: string): string {
    const labels: { [key: string]: string } = {
      content: $_("seller_dashboard.content"),
      media: $_("seller_dashboard.media"),
      folder: $_("seller_dashboard.folder"),
      comment: $_("seller_dashboard.comment"),
    };
    return labels[resourceType] || resourceType;
  }

  function getItemCategory(item) {
    const payload = item.attributes?.payload;
    if (!payload || !payload.body) return null;

    const body = payload.body;
    const content = body.content || body;

    if (
      item.subpath.includes("/products") &&
      content.product_id &&
      content.category_id
    ) {
      return { type: "product", icon: "🛍️", color: "#667eea" };
    } else if (
      item.subpath.includes("/coupons") &&
      content.type &&
      content.amount !== undefined
    ) {
      return { type: "coupon", icon: "🎟️", color: "#10b981" };
    } else if (
      item.subpath.includes("/branch") &&
      content.name &&
      content.city
    ) {
      return { type: "branch", icon: "🏢", color: "#f59e0b" };
    } else if (
      item.subpath.includes("/bundles") &&
      ((content.product_ids && Array.isArray(content.product_ids)) ||
        content.product_id) &&
      content.price !== undefined
    ) {
      return { type: "bundle", icon: "📦", color: "#8b5cf6" };
    }

    return null;
  }

  function getResourceTypeIcon(resourceType: string) {
    switch (resourceType) {
      case "folder":
        return FolderOutline;
      case "media":
        return LayersSolid;
      default:
        return TagOutline;
    }
  }

  function viewItem(item) {
    $goto("/sellers/[shortname]/[resource_type]", {
      subpath: item.subpath.replace(/^\//, ""),
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function editItem(item) {
    $goto("/sellers/[shortname]/[resource_type]/edit", {
      subpath: item.subpath.replace(/^\//, ""),
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function createItem() {
    if (selectedFolder === "products") {
      showAddItemModal = true;
      loadCategories();
    } else if (selectedFolder === "coupons") {
      openCouponModal();
    } else if (selectedFolder === "branch") {
      openBranchModal();
    } else if (selectedFolder === "bundles") {
      openBundleModal();
    } else {
      $goto("/sellers/create");
    }
  }

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
        console.error("Seller - No categories found in response:", response);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Error loading categories");
    } finally {
      isLoadingCategories = false;
    }
  }

  async function loadProducts(categoryShortname: string) {
    isLoadingProducts = true;
    selectedProduct = "";
    specifications = [];
    variationPrices = {};
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
        products = response.records.filter((product) => {
          const content =
            product.attributes?.payload?.body?.content ||
            product.attributes?.payload?.body;
          return content?.category_id === categoryShortname;
        });
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingProducts = false;
    }
  }

  async function loadSpecifications(productShortname: string) {
    isLoadingSpecifications = true;
    variationPrices = {};
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
        specifications = response.records.filter((spec) => {
          const content =
            spec.attributes?.payload?.body?.content ||
            spec.attributes?.payload?.body;

          return content?.product_id === productShortname;
        });

        const prices: Record<
          string,
          { price: string; stock: string; sku: string }
        > = {};
        specifications.forEach((spec) => {
          prices[spec.shortname] = {
            price: "",
            stock: "",
            sku: "",
          };
        });
        variationPrices = prices;
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Error loading specifications");
    } finally {
      isLoadingSpecifications = false;
    }
  }

  function handleCategoryChange() {
    if (selectedCategory) {
      loadProducts(selectedCategory);
    } else {
      products = [];
      selectedProduct = "";
      specifications = [];
      variationPrices = {};
    }
  }

  function handleProductChange() {
    if (selectedProduct) {
      loadSpecifications(selectedProduct);
    } else {
      specifications = [];
      variationPrices = {};
    }
  }

  function closeModal() {
    showAddItemModal = false;
    selectedCategory = "";
    selectedProduct = "";
    categories = [];
    products = [];
    specifications = [];
    variationPrices = {};
  }

  async function submitProductVariations() {
    const filledVariations = Object.entries(variationPrices)
      .filter(([_, data]) => data.price)
      .map(([shortname, data]) => ({
        shortname,
        price: parseFloat(data.price),
        stock: data.stock ? parseInt(data.stock) : 0,
        sku: data.sku || "",
      }));

    if (filledVariations.length === 0) {
      errorToastMessage("Please add price for at least one variation");
      return;
    }

    try {
      isLoading = true;
      for (const variation of filledVariations) {
        const selectedProductData = products.find(
          (p) => p.shortname === selectedProduct
        );
        const selectedSpecData = specifications.find(
          (s) => s.shortname === variation.shortname
        );

        const productData = {
          displayname: `${getLocalizedDisplayName(selectedProductData)} - ${getLocalizedDisplayName(selectedSpecData)}`,
          body: {
            content: {
              product_id: selectedProduct,
              category_id: selectedCategory,
              specification_id: variation.shortname,
              price: variation.price,
              stock: variation.stock,
              sku: variation.sku,
            },
            content_type: "json",
          },
          tags: [
            `category:${selectedCategory}`,
            `product:${selectedProduct}`,
            `specification:${variation.shortname}`,
          ],
          is_active: true,
        };
        await createEntity(
          productData,
          "Ecommerce",
          "/sellers/products",
          ResourceType.content,
          "",
          ""
        );
      }

      successToastMessage("Products added successfully!");
      closeModal();
      await loadFolderContents("products");
    } catch (error) {
      console.error("Error creating products:", error);
      errorToastMessage("Failed to create products");
    } finally {
      isLoading = false;
    }
  }

  function openCouponModal() {
    showCouponModal = true;
    couponForm = {
      type: "value",
      minValue: "",
      maxValue: "",
      amount: "",
    };
  }

  function closeCouponModal() {
    showCouponModal = false;
    couponForm = {
      type: "value",
      minValue: "",
      maxValue: "",
      amount: "",
    };
  }

  async function submitCoupon() {
    if (!couponForm.amount || !couponForm.minValue) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const couponData = {
        displayname: `Coupon - ${couponForm.type} - ${couponForm.amount}`,
        body: {
          content: {
            type: couponForm.type,
            min_value: parseFloat(couponForm.minValue),
            max_value: couponForm.maxValue
              ? parseFloat(couponForm.maxValue)
              : null,
            amount: parseFloat(couponForm.amount),
          },
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        couponData,
        "Ecommerce",
        "/sellers/coupons",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Coupon created successfully!");
      closeCouponModal();
      await loadFolderContents("coupons");
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage("Failed to create coupon");
    } finally {
      isLoading = false;
    }
  }

  function openBranchModal() {
    showBranchModal = true;
    branchForm = {
      name: "",
      country: "",
      state: "",
      city: "",
      address: "",
    };
  }

  function closeBranchModal() {
    showBranchModal = false;
    branchForm = {
      name: "",
      country: "",
      state: "",
      city: "",
      address: "",
    };
  }

  async function submitBranch() {
    if (
      !branchForm.name ||
      !branchForm.country ||
      !branchForm.city ||
      !branchForm.address
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const branchData = {
        displayname: `Branch - ${branchForm.name}`,
        body: {
          content: {
            name: branchForm.name,
            country: branchForm.country,
            state: branchForm.state,
            city: branchForm.city,
            address: branchForm.address,
          },
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        branchData,
        "Ecommerce",
        "/sellers/branch",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Branch created successfully!");
      closeBranchModal();
      await loadFolderContents("branch");
    } catch (error) {
      console.error("Error creating branch:", error);
      errorToastMessage("Failed to create branch");
    } finally {
      isLoading = false;
    }
  }

  function openBundleModal() {
    showBundleModal = true;
    bundleForm = {
      selectedProducts: [],
      price: "",
    };
    bundleProductSearch = "";
    bundleCategoryFilter = "all";
    loadSellerProducts();
  }

  function closeBundleModal() {
    showBundleModal = false;
    bundleForm = {
      selectedProducts: [],
      price: "",
    };
    sellerProducts = [];
    filteredSellerProducts = [];
    bundleProductSearch = "";
    bundleCategoryFilter = "all";
    productCategories = [];
  }

  function toggleProductSelection(productShortname: string) {
    if (bundleForm.selectedProducts.includes(productShortname)) {
      bundleForm.selectedProducts = bundleForm.selectedProducts.filter(
        (p) => p !== productShortname
      );
    } else {
      bundleForm.selectedProducts = [
        ...bundleForm.selectedProducts,
        productShortname,
      ];
    }
  }

  async function loadSellerProducts() {
    isLoadingSellerProducts = true;
    try {
      const response = await getSpaceContents(
        "Ecommerce",
        "/sellers/products",
        "managed",
        1000,
        0,
        true
      );

      if (response?.records) {
        sellerProducts = response.records;

        const categoriesSet = new Set<string>();
        sellerProducts.forEach((product) => {
          const content =
            product?.payload?.body?.content || product?.payload?.body;
          if (content?.category_id) {
            categoriesSet.add(content.category_id);
          }
        });
        productCategories = Array.from(categoriesSet);

        filterBundleProducts();
      }
    } catch (error) {
      console.error("Error loading seller products:", error);
      errorToastMessage("Error loading your products");
    } finally {
      isLoadingSellerProducts = false;
    }
  }

  function filterBundleProducts() {
    let result = [...sellerProducts];

    if (bundleProductSearch.trim()) {
      const searchLower = bundleProductSearch.toLowerCase();
      result = result.filter((product) => {
        const displayname = getLocalizedDisplayName(product).toLowerCase();
        const shortname = product.shortname?.toLowerCase() || "";
        const content =
          product?.payload?.body?.content || product?.payload?.body;
        const productId = content?.product_id?.toLowerCase() || "";

        return (
          displayname.includes(searchLower) ||
          shortname.includes(searchLower) ||
          productId.includes(searchLower)
        );
      });
    }

    if (bundleCategoryFilter !== "all") {
      result = result.filter((product) => {
        const content =
          product?.payload?.body?.content || product?.payload?.body;
        return content?.category_id === bundleCategoryFilter;
      });
    }

    filteredSellerProducts = result;
  }

  async function submitBundle() {
    if (bundleForm.selectedProducts.length < 2 || !bundleForm.price) {
      errorToastMessage("Please select at least 2 products and enter a price");
      return;
    }

    try {
      isLoading = true;
      const productNames = bundleForm.selectedProducts
        .map((shortname) => {
          const product = sellerProducts.find((p) => p.shortname === shortname);
          return getLocalizedDisplayName(product);
        })
        .join(" + ");

      const bundleData = {
        displayname: `Bundle - ${productNames}`,
        body: {
          content: {
            product_ids: bundleForm.selectedProducts,
            price: parseFloat(bundleForm.price),
          },
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        bundleData,
        "Ecommerce",
        "/sellers/bundles",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Bundle created successfully!");
      closeBundleModal();
      await loadFolderContents("bundles");
    } catch (error) {
      console.error("Error creating bundle:", error);
      errorToastMessage("Failed to create bundle");
    } finally {
      isLoading = false;
    }
  }

  function openEditModal(item) {
    itemToEdit = item;
    const payload = item.attributes?.payload;
    const body = payload?.body;
    const content = body?.content || {};

    if (item.subpath.includes("/products")) {
      editItem(item);
      return;
    } else if (item.subpath.includes("/coupons")) {
      couponForm = {
        type: content.type || "value",
        minValue: content.min_value?.toString() || "",
        maxValue: content.max_value?.toString() || "",
        amount: content.amount?.toString() || "",
      };
      showEditModal = true;
    } else if (item.subpath.includes("/branch")) {
      branchForm = {
        name: content.name || "",
        country: content.country || "",
        state: content.state || "",
        city: content.city || "",
        address: content.address || "",
      };
      showEditModal = true;
    } else if (item.subpath.includes("/bundles")) {
      bundleForm = {
        selectedProducts:
          content.product_ids ||
          (content.product_id ? [content.product_id] : []),
        price: content.price?.toString() || "",
      };
      loadSellerProducts();
      showEditModal = true;
    }
  }

  function closeEditModal() {
    showEditModal = false;
    itemToEdit = null;
    couponForm = { type: "value", minValue: "", maxValue: "", amount: "" };
    branchForm = { name: "", country: "", state: "", city: "", address: "" };
    bundleForm = { selectedProducts: [], price: "" };
  }

  async function submitEdit() {
    if (!itemToEdit) return;

    try {
      isLoading = true;
      let updateData;
      let subpath = itemToEdit.subpath;

      if (subpath.includes("/coupons")) {
        if (!couponForm.amount || !couponForm.minValue) {
          errorToastMessage("Please fill in all required fields");
          return;
        }
        updateData = {
          displayname: `Coupon - ${couponForm.type} - ${couponForm.amount}`,
          body: {
            content: {
              type: couponForm.type,
              min_value: parseFloat(couponForm.minValue),
              max_value: couponForm.maxValue
                ? parseFloat(couponForm.maxValue)
                : null,
              amount: parseFloat(couponForm.amount),
            },
            content_type: "json",
          },
          tags: itemToEdit.attributes.tags || [],
          is_active: true,
        };
      } else if (subpath.includes("/branch")) {
        if (
          !branchForm.name ||
          !branchForm.country ||
          !branchForm.city ||
          !branchForm.address
        ) {
          errorToastMessage("Please fill in all required fields");
          return;
        }
        updateData = {
          displayname: `Branch - ${branchForm.name}`,
          body: {
            content: {
              name: branchForm.name,
              country: branchForm.country,
              state: branchForm.state,
              city: branchForm.city,
              address: branchForm.address,
            },
            content_type: "json",
          },
          tags: itemToEdit.attributes.tags || [],
          is_active: true,
        };
      } else if (subpath.includes("/bundles")) {
        if (bundleForm.selectedProducts.length < 2 || !bundleForm.price) {
          errorToastMessage(
            "Please select at least 2 products and enter a price"
          );
          return;
        }
        const productNames = bundleForm.selectedProducts
          .map((shortname) => {
            const product = sellerProducts.find(
              (p) => p.shortname === shortname
            );
            return getLocalizedDisplayName(product);
          })
          .join(" + ");

        updateData = {
          displayname: `Bundle - ${productNames}`,
          body: {
            content: {
              product_ids: bundleForm.selectedProducts,
              price: parseFloat(bundleForm.price),
            },
            content_type: "json",
          },
          tags: itemToEdit.attributes.tags || [],
          is_active: true,
        };
      }

      const { updateEntity } = await import("@/lib/dmart_services");

      await updateEntity(
        itemToEdit.shortname,
        itemToEdit.space_name,
        itemToEdit.subpath,
        itemToEdit.resource_type,
        updateData,
        "",
        ""
      );

      successToastMessage("Item updated successfully!");
      closeEditModal();
      await loadFolderContents(selectedFolder);
    } catch (error) {
      console.error("Error updating item:", error);
      errorToastMessage("Failed to update item");
    } finally {
      isLoading = false;
    }
  }

  function openDeleteModal(item) {
    itemToDelete = item;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    itemToDelete = null;
  }

  async function confirmDelete() {
    if (!itemToDelete) return;

    try {
      isLoading = true;
      const { deleteEntity } = await import("@/lib/dmart_services");

      await deleteEntity(
        itemToDelete.shortname,
        itemToDelete.space_name,
        itemToDelete.subpath,
        itemToDelete.resource_type
      );

      successToastMessage("Item deleted successfully!");
      closeDeleteModal();
      await loadFolderContents(selectedFolder);
    } catch (error) {
      console.error("Error deleting item:", error);
      errorToastMessage("Failed to delete item");
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    applyFilters();
  });
</script>

<div class="seller-dashboard-container">
  <div class="seller-dashboard-content">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          {#if selectedFolder}
            <button class="back-button" onclick={goBackToFolders}>
              <svg
                class="back-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span class="back-text"
                >{$_("seller_dashboard.back") || "Back"}</span
              >
            </button>
          {/if}
          <div class="header-icon-wrapper">
            <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 2.18l8 4V17c0 4.52-3.15 8.75-8 9.83-4.85-1.08-8-5.31-8-9.83V8.18l8-4z"
              />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div class="header-text">
            <h1 class="dashboard-title">
              {#if selectedFolder}
                {selectedFolder.charAt(0).toUpperCase() +
                  selectedFolder.slice(1)}
              {:else}
                {$_("seller_dashboard.title") || "Seller Dashboard"}
              {/if}
            </h1>
            <p class="dashboard-subtitle">
              {#if selectedFolder}
                {$_("seller_dashboard.folder_subtitle") ||
                  "Manage items in this folder"}
              {:else}
                {$_("seller_dashboard.subtitle") ||
                  "Select a folder to manage your items"}
              {/if}
            </p>
          </div>
        </div>
        {#if selectedFolder}
          <button class="create-button" onclick={createItem}>
            <svg
              class="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>
              {#if selectedFolder === "products"}
                {$_("seller_dashboard.create_product") || "Create Product"}
              {:else if selectedFolder === "coupons"}
                {$_("seller_dashboard.create_coupon") || "Create Coupon"}
              {:else if selectedFolder === "branch"}
                {$_("seller_dashboard.create_branch") || "Create Branch"}
              {:else if selectedFolder === "bundles"}
                {$_("seller_dashboard.add_bundle") || "Add Bundle"}
              {:else}
                {$_("seller_dashboard.create_item") || "Create Item"}
              {/if}
            </span>
          </button>
        {/if}
      </div>
    </div>

    {#if !selectedFolder}
      <!-- Folders View -->
      {#if isLoading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p class="loading-text">
            {$_("seller_dashboard.loading_folders") || "Loading folders..."}
          </p>
        </div>
      {:else if folders.length === 0}
        <div class="empty-state">
          <svg
            class="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 class="empty-title">
            {$_("seller_dashboard.no_folders") || "No folders found"}
          </h3>
          <p class="empty-description">
            {$_("seller_dashboard.no_folders_description") ||
              "Contact administrator to set up folders"}
          </p>
        </div>
      {:else}
        <div class="folders-grid">
          {#each folders as folder (folder.shortname)}
            <button
              class="folder-card"
              onclick={() => loadFolderContents(folder.shortname)}
            >
              <div class="folder-card-icon">
                <svg
                  class="folder-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                  />
                </svg>
              </div>
              <div class="folder-card-body">
                <h3 class="folder-title" class:rtl={$isRTL}>
                  {getLocalizedDisplayName(folder) || folder.shortname}
                </h3>
                <p class="folder-shortname">{folder.shortname}</p>
                {#if folder.attributes?.description?.[$locale] || folder.attributes?.description?.en}
                  <p class="folder-description" class:rtl={$isRTL}>
                    {folder.attributes.description[$locale] ||
                      folder.attributes.description.en}
                  </p>
                {/if}
              </div>
              <div class="folder-card-footer">
                <div class="folder-meta">
                  <svg
                    class="meta-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" stroke-width="2" />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6v6l4 2"
                    />
                  </svg>
                  <span class="meta-text"
                    >{formatDate(folder.attributes.updated_at)}</span
                  >
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Items View -->
      <div class="filters-section">
        <div class="search-bar">
          <svg
            class="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="11" cy="11" r="8" stroke-width="2" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-4.35-4.35"
            />
          </svg>
          <input
            type="text"
            bind:value={searchTerm}
            placeholder={$_("seller_dashboard.search_placeholder") ||
              "Search items..."}
            class="search-input"
            class:rtl={$isRTL}
          />
        </div>

        <div class="filters-group">
          <div class="filter-item">
            <svg
              class="filter-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <select
              bind:value={categoryFilter}
              class="filter-select"
              class:rtl={$isRTL}
            >
              <option value="all"
                >{$_("seller_dashboard.all_categories") ||
                  "All Categories"}</option
              >
              {#each filterCategories as category (category.shortname)}
                <option value={category.shortname}>
                  {getLocalizedDisplayName(category)}
                </option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      {#if isLoading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p class="loading-text">
            {$_("seller_dashboard.loading") || "Loading items..."}
          </p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="empty-state">
          <svg
            class="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              stroke-width="1.5"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 9h6M9 15h6"
            />
          </svg>
          <h3 class="empty-title">
            {$_("seller_dashboard.no_items") || "No items found"}
          </h3>
          <p class="empty-description">
            {$_("seller_dashboard.no_items_description") ||
              "Start by creating your first item"}
          </p>
          <button class="create-button-large" onclick={createItem}>
            <svg
              class="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span
              >{$_("seller_dashboard.create_first_item") ||
                "Create Your First Item"}</span
            >
          </button>
        </div>
      {:else}
        <div class="items-stats">
          <svg
            class="stats-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p class="stats-text">
            {$_("seller_dashboard.showing") || "Showing"}
            <strong>{filteredItems.length}</strong>
            {$_("seller_dashboard.of") || "of"} <strong>{items.length}</strong>
            {$_("seller_dashboard.items") || "items"}
          </p>
        </div>

        <div class="items-grid">
          {#each filteredItems as item (item.shortname)}
            <div class="item-card">
              <div class="item-card-header">
                <div class="item-type-badge">
                  <svelte:component
                    this={getResourceTypeIcon(item.resource_type)}
                    class="type-icon"
                  />
                  <span>{getResourceTypeLabel(item.resource_type)}</span>
                </div>
                <div class="item-actions">
                  <button
                    class="action-button view"
                    onclick={() => viewItem(item)}
                    title={$_("seller_dashboard.view")}
                  >
                    <svg
                      class="action-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                  <button
                    class="action-button edit"
                    onclick={() => openEditModal(item)}
                    title={$_("seller_dashboard.edit")}
                  >
                    <svg
                      class="action-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    class="action-button delete"
                    onclick={() => openDeleteModal(item)}
                    title={$_("seller_dashboard.delete")}
                  >
                    <svg
                      class="action-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="item-card-body">
                <div class="item-title-row">
                  <h3 class="item-title" class:rtl={$isRTL}>
                    {getLocalizedDisplayName(item)}
                  </h3>
                  {#if getItemCategory(item)}
                    {@const category = getItemCategory(item)}
                    <span
                      class="item-category-badge"
                      style="background: {category.color}15; color: {category.color}; border-color: {category.color}30;"
                    >
                      <span class="category-icon">{category.icon}</span>
                      <span class="category-text">{category.type}</span>
                    </span>
                  {/if}
                </div>
                <p class="item-shortname">{item.shortname}</p>
                {#if getContentPreview(item)}
                  <p class="item-preview" class:rtl={$isRTL}>
                    {getContentPreview(item)}
                  </p>
                {/if}
              </div>

              <div class="item-card-footer">
                <div class="item-meta">
                  <svg
                    class="meta-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" stroke-width="2" />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6v6l4 2"
                    />
                  </svg>
                  <span class="meta-text"
                    >{formatDate(item.attributes.updated_at)}</span
                  >
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Add Item Modal -->
{#if showAddItemModal}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.add_product_item") || "Add Product Item"}
        </h2>
        <button class="modal-close" onclick={closeModal}>
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
        <!-- Category Selection -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <svg
              class="label-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span
              >{$_("seller_dashboard.select_category") ||
                "Select Category"}</span
            >
          </label>
          {#if isLoadingCategories}
            <div class="loading-select">
              <div class="mini-spinner"></div>
              <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
            </div>
          {:else}
            <select
              bind:value={selectedCategory}
              onchange={handleCategoryChange}
              class="form-select"
              class:rtl={$isRTL}
            >
              <option value="">
                {$_("seller_dashboard.choose_category") ||
                  "Choose a category..."}
              </option>
              {#each categories as category}
                <option value={category.shortname}>
                  {getLocalizedDisplayName(category)}
                </option>
              {/each}
            </select>
          {/if}
        </div>

        <!-- Product Selection -->
        {#if selectedCategory}
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <svg
                class="label-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span
                >{$_("seller_dashboard.select_product") ||
                  "Select Product"}</span
              >
            </label>
            {#if isLoadingProducts}
              <div class="loading-select">
                <div class="mini-spinner"></div>
                <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
              </div>
            {:else if products.length === 0}
              <p class="empty-message">
                {$_("seller_dashboard.no_products_in_category") ||
                  "No products found in this category"}
              </p>
            {:else}
              <select
                bind:value={selectedProduct}
                onchange={handleProductChange}
                class="form-select"
                class:rtl={$isRTL}
              >
                <option value="">
                  {$_("seller_dashboard.choose_product") ||
                    "Choose a product..."}
                </option>
                {#each products as product}
                  <option value={product.shortname}>
                    {getLocalizedDisplayName(product)}
                  </option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}

        <!-- Specifications/Variations -->
        {#if selectedProduct}
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <svg
                class="label-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span
                >{$_("seller_dashboard.product_variations") ||
                  "Product Variations"}</span
              >
            </label>
            {#if isLoadingSpecifications}
              <div class="loading-select">
                <div class="mini-spinner"></div>
                <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
              </div>
            {:else if specifications.length === 0}
              <p class="empty-message">
                {$_("seller_dashboard.no_variations") ||
                  "No variations found for this product"}
              </p>
            {:else}
              <div class="variations-table-wrapper">
                <table class="variations-table">
                  <thead>
                    <tr>
                      <th class:rtl={$isRTL}>
                        {$_("seller_dashboard.variation") || "Variation"}
                      </th>
                      <th class:rtl={$isRTL}>
                        {$_("seller_dashboard.sku") || "SKU"}
                      </th>
                      <th class:rtl={$isRTL}>
                        {$_("seller_dashboard.stock") || "Stock"}
                      </th>
                      <th class:rtl={$isRTL}>
                        {$_("seller_dashboard.price") || "Price"} ($)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each specifications as spec}
                      <tr>
                        <td class="variation-name-cell" class:rtl={$isRTL}>
                          <div class="variation-name-wrapper">
                            <svg
                              class="variation-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                              />
                            </svg>
                            <span>{getLocalizedDisplayName(spec)}</span>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            bind:value={variationPrices[spec.shortname].sku}
                            placeholder={$_("seller_dashboard.enter_sku") ||
                              "Enter SKU..."}
                            class="table-input sku-input-field"
                            class:rtl={$isRTL}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            bind:value={variationPrices[spec.shortname].stock}
                            placeholder="0"
                            class="table-input stock-input-field"
                            class:rtl={$isRTL}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            bind:value={variationPrices[spec.shortname].price}
                            placeholder="0.00"
                            class="table-input price-input-field"
                            class:rtl={$isRTL}
                          />
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeModal}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={submitProductVariations}
          disabled={!selectedProduct ||
            Object.values(variationPrices).every((v) => !v.price)}
        >
          {$_("seller_dashboard.add_items") || "Add Items"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Coupon Modal -->
{#if showCouponModal}
  <div class="modal-overlay" onclick={closeCouponModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_coupon") || "Create Coupon"}
        </h2>
        <button class="modal-close" onclick={closeCouponModal}>
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
        <!-- Type Selection -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <svg
              class="label-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span>{$_("seller_dashboard.coupon_type") || "Type"}</span>
          </label>
          <select
            bind:value={couponForm.type}
            class="form-select"
            class:rtl={$isRTL}
          >
            <option value="value"
              >{$_("seller_dashboard.value") || "Value"}</option
            >
            <option value="percentage"
              >{$_("seller_dashboard.percentage") || "Percentage"}</option
            >
          </select>
        </div>

        <!-- Min Value -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.min_value") || "Minimum Value"}</span>
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
          />
        </div>

        <!-- Max Value -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span
              >{$_("seller_dashboard.max_value") ||
                "Maximum Value (Optional)"}</span
            >
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={couponForm.maxValue}
            placeholder={$_("seller_dashboard.enter_max_value") ||
              "Enter maximum value"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>

        <!-- Amount -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span
              >{$_("seller_dashboard.amount") ||
                `Amount (${couponForm.type === "percentage" ? "%" : "$"})`}</span
            >
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={couponForm.type === "percentage" ? "100" : undefined}
            bind:value={couponForm.amount}
            placeholder={$_("seller_dashboard.enter_amount") || "Enter amount"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeCouponModal}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={submitCoupon}
          disabled={!couponForm.amount || !couponForm.minValue}
        >
          {$_("seller_dashboard.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Branch Modal -->
{#if showBranchModal}
  <div class="modal-overlay" onclick={closeBranchModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_branch") || "Create Branch"}
        </h2>
        <button class="modal-close" onclick={closeBranchModal}>
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
        <!-- Name -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.branch_name") || "Branch Name"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.name}
            placeholder={$_("seller_dashboard.enter_branch_name") ||
              "Enter branch name"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>

        <!-- Country -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.country") || "Country"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.country}
            placeholder={$_("seller_dashboard.enter_country") ||
              "Enter country"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>

        <!-- State -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.state") || "State (Optional)"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.state}
            placeholder={$_("seller_dashboard.enter_state") || "Enter state"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>

        <!-- City -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.city") || "City"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.city}
            placeholder={$_("seller_dashboard.enter_city") || "Enter city"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>

        <!-- Address -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.address") || "Address"}</span>
          </label>
          <textarea
            bind:value={branchForm.address}
            placeholder={$_("seller_dashboard.enter_address") ||
              "Enter full address"}
            class="form-textarea"
            class:rtl={$isRTL}
            rows="3"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeBranchModal}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={submitBranch}
          disabled={!branchForm.name ||
            !branchForm.country ||
            !branchForm.city ||
            !branchForm.address}
        >
          {$_("seller_dashboard.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Bundle Modal -->
{#if showBundleModal}
  <div class="modal-overlay" onclick={closeBundleModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_bundle") || "Add Bundle"}
        </h2>
        <button class="modal-close" onclick={closeBundleModal}>
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
        <!-- Product Selection -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <svg
              class="label-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <span
              >{$_("seller_dashboard.select_products") ||
                "Select Products (min. 2)"}</span
            >
          </label>

          {#if isLoadingSellerProducts}
            <div class="loading-select">
              <div class="mini-spinner"></div>
              <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
            </div>
          {:else if sellerProducts.length === 0}
            <p class="empty-message">
              {$_("seller_dashboard.no_products_found") ||
                "No products found. Create products first."}
            </p>
          {:else}
            <!-- Search and Filter Controls -->
            <div class="bundle-filters">
              <!-- Search Input -->
              <div class="bundle-search">
                <svg
                  class="search-icon-small"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="8" stroke-width="2" />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="m21 21-4.35-4.35"
                  />
                </svg>
                <input
                  type="text"
                  bind:value={bundleProductSearch}
                  oninput={filterBundleProducts}
                  placeholder={$_("seller_dashboard.search_products") ||
                    "Search products..."}
                  class="bundle-search-input"
                  class:rtl={$isRTL}
                />
                {#if bundleProductSearch}
                  <button
                    class="clear-search"
                    onclick={() => {
                      bundleProductSearch = "";
                      filterBundleProducts();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                {/if}
              </div>

              <!-- Category Filter -->
              {#if productCategories.length > 0}
                <div class="bundle-category-filter">
                  <svg
                    class="filter-icon-small"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 4h18M3 8h12M3 12h6"
                    />
                  </svg>
                  <select
                    bind:value={bundleCategoryFilter}
                    onchange={filterBundleProducts}
                    class="bundle-filter-select"
                    class:rtl={$isRTL}
                  >
                    <option value="all"
                      >{$_("seller_dashboard.all_categories") ||
                        "All Categories"}</option
                    >
                    {#each productCategories as category}
                      <option value={category}>{category}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>

            <!-- Products List -->
            <div class="products-checkboxes">
              {#if filteredSellerProducts.length === 0}
                <p class="no-results-message">
                  {$_("seller_dashboard.no_products_match") ||
                    "No products match your search criteria"}
                </p>
              {:else}
                {#each filteredSellerProducts as product}
                  <label class="checkbox-item">
                    <input
                      type="checkbox"
                      checked={bundleForm.selectedProducts.includes(
                        product.shortname
                      )}
                      onchange={() => toggleProductSelection(product.shortname)}
                      class="checkbox-input"
                    />
                    <span class="checkbox-label">
                      {getLocalizedDisplayName(product)}
                    </span>
                    <span class="checkbox-badge">
                      {product.shortname}
                    </span>
                  </label>
                {/each}
              {/if}
            </div>

            {#if bundleForm.selectedProducts.length > 0}
              <p class="selected-count">
                {bundleForm.selectedProducts.length}
                {bundleForm.selectedProducts.length === 1
                  ? "product"
                  : "products"} selected
                {#if bundleForm.selectedProducts.length < 2}
                  <span class="text-warning">(min. 2 required)</span>
                {/if}
              </p>
            {/if}
          {/if}
        </div>

        <!-- Price -->
        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("seller_dashboard.bundle_price") || "Bundle Price"}</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={bundleForm.price}
            placeholder={$_("seller_dashboard.enter_price") || "Enter price"}
            class="form-input"
            class:rtl={$isRTL}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeBundleModal}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={submitBundle}
          disabled={bundleForm.selectedProducts.length < 2 || !bundleForm.price}
        >
          {$_("seller_dashboard.add") || "Add"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && itemToEdit}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.edit_item") || "Edit Item"}
        </h2>
        <button class="modal-close" onclick={closeEditModal}>
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
        {#if itemToEdit.subpath.includes("/coupons")}
          <!-- Coupon Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.coupon_type") || "Type"}</span>
            </label>
            <select
              bind:value={couponForm.type}
              class="form-select"
              class:rtl={$isRTL}
            >
              <option value="value"
                >{$_("seller_dashboard.value") || "Value"}</option
              >
              <option value="percentage"
                >{$_("seller_dashboard.percentage") || "Percentage"}</option
              >
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.min_value") || "Minimum Value"}</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.minValue}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span
                >{$_("seller_dashboard.max_value") ||
                  "Maximum Value (Optional)"}</span
              >
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.maxValue}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.amount") || "Amount"}</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.amount}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
        {:else if itemToEdit.subpath.includes("/branch")}
          <!-- Branch Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.branch_name") || "Branch Name"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.name}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.country") || "Country"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.country}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.state") || "State (Optional)"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.state}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.city") || "City"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.city}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span>{$_("seller_dashboard.address") || "Address"}</span>
            </label>
            <textarea
              bind:value={branchForm.address}
              class="form-textarea"
              class:rtl={$isRTL}
              rows="3"
            ></textarea>
          </div>
        {:else if itemToEdit.subpath.includes("/bundles")}
          <!-- Bundle Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span
                >{$_("seller_dashboard.select_products") ||
                  "Select Products (min. 2)"}</span
              >
            </label>
            {#if isLoadingSellerProducts}
              <div class="loading-select">
                <div class="mini-spinner"></div>
                <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
              </div>
            {:else if sellerProducts.length === 0}
              <p class="empty-message">No products found</p>
            {:else}
              <div class="products-checkboxes">
                {#each sellerProducts as product}
                  <label class="checkbox-item">
                    <input
                      type="checkbox"
                      checked={bundleForm.selectedProducts.includes(
                        product.shortname
                      )}
                      onchange={() => toggleProductSelection(product.shortname)}
                      class="checkbox-input"
                    />
                    <span class="checkbox-label"
                      >{getLocalizedDisplayName(product)}</span
                    >
                  </label>
                {/each}
              </div>
              {#if bundleForm.selectedProducts.length > 0}
                <p class="selected-count">
                  {bundleForm.selectedProducts.length} products selected
                  {#if bundleForm.selectedProducts.length < 2}
                    <span class="text-warning">(min. 2 required)</span>
                  {/if}
                </p>
              {/if}
            {/if}
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              <span
                >{$_("seller_dashboard.bundle_price") || "Bundle Price"}</span
              >
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={bundleForm.price}
              class="form-input"
              class:rtl={$isRTL}
            />
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeEditModal}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button class="modal-button submit" onclick={submitEdit}>
          {$_("seller_dashboard.save") || "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && itemToDelete}
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
          {$_("seller_dashboard.delete_confirmation") ||
            "Are you sure you want to delete this item?"}
        </p>
        <p class="delete-item-name">
          <strong>{getLocalizedDisplayName(itemToDelete)}</strong>
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

  .seller-dashboard-container {
    min-height: 100vh;
    padding: 2rem;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .seller-dashboard-content {
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Header Styles */
  .dashboard-header {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.5);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex: 1;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 600;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .back-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .back-text {
    font-size: 0.95rem;
  }

  .header-icon-wrapper {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }

  .header-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: white;
  }

  .header-text {
    flex: 1;
  }

  .dashboard-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1a202c;
    margin: 0 0 0.25rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .dashboard-subtitle {
    font-size: 1rem;
    color: #718096;
    margin: 0;
  }

  .create-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 600;
    padding: 1rem 1.75rem;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    font-size: 1rem;
  }

  .create-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(102, 126, 234, 0.5);
  }

  .button-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Folders Grid */
  .folders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .folder-card {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .folder-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transform: scaleX(0);
    transition: transform 0.4s ease;
  }

  .folder-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    border-color: #667eea;
  }

  .folder-card:hover::before {
    transform: scaleX(1);
  }

  .folder-card-icon {
    width: 5rem;
    height: 5rem;
    background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    transition: all 0.3s ease;
  }

  .folder-card:hover .folder-card-icon {
    transform: scale(1.1) rotate(5deg);
    background: linear-gradient(135deg, #667eea25 0%, #764ba225 100%);
  }

  .folder-icon {
    width: 3rem;
    height: 3rem;
    color: #667eea;
  }

  .folder-card-body {
    flex: 1;
  }

  .folder-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 0.5rem 0;
  }

  .folder-title.rtl {
    text-align: right;
  }

  .folder-shortname {
    font-size: 0.85rem;
    color: #a0aec0;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    margin: 0 0 0.75rem 0;
    padding: 0.25rem 0.75rem;
    background: #f7fafc;
    border-radius: 6px;
    display: inline-block;
  }

  .folder-description {
    font-size: 0.95rem;
    color: #718096;
    line-height: 1.6;
    margin: 0;
  }

  .folder-description.rtl {
    text-align: right;
  }

  .folder-card-footer {
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
  }

  .folder-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #718096;
    font-size: 0.875rem;
  }

  .meta-icon {
    width: 1rem;
    height: 1rem;
    stroke-width: 2;
  }

  .meta-text {
    font-size: 0.875rem;
  }

  /* Filters Section */
  .filters-section {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    padding: 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.5);
  }

  .search-bar {
    position: relative;
    margin-bottom: 1.5rem;
  }

  .search-icon {
    position: absolute;
    left: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    color: #a0aec0;
    width: 1.25rem;
    height: 1.25rem;
    stroke-width: 2;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 1rem 1.25rem 1rem 3.5rem;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    font-size: 1rem;
    transition: all 0.3s ease;
    background: white;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  .search-input.rtl {
    text-align: right;
    padding: 1rem 3.5rem 1rem 1.25rem;
  }

  .search-input.rtl ~ .search-icon {
    left: auto;
    right: 1.25rem;
  }

  .filters-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .filter-item {
    flex: 1;
    min-width: 200px;
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 0 1rem;
    transition: all 0.3s ease;
  }

  .filter-item:focus-within {
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  .filter-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #a0aec0;
    margin-right: 0.75rem;
    stroke-width: 2;
    flex-shrink: 0;
  }

  .filter-select {
    flex: 1;
    padding: 0.875rem 0;
    border: none;
    background: transparent;
    font-size: 0.95rem;
    cursor: pointer;
    color: #2d3748;
    font-weight: 500;
  }

  .filter-select:focus {
    outline: none;
  }

  .filter-select.rtl {
    text-align: right;
  }

  .sort-toggle {
    padding: 0.875rem 1.25rem;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sort-toggle:hover {
    background: #f7fafc;
    border-color: #667eea;
  }

  .sort-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: #667eea;
    stroke-width: 2.5;
  }

  /* Loading State */
  .loading-state {
    text-align: center;
    padding: 5rem 2rem;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }

  .loading-spinner {
    width: 4rem;
    height: 4rem;
    border: 4px solid #e2e8f0;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem auto;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 1.1rem;
    color: #718096;
    font-weight: 500;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 5rem 2rem;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }

  .empty-icon {
    width: 6rem;
    height: 6rem;
    color: #cbd5e0;
    margin: 0 auto 2rem auto;
    stroke-width: 1.5;
  }

  .empty-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 0.75rem;
  }

  .empty-description {
    font-size: 1.1rem;
    color: #718096;
    margin-bottom: 2.5rem;
    line-height: 1.6;
  }

  .create-button-large {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 600;
    padding: 1.25rem 2.5rem;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    font-size: 1.1rem;
  }

  .create-button-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(102, 126, 234, 0.5);
  }

  /* Items Stats */
  .items-stats {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding: 1rem 1.5rem;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 14px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  }

  .stats-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: #667eea;
    stroke-width: 2;
  }

  .stats-text {
    color: #718096;
    font-size: 0.95rem;
    margin: 0;
  }

  .stats-text strong {
    color: #667eea;
    font-weight: 700;
  }

  /* Items Grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .item-card {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
    position: relative;
  }

  .item-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transform: scaleX(0);
    transition: transform 0.4s ease;
  }

  .item-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    border-color: #667eea;
  }

  .item-card:hover::before {
    transform: scaleX(1);
  }

  .item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
    border-bottom: 1px solid #e2e8f0;
  }

  .item-type-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
  }

  .type-icon {
    width: 1rem;
    height: 1rem;
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.625rem;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-button:hover {
    transform: scale(1.1);
  }

  .action-button.view:hover {
    background: #667eea;
    border-color: #667eea;
  }

  .action-button.view:hover .action-icon {
    color: white;
  }

  .action-button.edit:hover {
    background: #48bb78;
    border-color: #48bb78;
  }

  .action-button.edit:hover .action-icon {
    color: white;
  }

  .action-button.delete:hover {
    background: #f56565;
    border-color: #f56565;
  }

  .action-button.delete:hover .action-icon {
    color: white;
  }

  .action-icon {
    width: 1.125rem;
    height: 1.125rem;
    color: #718096;
    stroke-width: 2;
    transition: color 0.3s ease;
  }

  .item-card-body {
    padding: 1.75rem 1.5rem;
  }

  .item-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .item-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    line-height: 1.4;
    flex: 1;
    min-width: 0;
  }

  .item-title.rtl {
    text-align: right;
  }

  .item-category-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.9rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1.5px solid;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .item-category-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .category-icon {
    font-size: 1.1rem;
    line-height: 1;
  }

  .category-text {
    font-weight: 600;
  }

  .item-shortname {
    font-size: 0.85rem;
    color: #a0aec0;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    margin: 0 0 1rem 0;
    padding: 0.25rem 0.75rem;
    background: #f7fafc;
    border-radius: 6px;
    display: inline-block;
  }

  .item-preview {
    font-size: 0.95rem;
    color: #718096;
    line-height: 1.7;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .item-preview.rtl {
    text-align: right;
  }

  .item-card-footer {
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
    border-top: 1px solid #e2e8f0;
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #718096;
    font-size: 0.875rem;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .seller-dashboard-container {
      padding: 1rem;
    }

    .dashboard-header {
      padding: 1.5rem;
    }

    .header-content {
      flex-direction: column;
      align-items: stretch;
    }

    .header-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .back-button {
      align-self: flex-start;
    }

    .create-button {
      width: 100%;
      justify-content: center;
    }

    .dashboard-title {
      font-size: 1.5rem;
    }

    .filters-section {
      padding: 1rem;
    }

    .filters-group {
      flex-direction: column;
    }

    .filter-item {
      min-width: 100%;
    }

    .sort-toggle {
      width: 100%;
    }

    .items-grid,
    .folders-grid {
      grid-template-columns: 1fr;
    }

    .item-card-header {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .item-type-badge {
      flex: 1;
    }
  }

  @media (max-width: 480px) {
    .dashboard-title {
      font-size: 1.25rem;
    }

    .dashboard-subtitle {
      font-size: 0.9rem;
    }

    .item-title {
      font-size: 1.1rem;
    }

    .folder-title {
      font-size: 1.2rem;
    }

    .empty-icon {
      width: 4rem;
      height: 4rem;
    }

    .empty-title {
      font-size: 1.4rem;
    }
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.3s ease;
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
    border-radius: 24px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
    width: 50%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(30px);
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
    padding: 2rem;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .modal-close {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 12px;
    border: none;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  .modal-close:hover {
    background: #f7fafc;
    transform: scale(1.1);
  }

  .close-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #718096;
    stroke-width: 2.5;
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    margin-bottom: 1.75rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 0.75rem;
  }

  .form-label.rtl {
    flex-direction: row-reverse;
  }

  .label-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #667eea;
    stroke-width: 2;
  }

  .form-select {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.95rem;
    color: #2d3748;
    background: white;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .form-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  .form-select.rtl {
    text-align: right;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.95rem;
    color: #2d3748;
    background: white;
    transition: all 0.3s ease;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  .form-input.rtl,
  .form-textarea.rtl {
    text-align: right;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .loading-select {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #f7fafc;
    border-radius: 12px;
    color: #718096;
    font-size: 0.95rem;
  }

  .mini-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .empty-message {
    padding: 1rem;
    background: #fff5f5;
    border: 1px solid #feb2b2;
    border-radius: 12px;
    color: #c53030;
    font-size: 0.9rem;
    text-align: center;
    margin: 0;
  }

  .variations-table-wrapper {
    width: fit-content;
    overflow-x: auto;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    background: white;
  }

  .variations-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }

  .variations-table thead {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .variations-table thead th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .variations-table thead th.rtl {
    text-align: right;
  }

  .variations-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
    transition: all 0.2s ease;
  }

  .variations-table tbody tr:last-child {
    border-bottom: none;
  }

  .variations-table tbody tr:hover {
    background: #f7fafc;
  }

  .variations-table tbody td {
    padding: 1rem;
    vertical-align: middle;
  }

  .variation-name-cell {
    font-weight: 500;
    color: #2d3748;
    min-width: 180px;
  }

  .variation-name-cell.rtl {
    text-align: right;
  }

  .variation-name-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .variation-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #667eea;
    stroke-width: 2;
    flex-shrink: 0;
  }

  .table-input {
    width: fit-content;
    padding: 0.625rem 0.875rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    color: #2d3748;
    transition: all 0.3s ease;
    background: white;
  }

  .table-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .table-input.rtl {
    text-align: right;
  }

  .price-input-field {
    max-width: 120px;
    font-weight: 600;
    color: #667eea;
  }

  .stock-input-field {
    max-width: 100px;
  }

  .sku-input-field {
    min-width: 150px;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    font-size: 0.85rem;
  }

  .table-input::placeholder {
    color: #cbd5e0;
    font-weight: 400;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    background: #f7fafc;
  }

  .modal-button {
    padding: 0.875rem 1.75rem;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
  }

  .modal-button.cancel {
    background: white;
    color: #718096;
    border: 2px solid #e2e8f0;
  }

  .modal-button.cancel:hover {
    background: #f7fafc;
    border-color: #cbd5e0;
  }

  .modal-button.submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .modal-button.submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
  }

  .modal-button.submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-button.delete {
    background: linear-gradient(135deg, #f56565 0%, #c53030 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(245, 101, 101, 0.4);
  }

  .modal-button.delete:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(245, 101, 101, 0.5);
  }

  .modal-container.small {
    max-width: 500px;
  }

  .delete-message {
    font-size: 1rem;
    color: #4a5568;
    margin-bottom: 1rem;
  }

  .delete-item-name {
    font-size: 1.1rem;
    color: #1a202c;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #fff5f5;
    border-radius: 8px;
    text-align: center;
  }

  .delete-warning {
    font-size: 0.9rem;
    color: #e53e3e;
    font-weight: 600;
    margin: 0;
  }

  /* Bundle Search and Filter Styles */
  .bundle-filters {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .bundle-search {
    position: relative;
    flex: 1;
    min-width: 200px;
  }

  .search-icon-small {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.125rem;
    height: 1.125rem;
    stroke: #a0aec0;
    pointer-events: none;
  }

  .bundle-search-input {
    width: 100%;
    padding: 0.75rem 2.75rem 0.75rem 2.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .bundle-search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .bundle-search-input.rtl {
    padding: 0.75rem 2.75rem 0.75rem 2.75rem;
    text-align: right;
  }

  .bundle-search-input.rtl ~ .search-icon-small {
    left: auto;
    right: 1rem;
  }

  .clear-search {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .clear-search:hover {
    background: #f7fafc;
  }

  .clear-search svg {
    width: 1rem;
    height: 1rem;
    stroke: #a0aec0;
  }

  .bundle-category-filter {
    position: relative;
    min-width: 180px;
  }

  .filter-icon-small {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1rem;
    height: 1rem;
    stroke: #a0aec0;
    pointer-events: none;
  }

  .bundle-filter-select {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a0aec0'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1.25rem;
  }

  .bundle-filter-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .bundle-filter-select.rtl {
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    text-align: right;
    background-position: left 0.75rem center;
  }

  .bundle-filter-select.rtl ~ .filter-icon-small {
    left: auto;
    right: 0.875rem;
  }

  .no-results-message {
    text-align: center;
    padding: 2rem 1rem;
    color: #a0aec0;
    font-size: 0.95rem;
    font-style: italic;
  }

  /* Checkbox styles for bundle products */
  .products-checkboxes {
    max-height: 300px;
    overflow-y: auto;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.5rem;
    background: white;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 0.5rem;
  }

  .checkbox-item:hover {
    background: #f7fafc;
  }

  .checkbox-input {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: #667eea;
  }

  .checkbox-label {
    flex: 1;
    font-size: 0.95rem;
    color: #2d3748;
    font-weight: 500;
  }

  .checkbox-badge {
    font-size: 0.8rem;
    color: #a0aec0;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    padding: 0.25rem 0.5rem;
    background: #f7fafc;
    border-radius: 4px;
  }

  .selected-count {
    margin-top: 0.75rem;
    font-size: 0.9rem;
    color: #4a5568;
    font-weight: 600;
  }

  .text-warning {
    color: #ed8936;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .modal-container {
      max-width: 95%;
      margin: 0 1rem;
    }

    .modal-header,
    .modal-body {
      padding: 1.5rem;
    }

    .modal-footer {
      flex-direction: column;
      padding: 1rem 1.5rem;
    }

    .modal-button {
      width: 100%;
    }

    /* Make table scrollable on mobile */
    .variations-table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .variations-table {
      min-width: 600px;
    }

    .variations-table thead th,
    .variations-table tbody td {
      padding: 0.75rem 0.5rem;
      font-size: 0.85rem;
    }

    .table-input {
      padding: 0.5rem 0.625rem;
      font-size: 0.85rem;
    }

    .variation-name-cell {
      min-width: 140px;
    }

    .price-input-field {
      max-width: 100px;
    }

    .stock-input-field {
      max-width: 80px;
    }

    .sku-input-field {
      min-width: 120px;
    }
  }
</style>
