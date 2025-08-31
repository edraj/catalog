<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "../../../i18n";
  import { locale } from "@/i18n";

  import {
    fetchContactMessages,
    markMessageAsReplied,
  } from "../../../lib/dmart_services";

  let messages: any[] = $state([]);
  let loading = $state(true);
  let error = $state("");
  let currentPage = $state(0);
  let limit = 20;
  let totalMessages = $state(0);

  let showModal = $state(false);
  let selectedMessage: any = $state(null);
  let replyContent = $state("");
  let sendingReply = $state(false);

  const isRTL = $locale === "ar" || $locale === "ku";

  function hasAttachment(message: any): boolean {
    return message.attachments && message.attachments.length > 0;
  }

  function isReplied(message: any): boolean {
    if (!message.attachments || Object.keys(message.attachments).length === 0) {
      return false;
    }
    return true;
  }

  function getReplyMessage(message: any): string {
    if (!message.attachments || !message.attachments.comment) {
      return "";
    }
    const comments = message.attachments.comment;
    if (comments.length > 0) {
      return comments[0].attributes.payload.body.body || "";
    }
    return "";
  }

  async function loadMessages() {
    loading = true;
    error = "";
    try {
      const response = await fetchContactMessages();
      if (response && response.status === "success") {
        messages = response.records || [];
        totalMessages = response.attributes?.total || 0;

        await autoMarkAttachmentMessages();
      } else {
        error = $_("failedToFetchContactMessages");
      }
    } catch (err) {
      console.error("Error fetching contact messages:", err);
      error = $_("errorFetchingMessages");
    } finally {
      loading = false;
    }
  }

  async function autoMarkAttachmentMessages() {
    const messagesToMark = messages.filter(
      (message) => hasAttachment(message) && !isReplied(message)
    );

    for (const message of messagesToMark) {
      try {
        await markMessageAsReplied(
          "applications",
          "contacts",
          message.shortname,
          "Auto-replied: Message contains attachment"
        );

        message.attributes.payload.replied = true;
      } catch (error) {
        console.error(
          `Error auto-marking message ${message.shortname}:`,
          error
        );
      }
    }
  }

  function openReplyModal(message: any) {
    const messageBody = message.attributes.payload?.body;
    const ownerEmail = messageBody?.email || messageBody?.contact_email || "";

    if (!ownerEmail) {
      alert($_("noEmailFoundForMessage"));
      return;
    }

    selectedMessage = message;
    replyContent = "";
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedMessage = null;
    replyContent = "";
    sendingReply = false;
  }

  async function sendReply() {
    if (!selectedMessage || !replyContent.trim()) {
      alert($_("pleaseEnterReplyMessage"));
      return;
    }

    sendingReply = true;

    try {
      const messageBody = selectedMessage.attributes.payload?.body;
      const ownerEmail = messageBody?.email || messageBody?.contact_email || "";
      const subject =
        `${messageBody?.subject} - ${$_("reply")}` || $_("replyToYourMessage");

      window.open(
        `mailto:${ownerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(replyContent)}`
      );

      const success = await markMessageAsReplied(
        "applications",
        "contacts",
        selectedMessage.shortname,
        replyContent
      );

      if (success) {
        selectedMessage.attributes.payload.replied = true;
        await loadMessages();
        closeModal();
        alert($_("replySentAndMarked"));
      } else {
        alert($_("replySentButFailedToMark"));
        closeModal();
      }
    } catch (error) {
      console.error("Error marking message as replied:", error);
      alert($_("replySentButSystemError"));
      closeModal();
    } finally {
      sendingReply = false;
    }
  }

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  }

  function nextPage() {
    if ((currentPage + 1) * limit < totalMessages) {
      currentPage++;
      loadMessages();
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
      loadMessages();
    }
  }

  onMount(() => {
    loadMessages();
  });
</script>

