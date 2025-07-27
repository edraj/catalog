<script lang="ts">
  import { run } from "svelte/legacy";

  import { onMount } from "svelte";
  import { params, goto } from "@roxi/routify";
  import {
    getSpaceContents,
    getAvatar,
    getEntityAttachmentsCount,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  $goto;

  let isLoading = $state(true);
  let contents = $state([]);
  let filteredContents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let searchQuery = $state("");
  let sortBy = $state("created");
  let filterType = $state("all");

  const isRTL = $locale === "ar" || $locale === "ku";
  const direction = isRTL ? "rtl" : "ltr";

  onMount(async () => {
    spaceName = $params.space_name;
    await loadContents();
  });

  async function loadContents() {
    isLoading = true;
    error = null;

    try {
      const response = await getSpaceContents(spaceName, "/", "public");

      if (response && response.records) {
        const enhancedContents = await Promise.all(
          response.records.map(async (item) => {
            const [avatar, attachmentCounts] = await Promise.all([
              item?.attributes?.owner_shortname
                ? getAvatar(item?.attributes?.owner_shortname)
                : null,
              getEntityAttachmentsCount(
                item.shortname,
                spaceName,
                item.subpath || "/"
              ),
            ]);

            return {
              ...item,
              ownerAvatar: avatar,
              reactionCount:
                attachmentCounts?.find(
                  (c) => c.attributes?.resource_type === "reaction"
                )?.attributes?.count || 0,
              commentCount:
                attachmentCounts?.find(
                  (c) => c.attributes?.resource_type === "comment"
                )?.attributes?.count || 0,
              title:
                item.attributes?.displayname?.[$locale] ||
                item.attributes?.displayname?.en ||
                item.attributes?.displayname?.ar ||
                item.attributes?.payload?.body?.title ||
                item.shortname,
            };
          })
        );

        contents = enhancedContents;
        filteredContents = enhancedContents;
      } else {
        contents = [];
        filteredContents = [];
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = $_("error.failed_load_space_contents");
    } finally {
      isLoading = false;
    }
  }

  function handleItemClick(item: any) {
    if (item.resource_type === "folder" || item.subpath !== "/") {
      const subpath =
        item.subpath === "/"
          ? item.shortname
          : `${item.subpath}/${item.shortname}`;
      $goto(`/catalogs/[space_name]/[subpath]`, {
        space_name: spaceName,
        subpath: subpath.replace(/\//g, "-"),
      });
    } else {
      $goto(`/catalogs/[space_name]/[subpath]/[shortname]`, {
        space_name: spaceName,
        subpath: "/".replace(/\//g, "-"),
        shortname: item.shortname,
        resource_type: item.resource_type,
      });
    }
  }

  function getItemIcon(item: any): string {
    switch (item.resource_type) {
      case "folder":
        return "📁";
      case "content":
        return "📄";
      case "post":
        return "📝";
      case "ticket":
        return "🎫";
      case "user":
        return "👤";
      case "media":
        return "🖼️";
      default:
        return "📋";
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getResourceTypes() {
    const types = [...new Set(contents.map((item) => item.resource_type))];
    return types;
  }

  function applyFilters() {
    let filtered = contents;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.shortname.toLowerCase().includes(query) ||
          (
            item.attributes?.description?.[$locale] ||
            item.attributes?.description?.en ||
            ""
          )
            .toLowerCase()
            .includes(query)
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter((item) => item.resource_type === filterType);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.$localeCompare(b.title);
        case "updated":
          return (
            new Date(b.attributes?.updated_at || 0).getTime() -
            new Date(a.attributes?.updated_at || 0).getTime()
          );
        case "reactions":
          return (b.reactionCount || 0) - (a.reactionCount || 0);
        default:
          return (
            new Date(b.attributes?.created_at || 0).getTime() -
            new Date(a.attributes?.created_at || 0).getTime()
          );
      }
    });

    filteredContents = filtered;
  }

  function goBack() {
    $goto("/catalogs");
  }

  run(() => {
    applyFilters();
  });
</script>

<div class="space-page" dir={direction}>
  <section class="space-header">
    <div class="header-content">
      <div class="header-nav">
        <button onclick={goBack} class="back-button">
          <svg
            class="back-icon {isRTL ? 'rotate-180' : ''}"
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
          <span>{$_("go_back")}</span>
        </button>
      </div>

      <div class="space-info">
        <div class="space-avatar">
          <div class="avatar-large">
            {spaceName.charAt(0).toUpperCase()}
          </div>
        </div>
        <div class="space-details">
          <h1 class="space-title">{spaceName}</h1>
          <p class="space-subtitle">
            Browse through a variety of catalogs and posts to discover new
            ideas, insights, and updates from the community.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="filter-section">
    <div class="filter-content">
      <div class="search-bar">
        <svg
          class="search-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
        <input
          type="text"
          placeholder="Search by name, description, or owner..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>

      <div class="filters">
        <select bind:value={sortBy} class="filter-select">
          <option value="created">Sort by created</option>
          <option value="updated">Sort by updated</option>
          <option value="name">Sort by name</option>
          <option value="reactions">Sort by most reactions</option>
        </select>

        <select bind:value={filterType} class="filter-select">
          <option value="all">All types</option>
          {#each getResourceTypes() as type}
            <option value={type}>{$_("resource_type." + type)}</option>
          {/each}
        </select>
      </div>
    </div>
  </section>

  <section class="content-section">
    {#if isLoading}
      <div class="loading-state">
        <Diamonds color="#6366f1" size="60" unit="px" />
        <p class="loading-text">{$_("common.loading")}</p>
      </div>
    {:else if error}
      <div class="error-state">
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
        <h3 class="error-title">{$_("error.loading_contents_title")}</h3>
        <p class="error-message">{error}</p>
      </div>
    {:else if filteredContents.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h3 class="empty-title">
          {searchQuery || filterType !== "all"
            ? $_("search.no_results")
            : $_("space.no_contents_title")}
        </h3>
        <p class="empty-message">
          {searchQuery || filterType !== "all"
            ? $_("search.try_different_terms")
            : $_("space.no_contents_description")}
        </p>
      </div>
    {:else}
      <div class="content-grid">
        {#each filteredContents as item}
          <div
            class="content-card"
            onclick={() => handleItemClick(item)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleItemClick(item);
              }
            }}
          >
            <div class="card-header">
              <div class="item-icon">
                {getItemIcon(item)}
              </div>
              <div class="item-type">
                <span class="type-badge type-{item.resource_type}">
                  {$_("resource_type." + item.resource_type)}
                </span>
              </div>
            </div>

            <div class="card-content">
              <h3 class="item-title">{item.title}</h3>
              {#if item.attributes?.description?.[$locale] || item.attributes?.description?.en}
                <p class="item-description">
                  {item.attributes.description[$locale] ||
                    item.attributes.description.en}
                </p>
              {/if}
            </div>

            <div class="card-footer">
              <div class="author-info">
                {#if item.ownerAvatar}
                  <img
                    src={item.ownerAvatar || "/placeholder.svg"}
                    alt="Avatar"
                    class="author-avatar"
                  />
                {:else}
                  <div class="author-avatar-placeholder">
                    {(item.attributes?.owner_shortname || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                {/if}
                <div class="author-details">
                  <span class="author-name"
                    >{item.attributes?.owner_shortname ||
                      $_("common.unknown")}</span
                  >
                  <span class="item-date"
                    >{formatDate(item.attributes?.created_at)}</span
                  >
                </div>
              </div>

              <div class="engagement-stats">
                {#if item.reactionCount > 0}
                  <div class="stat-item">
                    <svg
                      class="stat-icon"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      />
                    </svg>
                    <span>{item.reactionCount}</span>
                  </div>
                {/if}
                {#if item.commentCount > 0}
                  <div class="stat-item">
                    <svg
                      class="stat-icon"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                      />
                    </svg>
                    <span>{item.commentCount}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .space-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
  }

  .space-header {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
    padding: 2rem 1.5rem;
  }

  .header-content {
    max-width: 80rem;
    margin: 0 auto;
  }

  .header-nav {
    margin-bottom: 2rem;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
  }

  .back-button:hover {
    color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
  }

  .back-button:hover .back-icon {
    transform: translateX(-0.25rem);
  }

  .space-info {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .space-avatar {
    flex-shrink: 0;
  }

  .avatar-large {
    width: 5rem;
    height: 5rem;
    border-radius: 1rem;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 800;
    font-size: 2rem;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
  }

  .space-details {
    flex: 1;
  }

  .space-title {
    font-size: 2.5rem;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 0.5rem;
    line-height: 1.1;
  }

  .space-subtitle {
    color: #64748b;
    font-size: 1.125rem;
    margin-bottom: 1.5rem;
  }

  .space-stats {
    display: flex;
    gap: 2rem;
  }

  .stat-item {
    text-align: center;
  }

  .stat-number {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #6366f1;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }

  .filter-section {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
    padding: 1.5rem;
  }

  .filter-content {
    max-width: 80rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .search-bar {
    flex: 1;
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: #94a3b8;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    border: 2px solid #e2e8f0;
    border-radius: 0.75rem;
    font-size: 1rem;
    background: white;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .filters {
    display: flex;
    gap: 1rem;
  }

  .filter-select {
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .content-section {
    padding: 2rem 1.5rem;
    max-width: 80rem;
    margin: 0 auto;
  }

  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: 4rem 0;
  }

  .loading-text {
    margin-top: 1rem;
    color: #64748b;
    font-weight: 500;
  }

  .error-icon,
  .empty-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1.5rem;
    color: #ef4444;
  }

  .empty-icon {
    color: #94a3b8;
  }

  .error-title,
  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.5rem;
  }

  .error-message,
  .empty-message {
    color: #64748b;
    font-size: 1rem;
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .content-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    cursor: pointer;
    overflow: hidden;
  }

  .content-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
    border-color: #6366f1;
  }

  .content-card:focus {
    outline: none;
    ring: 2px;
    ring-color: #6366f1;
    ring-offset: 2px;
  }

  .card-header {
    padding: 1.5rem 1.5rem 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .item-icon {
    font-size: 2rem;
  }

  .type-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .type-content {
    background: #dcfce7;
    color: #166534;
  }
  .type-folder {
    background: #dbeafe;
    color: #1e40af;
  }
  .type-post {
    background: #fce7f3;
    color: #be185d;
  }
  .type-media {
    background: #fed7aa;
    color: #c2410c;
  }

  .card-content {
    padding: 1rem 1.5rem;
  }

  .item-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.5rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-description {
    color: #64748b;
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    padding: 1rem 1.5rem 1.5rem;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .author-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .author-avatar-placeholder {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
  }

  .author-details {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
    line-height: 1;
  }

  .item-date {
    font-size: 0.75rem;
    color: #64748b;
    line-height: 1;
    margin-top: 0.25rem;
  }

  .engagement-stats {
    display: flex;
    gap: 1rem;
  }

  .engagement-stats .stat-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: #64748b;
  }

  .stat-icon {
    width: 1rem;
    height: 1rem;
  }

  @media (max-width: 768px) {
    .space-info {
      flex-direction: column;
      text-align: center;
      gap: 1.5rem;
    }

    .space-title {
      font-size: 2rem;
    }

    .space-stats {
      justify-content: center;
    }

    .filter-content {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      justify-content: center;
    }

    .content-grid {
      grid-template-columns: 1fr;
    }

    .card-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }
</style>
