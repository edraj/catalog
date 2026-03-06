<script lang="ts">
  import { _ } from "@/i18n";

  interface Props {
    reactionsCount: number;
    commentsCount: number;
    userReactionId: string | null;
    isSubmittingReaction: boolean;
    onToggleReaction: () => void;
  }

  let {
    reactionsCount,
    commentsCount,
    userReactionId,
    isSubmittingReaction,
    onToggleReaction,
  }: Props = $props();
</script>

<div class="action-bar-container">
  <div class="action-stats-left">
    <div class="stat-item clickable">
      <svg
        class="icon-comment"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        ></path>
      </svg>
      <span class="stat-count">{commentsCount}</span>
    </div>

    <button
      class="stat-item clickable heart-btn {userReactionId ? 'liked' : ''}"
      onclick={onToggleReaction}
      disabled={isSubmittingReaction}
    >
      <svg
        class="icon-heart"
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
      <span class="stat-count">{reactionsCount}</span>
    </button>
  </div>

  <div class="action-stats-right">
<!--    <div class="stat-item clickable share-btn">-->
<!--      <svg-->
<!--        class="icon-share"-->
<!--        fill="none"-->
<!--        stroke="currentColor"-->
<!--        viewBox="0 0 24 24"-->
<!--      >-->
<!--        <path-->
<!--          stroke-linecap="round"-->
<!--          stroke-linejoin="round"-->
<!--          stroke-width="2"-->
<!--          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"-->
<!--        ></path>-->
<!--      </svg>-->
<!--    </div>-->
  </div>
</div>

<style>
  .action-bar-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #f1f5f9;
    padding-top: 24px;
    margin-top: 32px;
  }

  .action-stats-left {
    display: flex;
    gap: 24px;
    align-items: center;
  }

  .action-stats-right {
    display: flex;
    align-items: center;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    background: none;
    border: none;
    padding: 0;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .stat-item.clickable {
    cursor: pointer;
  }

  .stat-item:hover {
    color: #475569;
  }

  .stat-count {
    color: #64748b;
  }

  .icon-comment,
  .icon-heart,
  .icon-bookmark,
  .icon-share {
    width: 20px;
    height: 20px;
  }

  .heart-btn:hover .icon-heart {
    color: #ef4444;
  }

  .heart-btn.liked .icon-heart {
    color: #ef4444;
  }

  .bookmark-btn:hover .icon-bookmark {
    color: #0f172a;
  }

  .share-btn:hover .icon-share {
    color: #0ea5e9;
  }
</style>
