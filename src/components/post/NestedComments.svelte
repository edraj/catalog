<script lang="ts">
  import { _ } from "@/i18n";
  import { formatDate } from "@/lib/helpers";
  import { user } from "@/stores/user";
  import { createComment } from "@/lib/dmart_services";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";

  interface Props {
    comments?: any[];
    spaceName: string;
    subpath: string;
    itemShortname: string;
    onCommentAdded?: () => void;
  }

  let {
    comments = [],
    spaceName,
    subpath,
    itemShortname,
    onCommentAdded = () => {},
  }: Props = $props();

  let replyingTo: string | null = $state(null);
  let replyText: string = $state("");
  let isSubmitting: boolean = $state(false);

  function organizeComments(comments: any[]) {
    const commentMap = new Map();
    const topLevelComments: any[] = [];

    comments.forEach((comment) => {
      const commentData = {
        ...comment,
        replies: [],
      };
      commentMap.set(comment.shortname, commentData);
    });

    comments.forEach((comment) => {
      const parentId = comment.attributes?.payload?.body?.parent_comment_id;
      const commentData = commentMap.get(comment.shortname);

      if (parentId && commentMap.has(parentId)) {
        commentMap.get(parentId).replies.push(commentData);
      } else {
        topLevelComments.push(commentData);
      }
    });

    return topLevelComments;
  }

  function getCommentText(comment: any): string {
    return comment.attributes?.payload?.body?.body || "";
  }

  function getCommentAuthor(comment: any): string {
    return comment.attributes?.owner_shortname || "Anonymous";
  }

  function getCommentDate(comment: any): string {
    return formatDate(comment.attributes?.created_at);
  }

  function startReply(commentId: string) {
    replyingTo = commentId;
    replyText = "";
  }

  function cancelReply() {
    replyingTo = null;
    replyText = "";
  }

  async function submitReply() {
    if (!$user?.shortname) {
      errorToastMessage($_("post_detail.login_required.message"));
      return;
    }

    if (!replyText.trim()) {
      errorToastMessage($_("post_detail.comments.empty_comment"));
      return;
    }

    isSubmitting = true;

    try {
      const success = await createComment(
        spaceName,
        subpath,
        itemShortname,
        replyText.trim(),
        replyingTo
      );

      if (success) {
        successToastMessage(
          $_("post_detail.comments.reply_added_successfully")
        );
        replyText = "";
        replyingTo = null;
        onCommentAdded();
      } else {
        errorToastMessage($_("post_detail.comments.reply_failed"));
      }
    } catch (error) {
      console.error("Error adding reply:", error);
      errorToastMessage($_("post_detail.comments.reply_error"));
    } finally {
      isSubmitting = false;
    }
  }

  const organizedComments = $derived(organizeComments(comments));
</script>

{#if organizedComments.length > 0}
  <div class="nested-comments">
    {#each organizedComments as comment}
      <div class="comment-thread">
        <!-- Top-level comment -->
        <div class="comment-item">
          <div class="comment-header">
            <div class="comment-author">
              <svg
                class="user-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span class="author-name">{getCommentAuthor(comment)}</span>
            </div>
            <div class="comment-meta">
              <span class="comment-date">{getCommentDate(comment)}</span>
              {#if $user?.shortname}
                <button
                  class="reply-button"
                  onclick={() => startReply(comment.shortname)}
                  disabled={replyingTo === comment.shortname}
                >
                  <svg
                    class="reply-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                  {$_("post_detail.comments.reply")}
                </button>
              {/if}
            </div>
          </div>
          <div class="comment-content">
            {getCommentText(comment)}
          </div>

          <!-- Reply form for this comment -->
          {#if replyingTo === comment.shortname}
            <div class="reply-form">
              <textarea
                bind:value={replyText}
                placeholder={$_("post_detail.comments.reply_placeholder")}
                class="reply-textarea"
                disabled={isSubmitting}
              ></textarea>
              <div class="reply-actions">
                <button
                  class="submit-reply-button"
                  onclick={submitReply}
                  disabled={isSubmitting || !replyText.trim()}
                >
                  {#if isSubmitting}
                    <svg class="animate-spin" fill="none" viewBox="0 0 24 24">
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
                  {:else}
                    <svg
                      class="submit-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  {/if}
                  {$_("post_detail.comments.submit_reply")}
                </button>
                <button
                  class="cancel-reply-button"
                  onclick={cancelReply}
                  disabled={isSubmitting}
                >
                  {$_("post_detail.comments.cancel")}
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Nested replies -->
        {#if comment.replies.length > 0}
          <div class="replies-container">
            {#each comment.replies as reply}
              <div class="reply-item">
                <div class="comment-header">
                  <div class="comment-author">
                    <svg
                      class="user-icon small"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span class="author-name">{getCommentAuthor(reply)}</span>
                  </div>
                  <div class="comment-meta">
                    <span class="comment-date">{getCommentDate(reply)}</span>
                  </div>
                </div>
                <div class="comment-content">
                  {getCommentText(reply)}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .nested-comments {
    margin-top: 1.5rem;
  }

  .comment-thread {
    margin-bottom: 1.5rem;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }

  .comment-item,
  .reply-item {
    background: #ffffff;
    padding: 1rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .comment-item:last-child {
    border-bottom: none;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .comment-author {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #64748b;
  }

  .user-icon.small {
    width: 1rem;
    height: 1rem;
  }

  .author-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .comment-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .comment-date {
    font-size: 0.75rem;
    color: #64748b;
  }

  .reply-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #64748b;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reply-button:hover:not(:disabled) {
    background: #f8fafc;
    color: #4f46e5;
    border-color: #c7d2fe;
  }

  .reply-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reply-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .comment-content {
    color: #374151;
    line-height: 1.6;
    font-size: 0.875rem;
  }

  .replies-container {
    background: #f8fafc;
    border-left: 3px solid #e2e8f0;
  }

  .reply-item {
    background: #f8fafc;
    border-left: 2px solid #cbd5e1;
    margin-left: 1rem;
  }

  .reply-form {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
  }

  .reply-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    background: #ffffff;
    font-size: 0.875rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
    transition: all 0.2s ease;
  }

  .reply-textarea:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .reply-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reply-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .submit-reply-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .submit-reply-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }

  .submit-reply-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .submit-icon {
    width: 1rem;
    height: 1rem;
  }

  .cancel-reply-button {
    padding: 0.5rem 1rem;
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-reply-button:hover:not(:disabled) {
    background: #f1f5f9;
    color: #374151;
  }

  .animate-spin {
    width: 1rem;
    height: 1rem;
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

  /* Mobile responsive */
  @media (max-width: 768px) {
    .comment-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .comment-meta {
      gap: 0.5rem;
    }

    .reply-actions {
      flex-direction: column;
    }

    .reply-item {
      margin-left: 0.5rem;
    }
  }
</style>
