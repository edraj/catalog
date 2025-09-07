<script lang="ts">
  import { _ } from "@/i18n";
  
  export let newComment: string;
  export let isSubmittingComment: boolean;
  export let isSubmittingReaction: boolean;
  export let userReactionId: string | null;
  export let onAddComment: () => void;
  export let onToggleReaction: () => void;
</script>

<section class="interactive-section">
  <h3 class="section-title-large">
    <span class="title-accent-blue"></span>
    {$_("post_detail.sections.interact")}
  </h3>

  <div class="comment-form">
    <h4 class="comment-form-title">
      {$_("post_detail.comments.add_comment")}
    </h4>
    <div class="comment-input-group">
      <textarea
        bind:value={newComment}
        placeholder={$_("post_detail.comments.placeholder")}
        class="comment-textarea"
        rows="3"
        disabled={isSubmittingComment}
      ></textarea>
      <div class="comment-actions">
        <button
          aria-label="Submit comment"
          onclick={onAddComment}
          disabled={isSubmittingComment || !newComment.trim()}
          class="submit-comment-button"
        >
          {#if isSubmittingComment}
            <svg
              class="animate-spin w-4 h-4"
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
            {$_("post_detail.comments.submitting")}
          {:else}
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
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              ></path>
            </svg>
            {$_("post_detail.comments.submit")}
          {/if}
        </button>
        <button
          aria-label="Toggle reaction"
          class="interaction-button reaction-button {userReactionId
            ? 'active'
            : ''}"
          onclick={onToggleReaction}
          disabled={isSubmittingReaction}
        >
          <svg
            class="interaction-icon"
            fill={userReactionId ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            ></path>
          </svg>
          {#if isSubmittingReaction}
            {$_("post_detail.reactions.processing")}
          {:else if userReactionId}
            {$_("post_detail.reactions.liked")}
          {:else}
            {$_("post_detail.reactions.like")}
          {/if}
        </button>
      </div>
    </div>
  </div>
</section>

<style>
  .interactive-section {
    background: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    margin-bottom: 24px;
  }

  .section-title-large {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 22px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e7eb;
  }

  .title-accent-blue {
    width: 4px;
    height: 28px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: 2px;
  }

  .comment-form {
    width: 100%;
  }

  .comment-form-title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
  }

  .comment-input-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .comment-textarea {
    width: 100%;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: #1f2937;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
    transition: border-color 0.2s ease;
  }

  .comment-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .comment-textarea:disabled {
    background-color: #f9fafb;
    color: #9ca3af;
    cursor: not-allowed;
  }

  .comment-textarea::placeholder {
    color: #9ca3af;
  }

  .comment-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .submit-comment-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 40px;
  }

  .submit-comment-button:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }

  .submit-comment-button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .interaction-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #f8fafc;
    color: #475569;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 40px;
  }

  .interaction-button:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #334155;
  }

  .interaction-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reaction-button.active {
    background: #fef3f2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  .reaction-button.active:hover:not(:disabled) {
    background: #fee2e2;
    border-color: #f87171;
  }

  .interaction-icon {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 768px) {
    .interactive-section {
      padding: 16px;
    }

    .section-title-large {
      font-size: 18px;
    }

    .comment-actions {
      flex-direction: column;
    }

    .submit-comment-button,
    .interaction-button {
      justify-content: center;
    }
  }
</style>