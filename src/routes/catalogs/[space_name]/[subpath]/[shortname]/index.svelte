<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getEntity } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { ResourceType } from "@edraj/tsdmart/dmart.model";
  import Attachments from "@/components/Attachments.svelte";
  import { user } from "@/stores/user";

  let isLoading = $state(false);
  let postData = $state(null);
  let error = $state(null);
  let spaceName = $state("");
  let subpath = "";
  let itemShortname = $state("");
  let actualSubpath = $state("");
  let breadcrumbs = $state([]);
  let isOwner = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  onMount(async () => {
    isOwner = $user.shortname === itemShortname;

    await initializeContent();
  });

  function initializeContent() {
    spaceName = $params.space_name;
    subpath = $params.subpath;
    itemShortname = $params.shortname;

    actualSubpath = subpath.replace(/-/g, "/");

    const pathParts = actualSubpath
      .split("/")
      .filter((part) => part.length > 0);
    breadcrumbs = [
      { name: $_("post_detail.breadcrumb.catalogs"), path: "/catalogs" },
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

    loadPostData();
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
        error = $_("post_detail.error.invalid_response");
      }
    } catch (err) {
      console.error("Error fetching post data:", err);
      error = err.message || $_("post_detail.error.failed_load");
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
    window.history.back();
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
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getAuthorInfo(item) {
    const relationships = item.relationships || [];
    const author = relationships.find(
      (rel) => rel.attributes?.role === "author"
    );
    return (
      author?.related_to?.shortname ||
      item.owner_shortname ||
      $_("common.unknown")
    );
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
      $_("post_detail.comments.no_content")
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
      default:
        return "❤️";
    }
  }
</script>

