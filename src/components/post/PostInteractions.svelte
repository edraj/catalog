<script lang="ts">
  import { _ } from "@/i18n";
  import { formatNumberInText } from "@/lib/helpers";
  import { getReactionType, getReactionEmoji, getCommentText } from "@/lib/utils/postUtils";
  
  export let reactions: any[];
  export let comments: any[];
  export let locale: string;
</script>

{#if reactions.length > 0 || comments.length > 0}
  <section class="interactions-section">
    <h3 class="section-title-large">
      <span class="title-accent"></span>
      {$_("post_detail.sections.interactions")}
    </h3>

    {#if reactions.length > 0}
      <div class="reactions-summary">
        <h4 class="simple-subtitle">
          {$_("post_detail.reactions.title")}
        </h4>
        <div class="reactions-simple">
          {#each Object.entries(reactions.reduce((acc, reaction) => {
              const type = getReactionType(reaction);
              acc[type] = (acc[type] || 0) + 1;
              return acc;
            }, {})) as [type, count]}
            <span class="reaction-count">
              {getReactionEmoji(type)}
              {formatNumberInText(Number(count), locale)}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if comments.length > 0}
      <div class="comments-simple">
        <h4 class="simple-subtitle">
          {$_("post_detail.comments.title", {
            values: {
              count: formatNumberInText(comments.length, locale),
            },
          })}
        </h4>
        <div class="comments-list-simple">
          {#each comments as comment}
            <div class="comment-simple">
              {getCommentText(comment, $_("post_detail.comments.no_content"))}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .interactions-section {
    margin-bottom: 32px;
    background: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
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

  .title-accent {
    width: 4px;
    height: 28px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 2px;
  }

  .reactions-summary {
    margin-bottom: 24px;
  }

  .simple-subtitle {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reactions-simple {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .reaction-count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    transition: all 0.2s ease;
  }

  .reaction-count:hover {
    background: #e5e7eb;
    transform: translateY(-1px);
  }

  .comments-simple {
    border-top: 1px solid #e5e7eb;
    padding-top: 24px;
  }

  .comments-list-simple {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .comment-simple {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: #475569;
    transition: all 0.2s ease;
  }

  .comment-simple:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  @media (max-width: 768px) {
    .interactions-section {
      padding: 16px;
    }

    .section-title-large {
      font-size: 18px;
    }

    .reactions-simple {
      gap: 8px;
    }

    .reaction-count {
      font-size: 13px;
      padding: 4px 8px;
    }
  }
</style>