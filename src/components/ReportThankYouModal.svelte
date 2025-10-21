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
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={handleBackdropClick}
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 transform transition-all duration-300 scale-100"
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {$_("thank_you_for_report")}
        </h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
            />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="mb-6">
        <div class="flex items-center mb-4">
          <div
            class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-green-600 dark:text-green-400"
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
          <div class="ml-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              {$_("report_submitted_successfully")}
            </h3>
          </div>
        </div>

        <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          {$_("thanks_for_report_message")}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex justify-end">
        <button
          on:click={handleClose}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          {$_("got_it")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
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

  .transform {
    animation: slideIn 0.3s ease-out;
  }
</style>
