<script lang="ts">
  import { _ } from "@/i18n";

  export let newComment: string;
  export let isSubmittingComment: boolean;
  export let onAddComment: () => void;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (newComment.trim() && !isSubmittingComment) {
        onAddComment();
      }
    }
  }
</script>

<div class="comment-composer">
  <div class="composer-avatar">
    <!-- Placeholder for current user avatar -->
    <div class="avatar-circle">YO</div>
  </div>

  <div class="composer-body">
    <textarea
      bind:value={newComment}
      placeholder={$_("Share your thoughts...") || "Share your thoughts..."}
      class="composer-textarea"
      rows="3"
      disabled={isSubmittingComment}
      onkeydown={handleKeydown}
    ></textarea>

    <div class="composer-footer">
      <span class="composer-hint">Shift + Enter for new line</span>
      <button
        aria-label="Submit comment"
        onclick={onAddComment}
        disabled={isSubmittingComment || !newComment.trim()}
        class="submit-btn"
      >
        {#if isSubmittingComment}
          <svg
            class="animate-spin w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        {/if}
        <svg
          class="send-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
        {$_("post_detail.comments.submit", { default: "Post Comment" })}
      </button>
    </div>
  </div>
</div>

<style>
  .comment-composer {
    display: flex;
    gap: 16px;
    margin-bottom: 32px;
  }

  .composer-avatar {
    flex-shrink: 0;
  }

  .avatar-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #f1f5f9;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
  }

  .composer-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .composer-textarea {
    width: 100%;
    background: #f8fafc;
    border: none;
    border-radius: 12px;
    padding: 16px;
    font-size: 15px;
    font-family: inherit;
    color: #0f172a;
    resize: none;
    line-height: 1.5;
  }

  .composer-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(199, 210, 254, 0.5); /* light purple focus */
  }

  .composer-textarea::placeholder {
    color: #94a3b8;
  }

  .composer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .composer-hint {
    font-size: 13px;
    color: #cbd5e1;
    font-family: monospace;
  }

  .submit-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #c7d2fe;
    color: white;
    border: none;
    border-radius: 9999px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .submit-btn:not(:disabled):hover {
    background: #a5b4fc;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .send-icon {
    width: 14px;
    height: 14px;
    transform: rotate(45deg);
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .opacity-25 {
    opacity: 0.25;
  }
  .opacity-75 {
    opacity: 0.75;
  }
  .w-4 {
    width: 16px;
  }
  .h-4 {
    height: 16px;
  }
  .mr-2 {
    margin-right: 8px;
  }
</style>
