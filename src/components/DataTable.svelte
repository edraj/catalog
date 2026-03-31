<script lang="ts">
  import type { Snippet } from "svelte";
  import { _, locale } from "@/i18n";
  import { formatNumber } from "@/lib/helpers";

  interface IndexAttribute {
    key: string;
    name: string | Record<string, string>;
  }

  interface CellSnippetContext {
    item: any;
    attr: IndexAttribute;
    index: number;
  }

  interface ActionsSnippetContext {
    item: any;
    index: number;
  }

  interface BulkActionsSnippetContext {
    selectedCount: number;
  }

  interface StateSnippetContext {
    items: any[];
  }

  interface Props {
    items: any[];
    indexAttributes?: IndexAttribute[];
    selectable?: boolean;
    selectedItems?: Set<string>;
    onSelectAll?: (checked: boolean) => void;
    onSelectItem?: (id: string) => void;
    onRowClick?: (item: any, event: MouseEvent) => void;
    loading?: boolean;
    emptyMessage?: string;
    currentPage?: number;
    totalPages?: number;
    totalItems?: number;
    itemsPerPage?: number;
    onPageChange?: (page: number) => void;
    onItemsPerPageChange?: (count: number) => void;
    itemsPerPageOptions?: number[];
    rtl?: boolean;
    name?: string;
    class?: string;
    cell: Snippet<[CellSnippetContext]>;
    actions: Snippet<[ActionsSnippetContext]>;
    bulkActions?: Snippet<[BulkActionsSnippetContext]>;
    loadingState?: Snippet<[StateSnippetContext]>;
    emptyState?: Snippet<[StateSnippetContext]>;
  }

  let {
    items = [],
    indexAttributes = [],
    selectable = false,
    selectedItems = new Set(),
    onSelectAll,
    onSelectItem,
    onRowClick,
    loading = false,
    emptyMessage,
    currentPage = 1,
    totalPages = 1,
    totalItems = 0,
    itemsPerPage = 10,
    onPageChange,
    onItemsPerPageChange,
    itemsPerPageOptions = [10, 25, 50, 100],
    rtl = false,
    name,
    class: className = "",
    cell,
    actions,
    bulkActions,
    loadingState,
    emptyState,
  }: Props = $props();

  const defaultIndexAttributes: IndexAttribute[] = [
    { key: "shortname", name: "Shortname" },
    { key: "is_active", name: "Status" },
    { key: "created_at", name: "Created At" },
    { key: "updated_at", name: "Updated At" },
  ];

  const effectiveIndexAttributes = $derived(
    indexAttributes &&
      indexAttributes.length > 0 &&
      indexAttributes.some((attr) => attr && Object.keys(attr).length > 0)
      ? indexAttributes
      : defaultIndexAttributes,
  );

  const allSelected = $derived(
    selectedItems.size > 0 && selectedItems.size === items.length,
  );

  const someSelected = $derived(
    selectedItems.size > 0 && selectedItems.size < items.length,
  );

  const showPagination = $derived(totalPages > 1);

  const actionsLabel = $derived(
    name
      ? name in { en: 1, ar: 1, ku: 1 }
        ? ($_(name) || "")
        : name
      : ($_("actions.name") || ""),
  );

  function getAttributeName(attr: IndexAttribute): string {
    if (typeof attr.name === "string") {
      if (attr.name in { en: 1, ar: 1, ku: 1 }) {
        return $_(attr.name + ".name") || "";
      }
      return attr.name;
    }
    if (typeof attr.name === "object" && attr.name !== null) {
      return attr.name.en || attr.name.ar || attr.name.ku || "";
    }
    return "";
  }

  function getItemId(item: any): string {
    return item.shortname || item.id || String(items.indexOf(item));
  }

  function handleSelectAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    onSelectAll?.(checked);
  }

  function handleSelectItem(id: string) {
    onSelectItem?.(id);
  }

  function handleRowClick(item: any, event: MouseEvent) {
    onRowClick?.(item, event);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      onPageChange?.(page);
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      onPageChange?.(currentPage + 1);
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1);
    }
  }

  function handleItemsPerPageChange(e: Event) {
    const value = parseInt((e.target as HTMLSelectElement).value, 10);
    onItemsPerPageChange?.(value);
  }

  const paginationStart = $derived(
    totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1,
  );

  const paginationEnd = $derived(
    Math.min(currentPage * itemsPerPage, totalItems),
  );