<div class="container mx-auto p-6">
  <div class="bg-white rounded-lg shadow-md">
    <div class="p-6 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold text-gray-900">
          {$_("contactMessages")}
        </h2>
        <button
          aria-label={`Refresh contact messages`}
          onclick={loadMessages}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? $_("refreshing") : $_("refresh")}
        </button>
      </div>

      {#if totalMessages > 0}
        <p class="text-sm text-gray-600 mt-2">
          {$_("showing")}
          {currentPage * limit + 1}
          {$_("to")}
          {Math.min((currentPage + 1) * limit, totalMessages)}
          {$_("of")}
          {totalMessages}
          {$_("messages")}
        </p>
      {/if}
    </div>

    <div class="p-6">
      {#if loading}
        <div class="flex justify-center items-center py-12">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          ></div>
          <span class="ml-2 text-gray-600">{$_("loadingMessages")}</span>
        </div>
      {:else if error}
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">{$_("error")}</h3>
              <p class="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      {:else if messages.length === 0}
        <div class="text-center py-12">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4m-4 0H9m-4 0h4m0 0V9a2 2 0 012-2h2a2 2 0 012 2v4.01"
            />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">
            {$_("noContactMessages")}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            {$_("noMessagesSubmitted")}
          </p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each messages as message}
            <div
              class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-gray-900">
                    {message.attributes.payload.body.full_name ||
                      $_("anonymous")}
                  </h3>
                  <p class="text-sm text-gray-600">
                    {message.attributes.payload.body.email ||
                      $_("noEmailProvided")}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    {$_("submitted")}: {formatDate(
                      message.attributes.created_at
                    )}
                  </p>
                </div>
                <div class="flex space-x-2">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {message.shortname}
                  </span>

                  {#if hasAttachment(message)}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                    >
                      📎 {$_("attachment")}
                    </span>
                  {/if}

                  {#if isReplied(message)}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      ✓ {$_("replied")}
                    </span>
                  {/if}

                  {#if message.attributes.payload?.body?.email && !isReplied(message)}
                    <button
                      aria-label={`Reply to ${message.attributes.payload.body.full_name}`}
                      onclick={() => openReplyModal(message)}
                      class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
                    >
                      {$_("reply")}
                    </button>
                  {/if}
                </div>
              </div>

              {#if message.attributes.payload?.body?.subject}
                <div class="mt-2 text-sm text-gray-600">
                  <strong>{$_("subject")}:</strong>
                  {message.attributes.payload.body.subject}
                </div>
              {/if}

              {#if hasAttachment(message)}
                <div class="mt-2 text-sm text-gray-600">
                  <strong>{$_("attachments")}:</strong>
                  <ul class="mt-1 text-xs text-gray-500">
                    {#each message.attributes.payload.body.attachments as attachment}
                      <li>
                        • {attachment.name ||
                          attachment.filename ||
                          $_("unknownFile")}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <div class="bg-gray-50 rounded-md p-3">
                <h4 class="text-sm font-medium text-gray-900 mb-2">
                  {$_("message")}:
                </h4>
                <p class="text-sm text-gray-700 whitespace-pre-wrap">
                  {message.attributes.payload?.body?.message ||
                    $_("noMessageContent")}
                </p>
              </div>

              {#if isReplied(message)}
                <div class="bg-green-50 rounded-md p-3 mt-3">
                  <h4 class="text-sm font-medium text-green-900 mb-2">
                    {$_("reply")}:
                  </h4>
                  <p class="text-sm text-green-700 whitespace-pre-wrap">
                    {getReplyMessage(message) || $_("noReplyContent")}
                  </p>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        {#if totalMessages > limit}
          <div
            class="flex justify-between items-center mt-6 pt-4 border-t border-gray-200"
          >
            <button
              aria-label={`Previous page`}
              onclick={prevPage}
              disabled={currentPage === 0}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {$_("previous")}
            </button>

            <span class="text-sm text-gray-700">
              {$_("page")}
              {currentPage + 1}
              {$_("of")}
              {Math.ceil(totalMessages / limit)}
            </span>

            <button
              aria-label={`Next page`}
              onclick={nextPage}
              disabled={(currentPage + 1) * limit >= totalMessages}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {$_("next")}
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

{#if showModal && selectedMessage}
  <div
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center"
    >
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
        onclick={closeModal}
      ></div>

      <div
        style="width: 80%;"
        class="inline-block align-bottom bg-white rounded-lg overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div
            class="sm:flex"
            class:items-start={!isRTL}
            class:items-end={isRTL}
          >
            <div
              class="mt-3 text-center sm:mt-0 w-full"
              class:sm:text-left={!isRTL}
              class:sm:text-right={isRTL}
            >
              <h3
                class="text-lg leading-6 font-medium text-gray-900 mb-4"
                id="modal-title"
              >
                {$_("replyToMessage")}
              </h3>

              <div class="mb-4 p-3 bg-gray-50 rounded-md">
                <div
                  class="text-sm text-gray-600 mb-2"
                  class:text-left={!isRTL}
                  class:text-right={isRTL}
                >
                  <strong>{$_("name")}:</strong>
                  {selectedMessage.attributes.payload.body.full_name ||
                    $_("anonymous")}
                </div>
                <div
                  class="text-sm text-gray-600 mb-2"
                  class:text-left={!isRTL}
                  class:text-right={isRTL}
                >
                  <strong>{$_("email")}:</strong>
                  {selectedMessage.attributes.payload.body.email ||
                    $_("noEmailProvided")}
                </div>
                <div
                  class="text-sm text-gray-600 mb-2"
                  class:text-left={!isRTL}
                  class:text-right={isRTL}
                >
                  <strong>{$_("subject")}:</strong>
                  {selectedMessage.attributes.payload.body.subject ||
                    $_("noSubject")}
                </div>
                <div
                  class="text-sm text-gray-600"
                  class:text-left={!isRTL}
                  class:text-right={isRTL}
                >
                  <strong>{$_("originalMessage")}:</strong>
                  <div
                    class="mt-1 text-gray-700 bg-white p-2 rounded border max-h-20 overflow-y-auto"
                    class:text-left={!isRTL}
                    class:text-right={isRTL}
                  >
                    {selectedMessage.attributes.payload?.body?.message ||
                      $_("noMessageContent")}
                  </div>
                </div>
              </div>

              <div class="mb-4">
                <label
                  for="reply-content"
                  class="block text-sm font-medium text-gray-700 mb-2"
                  class:text-left={!isRTL}
                  class:text-right={isRTL}
                >
                  {$_("yourReply")}:
                </label>
                <textarea
                  id="reply-content"
                  bind:value={replyContent}
                  rows="6"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  class:text-left={!isRTL}
                  class:text-right={isRTL}
                  placeholder={$_("typeReplyPlaceholder")}
                  disabled={sendingReply}
                  dir={isRTL ? "rtl" : "ltr"}
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex"
          class:sm:flex-row-reverse={!isRTL}
          class:sm:flex-row={isRTL}
        >
          <button
            aria-label={`Send reply`}
            type="button"
            onclick={sendReply}
            disabled={sendingReply}
            class="mx-2 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingReply ? $_("sending") : $_("sendReply")}
          </button>
          <button
            aria-label={`Cancel replying`}
            type="button"
            onclick={closeModal}
            disabled={sendingReply}
            class="mx-2 mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {$_("cancel")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 1200px;
  }
</style>
