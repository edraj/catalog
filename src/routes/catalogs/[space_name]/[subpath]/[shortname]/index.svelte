<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getEntity } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { ResourceType } from "@edraj/tsdmart/dmart.model";
  import Attachments from "@/components/Attachments.svelte";
  import { user } from "@/stores/user";

  $goto;
  let isLoading = false;
  let postData = $state(null);
  let error = null;
  let spaceName = "";
  let subpath = "";
  let itemShortname = "";
  let actualSubpath = "";
  let breadcrumbs = [];
  let isOwner = $state(false);

  onMount(async () => {
    isOwner = $user.shortname === itemShortname;

    await initializeContent();
  });

  $effect(() => {
    if ($params.space_name && $params.subpath && $params.shortname) {
      initializeContent();
    }
  });

  async function initializeContent() {
    spaceName = $params.space_name;
    subpath = $params.subpath;
    itemShortname = $params.shortname;

    actualSubpath = subpath.replace(/-/g, "/");

    const pathParts = actualSubpath
      .split("/")
      .filter((part) => part.length > 0);
    breadcrumbs = [
      { name: "Catalogs", path: "/catalogs" },
      { name: spaceName, path: `/catalog/${spaceName}` },
    ];

    let currentUrlPath = "";
    pathParts.forEach((part, index) => {
      currentUrlPath += (index === 0 ? "" : "-") + part;
      breadcrumbs.push({
        name: part,
        path: `/catalog/${spaceName}/${currentUrlPath}`,
      });
    });

    breadcrumbs.push({
      name: itemShortname,
      path: null,
    });

    await loadPostData();
  }

  async function loadPostData() {
    isLoading = true;
    error = null;
    postData = null;

    try {
      const response = await getEntity(
        itemShortname,
        spaceName,
        actualSubpath,
        $params.resource_type,
        "public",
        true
      );

      if (response && response.uuid) {
        postData = response;
      } else {
        console.error("Invalid response structure:", response);
        error = "Invalid response structure";
      }
    } catch (err) {
      console.error("Error fetching post data:", err);
      error = err.message || "Failed to load post data";
    } finally {
      isLoading = false;
    }
  }

  function navigateToBreadcrumb(path) {
    if (path) {
      $goto(path);
    }
  }

  function goBack() {
    history.back();
  }

  function getDisplayName(item) {
    if (item.displayname) {
      return (
        item.displayname[$locale] ||
        item.displayname.ar ||
        item.displayname.en ||
        item.shortname
      );
    }
    return item.shortname;
  }

  function getDescription(item) {
    if (item.description) {
      return (
        item.description[$locale] ||
        item.description.ar ||
        item.description.en ||
        ""
      );
    }
    return "";
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function getAuthorInfo(item) {
    const relationships = item.relationships || [];
    const author = relationships.find(
      (rel) => rel.attributes?.role === "author"
    );
    return author?.related_to?.shortname || item.owner_shortname || "Unknown";
  }

  function getPostTitle(postData) {
    if (postData?.payload?.body?.title) {
      return postData.payload.body.title;
    }
    return getDisplayName(postData);
  }

  function getPostContent(postData) {
    if (postData?.payload?.body?.content) {
      return postData.payload.body.content;
    }
    if (postData?.payload?.body && typeof postData.payload.body === "string") {
      return postData.payload.body;
    }
    return "";
  }

  function categorizeAttachments(item) {
    const reactions = [];
    const comments = [];
    const mediaFiles = [];

    if (item.attachments) {
      Object.keys(item.attachments).forEach((key) => {
        if (Array.isArray(item.attachments[key])) {
          item.attachments[key].forEach((attachment) => {
            if (attachment.resource_type === ResourceType.reaction) {
              reactions.push(attachment);
            } else if (attachment.resource_type === ResourceType.comment) {
              comments.push(attachment);
            } else if (
              attachment.resource_type === ResourceType.media ||
              (attachment.attributes?.payload?.content_type &&
                (attachment.attributes.payload.content_type.startsWith(
                  "image/"
                ) ||
                  attachment.attributes.payload.content_type.startsWith(
                    "video/"
                  ) ||
                  attachment.attributes.payload.content_type.startsWith(
                    "audio/"
                  ) ||
                  attachment.attributes.payload.content_type ===
                    "application/pdf"))
            ) {
              mediaFiles.push(attachment);
            }
          });
        }
      });
    }

    return { reactions, comments, mediaFiles };
  }

  function getReactionType(reaction) {
    return (
      reaction?.attributes?.payload?.body?.body?.type ||
      reaction?.payload?.body?.body?.type ||
      "unknown"
    );
  }

  function getCommentText(comment) {
    return (
      comment?.attributes?.payload?.body?.body ||
      comment?.payload?.body?.body ||
      "No content"
    );
  }

  function getCommentState(comment) {
    return (
      comment?.attributes?.payload?.body?.state ||
      comment?.payload?.body?.state ||
      "unknown"
    );
  }

  function getReactionEmoji(type) {
    switch (type) {
      case "like":
        return "👍";
      case "love":
        return "❤️";
      case "laugh":
        return "😂";
      case "wow":
        return "😮";
      case "sad":
        return "😢";
      case "angry":
        return "😠";
      default:
        return "👍";
    }
  }
</script>

<div class="page-container">
  <!-- Header Section -->
  <header class="page-header">
    <div class="header-content">
      <!-- Breadcrumbs -->
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          {#each breadcrumbs as crumb, index}
            <li class="breadcrumb-item">
              {#if index > 0}
                <svg
                  class="breadcrumb-separator"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
              {/if}
              {#if crumb.path}
                <button
                  onclick={() => navigateToBreadcrumb(crumb.path)}
                  class="breadcrumb-link"
                >
                  {crumb.name}
                </button>
              {:else}
                <span class="breadcrumb-current">{crumb.name}</span>
              {/if}
            </li>
          {/each}
        </ol>
      </nav>

      <button onclick={goBack} class="back-button">
        <svg
          class="back-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span>Back to Contents</span>
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main-content">
    {#if isLoading}
      <div class="loading-container">
        <div class="loading-content">
          <Diamonds color="#4f46e5" size="60" unit="px" />
          <p class="loading-text">Loading content...</p>
        </div>
      </div>
    {:else if error}
      <div class="error-container">
        <div class="error-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 class="error-title">Error Loading Post</h3>
        <p class="error-message">{error}</p>
        <div class="debug-info">
          <p class="debug-title">Debug Information:</p>
          <p>Space: <span class="debug-value">{spaceName}</span></p>
          <p>Subpath: <span class="debug-value">{actualSubpath}</span></p>
          <p>Item: <span class="debug-value">{itemShortname}</span></p>
        </div>
      </div>
    {:else if postData}
      {#if postData}
        {@const { reactions, comments, mediaFiles } =
          categorizeAttachments(postData)}

        <!-- Post Content Card -->
        <article class="post-card">
          <!-- Post Header -->
          <header class="post-header">
            <div class="post-title-section">
              <div class="post-icon">
                <span>📝</span>
              </div>
              <div class="post-title-content">
                <h1 class="post-title">{getPostTitle(postData)}</h1>
                <div class="post-badges">
                  <span class="badge badge-primary">
                    {postData.payload?.schema_shortname || "Content"}
                  </span>
                  <span
                    class="badge {postData.is_active
                      ? 'badge-success'
                      : 'badge-error'}"
                  >
                    <div
                      class="status-dot {postData.is_active
                        ? 'status-active'
                        : 'status-inactive'}"
                    ></div>
                    {postData.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <!-- Post Meta Grid -->
            <div class="meta-grid">
              <div class="meta-item">
                <svg
                  class="meta-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <div class="meta-content">
                  <p class="meta-label">Author</p>
                  <p class="meta-value">{getAuthorInfo(postData)}</p>
                </div>
              </div>
              <div class="meta-item">
                <svg
                  class="meta-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <div class="meta-content">
                  <p class="meta-label">Created</p>
                  <p class="meta-value">{formatDate(postData.created_at)}</p>
                </div>
              </div>
              <div class="meta-item">
                <svg
                  class="meta-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <div class="meta-content">
                  <p class="meta-label">Updated</p>
                  <p class="meta-value">{formatDate(postData.updated_at)}</p>
                </div>
              </div>
              <div class="meta-item">
                <svg
                  class="meta-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div class="meta-content">
                  <p class="meta-label">Content Type</p>
                  <p class="meta-value">
                    {postData.payload?.content_type || "Unknown"}
                  </p>
                </div>
              </div>
            </div>

            {#if getDescription(postData)}
              <div class="description-section">
                <h3 class="section-title">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      d="M20.59 13.41L10.59 3.41A2 2 0 0 0 9.17 3H4a2 2 0 0 0-2 2v5.17a2 2 0 0 0 .59 1.42l10 10a2 2 0 0 0 2.83 0l5.17-5.17a2 2 0 0 0 0-2.83z"
                    />
                    <circle cx="7.5" cy="7.5" r="1.5" />
                  </svg>
                  Description
                </h3>
                <p class="description-text">{getDescription(postData)}</p>
              </div>
            {/if}

            <!-- Tags -->
            {#if postData.tags && postData.tags.length > 0 && postData.tags[0] !== ""}
              <div class="tags-section">
                <h3 class="section-title">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      d="M20.59 13.41L10.59 3.41A2 2 0 0 0 9.17 3H4a2 2 0 0 0-2 2v5.17a2 2 0 0 0 .59 1.42l10 10a2 2 0 0 0 2.83 0l5.17-5.17a2 2 0 0 0 0-2.83z"
                    />
                    <circle cx="7.5" cy="7.5" r="1.5" />
                  </svg>
                  Tags
                </h3>
                <div class="tags-container">
                  {#each postData.tags as tag}
                    {#if tag && tag.trim()}
                      <span class="tag">#{tag}</span>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}
          </header>

          <!-- Post Content -->
          {#if getPostContent(postData)}
            <section class="content-section">
              <h3 class="content-title">
                <span class="title-accent"></span>
                Content
              </h3>

              <div class="post-content">
                <div class="content-text">
                  {getPostContent(postData)}
                </div>
              </div>
            </section>
          {/if}

          <!-- Interactions Section -->
          {#if reactions.length > 0 || comments.length > 0}
            <section class="interactions-section">
              <h3 class="section-title-large">
                <span class="title-accent"></span>
                Interactions
              </h3>

              <!-- Reactions Summary -->
              {#if reactions.length > 0}
                <div class="reactions-summary">
                  <h4 class="simple-subtitle">Reactions</h4>
                  <div class="reactions-simple">
                    {#each Object.entries(reactions.reduce((acc, reaction) => {
                        const type = getReactionType(reaction);
                        acc[type] = (acc[type] || 0) + 1;
                        return acc;
                      }, {})) as [type, count]}
                      <span class="reaction-count">
                        {getReactionEmoji(type)}
                        {count}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Comments List -->
              {#if comments.length > 0}
                <div class="comments-simple">
                  <h4 class="simple-subtitle">Comments ({comments.length})</h4>
                  <div class="comments-list-simple">
                    {#each comments as comment}
                      <div class="comment-simple">
                        {getCommentText(comment)}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </section>
          {/if}

          <!-- Media Attachments -->
          {#if mediaFiles.length > 0}
            <section class="media-section">
              <h3 class="section-title-large">
                <span class="title-accent-green"></span>
                Media & Files ({mediaFiles.length})
              </h3>
              <Attachments
                attachments={mediaFiles}
                resource_type={ResourceType.content}
                space_name={spaceName}
                subpath={actualSubpath}
                parent_shortname={itemShortname}
                {isOwner}
              />
            </section>
          {/if}

          {#if postData.relationships && postData.relationships.length > 0}
            <section class="relationships-section">
              <h3 class="section-title-large">
                <span class="title-accent-purple"></span>
                Relationships
              </h3>
              <div class="relationships-grid">
                {#each postData.relationships as relationship}
                  <div class="relationship-item">
                    <div class="relationship-content">
                      <span class="relationship-role">
                        {relationship.attributes?.role || "Related"}
                      </span>
                      <span class="relationship-name">
                        {relationship.related_to?.shortname || "Unknown"}
                      </span>
                      {#if relationship.related_to?.space_name}
                        <span class="relationship-space">
                          ({relationship.related_to.space_name})
                        </span>
                      {/if}
                    </div>
                    <span class="relationship-type">
                      {relationship.related_to?.resource_type || "unknown"}
                    </span>
                  </div>
                {/each}
              </div>
            </section>
          {/if}
        </article>
      {/if}
    {:else}
      <!-- No data state -->
      <div class="no-data-container">
        <div class="no-data-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h3 class="no-data-title">No Data Available</h3>
        <p class="no-data-message">Unable to load post data.</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .page-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
  }

  .page-header {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-content {
    max-width: 80rem;
    margin: 0 auto;
    padding: 1rem 1.5rem;
  }

  .breadcrumbs {
    margin-bottom: 1rem;
  }

  .breadcrumb-list {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .breadcrumb-item {
    display: flex;
    align-items: center;
  }

  .breadcrumb-separator {
    width: 1rem;
    height: 1rem;
    color: #94a3b8;
    margin: 0 0.5rem;
  }

  .breadcrumb-link {
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .breadcrumb-link:hover {
    color: #4f46e5;
  }

  .breadcrumb-current {
    color: #0f172a;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    color: #4f46e5;
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
  }

  .back-button:hover .back-icon {
    transform: translateX(-0.25rem);
  }

  .main-content {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: 5rem 0;
  }

  .loading-content {
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    color: #64748b;
    font-weight: 500;
  }

  .error-container {
    text-align: center;
    padding: 5rem 0;
  }

  .error-icon {
    width: 5rem;
    height: 5rem;
    background: #fee2e2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    color: #ef4444;
  }

  .error-icon svg {
    width: 2.5rem;
    height: 2.5rem;
  }

  .error-title {
    font-size: 2rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.75rem;
  }

  .error-message {
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .debug-info {
    background: #f1f5f9;
    border-radius: 0.5rem;
    padding: 1rem;
    font-size: 0.875rem;
    color: #64748b;
    max-width: 28rem;
    margin: 0 auto;
  }

  .debug-title {
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .debug-value {
    font-family: "Courier New", monospace;
  }

  .post-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(148, 163, 184, 0.3);
    overflow: hidden;
  }

  .post-header {
    padding: 2rem;
    background: linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%);
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
  }

  .post-title-section {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .post-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
    font-size: 2rem;
  }

  .post-title {
    font-size: 2rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }

  .post-badges {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge-primary {
    background: #e0e7ff;
    color: #3730a3;
  }

  .badge-success {
    background: #d1fae5;
    color: #065f46;
  }

  .badge-error {
    background: #fee2e2;
    color: #991b1b;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    margin-right: 0.5rem;
  }

  .status-active {
    background: #10b981;
  }

  .status-inactive {
    background: #ef4444;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 0.75rem;
  }

  .meta-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #64748b;
  }

  .meta-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .meta-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
  }

  .description-section {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .section-title svg {
    width: 1rem;
    height: 1rem;
  }

  .description-text {
    color: #374151;
    line-height: 1.6;
    margin: 0;
  }

  .tags-section {
    margin-top: 1.5rem;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: #dbeafe;
    color: #1e40af;
    transition: background-color 0.2s ease;
  }

  .tag:hover {
    background: #bfdbfe;
  }

  .content-section {
    padding: 2rem;
  }

  .content-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1.5rem;
  }

  .title-accent {
    width: 0.25rem;
    height: 1.5rem;
    background: #4f46e5;
    border-radius: 9999px;
  }

  .title-accent-green {
    width: 0.25rem;
    height: 1.5rem;
    background: #10b981;
    border-radius: 9999px;
  }

  .title-accent-purple {
    width: 0.25rem;
    height: 1.5rem;
    background: #8b5cf6;
    border-radius: 9999px;
  }

  .post-content {
    background: #f8fafc;
    border-radius: 0.75rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
  }

  .content-text {
    font-size: 1rem;
    line-height: 1.75;
    color: #334155;
    white-space: pre-wrap;
  }

  .interactions-section {
    padding: 0 2rem 1.5rem;
  }

  .reactions-summary {
    margin-bottom: 1.5rem;
  }

  .simple-subtitle {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .reactions-simple {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .reaction-count {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
  }

  .comments-simple {
    margin-top: 1.5rem;
  }

  .comments-list-simple {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .comment-simple {
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #374151;
  }

  .media-section {
    padding: 0 2rem 2rem;
  }

  .relationships-section {
    padding: 0 2rem 2rem;
  }

  .relationships-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .relationship-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
    border-radius: 0.75rem;
    border: 1px solid #c4b5fd;
  }

  .relationship-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .relationship-role {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    background: #e9d5ff;
    color: #6b21a8;
  }

  .relationship-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
  }

  .relationship-space {
    font-size: 0.75rem;
    color: #64748b;
    font-family: "Courier New", monospace;
  }

  .relationship-type {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .no-data-container {
    text-align: center;
    padding: 5rem 0;
  }

  .no-data-icon {
    width: 5rem;
    height: 5rem;
    background: #f1f5f9;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    color: #94a3b8;
  }

  .no-data-icon svg {
    width: 2.5rem;
    height: 2.5rem;
  }

  .no-data-title {
    font-size: 2rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.75rem;
  }

  .no-data-message {
    color: #64748b;
    margin: 0;
  }
</style>
