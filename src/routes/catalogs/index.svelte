<script lang="ts">
  import { onMount } from "svelte";
  import {
    getSpaceContents,
    getSpaces,
    getSpaceTags,
    searchInCatalog,
  } from "@/lib/dmart_services/dmart_services";
  import { getAllUsers } from "@/lib/dmart_services/users";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { formatNumber, formatNumberInText } from "@/lib/helpers";
  import { QueryType } from "@edraj/tsdmart";

  $goto;

  let isLoading = $state(true);
  let spaces = $state([]);
  let filteredSpaces = $state([]);
  let error = $state(null);
  let searchQuery = $state("");
  let sortBy = $state("name");
  let filterCategory = $state("all");
  let filterTags = $state("all");
  let filterActive = $state("all");
  let searchResults = $state([]);
  let isSearching = $state(false);
  let searchTimeout: number;
  let spaceStats = [];
  let totalSpaceItems = 0;
  let totalUsers = $state(0);
  let spaceTags = {};

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  onMount(async () => {
    try {
      const response = await getSpaces(false, "public");

      const [usersResponse, ...statsArr] = await Promise.all([
        getAllUsers(0, 0),
        ...response.records.map(async (space) => {
          const data = await getSpaceContents(
            space.shortname,
            "/",
            "public",
            100,
            0,
            false,
            QueryType.counters,
          );
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
        }),
      ]);

      totalUsers = usersResponse?.attributes?.total ?? 0;

      const totalItems = statsArr.reduce((sum, stat) => sum + stat.total, 0);

      spaces = response.records || [];
      filteredSpaces = spaces;

      spaceStats = statsArr;
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
    return record.shortname || $_("catalogs.unnamed_space");
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
          "",
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
          : !space.attributes?.is_active,
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

  // Color palette for space card avatars
  const avatarColors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#6d28d9",
    "#db2777",
  ];

  function getAvatarColor(index: number): string {
    return avatarColors[index % avatarColors.length];
  }
</script>

<div class="catalog-page" class:rtl={$isRTL}>
  <!-- Hero Section -->
  <section class="hero-section">
    <div class="hero-content">
      <div class="discover-badge">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path
            d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10"
          ></path>
        </svg>
        {$_("catalogs.discover")}
      </div>
      <h1 class="hero-title">
        {$_("catalogs.hero.title_explore")}
        <span class="hero-title-accent">{$_("catalogs.hero.title_spaces")}</span
        >
      </h1>
      <p class="hero-subtitle">{$_("catalogs.hero.subtitle")}</p>

      {#if !isLoading}
        <div class="stats-row">
          <!-- Active Spaces -->
          <div class="stat-card">
            <div class="stat-icon stat-icon-spaces">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                ></path>
              </svg>
            </div>
            <div>
              <div class="stat-value">
                {isLoading ? "—" : formatNumber(spaces.length, $locale)}
              </div>
              <div class="stat-label">{$_("catalogs.stats.active_spaces")}</div>
            </div>
          </div>

          <!-- Users -->
          <div class="stat-card">
            <div class="stat-icon stat-icon-members">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div>
              <div class="stat-value">
                {isLoading ? "—" : formatNumber(totalUsers, $locale)}
              </div>
              <div class="stat-label">{$_("catalogs.stats.members")}</div>
            </div>
          </div>

          <!-- All Entries -->
          <div class="stat-card">
            <div class="stat-icon stat-icon-posts">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                ></polygon>
              </svg>
            </div>
            <div>
              <div class="stat-value">
                {isLoading ? "—" : formatNumber(totalSpaceItems, $locale)}
              </div>
              <div class="stat-label">{$_("catalogs.stats.posts")}</div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </section>

  <!-- Search & Filters Section -->
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
        <label for="search-input"></label>
        <input
          id="search-input"
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
        <div class="filters-row">
          <div class="filter-group">
            <span class="filter-label">{$_("catalogs.filter.category")}</span>
            <select bind:value={filterCategory} class="filter-select">
              <option value="all">{$_("catalogs.filter.all")}</option>
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">{$_("catalogs.filter.tags")}</span>
            <select bind:value={filterTags} class="filter-select">
              <option value="all">{$_("catalogs.filter.all_tags")}</option>
            </select>
          </div>
          <div class="filter-group">
            <span class="filter-label">{$_("catalogs.filter.sort_by")}</span>
            <select bind:value={sortBy} class="filter-select">
              <option value="name">{$_("catalogs.filter.popular")}</option>
              <option value="created">{$_("catalogs.filter.newest")}</option>
              <option value="updated">{$_("catalogs.filter.name")}</option>
            </select>
          </div>
        </div>
      {/if}
    </div>
  </section>

  <!-- Content Section -->
  <section class="content-section">
    {#if isLoading}
      <div class="loading-state">
        <Diamonds color="#6366f1" size="60" unit="px" />
        <p class="loading-text">{$_("common.loading")}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon-wrap">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h2 class="error-title">{$_("catalogs.error.title")}</h2>
        <p class="error-message">{error}</p>
      </div>
    {:else if searchQuery.trim() && searchResults.length === 0 && !isSearching}
      <div class="empty-state">
        <div class="empty-icon-wrap">
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
      <!-- Search Results -->
      <div class="search-results">
        <div class="results-header">
          <div class="results-info">
            <h2 class="results-title">
              {$_("catalogs.search.results_title")}
            </h2>
            <p class="results-subtitle">
              {$_("catalogs.search.results_subtitle")}
            </p>
          </div>
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

        <div class="spaces-grid">
          {#each searchResults as record, index}
            <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
            <article
              class="space-card"
              onclick={() => handleRecordClick(record)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleRecordClick(record);
                }
              }}
              style="animation-delay: {index * 60}ms"
            >
              <div
                class="card-thumbnail"
                style="background: {getAvatarColor(index)}"
              >
                <span class="card-thumb-icon">
                  {record.shortname
                    ? record.shortname.charAt(0).toUpperCase()
                    : "R"}
                </span>
              </div>
              <div class="card-body">
                <div class="card-top-row">
                  <div>
                    <h3 class="card-title">{getRecordDisplayName(record)}</h3>
                    <p class="card-author">
                      {$_("catalogs.by")}
                      {record.attributes?.owner_shortname ||
                        $_("common.unknown")}
                    </p>
                  </div>
                </div>
                <p class="card-description">{getRecordDescription(record)}</p>
                {#if record.attributes?.tags && record.attributes.tags.length > 0}
                  <div class="card-tags">
                    {#each record.attributes.tags.slice(0, 3) as tag}
                      <span class="tag-pill">{tag}</span>
                    {/each}
                    {#if record.attributes.tags.length > 3}
                      <span class="tag-pill tag-more"
                        >+{record.attributes.tags.length - 3}</span
                      >
                    {/if}
                  </div>
                {/if}
                <div class="card-footer-meta">
                  <span class="card-date">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"
                      ></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {formatDate(record.attributes?.created_at)}
                  </span>
                </div>
              </div>
              <svg
                class="card-arrow"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6"></path>
              </svg>
            </article>
          {/each}
        </div>
      </div>
    {:else if !searchQuery.trim() && filteredSpaces.length === 0}
      <div class="empty-state">
        <div class="empty-icon-wrap">
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
      <!-- Showing count + Live -->
      <div class="showing-bar">
        <span class="showing-count">
          {$_("catalogs.showing_spaces", {
            values: {
              count: formatNumberInText(filteredSpaces.length, $locale),
            },
          })}
        </span>
        <span class="live-badge">
          <span class="live-dot"></span>
          {$_("catalogs.live")}
        </span>
      </div>

      <!-- Space Cards Grid -->
      <div class="spaces-grid">
        {#each filteredSpaces as space, index}
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
            style="animation-delay: {index * 60}ms"
          >
            <div
              class="card-thumbnail"
              style="background: {getAvatarColor(index)}"
            >
              <span class="card-thumb-icon">
                {space.shortname
                  ? space.shortname.charAt(0).toUpperCase()
                  : "S"}
              </span>
            </div>
            <div class="card-body">
              <div class="card-top-row">
                <div>
                  <h3 class="card-title">{getDisplayName(space)}</h3>
                  <p class="card-author">
                    {$_("catalogs.by")}
                    {space.attributes?.owner_shortname || $_("common.unknown")}
                  </p>
                </div>
                <span class="card-members-badge">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                  </svg>
                  {formatNumber(getSpaceStats(space.shortname), $locale)}
                </span>
              </div>
              <p class="card-description">{getDescription(space)}</p>

              {#if getTagsSpaces(space.shortname).length > 0}
                <div class="card-tags">
                  {#each getTagsSpaces(space.shortname).slice(0, 3) as tag}
                    <span class="tag-pill">{tag.name}</span>
                  {/each}
                  {#if getTagsSpaces(space.shortname).length > 3}
                    <span class="tag-pill tag-more"
                      >+{getTagsSpaces(space.shortname).length - 3}</span
                    >
                  {/if}
                </div>
              {/if}

              <div class="card-footer-meta">
                <span class="card-date">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    ></path>
                  </svg>
                  {space.attributes?.owner_shortname || $_("common.unknown")}
                </span>
                <span class="card-comments">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    ></path>
                  </svg>
                  {formatNumber(getSpaceStats(space.shortname), $locale)}
                </span>
              </div>
            </div>
            <svg
              class="card-arrow"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  /* ============================
     Page Layout
     ============================ */
  .catalog-page {
    min-height: 100vh;
    background: #ffffff;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .rtl {
    direction: rtl;
  }

  /* ============================
     Hero Section
     ============================ */
  .hero-section {
    padding: 3rem 2rem 2.5rem;
    background: linear-gradient(180deg, #f0f6ff 0%, #ffffff 100%);
  }

  .hero-content {
    max-width: 72rem;
    margin: 0 auto;
  }

  .discover-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.8rem;
    background: #ecfdf5;
    color: #059669;
    border-radius: 2rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    margin-bottom: 1rem;
    border: 1px solid #a7f3d0;
  }

  .hero-title {
    font-size: clamp(2.2rem, 4vw, 3.2rem);
    font-weight: 700;
    color: #1e293b;
    line-height: 1.15;
    margin-bottom: 0.75rem;
    letter-spacing: -0.02em;
  }

  .hero-title-accent {
    color: #7c3aed;
    font-style: italic;
    font-weight: 700;
  }

  .hero-subtitle {
    font-size: 1.05rem;
    color: #64748b;
    line-height: 1.6;
    max-width: 36rem;
    margin-bottom: 2rem;
  }

  .stats-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    min-width: 160px;
  }

  .stat-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-icon-spaces {
    background: #ede9fe;
    color: #7c3aed;
  }

  .stat-icon-members {
    background: #fce7f3;
    color: #db2777;
  }

  .stat-icon-posts {
    background: #ecfeff;
    color: #0891b2;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 500;
    margin-top: 0.15rem;
  }

  /* ============================
     Search & Filters
     ============================ */
  .search-section {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .search-container {
    max-width: 72rem;
    margin: 0 auto;
  }

  .search-bar {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: #94a3b8;
    left: 1.25rem;
  }

  .rtl .search-icon {
    left: auto;
    right: 1.25rem;
  }

  .search-input {
    width: 100%;
    padding: 1rem 1.25rem 1rem 3.25rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 1rem;
    font-size: 0.95rem;
    background: #f8fafc;
    transition: all 0.2s ease;
    color: #334155;
  }

  .rtl .search-input {
    padding: 1rem 3.25rem 1rem 1.25rem;
    text-align: right;
  }

  .search-input:focus {
    outline: none;
    border-color: #818cf8;
    background: white;
    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.12);
  }

  .search-input::placeholder {
    color: #94a3b8;
  }

  .search-loading {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .filters-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .filter-label {
    font-size: 0.7rem;
    color: #94a3b8;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .filter-select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #334155;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: auto;
  }

  .filter-select:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.12);
  }

  /* ============================
     Content Section
     ============================ */
  .content-section {
    padding: 1.5rem 2rem 3rem;
    max-width: 72rem;
    margin: 0 auto;
  }

  /* ============================
     Showing Bar
     ============================ */
  .showing-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .showing-count {
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
  }

  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #059669;
    font-weight: 600;
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  /* ============================
     Loading / Error / Empty
     ============================ */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6rem 0;
  }

  .loading-text {
    margin-top: 1.25rem;
    color: #64748b;
    font-weight: 500;
  }

  .error-state,
  .empty-state {
    text-align: center;
    padding: 5rem 0;
  }

  .error-icon-wrap,
  .empty-icon-wrap {
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 1.25rem;
    color: #ef4444;
  }

  .empty-icon-wrap {
    color: #94a3b8;
  }

  .error-title,
  .empty-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.5rem;
  }

  .error-message,
  .empty-message {
    color: #64748b;
    font-size: 1rem;
  }

  /* ============================
     Search Results Header
     ============================ */
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .results-info {
    flex: 1;
  }

  .results-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.25rem 0;
  }

  .results-subtitle {
    color: #64748b;
    font-size: 0.85rem;
    margin: 0;
  }

  .clear-search-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-search-btn:hover {
    background: #e2e8f0;
  }

  .clear-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  /* ============================
     Space Cards Grid
     ============================ */
  .spaces-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }

  .space-card {
    display: flex;
    align-items: stretch;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.25s ease;
    animation: fadeSlideUp 0.4s ease forwards;
    opacity: 0;
    position: relative;
  }

  @keyframes fadeSlideUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }

  .space-card:hover {
    border-color: #c7d2fe;
    box-shadow:
      0 8px 24px -4px rgba(99, 102, 241, 0.1),
      0 2px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
  }

  .space-card:focus {
    outline: 2px solid #818cf8;
    outline-offset: 2px;
  }

  /* Card Thumbnail */
  .card-thumbnail {
    width: 140px;
    min-height: 140px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .card-thumb-icon {
    font-size: 2.5rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Card Body */
  .card-body {
    flex: 1;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .card-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
    line-height: 1.3;
  }

  .card-author {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0.15rem 0 0 0;
    font-weight: 400;
  }

  .card-members-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    background: #f1f5f9;
    border-radius: 1rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-description {
    font-size: 0.82rem;
    color: #64748b;
    line-height: 1.5;
    margin: 0 0 0.6rem 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
  }

  /* Tags */
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.6rem;
  }

  .tag-pill {
    padding: 0.15rem 0.5rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.35rem;
    font-size: 0.68rem;
    color: #475569;
    font-weight: 500;
    white-space: nowrap;
  }

  .tag-pill.tag-more {
    background: #e2e8f0;
    color: #64748b;
  }

  /* Card Footer */
  .card-footer-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: auto;
  }

  .card-date,
  .card-comments {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #94a3b8;
    font-weight: 400;
  }

  /* Card Arrow */
  .card-arrow {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    color: #cbd5e1;
    transition:
      color 0.2s ease,
      transform 0.2s ease;
  }

  .rtl .card-arrow {
    right: auto;
    left: 1rem;
    transform: rotate(180deg);
  }

  .space-card:hover .card-arrow {
    color: #818cf8;
    transform: translateX(3px);
  }

  .rtl .space-card:hover .card-arrow {
    transform: translateX(-3px) rotate(180deg);
  }

  /* ============================
     Responsive
     ============================ */
  @media (max-width: 1024px) {
    .spaces-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .hero-section {
      padding: 2rem 1rem 1.5rem;
    }

    .search-section {
      padding: 1rem;
    }

    .content-section {
      padding: 1rem;
    }

    .hero-title {
      font-size: 1.8rem;
    }

    .hero-subtitle {
      font-size: 0.95rem;
    }

    .stats-row {
      flex-direction: column;
    }

    .filters-row {
      flex-direction: column;
      gap: 0.75rem;
    }

    .filter-group {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
    }

    .space-card {
      flex-direction: column;
    }

    .card-thumbnail {
      width: 100%;
      min-height: 80px;
      height: 80px;
    }

    .card-thumb-icon {
      font-size: 1.8rem;
    }

    .spaces-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .showing-bar {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }
  }
</style>