</script>

<div class="data-table-container" class:rtl>
  {#if selectable && selectedItems.size > 0 && bulkActions}
    <div class="bulk-actions-bar" class:rtl>
      <div class="bulk-actions-content">
        <div class="bulk-actions-info">
          <span class="bulk-actions-count">
            {selectedItems.size}
            {$_("admin_content.bulk_actions.items_selected")}
          </span>
        </div>
        <div class="bulk-actions-buttons">
          {@render bulkActions({ selectedCount: selectedItems.size })}
        </div>
      </div>
    </div>
  {/if}

  <div class="data-table-card">
    {#if loading}
      {#if loadingState}
        {@render loadingState({ items })}
      {:else}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>{$_("loading") || "Loading..."}</span>
        </div>
      {/if}
    {:else if items.length === 0}
      {#if emptyState}
        {@render emptyState({ items })}
      {:else}
        <div class="empty-state">
          <div class="empty-state-icon">
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
              />
            </svg>
          </div>
          <h3 class="empty-state-title">
            {$_("admin_content.empty.title") || "No items found"}
          </h3>
          <p class="empty-state-description">
            {emptyMessage || $_("admin_content.empty.description") || "There are no items to display."}
          </p>
        </div>
      {/if}
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-gray-100">
              {#if selectable}
                <th class="px-4 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onchange={handleSelectAll}
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    aria-label={$_("admin_content.bulk_actions.select_all")}
                  />
                </th>
              {/if}
              {#each effectiveIndexAttributes as attr}
                <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {getAttributeName(attr)}
                </th>
              {/each}
              <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {actionsLabel}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            {#each items as item, index}
              {@const itemId = getItemId(item)}
              <tr
                class="data-table-row hover:bg-gray-50/50 transition-colors group cursor-pointer {selectable && selectedItems.has(itemId) ? 'bg-indigo-50/30' : ''}"
                onclick={(e) => handleRowClick(item, e)}
              >
                {#if selectable}
                  <td class="px-4 py-8" onclick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(itemId)}
                      onchange={() => handleSelectItem(itemId)}
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      aria-label={$_("admin_content.bulk_actions.select_item", { values: { name: itemId } })}
                    />
                  </td>
                {/if}
                {#each effectiveIndexAttributes as attr}
                  <td class="px-6 py-8">
                    {@render cell({ item, attr, index })}
                  </td>
                {/each}
                <td class="px-6 py-8">
                  <div class="flex items-center justify-end gap-4">
                    {@render actions({ item, index })}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if showPagination || items.length > 0}
        <div class="data-table-pagination">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">
                {$_("admin_content.pagination.items_per_page") || "Items per page"}
              </span>
              <select
                value={itemsPerPage}
                onchange={handleItemsPerPageChange}
                class="bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-lg pl-3 pr-8 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                {#each itemsPerPageOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>

            {#if showPagination}
              <div class="text-sm text-gray-500 hidden sm:block">
                {$_("admin_content.pagination.showing", {
                  values: {
                    start: formatNumber(paginationStart, $locale || "en"),
                    end: formatNumber(paginationEnd, $locale || "en"),
                    total: formatNumber(totalItems, $locale || "en"),
                  },
                })}
              </div>

              <div class="flex items-center gap-2">
                <button
                  onclick={previousPage}
                  disabled={currentPage === 1}
                  class="pagination-btn"
                  aria-label={$_("admin_content.pagination.previous")}
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <div class="flex items-center gap-1">
                  {#if totalPages <= 7}
                    {#each Array(totalPages) as _, i}
                      <button
                        class="pagination-page-btn {currentPage === i + 1 ? 'pagination-page-btn-active' : ''}"
                        onclick={() => goToPage(i + 1)}
                      >
                        {formatNumber(i + 1, $locale || "en")}
                      </button>
                    {/each}
                  {:else}
                    <button
                      class="pagination-page-btn {currentPage === 1 ? 'pagination-page-btn-active' : ''}"
                      onclick={() => goToPage(1)}
                    >
                      {formatNumber(1, $locale || "en")}
                    </button>

                    {#if currentPage > 3}
                      <span class="pagination-ellipsis">...</span>
                    {/if}

                    {#each Array(totalPages) as _, i}
                      {#if i + 1 > 1 && i + 1 < totalPages && Math.abs(currentPage - (i + 1)) <= 1}
                        <button
                          class="pagination-page-btn {currentPage === i + 1 ? 'pagination-page-btn-active' : ''}"
                          onclick={() => goToPage(i + 1)}
                        >
                          {formatNumber(i + 1, $locale || "en")}
                        </button>
                      {/if}
                    {/each}

                    {#if currentPage < totalPages - 2}
                      <span class="pagination-ellipsis">...</span>
                    {/if}

                    <button
                      class="pagination-page-btn {currentPage === totalPages ? 'pagination-page-btn-active' : ''}"
                      onclick={() => goToPage(totalPages)}
                    >
                      {formatNumber(totalPages, $locale || "en")}
                    </button>
                  {/if}
                </div>

                <button
                  onclick={nextPage}
                  disabled={currentPage === totalPages}
                  class="pagination-btn"
                  aria-label={$_("admin_content.pagination.next")}
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            {:else}
              <div class="text-sm text-gray-500">
                {$_("admin_content.pagination.total_items", {
                  values: { total: formatNumber(totalItems, $locale || "en") },
                })}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .rtl {
    direction: rtl;
  }

  .data-table-container {
    width: 100%;
  }

  .data-table-card {
    background: white;
    border-radius: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid #f0f0ee;
    overflow: hidden;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px;
    color: #6b7280;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 12px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 64px;
  }

  .empty-state-icon {
    width: 64px;
    height: 64px;
    background: #f9fafb;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    color: #9ca3af;
  }

  .empty-state-title {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 8px;
  }

  .empty-state-description {
    color: #6b7280;
    margin-bottom: 24px;
  }

  .data-table-row:hover td:last-child > div {
    opacity: 1 !important;
  }

  .data-table-pagination {
    padding: 16px;
    border-top: 1px solid #f0f0ee;
    background: #f9fafb/50;
  }

  .pagination-btn {
    padding: 8px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pagination-btn:hover:not(:disabled) {
    background: #f9fafb;
    color: #4f46e5;
    border-color: #e0e7ff;
  }

  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pagination-page-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    background: white;
    border: 1px solid #e5e7eb;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pagination-page-btn:hover {
    background: #f9fafb;
    color: #4f46e5;
  }

  .pagination-page-btn-active {
    background: #4f46e5 !important;
    color: white !important;
    border-color: #4f46e5 !important;
  }

  .pagination-ellipsis {
    padding: 0 4px;
    color: #9ca3af;
  }

  .bulk-actions-bar {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px 20px;
    margin-bottom: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .bulk-actions-bar.rtl {
    direction: rtl;
  }

  .bulk-actions-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .bulk-actions-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .bulk-actions-count {
    color: #1f2937;
    font-weight: 600;
    font-size: 15px;
  }

  .bulk-actions-buttons {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  @media (max-width: 640px) {
    .bulk-actions-content {
      flex-direction: column;
      align-items: stretch;
    }

    .bulk-actions-buttons {
      justify-content: stretch;
    }
  }
</style>
