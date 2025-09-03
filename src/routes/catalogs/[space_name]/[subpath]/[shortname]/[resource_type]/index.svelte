<script lang="ts">
    import {onMount} from "svelte";
    import {goto, params} from "@roxi/routify";
    import {
        checkCurrentUserReactedIdea,
        createComment,
        createReaction,
        deleteReactionComment,
        getEntity,
        getRelatedContents
    } from "@/lib/dmart_services";
    import {Diamonds} from "svelte-loading-spinners";
    import {_, locale} from "@/i18n";
    import {derived} from "svelte/store";
    import {ResourceType} from "@edraj/tsdmart/dmart.model";
    import Attachments from "@/components/Attachments.svelte";
    import {user} from "@/stores/user";
    import {errorToastMessage, successToastMessage,} from "@/lib/toasts_messages";
    import {formatNumberInText} from "@/lib/helpers";

    $goto;
  let isLoading = $state(false);
  let postData = $state(null);
  let relatedContent = $state([]);
  let isLoadingRelated = $state(false);
  let error = $state(null);
  let spaceName = $state("");
  let subpath = "";
  let itemShortname = $state("");
  let actualSubpath = $state(null);
  let breadcrumbs = $state([]);
  let isOwner = $state(false);
  let newComment = $state("");
  let isSubmittingComment = $state(false);
  let isSubmittingReaction = $state(false);
  let userReactionId = $state(null);
  let showLoginPrompt = $state(false);

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
        await checkUserReaction();
        await loadRelatedContent();
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

  async function loadRelatedContent() {
    if (!postData) return;

    isLoadingRelated = true;
    try {
      const editorRelationship = postData.relationships?.find(
        (rel) => rel.attributes?.role === "editor"
      );
      const editorShortname = editorRelationship?.related_to?.shortname;

      const response = await getRelatedContents(
        spaceName,
        actualSubpath,
        "public",
        postData.tags || [],
        postData.owner_shortname,
        6
      );

      if (response?.records) {
        relatedContent = response.records.filter(
          (item) => item.shortname !== itemShortname
        );
      }
    } catch (err) {
      console.error("Error loading related content:", err);
    } finally {
      isLoadingRelated = false;
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
    return item.attributes?.payload?.body?.title || item.shortname;
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
    const relationships = item.attributes?.relationships || [];
    const author = relationships.find(
      (rel) => rel.attributes?.role === "editor"
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
      comment?.attributes?.displayname?.ar ||
      comment?.attributes?.displayname?.en ||
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

  async function handleAddComment() {
    if (!$user || !$user.shortname) {
      showLoginPrompt = true;
      return;
    }

    if (!newComment.trim()) {
      errorToastMessage($_("post_detail.comments.empty_comment"));
      return;
    }

    isSubmittingComment = true;

    try {
      const success = await createComment(
        spaceName,
        actualSubpath,
        itemShortname,
        newComment.trim()
      );

      if (success) {
        successToastMessage($_("post_detail.comments.added_successfully"));
        newComment = "";
        await loadPostData();
      } else {
        errorToastMessage($_("post_detail.comments.add_failed"));
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      errorToastMessage($_("post_detail.comments.add_error"));
    } finally {
      isSubmittingComment = false;
    }
  }

  async function handleToggleReaction() {
    if (!$user || !$user.shortname) {
      showLoginPrompt = true;
      return;
    }

    isSubmittingReaction = true;

    try {
      if (userReactionId) {
        const success = await deleteReactionComment(
          ResourceType.reaction,
          `${actualSubpath}/${itemShortname}`,
          userReactionId,
          spaceName
        );

        if (success) {
          userReactionId = null;
          successToastMessage($_("post_detail.reactions.removed_successfully"));
          await loadPostData();
        } else {
          errorToastMessage($_("post_detail.reactions.remove_failed"));
        }
      } else {
        const success = await createReaction(
          itemShortname,
          spaceName,
          actualSubpath
        );

        if (success) {
          successToastMessage($_("post_detail.reactions.added_successfully"));
          await loadPostData();
          await checkUserReaction();
        } else {
          errorToastMessage($_("post_detail.reactions.add_failed"));
        }
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
      errorToastMessage($_("post_detail.reactions.toggle_error"));
    } finally {
      isSubmittingReaction = false;
    }
  }

  async function checkUserReaction() {
    if (!$user || !$user.shortname) return;

    try {
      const reactionId = await checkCurrentUserReactedIdea(
        $user.shortname,
        itemShortname,
        spaceName,
        actualSubpath
      );
      userReactionId = reactionId;
    } catch (error) {
      console.error("Error checking user reaction:", error);
    }
  }

  function closeLoginPrompt() {
    showLoginPrompt = false;
  }

  function goToLogin() {
    $goto("/login");
  }

  function handleRelationshipClick(relationship) {
    if (
      relationship.attributes?.role === "editor" &&
      relationship.related_to?.shortname
    ) {
      const editorShortname = relationship.related_to.shortname;
      $goto("/catalogs/[space_name]/[subpath]/[shortname]/[resource_type]", {
        space_name: spaceName,
        subpath: "authors",
        shortname: editorShortname,
        resource_type: ResourceType.content,
      });
    }
  }

  function handleRelatedContentClick(item) {
    // const encodedSubpath = item.subpath?.replace(/\//g, "-") || "";
    $goto("/catalogs/[space_name]/[subpath]/[shortname]/[resource_type]", {
      space_name: spaceName,
      subpath: item.subpath,
      shortname: item.shortname,
      resource_type: ResourceType.content,
    });
  }

  function isHtmlContent(content) {
    if (typeof content !== "string") return false;
    const htmlRegex = /<[^>]*>/;
    return htmlRegex.test(content);
  }

  function isMarkdownContent(content) {
    if (typeof content !== "string") return false;
    const markdownPatterns = [
      /^#{1,6}\s+/m,
      /\*\*.*?\*\*/,
      /\*.*?\*/,
      /\[.*?\]$$.*?$$/,
      /^[-*+]\s+/m,
      /\`\`\`[\s\S]*?\`\`\`/,
    ];
    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  function isStructuredData(data) {
    if (!data || typeof data !== "object") return false;
    const meaningfulKeys = Object.keys(data).filter(
      (key) => key !== "content" && data[key] && data[key].toString().trim()
    );
    return meaningfulKeys.length > 0;
  }

  function renderMarkdown(content) {
    if (!content) return "";

    let html = content
      // Convert headings
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")

      // Convert bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\_\_\_(.*?)\_\_\_/g, "<strong><em>$1</em></strong>")
      .replace(/\_\_(.*?)\_\_/g, "<strong>$1</strong>")
      .replace(/\_(.*?)\_/g, "<em>$1</em>")

      // Convert inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")

      // Convert code blocks
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")

      // Convert blockquotes
      .replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>")

      // Convert links
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )

      // Convert line breaks to paragraphs
      .split("\n\n")
      .map((paragraph) => {
        paragraph = paragraph.trim();
        if (!paragraph) return "";

        // Don't wrap headings, blockquotes, pre, or other block elements in paragraphs
        if (
          paragraph.startsWith("<h") ||
          paragraph.startsWith("<blockquote") ||
          paragraph.startsWith("<pre") ||
          paragraph.startsWith("<ul") ||
          paragraph.startsWith("<ol")
        ) {
          return paragraph;
        }

        return `<p>${paragraph.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    return html;
  }
  let prevParams = { shortname: "", subpath: "", space_name: "" };

  $effect(() => {
    const { shortname, subpath, space_name } = $params;

    if (
      prevParams.shortname !== shortname ||
      prevParams.subpath !== subpath ||
      prevParams.space_name !== space_name
    ) {
      prevParams = { shortname, subpath, space_name };
      initializeContent();
    }
  });
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
                  aria-label={`Navigate to ${crumb.name}`}
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

      <button aria-label={`Go back`} onclick={goBack} class="back-button">
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
      </div>
    {:else if postData}
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

            <div class="meta-card">
              <div class="meta-row">
                <div class="meta-item-compact">
                  <svg
                    class="meta-icon-small"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span class="meta-text">{getAuthorInfo(postData)}</span>
                </div>
                <div class="meta-item-compact">
                  <svg
                    class="meta-icon-small"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span class="meta-text"
                    >{formatDate(postData.created_at)}</span
                  >
                </div>
              </div>
              <div class="meta-row">
                <div class="meta-item-compact">
                  <svg
                    class="meta-icon-small"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span class="meta-text"
                    >{postData.payload?.content_type ||
                      $_("common.unknown")}</span
                  >
                </div>
                <div class="meta-item-compact">
                  <svg
                    class="meta-icon-small"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span class="meta-text"
                    >{formatDate(postData.updated_at)}</span
                  >
                </div>
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
                {#if postData?.payload?.content_type === "html"}
                  <div
                    class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
                  >
                    {@html getPostContent(postData)}
                  </div>
                {:else if postData?.payload?.content_type === "json"}
                  {#if isHtmlContent(getPostContent(postData))}
                    <div
                      class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
                    >
                      {@html getPostContent(postData)}
                    </div>
                  {:else if isMarkdownContent(getPostContent(postData))}
                    <div
                      class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-blockquote:py-2"
                    >
                      {@html renderMarkdown(getPostContent(postData))}
                    </div>
                  {:else if isStructuredData(postData.payload.body)}
                    <div
                      class="structured-content bg-white rounded-lg shadow-sm border p-6"
                    >
                      <h4
                        class="text-xl font-bold text-gray-900 mb-4 border-b pb-2"
                      >
                        Content Details
                      </h4>
                      {#each Object.entries(postData.payload.body) as [key, value]}
                        {#if key !== "content" && value}
                          <div class="mb-3 flex flex-wrap">
                            <span
                              class="font-semibold text-gray-700 capitalize min-w-24"
                              >{key.replace("_", " ")}:</span
                            >
                            <span class="ml-3 text-gray-600 flex-1"
                              >{value}</span
                            >
                          </div>
                        {/if}
                      {/each}

                      {#if postData.payload.body.content}
                        <div class="mt-6 pt-4 border-t">
                          <span class="font-semibold text-gray-700 block mb-3"
                            >Content:</span
                          >
                          <div
                            class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800"
                          >
                            {@html postData.payload.body.content}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <details
                      class="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border shadow-sm"
                    >
                      <summary
                        class="cursor-pointer font-semibold text-gray-800 mb-3 hover:text-blue-600 transition-colors duration-200"
                        >📊 View Raw Data</summary
                      >
                      <pre
                        class="text-sm overflow-x-auto mt-4 bg-gray-900 text-green-400 p-4 rounded-md font-mono leading-relaxed">{JSON.stringify(
                          postData.payload.body?.content ||
                            postData.payload.body,
                          null,
                          2
                        )}</pre>
                    </details>
                  {/if}
                {:else}
                  <!-- This is likely plain text or markdown that needs to be rendered -->
                  {#if getPostContent(postData) && (getPostContent(postData).includes("#") || getPostContent(postData).includes("*") || getPostContent(postData).includes("_"))}
                    <!-- Detect and render markdown-like content -->
                    <div
                      class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-blockquote:py-2"
                    >
                      {@html renderMarkdown(getPostContent(postData))}
                    </div>
                  {:else}
                    <!-- Plain text fallback with better styling -->
                    <div class="bg-white p-6 rounded-lg shadow-sm border">
                      <div
                        class="whitespace-pre-wrap leading-relaxed text-gray-700 text-base"
                      >
                        {getPostContent(postData)}
                      </div>
                    </div>
                  {/if}
                {/if}
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
                      {formatNumberInText(Number(count), $locale)}
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
                      count: formatNumberInText(comments.length, $locale),
                    },
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
                  aria-label={`Submit comment`}
                  onclick={handleAddComment}
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
                  aria-label={`Toggle reaction`}
                  class="interaction-button reaction-button {userReactionId
                    ? 'active'
                    : ''}"
                  onclick={handleToggleReaction}
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
        {#if mediaFiles.length > 0}
          <section class="media-section">
            <h3 class="section-title-large">
              <span class="title-accent-green"></span>
              {$_("post_detail.media.title", {
                values: {
                  count: formatNumberInText(mediaFiles.length, $locale),
                },
              })}
            </h3>
            <Attachments
              attachments={mediaFiles}
              resource_type={ResourceType.ticket}
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
                <button
                  aria-label={`View relationship with ${relationship.related_to?.shortname}`}
                  class="relationship-item clickable"
                  onclick={() => handleRelationshipClick(relationship)}
                  disabled={relationship.attributes?.role !== "editor"}
                >
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
                  <div class="relationship-meta">
                    <span class="relationship-type">
                      {relationship.related_to?.resource_type || "unknown"}
                    </span>
                    {#if relationship.attributes?.role === "editor"}
                      <svg
                        class="click-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Related Content Section -->
        {#if relatedContent.length > 0}
          <section class="related-content-section">
            <h3 class="section-title-large">
              <span class="title-accent-orange"></span>
              {$_("related_content")}
            </h3>
            {#if isLoadingRelated}
              <div class="loading-related">
                <Diamonds color="#f97316" size="40" unit="px" />
                <p>{$_("loading")}</p>
              </div>
            {:else}
              <div class="related-content-grid">
                {#each relatedContent as item}
                  <button
                    aria-label={`View related content: ${getDisplayName(item)}`}
                    class="related-content-card"
                    onclick={() => handleRelatedContentClick(item)}
                  >
                    <div class="related-content-header">
                      <h4 class="related-content-title">
                        {getDisplayName(item)}
                      </h4>
                      <svg
                        class="external-link-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </div>
                    <div class="related-content-meta">
                      <span class="related-content-date">
                        {formatDate(item.attributes?.updated_at)}
                      </span>
                      <span class="related-content-author">
                        {getAuthorInfo(item)}
                      </span>
                    </div>
                    {#if item.tags && item.tags.length > 0}
                      <div class="related-content-tags">
                        {#each item.tags.slice(0, 3) as tag}
                          <span class="related-tag">#{tag}</span>
                        {/each}
                        {#if item.tags.length > 3}
                          <span class="tag-more">+{item.tags.length - 3}</span>
                        {/if}
                      </div>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/if}
      </article>
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

    {#if showLoginPrompt}
      <div class="modal-overlay" onclick={closeLoginPrompt} role="presentation">
        <div class="login-prompt-modal" onclick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">
              {$_("post_detail.login_required.title")}
            </h3>
            <button
              aria-label={`Close login prompt`}
              onclick={closeLoginPrompt}
              class="modal-close-button"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="login-prompt-text">
              {$_("post_detail.login_required.message")}
            </p>
            <div class="login-prompt-actions">
              <button onclick={goToLogin} class="login-button">
                {$_("post_detail.login_required.login")}
              </button>
              <button onclick={closeLoginPrompt} class="cancel-button">
                {$_("post_detail.login_required.cancel")}
              </button>
            </div>
          </div>
        </div>
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
    gap: 1.5rem;
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
    flex-shrink: 0;
  }

  .post-title-content {
    flex: 1;
    min-width: 0;
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
    flex-wrap: wrap;
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

  /* New compact meta card styles */
  .meta-card {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 0.75rem;
    padding: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    backdrop-filter: blur(4px);
    min-width: 280px;
    flex-shrink: 0;
  }

  .meta-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .meta-row:last-child {
    margin-bottom: 0;
  }

  .meta-item-compact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .meta-icon-small {
    width: 1rem;
    height: 1rem;
    color: #64748b;
    flex-shrink: 0;
  }

  .meta-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
    truncate: true;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .title-accent-orange {
    width: 0.25rem;
    height: 1.5rem;
    background: #f97316;
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
    width: 100%;
    text-align: left;
    transition: all 0.2s ease;
  }

  .relationship-item.clickable:not(:disabled) {
    cursor: pointer;
  }

  .relationship-item.clickable:not(:disabled):hover {
    background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
  }

  .relationship-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .relationship-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
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
    font-family: "uthmantn", "Courier New", monospace;
  }

  .relationship-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .relationship-type {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .click-icon {
    width: 1rem;
    height: 1rem;
    color: #8b5cf6;
  }

  /* Related Content Styles */
  .related-content-section {
    padding: 0 2rem 2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    margin-top: 1rem;
  }

  .loading-related {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    color: #64748b;
  }

  .related-content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .related-content-card {
    background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
    border: 1px solid #fdba74;
    border-radius: 0.75rem;
    padding: 1rem;
    text-align: left;
    transition: all 0.2s ease;
    cursor: pointer;
    width: 100%;
  }

  .related-content-card:hover {
    background: linear-gradient(135deg, #fed7aa 0%, #fb923c 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(249, 115, 22, 0.15);
  }

  .related-content-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .related-content-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.3;
    margin: 0;
    flex: 1;
  }

  .external-link-icon {
    width: 1rem;
    height: 1rem;
    color: #f97316;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .related-content-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  .related-content-date,
  .related-content-author {
    font-weight: 500;
  }

  .related-content-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .related-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 500;
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
  }

  .tag-more {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 500;
    background: rgba(107, 114, 128, 0.1);
    color: #6b7280;
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

  /* Interactive Section Styles */
  .interactive-section {
    padding: 0 2rem 2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    margin-top: 1rem;
  }

  .rtl .interactive-section {
    text-align: right;
  }

  .interaction-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
    border: 1px solid;
  }

  .reaction-button {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #dc2626;
    margin-left: 1rem;
  }

  .reaction-button:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-1px);
  }

  .reaction-button.active {
    background: #dc2626;
    color: white;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .reaction-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .interaction-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .comment-form {
    background: rgba(248, 250, 252, 0.8);
    border-radius: 0.75rem;
    padding: 1.5rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .comment-form-title {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1rem;
  }

  .comment-input-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .comment-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.9);
    font-size: 0.875rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
    transition: all 0.2s ease;
  }

  .rtl .comment-textarea {
    text-align: right;
  }

  .comment-textarea:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .comment-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .comment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .rtl .comment-actions {
    justify-content: flex-start;
  }

  .submit-comment-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
  }

  .submit-comment-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }

  .submit-comment-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .login-prompt-modal {
    background: white;
    border-radius: 0.75rem;
    max-width: 28rem;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
  }

  .modal-close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: white;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-close-button:hover {
    background: rgba(248, 250, 252, 0.8);
    color: #374151;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .login-prompt-text {
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .login-prompt-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .rtl .login-prompt-actions {
    justify-content: flex-start;
  }

  .login-button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
  }

  .login-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }

  .cancel-button {
    padding: 0.75rem 1.5rem;
    background: rgba(248, 250, 252, 0.8);
    color: #64748b;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button:hover {
    background: rgba(241, 245, 249, 0.8);
    color: #374151;
  }

  .title-accent-blue {
    width: 0.25rem;
    height: 1.5rem;
    background: #0ea5e9;
    border-radius: 9999px;
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
    .relationships-section,
    .related-content-section {
      padding: 0 1.5rem 1.5rem;
    }

    .post-title {
      font-size: 1.5rem;
    }

    .post-title-section {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1rem;
    }

    .rtl .post-title-section {
      flex-direction: column;
    }

    .meta-card {
      min-width: auto;
      width: 100%;
    }

    .meta-row {
      flex-direction: column;
      gap: 0.5rem;
    }

    .relationships-grid,
    .related-content-grid {
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

    .comment-actions {
      flex-direction: column;
    }

    .rtl .comment-actions {
      flex-direction: column;
    }

    .reaction-button {
      margin-left: 0;
    }
  }
</style>
