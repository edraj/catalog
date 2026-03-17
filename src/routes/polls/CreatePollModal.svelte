<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { createEntity } from "@/lib/dmart_services/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";

  export let onClose = () => {};

  const dispatch = createEventDispatcher();

  let title = "";
  let description = "";
  let space = "";
  let choiceType = "single";
  let options = ["", "", ""];
  let isSubmitting = false;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function addOption() {
    options = [...options, ""];
  }

  function removeOption(index) {
    if (options.length <= 2) {
      errorToastMessage($_("polls.min_options_error"));
      return;
    }
    options = options.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      errorToastMessage($_("polls.title_required"));
      return;
    }
    if (!space.trim()) {
      errorToastMessage($_("polls.space_required"));
      return;
    }

    const validOptions = options.filter((o) => o.trim() !== "");
    if (validOptions.length < 2) {
      errorToastMessage($_("polls.min_valid_options_error"));
      return;
    }

    isSubmitting = true;

    try {
      const candidates = validOptions.map((opt, i) => ({
        key: `opt${i + 1}`,
        value: opt.trim(),
      }));

      const pollData = {
        shortname: undefined,
        displayname: title,
        description: description,
        is_active: true,
        tags: [space],
        body: {
          candidates,
          choiceType,
        },
      };

      const attributes: any = {
        displayname: { en: pollData.displayname || "" },
        description: { en: pollData.description || "", ar: "", ku: "" },
        is_active: pollData.is_active !== false,
        tags: pollData.tags || [],
        relationships: [],
        payload: {
          content_type: "json",
          body: pollData.body,
        },
      };

      const response = await createEntity(
        "poll",
        "/polls",
        ResourceType.content,
        attributes,
        pollData.shortname || "auto",
      );

      if (response) {
        successToastMessage($_("polls.create_success"));
        dispatch("success");
        onClose();
      } else {
        errorToastMessage($_("polls.create_error"));
      }
    } catch (error) {
      console.error("Error creating poll:", error);
      errorToastMessage($_("polls.create_error"));
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div
  class="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4 xl:p-0 backdrop-blur-sm"
  onclick={onClose}
  onkeydown={(e) => e.key === "Escape" && onClose()}
  class:rtl={$isRTL}
  role="dialog"
  aria-modal="true"
  tabindex="0"
>
  <div
    class="bg-white rounded-3xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="document"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-100">
      <h2 class="text-[1.35rem] font-bold text-gray-900 tracking-tight">
        {$_("polls.create_poll")}
      </h2>
      <button
        class="p-2 -mr-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        onclick={onClose}
        aria-label={$_("polls.cancel")}
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div class="p-6 md:p-8 overflow-y-auto space-y-6">
      <!-- Title -->
      <div>
        <label
          for="poll-title"
          class="block text-sm font-semibold text-gray-700 mb-2"
        >
          {$_("polls.title")}
        </label>
        <input
          id="poll-title"
          type="text"
          bind:value={title}
          class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      <!-- Description -->
      <div>
        <label
          for="poll-description"
          class="block text-sm font-semibold text-gray-700 mb-2"
        >
          {$_("polls.description")}
        </label>
        <textarea
          id="poll-description"
          bind:value={description}
          rows="3"
          class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm resize-none"
        ></textarea>
      </div>

      <!-- Space -->
      <div>
        <label
          for="poll-space"
          class="block text-sm font-semibold text-gray-700 mb-2"
        >
          {$_("polls.space")}
        </label>
        <input
          id="poll-space"
          type="text"
          bind:value={space}
          class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      <!-- Choice Type -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-3">
          {$_("polls.choice_type")}
        </label>
        <div class="flex items-center gap-4">
          <button
            class="px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm {choiceType ===
            'single'
              ? 'bg-[#111827] text-white border border-transparent'
              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}"
            onclick={() => (choiceType = "single")}
          >
            {$_("polls.single_choice")}
          </button>
          <button
            class="px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm {choiceType ===
            'multiple'
              ? 'bg-[#111827] text-white border border-transparent'
              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}"
            onclick={() => (choiceType = "multiple")}
          >
            {$_("polls.multiple_choice")}
          </button>
        </div>
      </div>

      <!-- Options -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-3">
          {$_("polls.options")}
        </label>
        <div class="space-y-3">
          {#each options as option, index}
            <div class="relative flex items-center">
              <input
                type="text"
                bind:value={options[index]}
                class="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              />
              {#if options.length > 2}
                <button
                  class="absolute right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  onclick={() => removeOption(index)}
                  title={$_("polls.remove_option")}
                  aria-label={$_("polls.remove_option")}
                >
                  <svg
                    class="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    ></path>
                  </svg>
                </button>
              {/if}
            </div>
          {/each}
        </div>
        <button
          class="mt-4 text-[13px] font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
          onclick={addOption}
        >
          {$_("polls.add_option")}
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50/80"
    >
      <div class="flex-1"></div>
      <div class="flex items-center gap-4">
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
          onclick={onClose}
        >
          {$_("polls.cancel")}
        </button>
        <button
          class="px-8 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-indigo-200"
          onclick={handleSubmit}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <div
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
          {/if}
          {$_("polls.create")}
        </button>
      </div>
    </div>
  </div>
</div>
