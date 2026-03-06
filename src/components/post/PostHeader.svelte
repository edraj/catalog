<script lang="ts">
  import { _ } from "@/i18n";
  import {
    formatDate,
    getAuthorInfo,
    getPostTitle,
  } from "@/lib/utils/postUtils";

  export let postData: any;
  export let locale: string;
  export let isOwner: boolean;

  $: authorInfo = getAuthorInfo(postData, $_("common.unknown"));

  // Estimate read time based on text length, generic fallback
  function estimateReadTime(text: string) {
    if (!text) return "1 min";
    const words = text.split(" ").length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min`;
  }

  $: readTime = estimateReadTime(
    postData.content_en || postData.content_ar || postData.content_ku || "",
  );
</script>

<header class="post-header mb-6">
  <div class="author-row">
    <div class="author-avatar-wrapper">
      <div class="author-avatar">
        {authorInfo ? authorInfo.substring(0, 2).toUpperCase() : "U"}
      </div>
      <div class="status-dot"></div>
    </div>

    <div class="author-details-container">
      <div class="author-identity">
        <span class="author-name">{authorInfo}</span>
        <span class="author-handle"
          >@{authorInfo.toLowerCase().replace(/\s+/g, "")}</span
        >
      </div>
      <div class="post-meta">
        <svg
          class="clock-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="post-time">
          {formatDate(postData.created_at, locale, $_("common.not_available"))}
        </span>
        <span class="separator">·</span>
        <span class="folder-badge">
          <svg
            class="folder-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          {postData.payload?.schema_shortname ||
            $_("post_detail.content_type.content")}
        </span>
        <span class="separator">·</span>
        <svg
          class="eye-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span class="read-time">{readTime} read</span>
      </div>
    </div>
  </div>

  <div class="hot-badge-wrapper mb-3">
    <span class="hot-badge">
      <span class="fire-emoji">🔥</span> Hot
    </span>
  </div>

  <h1 class="post-title break-words">{getPostTitle(postData)}</h1>

  <div class="post-tags">
    {#if postData.tags && postData.tags.length > 0}
      {#each postData.tags as tag}
        {#if tag && tag.trim()}
          <span class="badge badge-tag">#{tag}</span>
        {/if}
      {/each}
    {/if}
  </div>
</header>

<style>
  .post-header {
    background: transparent;
    padding: 0;
    margin-bottom: 32px;
    border: none;
    box-shadow: none;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .author-avatar-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .author-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: #f8fafc;
    color: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    border: 1px solid #e2e8f0;
  }

  .status-dot {
    position: absolute;
    bottom: 0px;
    right: 0px;
    width: 12px;
    height: 12px;
    background-color: #10b981; /* green */
    border: 2px solid white;
    border-radius: 50%;
  }

  .author-details-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .author-identity {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
  }

  .author-name {
    font-weight: 700;
    color: #0f172a;
  }

  .author-handle {
    color: #94a3b8;
    font-weight: 500;
  }

  .post-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .separator {
    color: #cbd5e1;
    margin: 0 4px;
  }

  .clock-icon,
  .folder-icon,
  .eye-icon {
    width: 14px;
    height: 14px;
    color: #94a3b8;
  }

  .folder-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: #f1f5f9;
    color: #64748b;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .hot-badge-wrapper {
    margin-bottom: 12px;
  }

  .hot-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: #fff7ed;
    color: #f97316;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid #ffedd5;
  }

  .fire-emoji {
    font-size: 14px;
  }

  .post-title {
    font-size: 32px;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 16px 0;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }

  .post-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
  }

  .badge-tag {
    background-color: #e0e7ff; /* light blue/indigo */
    color: #4f46e5;
    border: none;
  }
</style>
