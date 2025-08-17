<script lang="ts">
  import { onMount } from "svelte";
  import {
    getSpaceContents,
    getSpaceContentsByTags,
    getSpaces,
    getSpaceTags,
    searchInCatalog,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { formatNumber, formatNumberInText } from "@/lib/helpers";
  import {
    GlobeSolid,
    MessageCaptionSolid,
    HeartSolid,
  } from "flowbite-svelte-icons";
  $goto;

  let isLoading = $state(true);
  let spaces = $state([]);
  let filteredSpaces = $state([]);
  let error = $state(null);
  let searchQuery = $state("");
  let sortBy = $state("name");
  let filterActive = $state("all");
  let searchResults = $state([]);
  let isSearching = $state(false);
  let searchTimeout: number;
  let spaceStats = [];
  let totalSpaceItems = 0;
  let spaceTags = {};

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  onMount(async () => {
    try {
      const response = await getSpaces(false, "public");

      const statsPromises = response.records.map(async (space) => {
        const data = await getSpaceContents(space.shortname, "/", "public");
        const tags = await getSpaceTags(space.shortname);

        if (tags.status === "success" && tags.records.length > 0) {
          const tagData = tags.records[0].attributes;
          if (tagData.tag_counts) {
            const sortedTags = Object.entries(tagData.tag_counts)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => Number(b.count) - Number(a.count));

            spaceTags[space.shortname] = sortedTags;
          }
        } else {
          spaceTags[space.shortname] = [];
        }

        return {
          spaceName: space.shortname,
          total: data.attributes.total,
        };
      });

      const stats = await Promise.all(statsPromises);

      const totalItems = stats.reduce((sum, stat) => sum + stat.total, 0);

      spaces = response.records || [];
      filteredSpaces = spaces;

      spaceStats = stats;
      totalSpaceItems = totalItems;
    } catch (err) {
      console.error("Error fetching spaces:", err);
      error = $_("catalogs.error.failed_load");
    } finally {
      isLoading = false;
    }
  });

  function getTagsSpaces(shortname) {
    return spaceTags[shortname] || [];
  }

  function getSpaceStats(spaceShortname) {
    return (
      spaceStats.find((stat) => stat.spaceName === spaceShortname)?.total || 0
    );
  }

  function handleSpaceClick(space: any) {
    $goto("/catalogs/[space_name]", {
      space_name: space.shortname,
    });
  }

  function handleRecordClick(record: any) {
    const encodedSubpath = encodeURIComponent(record.subpath);

    $goto("/catalogs/[space_name]/[subpath]/[shortname]/[resource_type]", {
      space_name: record.attributes?.space_name,
      subpath: encodedSubpath,
      shortname: record.shortname,
      resource_type: record.resource_type,
    });
  }

  function getDisplayName(space: any): string {
    const displayname = space.attributes?.displayname;
    if (displayname) {
      return (
        displayname[$locale] ||
        displayname.en ||
        displayname.ar ||
        space.shortname
      );
    }
    return space.shortname || $_("catalogs.unnamed_space");
  }

  function getDescription(space: any): string {
    const description = space.attributes?.description;
    if (description) {
      return (
        description[$locale] ||
        description.en ||
        description.ar ||
        $_("catalogs.no_description")
      );
    }
    return $_("catalogs.no_description");
  }

  function getRecordDisplayName(record: any): string {
    const displayname = record.attributes?.displayname;
    if (displayname) {
      return (
        displayname[$locale] ||
        displayname.en ||
        displayname.ar ||
        record.shortname
      );
    }
    if (
      record.resource_type === "ticket" &&
      record.attributes?.payload?.body?.title
    ) {
      return record.attributes.payload.body.title;
    }
    return record.shortname || $_("catalogs.unnamed_record");
  }

  function getRecordDescription(record: any): string {
    const description = record.attributes?.description;

    if (description) {
      return (
        description[$locale] ||
        description.en ||
        description.ar ||
        $_("catalogs.no_description")
      );
    }

    if (
      record.resource_type === "ticket" &&
      record.attributes?.payload?.body?.content
    ) {
      const contentType = record.attributes?.payload?.content_type;

      if (contentType === "json") {
        let processedContent = record.attributes.payload.body.content
          .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[Image: $1]")
          .replace(/<img[^>]*>/gi, "[Image]")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        return processedContent.length > 200
          ? processedContent.substring(0, 200) + "..."
          : processedContent || $_("catalogs.no_description");
      } else {
        const textContent = record.attributes.payload.body.content.replace(
          /<[^>]*>/g,
          ""
        );
        return textContent.length > 200
          ? textContent.substring(0, 200) + "..."
          : textContent;
      }
    }

    if (record.attributes?.payload?.body) {
      const htmlContent = record.attributes.payload.body;
      if (typeof htmlContent === "string") {
        const contentType = record.attributes?.payload?.content_type;

        if (contentType === "json") {
          let processedContent = htmlContent
            .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[Image: $1]")
            .replace(/<img[^>]*>/gi, "[Image]")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim();

          return processedContent.length > 200
            ? processedContent.substring(0, 200) + "..."
            : processedContent || $_("catalogs.no_description");
        } else {
          const textContent = htmlContent.replace(/<[^>]*>/g, "");
          return textContent.length > 200
            ? textContent.substring(0, 200) + "..."
            : textContent;
        }
      }
    }

    return $_("catalogs.no_description");
  }
  function formatDate(dateString: string): string {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function performSearch(query: string) {
    if (!query.trim()) {
      searchResults = [];
      filteredSpaces = spaces;
      return;
    }

    isSearching = true;
    try {
      const results = await searchInCatalog(query.trim());
      searchResults = results;

      filteredSpaces = [];
    } catch (err) {
      console.error("Error performing search:", err);
      error = $_("catalogs.error.search_failed");
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  function applyFilters() {
    if (searchQuery.trim()) {
      return;
    }

    let filtered = spaces;

    if (filterActive !== "all") {
      filtered = filtered.filter((space) =>
        filterActive === "active"
          ? space.attributes?.is_active
          : !space.attributes?.is_active
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "created":
          return (
            new Date(b.attributes?.created_at || 0).getTime() -
            new Date(a.attributes?.created_at || 0).getTime()
          );
        case "updated":
          return (
            new Date(b.attributes?.updated_at || 0).getTime() -
            new Date(a.attributes?.updated_at || 0).getTime()
          );
        default:
          return getDisplayName(a).localeCompare(getDisplayName(b));
      }
    });

    filteredSpaces = filtered;
  }

  function handleSearchInput() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);
  }

  function handleContactUs() {
    $goto("/contact");
  }

  $effect(() => {
    if (!searchQuery.trim()) {
      searchResults = [];
      applyFilters();
    }
  });

  $effect(() => {
    applyFilters();
  });