<div class="page-container" class:rtl={$isRTL}>
  <header class="page-header">
    <div class="header-content">
      <nav class="breadcrumbs" aria-label={$_("post_detail.breadcrumb.label")}>
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
        <span>{$_("post_detail.navigation.back_to_contents")}</span>
      </button>
    </div>
  </header>

  <main class="main-content">
    {#if isLoading}
      <div class="loading-container">
        <div class="loading-content">
          <Diamonds color="#4f46e5" size="60" unit="px" />
          <p class="loading-text">{$_("post_detail.loading.content")}</p>
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
        <h3 class="error-title">{$_("post_detail.error.title")}</h3>
        <p class="error-message">{error}</p>
        <div class="debug-info">
          <p class="debug-title">{$_("post_detail.debug.title")}</p>
          <p>
            {$_("post_detail.debug.space")}:
            <span class="debug-value">{spaceName}</span>
          </p>
          <p>
            {$_("post_detail.debug.subpath")}:
            <span class="debug-value">{actualSubpath}</span>
          </p>
          <p>
            {$_("post_detail.debug.item")}:
            <span class="debug-value">{itemShortname}</span>
          </p>
        </div>
      </div>
    {:else if postData}
      {#if postData}
        {@const { reactions, comments, mediaFiles } =
          categorizeAttachments(postData)}

        <article class="post-card">
          <header class="post-header">
            <div class="post-title-section">
              <div class="post-icon">
                <span>📝</span>
              </div>
              <div class="post-title-content">
                <h1 class="post-title">{getPostTitle(postData)}</h1>
                <div class="post-badges">
                  <span class="badge badge-primary">
                    {postData.payload?.schema_shortname ||
                      $_("post_detail.content_type.content")}
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
                    {postData.is_active
                      ? $_("post_detail.status.active")
                      : $_("post_detail.status.inactive")}
                  </span>
                </div>
              </div>
            </div>

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
                  <p class="meta-label">{$_("post_detail.meta.author")}</p>
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
                  <p class="meta-label">{$_("post_detail.meta.created")}</p>
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
                  <p class="meta-label">{$_("post_detail.meta.updated")}</p>
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
                  <p class="meta-label">
                    {$_("post_detail.meta.content_type")}
                  </p>
                  <p class="meta-value">
                    {postData.payload?.content_type || $_("common.unknown")}
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
                  {$_("post_detail.sections.description")}
                </h3>
                <p class="description-text">{getDescription(postData)}</p>
              </div>
            {/if}

            {#if postData.tags && postData.tags.length > 0 && postData.tags[0] !== ""}
              <div class="tags-section">
                <h3 class="section-title">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      d="M20.59 13.41L10.59 3.41A2 2 0 0 0 9.17 3H4a2 2 0 0 0-2 2v5.17a2 2 0 0 0 .59 1.42l10 10a2 2 0 0 0 2.83 0l5.17-5.17a2 2 0 0 0 0-2.83z"
                    />
                    <circle cx="7.5" cy="7.5" r="1.5" />
                  </svg>
                  {$_("post_detail.sections.tags")}
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

          {#if getPostContent(postData)}
            <section class="content-section">
              <h3 class="content-title">
                <span class="title-accent"></span>
                {$_("post_detail.sections.content")}
              </h3>

              <div class="post-content">
                <div class="content-text">
                  {getPostContent(postData)}
                </div>
              </div>
            </section>
          {/if}

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
                        {count}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if comments.length > 0}
                <div class="comments-simple">
                  <h4 class="simple-subtitle">
                    {$_("post_detail.comments.title", {
                      values: { count: comments.length },
                    })}
                  </h4>
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

          {#if mediaFiles.length > 0}
            <section class="media-section">
              <h3 class="section-title-large">
                <span class="title-accent-green"></span>
                {$_("post_detail.media.title", {
                  values: { count: mediaFiles.length },
                })}
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
                {$_("post_detail.sections.relationships")}
              </h3>
              <div class="relationships-grid">
                {#each postData.relationships as relationship}
                  <div class="relationship-item">
                    <div class="relationship-content">
                      <span class="relationship-role">
                        {relationship.attributes?.role ||
                          $_("post_detail.relationships.related")}
                      </span>
                      <span class="relationship-name">
                        {relationship.related_to?.shortname ||
                          $_("common.unknown")}
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
        <h3 class="no-data-title">{$_("post_detail.no_data.title")}</h3>
        <p class="no-data-message">{$_("post_detail.no_data.message")}</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .page-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
  }

  .rtl {
    direction: rtl;
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

  .rtl .header-content {
    text-align: right;
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

  .rtl .breadcrumb-separator {
    transform: rotate(180deg);
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

  .rtl .back-button:hover .back-icon {
    transform: translateX(0.25rem);
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

  .rtl .error-container {
    text-align: center;
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

  .rtl .debug-info {
    text-align: right;
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

  .rtl .post-header {
    text-align: right;
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

  .rtl .status-dot {
    margin-right: 0;
    margin-left: 0.5rem;
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

  .rtl .description-section {
    text-align: right;
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

  .rtl .tags-section {
    text-align: right;
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

  .rtl .content-section {
    text-align: right;
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

  .section-title-large {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1.5rem;
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

  .rtl .interactions-section {
    text-align: right;
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

  .rtl .media-section {
    text-align: right;
  }

  .relationships-section {
    padding: 0 2rem 2rem;
  }

  .rtl .relationships-section {
    text-align: right;
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

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .header-content {
      padding: 1rem;
    }

    .main-content {
      padding: 1rem;
    }

    .post-header {
      padding: 1.5rem;
    }

    .content-section {
      padding: 1.5rem;
    }

    .interactions-section,
    .media-section,
    .relationships-section {
      padding: 0 1.5rem 1.5rem;
    }

    .meta-grid {
      grid-template-columns: 1fr;
    }

    .post-title {
      font-size: 1.5rem;
    }

    .post-title-section {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .rtl .post-title-section {
      flex-direction: column;
    }

    .relationships-grid {
      grid-template-columns: 1fr;
    }

    .relationship-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .rtl .relationship-item {
      flex-direction: column;
      align-items: flex-end;
    }
  }
</style>
