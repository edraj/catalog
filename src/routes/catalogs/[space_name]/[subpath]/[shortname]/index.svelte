<script lang="ts">
  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import { getCatalogItem } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { ResourceType } from "@edraj/tsdmart/dmart.model";
  $goto;
  let isLoading = false;
  let postData = $state(null);
  let error = null;
  let spaceName = "";
  let subpath = "";
  let itemShortname = "";
  let actualSubpath = "";
  let breadcrumbs = [];

  onMount(async () => {
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
      const response = await getCatalogItem(
        spaceName,
        actualSubpath,
        itemShortname,
        ResourceType.content,
        "managed"
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

  function getResourceTypeIcon(resourceType) {
    switch (resourceType) {
      case "content":
        return "📄";
      case "post":
        return "📝";
      case "ticket":
        return "🎫";
      case "media":
        return "🖼️";
      default:
        return "📋";
    }
  }

  function getResourceTypeColor(resourceType) {
    switch (resourceType) {
      case "content":
        return "bg-green-100 text-green-800";
      case "post":
        return "bg-purple-100 text-purple-800";
      case "ticket":
        return "bg-orange-100 text-orange-800";
      case "media":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getAuthorInfo(item) {
    const relationships = item.relationships || [];
    const author = relationships.find(
      (rel) => rel.attributes?.role === "author"
    );
    return author?.related_to?.shortname || item.owner_shortname || "Unknown";
  }

  function getContentPreview(payload) {
    if (!payload?.body) return "";

    if (payload.content_type === "html") {
      const div = document.createElement("div");
      div.innerHTML = payload.body;
      return div.textContent || div.innerText || "";
    }

    return payload.body.toString();
  }

  function isImageContent(payload) {
    return payload?.content_type === "image" && payload?.body;
  }

  function getImageUrl(item, payload) {
    if (isImageContent(payload)) {
      return `/media/${spaceName}${actualSubpath}/${item.shortname}/${payload.body}`;
    }
    return null;
  }

  function getAttachmentUrl(item, attachment) {
    const filename = attachment.attributes?.payload?.body;
    if (filename && attachment.subpath) {
      return `/media/${spaceName}${attachment.subpath}/${filename}`;
    }
    if (filename) {
      return `/media/${spaceName}${actualSubpath}/${item.shortname}/${filename}`;
    }
    return null;
  }

  function getAttachmentsList(item) {
    const attachments = [];

    if (item.attachments?.media && Array.isArray(item.attachments.media)) {
      attachments.push(...item.attachments.media);
    }

    if (item.attachments) {
      Object.keys(item.attachments).forEach((key) => {
        if (key !== "media" && Array.isArray(item.attachments[key])) {
          attachments.push(...item.attachments[key]);
        }
      });
    }

    return attachments;
  }

  function isVideoContent(contentType) {
    return contentType && contentType.startsWith("video/");
  }

  function isAudioContent(contentType) {
    return contentType && contentType.startsWith("audio/");
  }

  function isPdfContent(contentType) {
    return contentType === "application/pdf";
  }

  function getFileExtension(filename) {
    return filename ? filename.split(".").pop().toLowerCase() : "";
  }

  function canPreview(contentType, filename) {
    if (!contentType) return false;

    if (
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/")
    ) {
      return true;
    }

    const ext = getFileExtension(filename);
    const previewableExts = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "svg",
      "webp",
      "mp4",
      "webm",
      "mp3",
      "wav",
      "ogg",
    ];
    return previewableExts.includes(ext);
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header Section -->
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-6 max-w-4xl">
      <!-- Breadcrumbs -->
      <nav class="flex mb-4" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          {#each breadcrumbs as crumb, index}
            <li class="inline-flex items-center">
              {#if index > 0}
                <svg
                  class="w-4 h-4 text-gray-400 mx-1"
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
                  class="text-gray-500 hover:text-gray-700 transition-colors duration-200 text-sm"
                >
                  {crumb.name}
                </button>
              {:else}
                <span class="text-gray-900 font-medium text-sm"
                  >{crumb.name}</span
                >
              {/if}
            </li>
          {/each}
        </ol>
      </nav>

      <div class="flex items-center justify-between">
        <button
          onclick={goBack}
          class="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
        >
          <svg
            class="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
          Back to Contents
        </button>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if isLoading}
      <div class="flex justify-center py-16">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else if error}
      <div class="text-center py-16">
        <div
          class="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          Error Loading Post
        </h3>
        <p class="text-gray-600">{error}</p>
        <div class="mt-4 text-sm text-gray-500">
          <p>Debug info:</p>
          <p>Space: {spaceName}</p>
          <p>Subpath: {actualSubpath}</p>
          <p>Item: {itemShortname}</p>
        </div>
      </div>
    {:else if postData}
      <!-- Post Content -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <!-- Post Header -->
        <div class="p-8 border-b border-gray-100">
          <div class="flex items-start justify-between mb-6">
            <div class="flex items-center space-x-4">
              <div
                class="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
              >
                <span class="text-white text-2xl">
                  {getResourceTypeIcon("content")}
                </span>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900 mb-2">
                  {getDisplayName(postData)}
                </h1>
                <div class="flex items-center space-x-4 text-sm text-gray-600">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getResourceTypeColor(
                      'content'
                    )}"
                  >
                    content
                  </span>
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {postData.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'}"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full mr-1.5 {postData.is_active
                        ? 'bg-green-400'
                        : 'bg-red-400'}"
                    ></div>
                    {postData.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Post Meta Information -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">Author</h3>
              <p class="text-sm text-gray-900">{getAuthorInfo(postData)}</p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">Created</h3>
              <p class="text-sm text-gray-900">
                {formatDate(postData.created_at)}
              </p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-1">Updated</h3>
              <p class="text-sm text-gray-900">
                {formatDate(postData.updated_at)}
              </p>
            </div>
          </div>

          {#if getDescription(postData)}
            <div class="mb-6">
              <h3 class="text-sm font-medium text-gray-500 mb-2">
                Description
              </h3>
              <p class="text-gray-700">{getDescription(postData)}</p>
            </div>
          {/if}

          <!-- Tags -->
          {#if postData.tags && postData.tags.length > 0 && postData.tags[0] !== ""}
            <div class="mb-6">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Tags</h3>
              <div class="flex flex-wrap gap-2">
                {#each postData.tags as tag}
                  {#if tag && tag.trim()}
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      #{tag}
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Post Content/Payload -->

        {#if postData.payload}
          <div class="p-8">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Content</h3>

            {#if isImageContent(postData.payload)}
              <!-- Image Content -->
              <div class="mb-6">
                <img
                  src={getImageUrl(postData, postData.payload) ||
                    "/placeholder.svg"}
                  alt={getDisplayName(postData)}
                  class="max-w-full h-auto rounded-lg shadow-md"
                  onerror={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                    const next = (e.currentTarget as HTMLElement)
                      .nextElementSibling as HTMLElement | null;
                    if (next) next.style.display = "block";
                  }}
                />
                <div
                  class="hidden bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
                >
                  <svg
                    class="w-12 h-12 text-gray-400 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p class="text-gray-500">Image could not be loaded</p>
                  <p class="text-xs text-gray-400 mt-1">
                    {postData.payload.body}
                  </p>
                </div>
              </div>
            {:else if postData.payload.content_type === "html"}
              <!-- HTML Content -->
              <div
                class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900"
              >
                {@html postData.payload.body}
              </div>
            {:else}
              <!-- Other Content Types -->
              <div class="bg-gray-50 rounded-lg p-6">
                <div class="flex items-center mb-4">
                  <svg
                    class="w-5 h-5 text-gray-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span class="text-sm font-medium text-gray-700"
                    >Content Type: {postData.payload.content_type}</span
                  >
                </div>
                <pre
                  class="text-sm text-gray-800 whitespace-pre-wrap bg-white p-4 rounded border">{getContentPreview(
                    postData.payload
                  )}</pre>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Enhanced Attachments Section with Media Previews -->
        {#if getAttachmentsList(postData).length > 0}
          <div class="px-8 pb-8">
            <div class="border-t border-gray-100 pt-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">
                Attachments ({getAttachmentsList(postData).length})
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each getAttachmentsList(postData) as attachment}
                  <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="flex items-center mb-3">
                      <div
                        class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3"
                      >
                        {#if attachment.attributes?.payload?.content_type === "image"}
                          <svg
                            class="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        {:else if isVideoContent(attachment.attributes?.payload?.content_type)}
                          <svg
                            class="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        {:else if isAudioContent(attachment.attributes?.payload?.content_type)}
                          <svg
                            class="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5.25 5.25C5.25 8.9 8.1 11.25 11.25 11.25s6-2.35 6-5.25-2.85-3.75-6-3.75-6 2.35-6 5.25z"
                            />
                          </svg>
                        {:else}
                          <svg
                            class="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        {/if}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">
                          {attachment.attributes?.displayname?.ar ||
                            attachment.attributes?.displayname?.en ||
                            attachment.shortname}
                        </p>
                        <p class="text-xs text-gray-500">
                          {attachment.attributes?.payload?.content_type ||
                            "Unknown type"}
                        </p>
                      </div>
                    </div>

                    {#if attachment.attributes?.payload?.bytesize}
                      <div class="text-xs text-gray-500 mb-2">
                        Size: {(
                          attachment.attributes.payload.bytesize / 1024
                        ).toFixed(1)} KB
                      </div>
                    {/if}

                    <!-- Media Preview Section -->
                    {#if attachment.attributes?.payload?.content_type === "image"}
                      <div class="mb-3">
                        <button
                          type="button"
                          class="w-full h-32 p-0 border-0 bg-transparent rounded cursor-pointer focus:outline-none"
                          aria-label="Preview image"
                          onclick={() => {
                            const modal = document.createElement("div");
                            modal.className =
                              "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                            modal.innerHTML = `
                            <div class="relative max-w-4xl max-h-full p-4">
                              <img src="${getAttachmentUrl(postData, attachment)}" class="max-w-full max-h-full object-contain rounded-lg" />
                              <button type="button" class="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl" aria-label="Close preview">&times;</button>
                            </div>
                          `;
                            document.body.appendChild(modal);
                            const closeBtn = modal.querySelector("button");
                            if (closeBtn) {
                              closeBtn.addEventListener("click", () => {
                                document.body.removeChild(modal);
                              });
                            }
                            modal.addEventListener("click", (event) => {
                              if (event.target === modal) {
                                document.body.removeChild(modal);
                              }
                            });
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}
                        >
                          <img
                            src={getAttachmentUrl(postData, attachment) ||
                              "/placeholder.svg"}
                            alt={attachment.shortname}
                            class="w-full h-32 object-cover rounded border hover:opacity-80"
                            onerror={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.style.display = "none";
                              const fallback =
                                img.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = "block";
                            }}
                          />
                          <div
                            class="hidden bg-gray-200 h-32 flex items-center justify-center rounded border"
                          >
                            <span class="text-gray-500 text-sm"
                              >Image not available</span
                            >
                          </div>
                        </button>
                        <div
                          class="hidden bg-gray-200 h-32 flex items-center justify-center rounded border"
                        >
                          <span class="text-gray-500 text-sm"
                            >Image not available</span
                          >
                        </div>
                      </div>
                    {:else if isVideoContent(attachment.attributes?.payload?.content_type)}
                      <div class="mb-3">
                        <video
                          src={getAttachmentUrl(postData, attachment)}
                          class="w-full h-32 object-cover rounded border"
                          controls
                          preload="metadata"
                        >
                          <track kind="captions" />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    {:else if isAudioContent(attachment.attributes?.payload?.content_type)}
                      <div class="mb-3">
                        <audio
                          src={getAttachmentUrl(postData, attachment)}
                          class="w-full"
                          controls
                          preload="metadata"
                        >
                          Your browser does not support the audio tag.
                        </audio>
                      </div>
                    {:else if isPdfContent(attachment.attributes?.payload?.content_type)}
                      <div class="mb-3">
                        <div
                          class="bg-red-50 border border-red-200 rounded p-3 text-center"
                        >
                          <svg
                            class="w-8 h-8 text-red-600 mx-auto mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          <p class="text-sm text-red-700">PDF Document</p>
                        </div>
                      </div>
                    {:else}
                      <div class="mb-3">
                        <div
                          class="bg-gray-100 border border-gray-300 rounded p-3 text-center"
                        >
                          <svg
                            class="w-8 h-8 text-gray-400 mx-auto mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <p class="text-sm text-gray-600">
                            File: {attachment.attributes?.payload?.body}
                          </p>
                        </div>
                      </div>
                    {/if}

                    <!-- Download/Open Link -->
                    <div class="flex space-x-2">
                      <a
                        href={getAttachmentUrl(postData, attachment)}
                        target="_blank"
                        class="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 flex-1 justify-center py-2 px-3 border border-blue-200 rounded hover:bg-blue-50"
                      >
                        <svg
                          class="w-3 h-3 mr-1"
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
                        Open
                      </a>
                      <a
                        href={getAttachmentUrl(postData, attachment)}
                        download
                        class="inline-flex items-center text-xs text-green-600 hover:text-green-800 flex-1 justify-center py-2 px-3 border border-green-200 rounded hover:bg-green-50"
                      >
                        <svg
                          class="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
        <!-- Relationships -->
        {#if postData.relationships && postData.relationships.length > 0}
          <div class="px-8 pb-8">
            <div class="border-t border-gray-100 pt-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">
                Relationships
              </h3>
              <div class="space-y-3">
                {#each postData.relationships as relationship}
                  <div
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div class="flex items-center space-x-3">
                      <span
                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {relationship.attributes?.role || "Related"}
                      </span>
                      <span class="text-sm font-medium text-gray-900">
                        {relationship.related_to?.shortname || "Unknown"}
                      </span>
                      {#if relationship.related_to?.space_name}
                        <span class="text-xs text-gray-500">
                          ({relationship.related_to.space_name})
                        </span>
                      {/if}
                    </div>
                    <span class="text-xs text-gray-400">
                      {relationship.related_to?.resource_type || "unknown"}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- No data state -->
      <div class="text-center py-16">
        <div
          class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          No Data Available
        </h3>
        <p class="text-gray-600">Unable to load post data.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Prose styling for HTML content */
  .prose {
    color: #374151;
    line-height: 1.7;
  }
</style>
