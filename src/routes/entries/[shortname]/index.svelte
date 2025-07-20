<script lang="ts">
  import { params } from "@roxi/routify";
  import { goto } from "@roxi/routify";
  import { onMount } from "svelte";
  import {
    checkCurrentUserReactedIdea,
    createComment,
    createReaction,
    deleteReactionComment,
    getAvatar,
    getEntityAttachmentsCount,
    getEntity,
  } from "@/lib/dmart_services";
  import { formatDate } from "@/lib/helpers";
  import { Button, Card, Input } from "flowbite-svelte";
  import Attachments from "@/routes/components/Attachments.svelte";
  import { ResourceType } from "@edraj/tsdmart";
  import { user } from "@/stores/user";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import Avatar from "@/routes/components/Avatar.svelte";
  import { Diamonds } from "svelte-loading-spinners";
  import {
    ArrowLeftOutline,
    CheckCircleSolid,
    ClockOutline,
    CloseCircleSolid,
    EditOutline,
    EyeSlashSolid,
    EyeSolid,
    HeartSolid,
    MessagesSolid,
    TagOutline,
    TrashBinSolid,
    UserCircleOutline,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";

  $goto;

  let entity = $state(null);
  let isLoading = $state(false);
  let isLoadingPage: boolean = $state(true);
  let isOwner = $state(false);
  let userReactionEntry = $state(null);
  let counts: any = $state({});

  onMount(async () => {
    isLoadingPage = true;
    await refreshIdea();
    isOwner = $user.shortname === entity.owner_shortname;
    await refreshCounts();
    isLoadingPage = false;
  });

  function handleEdit(entity) {
    $goto("/entries/[shortname]/edit", {
      shortname: entity.shortname,
      space_name: $params.space_name,
      subpath: $params.subpath,
    });
  }

  let comment = $state("");

  async function handleAddComment() {
    if (comment) {
      const response = await createComment(
        $params.space_name,
        $params.subpath,
        $params.shortname,
        comment
      );
      if (response) {
        await refreshCounts();
        await refreshIdea();
        successToastMessage("Comment added successfully");
        comment = "";
        await refreshIdea();
      } else {
        errorToastMessage("Failed to add comment!");
      }
    }
  }

  async function deleteComment(shortname: string) {
    const response = await deleteReactionComment(
      ResourceType.comment,
      `${$params.subpath}/${entity.shortname}`,
      shortname,
      $params.space_name
    );

    if (response) {
      await refreshCounts();
      await refreshIdea();
      successToastMessage("Comment deleted successfully");
    } else {
      errorToastMessage("Failed to delete comment!");
    }
  }

  async function handleReaction() {
    if (userReactionEntry) {
      const response = await deleteReactionComment(
        ResourceType.reaction,
        `${$params.subpath}/${entity.shortname}`,
        userReactionEntry,
        $params.space_name
      );
      if (response) {
        userReactionEntry = null;
        await refreshCounts();
        await refreshIdea();
        successToastMessage("Reaction removed successfully");
      } else {
        errorToastMessage("Failed to remove reaction!");
      }
    } else {
      const response = await createReaction(
        entity.shortname,
        $params.space_name,
        $params.subpath
      );
      if (response) {
        await refreshCounts();
        await refreshIdea();
        successToastMessage("Reaction added successfully");
      } else {
        errorToastMessage("Failed to add reaction!");
      }
    }
  }

  async function refreshIdea() {
    entity = await getEntity(
      $params.shortname,
      $params.space_name,
      $params.subpath
    );
    if (entity) {
      userReactionEntry = await checkCurrentUserReactedIdea(
        $user.shortname,
        entity.shortname,
        $params.space_name,
        $params.subpath
      );
    }
  }

  async function refreshCounts() {
    counts = await getEntityAttachmentsCount(
      entity.shortname,
      $params.space_name,
      $params.subpath
    );
    if (counts.length > 0) {
      counts = counts[0].attributes;
    }
  }

  function getStatusInfo(entity: any) {
    if (!entity.is_active) {
      return {
        text: "Draft",
        class: "status-draft",
        icon: EyeSlashSolid,
        description: "This entry is saved as a draft and not visible to others",
      };
    } else if (entity.state === "pending") {
      return {
        text: "Pending Review",
        class: "status-pending",
        icon: ClockOutline,
        description:
          "This entry is under review and will be published once approved",
      };
    } else if (entity.state === "approved") {
      return {
        text: "Published",
        class: "status-published",
        icon: CheckCircleSolid,
        description: "This entry is live and visible to everyone",
      };
    } else if (entity.state === "rejected") {
      return {
        text: "Rejected",
        class: "status-rejected",
        icon: CloseCircleSolid,
        description: "This entry was rejected and needs revision",
      };
    } else {
      return {
        text: "Active",
        class: "status-active",
        icon: EyeSolid,
        description: "This entry is active",
      };
    }
  }
</script>

{#if isLoadingPage}
  <div class="loading-container">
    <div class="loading-content">
      <Diamonds size="60" color="#2563eb" unit="px" duration="1s" />
      <p class="loading-text">Loading your entry...</p>
    </div>
  </div>
{:else if entity}
  <div class="page-container">
    <div class="content-wrapper">
      <!-- Header -->
      <div class="header">
        <button class="back-button" onclick={() => $goto("/entries")}>
          <ArrowLeftOutline class="w-5 h-5" />
          Back to My Entries
        </button>

        {#if isOwner}
          <button class="edit-button" onclick={() => handleEdit(entity)}>
            <EditOutline class="w-4 h-4" />
            Edit Entry
          </button>
        {/if}
      </div>

      <!-- Status Banner -->
      <div class="status-banner">
        <div class="status-icon">
          {#if entity}
            {#key entity.state}
              {#if getStatusInfo(entity).icon}
                {@const SvelteComponent = getStatusInfo(entity).icon}
                <svelte:component this={SvelteComponent} class="w-6 h-6" />
              {/if}
            {/key}
          {/if}
        </div>
        <div class="status-info">
          <div class="status-header">
            <span class="status-badge {getStatusInfo(entity).class}">
              {getStatusInfo(entity).text}
            </span>
            <span class="created-date">
              Created {formatDate(entity.created_at)}
            </span>
          </div>
          <p class="status-description">
            {getStatusInfo(entity).description}
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div class="main-card">
        <!-- Title -->
        <h1 class="entry-title">
          {entity.payload?.body?.title ||
            entity.displayname.en ||
            "Untitled Entry"}
        </h1>

        <!-- Meta Information -->
        <div class="meta-info">
          <div class="meta-item">
            <UserCircleOutline class="w-5 h-5" />
            <span class="meta-text">{entity.owner_shortname}</span>
          </div>
          <div class="meta-item">
            <ClockOutline class="w-5 h-5" />
            <span class="meta-text"
              >Updated {formatDate(entity.updated_at)}</span
            >
          </div>
          <div class="engagement-stats">
            <div class="stat-item likes">
              <HeartSolid class="w-5 h-5" />
              <span class="stat-count">{counts.reaction || 0}</span>
            </div>
            <div class="stat-item comments">
              <MessagesSolid class="w-5 h-5" />
              <span class="stat-count">{counts.comment || 0}</span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        {#if entity.tags && entity.tags.length > 0}
          <div class="tags-section">
            <h3 class="section-title">
              <TagOutline class="w-5 h-5" />
              Tags
            </h3>
            <div class="tags-container">
              {#each entity.tags as tag}
                <span class="tag">
                  <TagOutline class="w-3 h-3" />
                  {tag}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Content -->
        <div class="entry-content">
          {@html entity.payload?.body?.content || "No content available"}
        </div>

        <!-- Attachments -->
        {#if entity.attachments.media && Object.keys(entity.attachments.media).length > 0}
          <div class="attachments-section">
            <h3 class="section-title">
              {$_("Attachments")}
            </h3>
            <Attachments
              resource_type={ResourceType.ticket}
              space_name={$params.space_name}
              subpath={$params.subpath}
              parent_shortname={entity.shortname}
              attachments={Object.values(entity.attachments.media ?? [])}
              {isOwner}
            />
          </div>
        {/if}

        <!-- Actions -->
        <div class="actions-section">
          <button
            class="like-button {userReactionEntry ? 'liked' : ''}"
            onclick={handleReaction}
            disabled={isLoading}
          >
            <HeartSolid class="w-5 h-5" />
            {userReactionEntry ? "Unlike" : "Like"} ({counts.reaction || 0})
          </button>
        </div>
      </div>

      <!-- Comments Section -->
      <div class="comments-section">
        <h3 class="comments-title">
          <MessagesSolid class="w-6 h-6" />
          Comments ({counts.comment || 0})
        </h3>

        <!-- Add Comment -->
        <div class="comment-form">
          <div class="comment-input-container">
            <div class="comment-input-wrapper">
              <input
                type="text"
                bind:value={comment}
                placeholder="Share your thoughts..."
                class="comment-input mr-2"
                onkeydown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
              <button
                class="comment-submit ml-2"
                onclick={handleAddComment}
                disabled={!comment.trim() || isLoading}
                aria-label="Submit comment"
              >
                <svg
                  class="w-4 h-4"
                  version="1.1"
                  id="Layer_1"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  viewBox="0 0 512 512"
                  xml:space="preserve"
                  fill="#000000"
                  ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
                    id="SVGRepo_tracerCarrier"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></g><g id="SVGRepo_iconCarrier">
                    <polygon
                      style="fill:#5EBAE7;"
                      points="490.452,21.547 16.92,235.764 179.068,330.053 179.068,330.053 "
                    ></polygon>
                    <polygon
                      style="fill:#36A9E1;"
                      points="490.452,21.547 276.235,495.079 179.068,330.053 179.068,330.053 "
                    ></polygon>
                    <rect
                      x="257.137"
                      y="223.122"
                      transform="matrix(-0.7071 -0.7071 0.7071 -0.7071 277.6362 609.0793)"
                      style="fill:#FFFFFF;"
                      width="15.652"
                      height="47.834"
                    ></rect>
                    <path
                      style="fill:#1D1D1B;"
                      d="M0,234.918l174.682,102.4L277.082,512L512,0L0,234.918z M275.389,478.161L190.21,332.858 l52.099-52.099l-11.068-11.068l-52.099,52.099L33.839,236.612L459.726,41.205L293.249,207.682l11.068,11.068L470.795,52.274 L275.389,478.161z"
                    ></path>
                  </g></svg
                >
              </button>
            </div>
          </div>
        </div>

        <!-- Comments List -->
        {#if entity.attachments && entity.attachments.comment && entity.attachments.comment.length > 0}
          <div class="comments-list">
            {#each entity.attachments.comment as comment}
              <div class="comment-item">
                <div class="comment-avatar">
                  {#await getAvatar(comment.attributes.owner_shortname) then avatar}
                    <Avatar src={avatar} size="40" />
                  {/await}
                </div>
                <div class="comment-content">
                  <div class="comment-header">
                    <span class="comment-author">{comment.owner_shortname}</span
                    >
                    <span class="comment-date"
                      >{formatDate(comment.attributes.created_at)}</span
                    >
                    {#if comment.attributes.owner_shortname === $user.shortname}
                      <button
                        class="delete-comment"
                        onclick={() => deleteComment(comment.shortname)}
                      >
                        <TrashBinSolid class="w-3 h-3" />
                      </button>
                    {/if}
                  </div>
                  <p class="comment-text">
                    {comment.attributes.payload.body.body}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-comments">
            <MessagesSolid class="w-12 h-12 no-comments-icon" />
            <p class="no-comments-title">No comments yet</p>
            <p class="no-comments-subtitle">
              Be the first to share your thoughts!
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="error-container">
    <div class="error-content">
      <div class="error-icon">
        <CloseCircleSolid class="w-12 h-12" />
      </div>
      <h2 class="error-title">Entry Not Found</h2>
      <p class="error-message">
        The entry you're looking for doesn't exist or has been removed.
      </p>
      <button class="error-button" onclick={() => $goto("/entries")}>
        Back to My Entries
      </button>
    </div>
  </div>
{/if}

<style>
  .page-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 2rem 1rem;
  }

  .content-wrapper {
    max-width: 800px;
    margin: 0 auto;
  }

  .loading-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  }

  .loading-content {
    text-align: center;
  }

  .loading-text {
    color: #64748b;
    margin-top: 1rem;
    font-size: 1.125rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #64748b;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .back-button:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #475569;
  }

  .edit-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .edit-button:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    transform: translateY(-1px);
  }

  .status-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .status-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 12px;
    color: #3b82f6;
  }

  .status-info {
    flex: 1;
  }

  .status-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-draft {
    background: #f1f5f9;
    color: #475569;
  }

  .status-pending {
    background: #fef3c7;
    color: #d97706;
  }

  .status-published {
    background: #d1fae5;
    color: #059669;
  }

  .status-rejected {
    background: #fecaca;
    color: #dc2626;
  }

  .status-active {
    background: #dbeafe;
    color: #2563eb;
  }

  .created-date {
    font-size: 0.875rem;
    color: #64748b;
  }

  .status-description {
    color: #64748b;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .main-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .entry-title {
    font-size: 2.25rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 1.5rem;
    line-height: 1.2;
  }

  .meta-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 2rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
  }

  .meta-text {
    font-weight: 500;
  }

  .engagement-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-item.likes {
    color: #ef4444;
  }

  .stat-item.comments {
    color: #3b82f6;
  }

  .stat-count {
    font-weight: 600;
  }

  .tags-section {
    margin-bottom: 2rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 1rem;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: #f1f5f9;
    color: #3b82f6;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid #e2e8f0;
  }

  .entry-content {
    margin-bottom: 2rem;
    line-height: 1.7;
    color: #374151;
  }

  .entry-content :global(h1),
  .entry-content :global(h2),
  .entry-content :global(h3),
  .entry-content :global(h4),
  .entry-content :global(h5),
  .entry-content :global(h6) {
    color: #1e293b;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  .entry-content :global(p) {
    margin-bottom: 1.25rem;
  }

  .entry-content :global(a) {
    color: #3b82f6;
    text-decoration: underline;
  }

  .entry-content :global(blockquote) {
    border-left: 4px solid #3b82f6;
    padding-left: 1rem;
    margin: 1.5rem 0;
    font-style: italic;
    color: #64748b;
  }

  .attachments-section {
    border-top: 1px solid #e2e8f0;
    padding-top: 2rem;
    margin-bottom: 2rem;
  }

  .actions-section {
    border-top: 1px solid #e2e8f0;
    padding-top: 1.5rem;
  }

  .like-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #64748b;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .like-button:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #ef4444;
  }

  .like-button.liked {
    background: #ef4444;
    border-color: #ef4444;
    color: white;
  }

  .like-button.liked:hover {
    background: #dc2626;
    border-color: #dc2626;
  }

  .like-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .comments-section {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }

  .comments-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 1.5rem;
  }

  .comment-form {
    background: #f8fafc;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .comment-input-container {
    display: flex;
    gap: 1rem;
  }

  .comment-avatar {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .comment-input-wrapper {
    display: flex;
    flex: 1;
  }

  .comment-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    transition: border-color 0.2s ease;
  }

  .comment-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .comment-submit {
    padding: 0.75rem 0.75rem;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
    height: 80%;
  }

  .comment-submit:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  }

  .comment-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .comment-item {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .comment-content {
    flex: 1;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .comment-author {
    font-weight: 600;
    color: #1e293b;
  }

  .comment-date {
    font-size: 0.875rem;
    color: #64748b;
  }

  .delete-comment {
    margin-left: auto;
    padding: 0.25rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-comment:hover {
    background: #fee2e2;
    border-color: #fca5a5;
  }

  .comment-text {
    color: #374151;
    line-height: 1.6;
  }

  .no-comments {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
  }

  .no-comments-icon {
    margin: 0 auto 1rem;
    opacity: 0.5;
  }

  .no-comments-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .no-comments-subtitle {
    font-size: 0.875rem;
  }

  .error-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  }

  .error-content {
    text-align: center;
    padding: 2rem;
  }

  .error-icon {
    width: 96px;
    height: 96px;
    background: #fef2f2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    color: #ef4444;
  }

  .error-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 0.75rem;
  }

  .error-message {
    color: #64748b;
    margin-bottom: 1.5rem;
    max-width: 400px;
  }

  .error-button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .error-button:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .page-container {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .back-button,
    .edit-button {
      justify-content: center;
    }

    .main-card {
      padding: 1.5rem;
    }

    .entry-title {
      font-size: 1.875rem;
    }

    .meta-info {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .engagement-stats {
      margin-left: 0;
      justify-content: center;
    }

    .comments-section {
      padding: 1.5rem;
    }

    .comment-form {
      padding: 1rem;
    }

    .comment-input-container {
      flex-direction: column;
    }

    .comment-avatar {
      align-self: center;
    }
  }
</style>