</script>

<div class="catalog-page" class:rtl={$isRTL}>
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          {$_("catalogs.hero.title")}
        </h1>
        <p class="hero-description">
          {$_("catalogs.hero.description")}
        </p>
      </div>
    </div>
  </section>

  <section class="search-section">
    <div class="search-container">
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
          placeholder={$_("catalogs.search.placeholder")}
          bind:value={searchQuery}
          oninput={handleSearchInput}
          class="search-input"
        />
        {#if isSearching}
          <div class="search-loading">
            <Diamonds color="#6366f1" size="20" unit="px" />
          </div>
        {/if}
      </div>

      {#if !searchQuery.trim()}
        <div class="filters">
          <select bind:value={sortBy} class="filter-select">
            <option value="name">{$_("catalogs.sort.name")}</option>
            <option value="created">{$_("catalogs.sort.created")}</option>
            <option value="updated">{$_("catalogs.sort.updated")}</option>
          </select>
        </div>
      {/if}
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
        <h3 class="error-title">{$_("catalogs.error.title")}</h3>
        <p class="error-message">{error}</p>
      </div>
    {:else if searchQuery.trim() && searchResults.length === 0 && !isSearching}
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <h3 class="empty-title">{$_("catalogs.empty.no_results_title")}</h3>
        <p class="empty-message">
          {$_("catalogs.empty.no_results_description")}
        </p>
      </div>
    {:else if searchQuery.trim() && searchResults.length > 0}
      <div class="search-results">
        <div class="results-header">
          <div class="results-info">
            <h2 class="results-title">
              {$_("catalogs.search.results_title", {
                values: {
                  count: formatNumberInText(searchResults.length, $locale),
                  query: searchQuery,
                },
              })}
            </h2>
            <p class="results-subtitle">
              {$_("catalogs.search.results_subtitle", {
                values: {
                  count: formatNumberInText(searchResults.length, $locale),
                },
              })}
            </p>
          </div>

          <!-- Clear Search Button -->
          <button
            class="clear-search-btn"
            onclick={() => {
              searchQuery = "";
              searchResults = [];
              applyFilters();
            }}
            aria-label={$_("catalogs.search.clear")}
          >
            <svg
              class="clear-icon"
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
            {$_("catalogs.search.clear")}
          </button>
        </div>

        <!-- Enhanced Results Grid -->
        <div class="results-grid">
          {#each searchResults as record, index}
            <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
            <article
              class="result-card {record.resource_type}-card"
              onclick={() => handleRecordClick(record)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleRecordClick(record);
                }
              }}
              style="animation-delay: {index * 50}ms"
            >
              <!-- Card Header with Resource Type Indicator -->
              <div class="result-header">
                <div class="result-avatar-container">
                  <div class="result-avatar {record.resource_type}">
                    <div class="avatar-circle">
                      {record.shortname
                        ? record.shortname.charAt(0).toUpperCase()
                        : "R"}
                    </div>
                  </div>
                </div>

                <!-- Result Title and Meta -->
                <div class="result-info">
                  <h3 class="result-title">
                    {getRecordDisplayName(record)}
                  </h3>

                  <div class="result-meta-line">
                    <span class="result-shortname">@{record.shortname}</span>
                    <span class="meta-separator">•</span>
                    <span class="result-space">
                      <svg
                        class="space-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        ></path>
                      </svg>
                      {record.attributes?.space_name}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Result Content -->
              <div class="result-content">
                <p class="result-description">
                  {getRecordDescription(record)}
                </p>
              </div>

              <!-- Tags Section -->
              {#if record.attributes?.tags && record.attributes.tags.length > 0}
                <div class="result-tags">
                  {#each record.attributes.tags.slice(0, 4) as tag}
                    <span class="tag">
                      <svg
                        class="tag-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        ></path>
                      </svg>
                      {tag}
                    </span>
                  {/each}
                  {#if record.attributes.tags.length > 4}
                    <span class="tag-more">
                      +{formatNumberInText(
                        record.attributes.tags.length - 4,
                        $locale
                      )} more
                    </span>
                  {/if}
                </div>
              {/if}

              <!-- Result Footer -->
              <div class="result-footer">
                <div class="result-meta">
                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span class="meta-text">
                      {record.attributes?.owner_shortname ||
                        $_("common.unknown")}
                    </span>
                  </div>

                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <span class="meta-text">
                      {formatDate(record.attributes?.created_at)}
                    </span>
                  </div>

                  {#if record.attributes?.updated_at && record.attributes.updated_at !== record.attributes.created_at}
                    <div class="meta-item updated">
                      <svg
                        class="meta-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                      </svg>
                      <span class="meta-text">
                        Updated {formatDate(record.attributes.updated_at)}
                      </span>
                    </div>
                  {/if}
                </div>

                <!-- Action Button -->
                <div class="result-actions">
                  <button
                    class="view-btn"
                    aria-label={$_("catalogs.actions.view_details")}
                  >
                    <svg
                      class="action-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Hover Effect Overlay -->
              <div class="card-overlay"></div>
            </article>
          {/each}
        </div>
      </div>
    {:else if !searchQuery.trim() && filteredSpaces.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
        </div>
        <h3 class="empty-title">{$_("catalogs.empty.no_catalogs_title")}</h3>
        <p class="empty-message">
          {$_("catalogs.empty.no_catalogs_description")}
        </p>
      </div>
    {:else}
      {#if !isLoading && spaceStats.length > 0}
        <div class="header-stats">
          <h1 class="stats-title">{$_("SpacesDashboard")}</h1>
          <div class="global-stats">
            <div class="global-stat-card">
              <div class="global-stat-number">
                {formatNumber(spaces.length, $locale)}
              </div>
              <div class="global-stat-label">Total Spaces</div>
            </div>
            <div class="global-stat-card">
              <div class="global-stat-number">
                {formatNumber(totalSpaceItems, $locale)}
              </div>
              <div class="global-stat-label">Total Items</div>
            </div>
          </div>
        </div>
      {/if}
      {#if !isLoading}
        <div class="spaces-grid">
          {#each filteredSpaces as space}
            <div
              class="space-card"
              onclick={() => handleSpaceClick(space)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleSpaceClick(space);
                }
              }}
            >
              <div class="space-header">
                <div class="space-avatar">
                  <div class="avatar-circle">
                    {space.shortname
                      ? space.shortname.charAt(0).toUpperCase()
                      : "S"}
                  </div>
                </div>
                <div class="space-info">
                  <h3 class="space-title">{getDisplayName(space)}</h3>
                  <p class="space-shortname">@{space.shortname}</p>
                </div>
              </div>

              <div class="space-content">
                <p class="space-description">{getDescription(space)}</p>

                <!-- Tags Section -->
                {#if getTagsSpaces(space.shortname).length > 0}
                  <div class="space-tags">
                    {#each getTagsSpaces(space.shortname).slice(0, 5) as tag}
                      <span class="tag-chip">{tag.name}</span>
                    {/each}
                    {#if getTagsSpaces(space.shortname).length > 5}
                      <span class="tag-more"
                        >+{formatNumberInText(
                          getTagsSpaces(space.shortname).length - 5,
                          $locale
                        )}</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Individual Space Stats -->
              <div class="space-stats">
                <div class="space-stat-number">
                  {formatNumber(getSpaceStats(space.shortname), $locale)}
                </div>
                <div class="space-stat-label">{$_("itemsInSpace")}</div>
              </div>
              <div class="space-footer">
                <div class="space-meta">
                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span
                      >{space.attributes?.owner_shortname ||
                        $_("common.unknown")}</span
                    >
                  </div>
                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <span>{formatDate(space.attributes?.created_at)}</span>
                  </div>
                </div>

                {#if space.attributes?.primary_website}
                  <a
                    href={space.attributes.primary_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="website-link"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <svg
                      class="link-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      ></path>
                    </svg>
                    {$_("catalogs.actions.visit")}
                  </a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </section>

  <footer class="footer-section">
    <div class="footer-content">
      <div class="footer-grid">
        <div class="footer-brand">
          <h3 class="brand-name">{$_("Catalog")}</h3>
          <p class="brand-description">
            {$_("BrandDescription")}
          </p>
          <div class="social-icons">
            <a href="#" class="social-icon">
              <GlobeSolid class="icon" />
            </a>
            <a href="#" class="social-icon">
              <MessageCaptionSolid class="icon" />
            </a>
            <a href="#" class="social-icon">
              <HeartSolid class="icon" />
            </a>
          </div>
        </div>

        <div class="footer-column">
          <h4 class="footer-column-title">{$_("Support")}</h4>
          <ul class="footer-links">
            <li><a href="/help">{$_("HelpCenter")}</a></li>
            <li><a href="/community">{$_("Community")}</a></li>
            <li>
              <button onclick={handleContactUs} class="footer-link-button"
                >{$_("ContactUs")}</button
              >
            </li>
            <li><a href="/privacy">{$_("Privacy")}</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>{$_("Copyright")}</p>
      </div>
    </div>
  </footer>
</div>

<style>
  .catalog-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
  }

  .rtl {
    direction: rtl;
  }

  .hero-section {
    padding: 4rem 1.5rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.1) 0%,
      rgba(168, 85, 247, 0.1) 100%
    );
  }

  .hero-content {
    max-width: 80rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .hero-text {
    flex: 1;
  }

  .hero-title {
    font-size: 3rem;
    font-weight: 800;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 1rem;
    line-height: 1.1;
  }

  .hero-description {
    font-size: 1.25rem;
    color: #64748b;
    line-height: 1.6;
    max-width: 32rem;
  }

  .search-section {
    padding: 2rem 1.5rem;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
  }

  .search-container {
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
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: #94a3b8;
    left: 1rem;
  }

  .rtl .search-icon {
    left: auto;
    right: 1rem;
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

  .rtl .search-input {
    padding: 0.875rem 3rem 0.875rem 1rem;
    text-align: right;
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

  .rtl .filter-select {
    text-align: right;
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

  .space-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    cursor: pointer;
    overflow: hidden;
  }

  .space-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
    border-color: #6366f1;
  }

  .space-card:focus {
    outline: none;
    ring: 2px;
    ring-color: #6366f1;
    ring-offset: 2px;
  }

  .space-header {
    padding: 1.5rem 1.5rem 1rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .space-avatar {
    flex-shrink: 0;
  }

  .avatar-circle {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.25rem;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .space-info {
    flex: 1;
    min-width: 0;
  }

  .rtl .space-info {
    text-align: right;
  }

  .space-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }

  .space-shortname {
    font-size: 0.875rem;
    color: #6366f1;
    font-weight: 500;
    margin: 0;
  }

  .space-content {
    padding: 0 1.5rem 1rem;
  }

  .space-description {
    color: #64748b;
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rtl .space-description {
    text-align: right;
  }

  .space-footer {
    padding: 1rem 1.5rem 1.5rem;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .space-meta {
    display: flex;
    gap: 1.5rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #64748b;
  }

  .meta-icon {
    width: 1rem;
    height: 1rem;
  }

  .website-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #6366f1;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .website-link:hover {
    color: #4f46e5;
  }

  .link-icon {
    width: 1rem;
    height: 1rem;
  }

  @media (max-width: 768px) {
    .hero-content {
      flex-direction: column;
      text-align: center;
    }

    .hero-title {
      font-size: 2rem;
    }

    .hero-description {
      font-size: 1rem;
    }

    .search-container {
      flex-direction: column;
      align-items: stretch;
    }

    .rtl .search-container {
      flex-direction: column;
    }

    .filters {
      justify-content: center;
    }

    .spaces-grid {
      grid-template-columns: 1fr;
    }

    .space-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .rtl .space-footer {
      align-items: flex-end;
    }
  }

  search-results {
    margin-top: 2rem;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .results-info {
    flex: 1;
  }

  .results-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .results-subtitle {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }

  .clear-search-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    color: #374151;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-search-btn:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
  }

  .clear-icon {
    width: 1rem;
    height: 1rem;
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .result-card {
    position: relative;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    overflow: hidden;
    animation: fadeInUp 0.4s ease forwards;
    opacity: 0;
    transform: translateY(20px);
  }

  @keyframes fadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .result-card:hover {
    border-color: #6366f1;
    box-shadow:
      0 10px 25px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  .result-card.content-card {
    border-left: 4px solid #10b981;
  }

  .result-card.ticket-card {
    border-left: 4px solid #f59e0b;
  }

  .result-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .result-avatar-container {
    position: relative;
    flex-shrink: 0;
  }

  .result-avatar {
    width: 3rem;
    height: 3rem;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
    position: relative;
  }

  .resource-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .result-type-badge.content {
    background: #10b981;
    color: white;
  }

  .result-type-badge.ticket {
    background: #f59e0b;
    color: white;
  }

  .result-info {
    flex: 1;
    min-width: 0;
  }

  .result-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .result-meta-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .result-shortname {
    font-family: "Monaco", "Menlo", monospace;
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }

  .meta-separator {
    color: #d1d5db;
  }

  .result-space {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .space-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .result-state {
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .result-state.pending {
    background: #fef3c7;
    color: #92400e;
  }

  .result-state.completed {
    background: #d1fae5;
    color: #065f46;
  }

  .result-content {
    margin-bottom: 1rem;
  }

  .result-description {
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .result-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    color: #374151;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .tag-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .tag-more {
    padding: 0.25rem 0.5rem;
    background: #e5e7eb;
    color: #6b7280;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-style: italic;
  }

  .result-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #f3f4f6;
  }

  .result-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .meta-item.updated {
    color: #059669;
  }

  .meta-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .meta-text {
    white-space: nowrap;
  }

  .result-actions {
    flex-shrink: 0;
  }

  .view-btn {
    padding: 0.5rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-btn:hover {
    background: #6366f1;
    border-color: #6366f1;
    color: white;
  }

  .action-icon {
    width: 1rem;
    height: 1rem;
  }

  .card-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.1),
      rgba(168, 85, 247, 0.1)
    );
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .result-card:hover .card-overlay {
    opacity: 1;
  }

  .load-more-container {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  .load-more-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .load-more-btn:hover {
    background: #5b21b6;
    transform: translateY(-1px);
  }

  .load-icon {
    width: 1rem;
    height: 1rem;
  }

  /* RTL Support */
  .rtl .result-card {
    text-align: right;
  }

  /* .rtl .result-header {
    flex-direction: row-reverse;
  }

  .rtl .result-meta-line {
    flex-direction: row-reverse;
  }

  .rtl .result-footer {
    flex-direction: row-reverse;
  } */

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .results-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .results-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .result-card {
      padding: 1rem;
    }

    .result-header {
      gap: 0.75rem;
    }

    .result-avatar {
      width: 2.5rem;
      height: 2.5rem;
    }

    .result-meta {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }

    .result-footer {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }
  }

  .header-stats {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stats-title {
    font-size: 1.8rem;
    font-weight: 600;
    color: #222;
  }

  .global-stats {
    display: flex;
    gap: 1rem;
  }

  .global-stat-card {
    flex: 1;
    padding: 1rem;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    text-align: center;
  }

  .global-stat-number {
    font-size: 1.6rem;
    font-weight: bold;
    color: #2d6cdf;
  }

  .global-stat-label {
    font-size: 0.9rem;
    color: #666;
  }

  /* === Spaces Grid === */
  .spaces-grid {
    display: grid;
    gap: 3.5rem;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  }

  /* === Space Card === */
  .space-card {
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 1rem;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .space-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
  }

  /* === Space Header === */
  .space-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.8rem;
  }

  .avatar-circle {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #2d6cdf;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .space-info {
    flex: 1;
  }

  .space-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #222;
    margin: 0;
  }

  .space-shortname {
    font-size: 0.85rem;
    color: #888;
  }

  /* === Space Content === */
  .space-content {
    flex-grow: 1;
    margin-bottom: 1rem;
  }

  .space-description {
    font-size: 0.9rem;
    color: #555;
  }

  /* === Space Stats === */
  .space-stats {
    margin-bottom: 1rem;
  }

  .space-stat-number {
    font-size: 1.2rem;
    font-weight: bold;
    color: #2d6cdf;
  }

  .space-stat-label {
    font-size: 0.85rem;
    color: #777;
  }

  /* === Space Footer === */
  .space-footer {
    border-top: 1px solid #eee;
    padding-top: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .space-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #666;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .meta-icon {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }

  /* === Website Link === */
  .website-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #2d6cdf;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .website-link:hover {
    color: #1a4ea3;
  }

  .link-icon {
    width: 16px;
    height: 16px;
  }

  .space-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    background-color: var(--color-primary-100, #e3f2fd);
    color: var(--color-primary-700, #1976d2);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid var(--color-primary-200, #bbdefb);
    transition: all 0.2s ease;
  }

  .tag-chip:hover {
    background-color: var(--color-primary-200, #bbdefb);
  }

  .tag-more {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    background-color: var(--color-gray-100, #f5f5f5);
    color: var(--color-gray-600, #757575);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid var(--color-gray-300, #e0e0e0);
  }
  .footer-section {
    background: #111827;
    color: white;
  }

  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .footer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    padding: 3rem 0;
  }

  .footer-brand {
    grid-column: span 2;
  }

  @media (max-width: 768px) {
    .footer-brand {
      grid-column: span 1;
    }
  }

  .brand-name {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    margin-bottom: 1rem;
  }

  .brand-description {
    color: #9ca3af;
    margin-bottom: 1.5rem;
    max-width: 24rem;
    line-height: 1.6;
  }

  .social-icons {
    display: flex;
    gap: 1rem;
  }

  .social-icon {
    color: #9ca3af;
    transition: color 0.3s ease;
  }

  .social-icon:hover {
    color: white;
  }

  .footer-column-title {
    font-weight: 700;
    color: white;
    margin-bottom: 1rem;
  }

  .footer-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .footer-links li {
    margin-bottom: 0.5rem;
  }

  .footer-links a {
    color: #9ca3af;
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .footer-links a:hover {
    color: white;
  }

  .footer-bottom {
    border-top: 1px solid #374151;
    padding: 2rem 0;
    text-align: center;
    color: #9ca3af;
  }
</style>
