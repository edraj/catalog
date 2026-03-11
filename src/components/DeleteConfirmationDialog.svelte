<script lang="ts">
  import { Modal } from "flowbite-svelte";
  import { _ } from "@/i18n";
  import { Diamonds } from "svelte-loading-spinners";

  interface Props {
    open?: boolean;
    title?: string;
    itemName?: string;
    itemType?: string;
    isDeleting?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }

  let {
    open = $bindable(false),
    title = "",
    itemName = "",
    itemType = "item",
    isDeleting = false,
    onConfirm = () => {},
    onCancel = () => {},
  }: Props = $props();

  function handleConfirm() {
    onConfirm();
  }

  function handleCancel() {
    onCancel();
  }

  const displayTitle = title || $_("delete_confirmation.title", { values: { type: itemType } });
</script>

<Modal
  title="⚠️ {displayTitle}"
  bind:open={open}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  <div class="delete-warning">
    <div class="delete-warning-header">
      <div class="delete-icon">⚠️</div>
      <div>
        <h4>{$_("delete_confirmation.confirm")}</h4>
        <p>{$_("delete_confirmation.irreversible")}</p>
      </div>
    </div>
  </div>

  <div class="item-details">
    <p>
      <strong>{$_("delete_confirmation.item_label")}:</strong>
      {itemName}
    </p>
  </div>

  <div class="delete-final-warning">
    {$_("delete_confirmation.warning")}
  </div>

  {#snippet footer()}
    <button
      onclick={handleCancel}
      class="btn btn-secondary"
      disabled={isDeleting}
    >
      {$_("cancel")}
    </button>
    <button
      onclick={handleConfirm}
      disabled={isDeleting}
      class="btn btn-danger"
    >
      {#if isDeleting}
        <Diamonds size="20" color="#ffffff" />
        {$_("deleting")}
      {:else}
        {$_("delete")}
      {/if}
    </button>
  {/snippet}
</Modal>

<style>
  .delete-warning {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fca5a5;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .delete-warning-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.rtl) .delete-warning-header {
    flex-direction: row-reverse;
  }

  .delete-icon {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .delete-warning h4 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #991b1b;
    margin: 0;
  }

  .delete-warning p {
    font-size: 0.875rem;
    color: #7f1d1d;
    margin: 0;
  }

  .item-details {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
    margin: 1rem 0;
  }

  .item-details p {
    font-size: 0.875rem;
    margin: 0.25rem 0;
  }

  .item-details strong {
    color: #374151;
  }

  .delete-final-warning {
    font-size: 0.875rem;
    color: #dc2626;
    font-weight: 500;
    text-align: center;
    padding: 0.75rem;
    background: #fef2f2;
    border-radius: 8px;
    border: 1px solid #fca5a5;
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
    min-width: 100px;
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

  .btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(239, 68, 68, 0.4);
  }
</style>
