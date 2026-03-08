<script lang="ts">
  import { _ } from "@/i18n";

  export let show = false;
  export let onClose: () => void = () => {};

  function handleClose() {
    show = false;
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      handleClose();
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-backdrop"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
  >
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">{$_("reports.modal.thank_you")}</h2>
        <button
          type="button"
          class="close-button"
          on:click={handleClose}
          aria-label={$_("common.close")}
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

      <div class="modal-body success-content">
        <div class="success-icon-container">
          <svg
            class="success-icon"
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
        </div>
        
        <h3 class="success-title">{$_("reports.modal.submitted_successfully")}</h3>
        <p class="success-message">
          {$_("reports.modal.thanks_message")}
        </p>

        <div class="modal-actions">
          <button
            type="button"
            class="submit-button"
            on:click={handleClose}
          >
            {$_("common.got_it")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
    padding: 1rem;
  }

  .modal-container {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-width: 28rem;
    width: 100%;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .close-button {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    color: #374151;
    background-color: #f3f4f6;
  }

  .close-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-body {
    padding: 2rem 1.5rem;
    text-align: center;
  }

  .success-icon-container {
    width: 3.5rem;
    height: 3.5rem;
    background-color: #ecfdf5;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.25rem auto;
  }

  .success-icon {
    width: 1.75rem;
    height: 1.75rem;
    color: #10b981;
  }

  .success-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.75rem 0;
  }

  .success-message {
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
  }

  .modal-actions {
    display: flex;
    justify-content: center;
  }

  .submit-button {
    padding: 0.625rem 1.5rem;
    background-color: #3b82f6;
    color: white;
    border: 1px solid #3b82f6;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .submit-button:hover {
    background-color: #2563eb;
    border-color: #2563eb;
  }
</style>
