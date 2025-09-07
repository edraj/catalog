<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params } from "@roxi/routify";
  import {
    getAvatar,
    getEntityAttachmentsCount,
    getSpaceContents,
    getSpaceContentsByTags,
    getSpaceTags,
    searchInCatalog,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import Avatar from "@/components/Avatar.svelte";
  import { derived } from "svelte/store";
  import { formatNumberInText } from "@/lib/helpers";

  $goto;

  let isLoading = $state(true);
  let isLoadingMore = $state(false);
  let allContents = $state([]);
  let filteredContents = $state([]);
  let displayedContents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let searchQuery = $state("");
  let sortBy = $state("created");
  let selectedContentTags = $state([]);
  let availableContentTags = $state([]);
  let showAllTags = $state(false);
  let searchResults = $state([]);
  let isSearching = $state(false);
  let searchTimeout: number;
  let tagCounts = $state({});

  // Pagination state
  let currentOffset = $state(0);
  let itemsPerLoad = $state(20);
  let totalItemsCount = $state(0);
  let hasMoreItems = $state(true);
  let isInitialLoad = $state(true);

  let isTagFiltered = $state(false);
  let tagFilteredContents = $state([]);
  let tagFilteredOffset = $state(0);
  let tagFilteredHasMore = $state(true);

  const itemsPerLoadOptions = [20, 50, 100];

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  const sortOptions = [
    { value: "created", label: $_("admin_dashboard.sort.created") },
    { value: "updated", label: $_("admin_dashboard.sort.updated") },
    { value: "name", label: $_("space.sort.name") },
    { value: "reactions", label: $_("space.sort.reactions") },
  ];

  onMount(async () => {
    spaceName = $params.space_name;
    await loadContents(true);
  });

  async function loadContents(reset = false, tags = []) {
    if (reset) {
      isLoading = true;
      currentOffset = 0;
      if (tags.length > 0) {
        tagFilteredOffset = 0;
        tagFilteredContents = [];
        isTagFiltered = true;
      } else {
        allContents = [];
        isTagFiltered = false;
      }
      displayedContents = [];
      isInitialLoad = true;
    } else {
      isLoadingMore = true;
    }

    error = null;

    try {
      let response;

      if (tags.length > 0) {
        response = await getSpaceContentsByTags(
          spaceName,
          "/",
          "public",
          itemsPerLoad,
          isTagFiltered ? tagFilteredOffset : currentOffset,
          tags
        );
      } else {
        response = await getSpaceContents(
          spaceName,
          "/",
          "public",
          itemsPerLoad,
          currentOffset
        );
      }

      if (!response || !response.records) {
        if (reset) {
          if (isTagFiltered) {
            tagFilteredContents = [];
            tagFilteredHasMore = false;
          } else {
            allContents = [];
            availableContentTags = [];
            totalItemsCount = 0;
            hasMoreItems = false;
          }
        }
        return;
      }

      const enhancedItems = await Promise.all(
        response.records.map(async (item) => {
          const enhancedItem = await enhanceItem(item);
          return enhancedItem;
        })
      );

      if (reset) {
        if (isTagFiltered) {
          tagFilteredContents = enhancedItems;
          tagFilteredHasMore = enhancedItems.length === itemsPerLoad;
        } else {
          allContents = enhancedItems;
          extractContentTags(enhancedItems);
        }
      } else {
        if (isTagFiltered) {
          tagFilteredContents = [...tagFilteredContents, ...enhancedItems];
          tagFilteredHasMore = enhancedItems.length === itemsPerLoad;
        } else {
          allContents = [...allContents, ...enhancedItems];
          extractContentTags(enhancedItems, false);
        }
      }

      if (isTagFiltered) {
        tagFilteredOffset += itemsPerLoad;
      } else {
        currentOffset += itemsPerLoad;
        hasMoreItems = enhancedItems.length === itemsPerLoad;
      }

      if (reset) {
        totalItemsCount = enhancedItems.length;
      }

      applyFiltersAndSort();
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = $_("space.error.failed_load_contents");
      if (reset) {
        if (isTagFiltered) {
          tagFilteredContents = [];
          tagFilteredHasMore = false;
        } else {
          allContents = [];
          availableContentTags = [];
          totalItemsCount = 0;
          hasMoreItems = false;
        }
      }
    } finally {
      isLoading = false;
      isLoadingMore = false;
      isInitialLoad = false;
    }
  }

  async function performSearch(query: string) {
    if (!query.trim()) {
      searchResults = [];
      applyFiltersAndSort();
      return;
    }

    isSearching = true;
    try {
      const results = await searchInCatalog(query.trim());

      const enhancedSearchResults = await Promise.all(
        results.map(async (item) => {
          const enhancedItem = await enhanceItem(item);
          return enhancedItem;
        })
      );

      searchResults = enhancedSearchResults;

      const sortedResults = [...searchResults];
      sortedResults.sort((a, b) => {
        switch (sortBy) {
          case "name":
            return a.title.localeCompare(b.title);
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

      displayedContents = sortedResults;
      filteredContents = sortedResults;
    } catch (err) {
      console.error("Error performing search:", err);
      error = $_("catalogs.error.search_failed");
      searchResults = [];
      displayedContents = [];
      filteredContents = [];
    } finally {
      isSearching = false;
    }
  }

  function handleSearchInput() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);
  }

  async function enhanceItem(item) {
    try {
      const [avatar, attachmentCounts] = await Promise.all([
        getAvatar(item.attributes?.owner_shortname || item.shortname),
        getEntityAttachmentsCount(
          item.shortname,
          spaceName,
          item.subpath || "/"
        ),
      ]);

      const attachmentData = attachmentCounts?.[0]?.attributes || {};

      const contentTags = extractItemTags(item);

      return {
        ...item,
        owner_avatar: avatar,
        reactionCount: attachmentData.reaction || 0,
        commentCount: attachmentData.comment || 0,
        mediaCount: attachmentData.media || 0,
        reportCount: attachmentData.report || 0,
        shareCount: attachmentData.share || 0,
        contentTags: contentTags,
        title:
          item.attributes?.displayname?.[$locale] ||
          item.attributes?.displayname?.en ||
          item.attributes?.displayname?.ar ||
          item.attributes?.payload?.body?.title ||
          item.shortname,
        folderPath: item.subpath || "/",
        folderName: getFolderNameFromPath(item.subpath || "/"),
      };
    } catch (error) {
      console.warn(`Error enhancing item ${item.shortname}:`, error);
      return {
        ...item,
        owner_avatar: null,
        reactionCount: 0,
        commentCount: 0,
        mediaCount: 0,
        reportCount: 0,
        shareCount: 0,
        contentTags: [],
        title: item.shortname,
        folderPath: item.subpath || "/",
        folderName: getFolderNameFromPath(item.subpath || "/"),
      };
    }
  }

  function extractItemTags(item) {
    const tags = [];

    if (item.attributes?.tags) {
      if (Array.isArray(item.attributes.tags)) {
        tags.push(...item.attributes.tags);
      } else if (typeof item.attributes.tags === "string") {
        tags.push(...item.attributes.tags.split(",").map((tag) => tag.trim()));
      }
    }

    if (item.attributes?.category) {
      tags.push(item.attributes.category);
    }

    if (item.resource_type) {
      tags.push(item.resource_type);
    }

    if (item.attributes?.payload?.content_type) {
      tags.push(item.attributes.payload.content_type);
    }

    if (item.attributes?.keywords) {
      if (Array.isArray(item.attributes.keywords)) {
        tags.push(...item.attributes.keywords);
      }
    }

    return [...new Set(tags.filter((tag) => tag && tag.trim()))];
  }

  async function extractContentTags(items, reset = true) {
    const contentTags = await getSpaceTags(spaceName);

    if (contentTags.records && contentTags.records[0]?.attributes) {
      const tagsData = contentTags.records[0].attributes;
      availableContentTags = tagsData.tags || [];
      tagCounts = tagsData.tag_counts || {};
    } else {
      availableContentTags = [];
      tagCounts = {};
    }
  }

  function getFolderNameFromPath(path) {
    if (path === "/" || !path) return $_("catalogs.root_folder");
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || $_("catalogs.root_folder");
  }

  function applyFiltersAndSort() {
    if (searchQuery.trim()) {
      return;
    }

    let filtered = [];

    if (isTagFiltered) {
      filtered = [...tagFilteredContents];
    } else {
      filtered = [...allContents];

      if (selectedContentTags.length > 0 && !isTagFiltered) {
        filtered = filtered.filter((item) =>
          selectedContentTags.some((selectedTag) =>
            item.attributes?.tags.includes(selectedTag)
          )
        );
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title);
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
    displayedContents = filtered;
  }

  function loadMoreItems() {
    if (isLoadingMore || searchQuery.trim()) return;

    if (isTagFiltered) {
      if (!tagFilteredHasMore) return;
      loadContents(false, selectedContentTags);
    } else {
      if (!hasMoreItems) return;
      loadContents(false);
    }
  }

  function handleItemsPerLoadChange(newItemsPerLoad) {
    itemsPerLoad = newItemsPerLoad;
    loadContents(true);
  }

  function handleItemClick(item) {
    const subpath = item.subpath === "/" ? "/" : item.subpath;
    const subpathParam = subpath.replace(/\//g, "-");

    $goto(`/catalogs/[space_name]/[subpath]/[shortname]/[resource_type]`, {
      space_name: spaceName,
      subpath: subpathParam,
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function getItemIcon(item) {
    switch (item.resource_type) {
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

  function formatDate(dateString) {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  }

  function goBack() {
    $goto("/catalogs");
  }

  function toggleContentTag(tag) {
    if (selectedContentTags.includes(tag)) {
      selectedContentTags = selectedContentTags.filter((t) => t !== tag);
    } else {
      selectedContentTags = [...selectedContentTags, tag];
    }

    if (selectedContentTags.length > 0) {
      loadContents(true, selectedContentTags);
    } else {
      isTagFiltered = false;
      loadContents(true, []);
    }
  }

  function clearAllFilters() {
    selectedContentTags = [];
    searchQuery = "";
    searchResults = [];
    isTagFiltered = false;
    tagFilteredContents = [];
    tagFilteredOffset = 0;
    tagFilteredHasMore = true;
    loadContents(true, []);
  }

  function shareItem(item) {
    const url = `${window.location.origin}/catalogs/${spaceName}/${item.subpath?.replace(/\//g, "-") || "-"}/${item.shortname}?resource_type=${item.resource_type}`;
    const title = item.title;

    if (navigator.share) {
      navigator
        .share({
          title: title,
          text: `Check out this content: ${title}`,
          url: url,
        })
        .catch(console.error);
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          alert($_("catalog_contents.share.copied_to_clipboard"));
        })
        .catch(() => {
          prompt($_("catalog_contents.share.copy_link"), url);
        });
    }
  }

  function reportItem(item) {
    const reason = prompt($_("catalog_contents.report.reason_prompt"));
    if (reason && reason.trim()) {
      alert($_("catalog_contents.report.submitted"));
    }
  }

  function handleCardTagClick(event, tag) {
    event.stopPropagation();
    toggleContentTag(tag);
  }

  const displayedTags = $derived.by(() => {
    if (showAllTags) return availableContentTags;
    return availableContentTags.slice(0, 12);
  });

  const totalDisplayed = $derived.by(() => displayedContents.length);
  const totalFiltered = $derived.by(() => {
    if (searchQuery.trim()) {
      return searchResults.length;
    }
    if (isTagFiltered) {
      return tagFilteredContents.length;
    }
    return filteredContents.length;
  });

  const currentLoadingState = $derived.by(() => {
    if (isTagFiltered && selectedContentTags.length > 0) {
      return `Showing content tagged with: ${selectedContentTags.join(", ")}`;
    }
    return "Showing all content";
  });

  $effect(() => {
    if (!searchQuery.trim()) {
      searchResults = [];
      applyFiltersAndSort();
    }
  });
</script>

<div class="catalog-contents-page" class:rtl={$isRTL}>
  <div class="header-section">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <div class="header-nav">
        <button aria-label={`Go back`} onclick={goBack} class="back-button">
          <svg
            class="back-icon"
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
          <span>{$_("navigation.go_back")}</span>
        </button>
      </div>

      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">{spaceName}</h1>
          <p class="page-description">
            {$_("space.all_content_subtitle")}
          </p>
          <div class="content-stats">
            <span class="stat-item">
              <svg
                class="stat-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              {formatNumberInText(totalDisplayed, $locale)}
              {$_("space.total_items")}
            </span>
            <span class="stat-item">
              <svg
                class="stat-icon"
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
              {formatNumberInText(availableContentTags.length, $locale)}
              {$_("space.total_tags")}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="loading-state">
        <Diamonds color="#3b82f6" size="60" unit="px" />
        <p class="loading-text">{$_("catalog_contents.loading")}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">
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
        <h3 class="error-title">
          {$_("catalog_contents.error.title")}
        </h3>
        <p class="error-message">{error}</p>
        <button
          aria-label={`Retry loading content`}
          onclick={() => loadContents(true)}
          class="retry-button"
        >
          {$_("catalog_contents.error.try_again")}
        </button>
      </div>
    {:else}
      {#if availableContentTags.length > 0 && !searchQuery.trim()}
        <div class="tags-filter-section">
          <div class="tags-header">
            <h3 class="tags-title">
              <svg
                class="tags-icon"
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
              {$_("space.filter_by_tags")}
            </h3>
            <div class="tags-actions">
              {#if availableContentTags.length > 12}
                <button
                  aria-label={`Show all tags`}
                  onclick={() => (showAllTags = !showAllTags)}
                  class="show-all-tags-button"
                >
                  {showAllTags
                    ? $_("space.show_less_tags")
                    : $_("space.show_all_tags")}
                  ({formatNumberInText(availableContentTags.length, $locale)})
                </button>
              {/if}
              {#if selectedContentTags.length > 0}
                <button
                  aria-label={`Clear all filters`}
                  onclick={clearAllFilters}
                  class="clear-filters-button"
                >
                  {$_("catalog_contents.filters.clear_filters")}
                </button>
              {/if}
            </div>
          </div>

          <div class="content-tags-container">
            {#each displayedTags as tag}
              <button
                onclick={() => toggleContentTag(tag)}
                class="content-tag {selectedContentTags.includes(tag)
                  ? 'content-tag-selected'
                  : 'content-tag-unselected'}"
                aria-label={$_("space.content_tag_label", {
                  values: { tag },
                })}
              >
                <span class="content-tag-name">{tag}</span>
                <span class="content-tag-count">
                  ({formatNumberInText(tagCounts[tag], $locale) || 0})
                </span>
                {#if selectedContentTags.includes(tag)}
                  <svg
                    class="content-tag-check"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {/if}
              </button>
            {/each}
          </div>

          {#if selectedContentTags.length > 0}
            <div class="selected-tags-section">
              <div class="selected-tags-header">
                <span class="selected-tags-title">
                  {$_("space.showing_with_tags")}:
                </span>
              </div>
              <div class="selected-tags-container">
                {#each selectedContentTags as tag}
                  <div class="selected-tag">
                    <span class="selected-tag-name">{tag}</span>
                    <button
                      onclick={() => toggleContentTag(tag)}
                      class="remove-tag-button"
                      aria-label={$_("space.remove_tag_filter", {
                        values: { tag },
                      })}
                    >
                      <svg
                        class="remove-tag-icon"
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
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="search-filter-section">
        <div class="search-filter-header">
          <h2 class="section-title">
            {$_("catalog_contents.filters.title")}
          </h2>
          {#if searchQuery || selectedContentTags.length > 0}
            <button
              onclick={clearAllFilters}
              class="clear-all-filters-button"
              aria-label={`Clear all filters`}
            >
              {$_("catalog_contents.filters.clear_all")}
            </button>
          {/if}
        </div>

        <div class="search-filter-controls">
          <div class="search-input-group">
            <div class="search-input-wrapper">
              <label class="filter-label" for="sort-by"
                >{$_("catalog_contents.search.label")}</label
              >
              <input
                type="text"
                bind:value={searchQuery}
                placeholder={$_("catalog_contents.search.placeholder")}
                oninput={handleSearchInput}
                class="search-input"
                aria-label={$_("catalog_contents.search.label")}
              />
              {#if searchQuery}
                <button
                  onclick={() => {
                    searchQuery = "";
                    searchResults = [];
                    applyFiltersAndSort();
                  }}
                  class="clear-search-button"
                  aria-label={$_("catalog_contents.search.clear")}
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              {/if}
              {#if isSearching}
                <div class="search-loading-indicator">
                  <Diamonds color="#3b82f6" size="16" unit="px" />
                </div>
              {/if}
            </div>
          </div>
          <div class="filter-controls">
            <div class="filter-group">
              <label class="filter-label" for="sort-by"
                >{$_("catalog_contents.filters.sort_by")}</label
              >
              <select
                bind:value={sortBy}
                class="filter-select sort-select"
                aria-label={$_("catalog_contents.filters.sort_by")}
                id="sort-by"
                onchange={() => {
                  if (searchQuery.trim()) {
                    performSearch(searchQuery);
                  } else {
                    applyFiltersAndSort();
                  }
                }}
              >
                {#each sortOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label" for="items-per-load"
                >{$_("catalog_contents.pagination.items_per_load")}</label
              >
              <select
                bind:value={itemsPerLoad}
                onchange={(e) => {
                  e.preventDefault();
                  handleItemsPerLoadChange(
                    parseInt((e.target as HTMLSelectElement).value)
                  );
                }}
                class="filter-select"
                aria-label={$_("catalog_contents.pagination.items_per_load")}
                id="items-per-load"
              >
                {#each itemsPerLoadOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="results-summary">
          <div class="results-info">
            {#if searchQuery.trim()}
              {$_("catalog_contents.pagination.showing_items", {
                values: {
                  displayed: formatNumberInText(totalDisplayed, $locale),
                  total: formatNumberInText(totalFiltered, $locale),
                },
              })}
              {$_("catalog_contents.results.for_query", {
                values: { query: searchQuery },
              })}
            {:else}
              {$_("catalog_contents.pagination.showing_items", {
                values: {
                  displayed: formatNumberInText(totalDisplayed, $locale),
                  total: formatNumberInText(totalFiltered, $locale),
                },
              })}
              {#if selectedContentTags.length > 0}
                {$_("catalog_contents.results.with_tags", {
                  values: {
                    count: formatNumberInText(
                      selectedContentTags.length,
                      $locale
                    ),
                  },
                })}
              {/if}
            {/if}
          </div>
        </div>
      </div>
      {#if totalDisplayed !== 0}
        <div class="card-list-container">
          <div class="card-list">
            {#each displayedContents as item, index}
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
                <div class="card-avatar">
                  {#if item.owner_avatar}
                    <Avatar
                      src={item.owner_avatar}
                      size="48"
                      alt={item.attributes?.owner_shortname || "User"}
                    />
                  {:else if item.attributes?.owner_shortname}
                    <div class="avatar-fallback">
                      {item.attributes.owner_shortname.charAt(0).toUpperCase()}
                    </div>
                  {:else}
                    <div class="avatar-unknown">
                      <span class="text-sm font-medium text-gray-600">?</span>
                    </div>
                  {/if}
                </div>

                <div class="card-content">
                  <div class="card-header">
                    <h3 class="card-title">
                      <span class="title-icon">{getItemIcon(item)}</span>
                      {item.title}
                    </h3>
                  </div>

                  <div class="card-meta">
                    <span class="meta-text"
                      >{$_("catalog_contents.card.posted_by")}</span
                    >
                    <span class="meta-author">
                      {item.attributes?.owner_shortname || $_("common.unknown")}
                    </span>
                    <span class="meta-separator">•</span>
                    <span class="meta-time">
                      {formatRelativeTime(item.attributes?.created_at)}
                    </span>
                    <span class="meta-separator">•</span>
                    <span class="meta-folder">
                      <span class="folder-icon">📁</span>
                      {item.folderName}
                    </span>
                  </div>

                  {#if item.attributes?.payload?.body}
                    <div class="card-preview">
                      {#if item.attributes?.payload.content_type === "html"}
                        {@const cleanText = item.attributes.payload.body
                          .replace(/<[^>]*>/g, "")
                          .replace(/\s+/g, " ")
                          .trim()}
                        <div class="prose max-w-none preview-content">
                          <div class="text-sm text-gray-700 leading-relaxed">
                            {cleanText.substring(0, 200)}
                            {#if cleanText.length > 200}
                              <span class="text-gray-400">...</span>
                            {/if}
                          </div>
                          {#if cleanText.length > 200}
                            <div class="mt-2">
                              <span
                                class="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                Show more
                              </span>
                            </div>
                          {/if}
                        </div>
                      {:else if item.attributes?.payload.content_type === "json"}
                        <div class="p-3 preview-content">
                          {#if typeof item.attributes.payload.body === "object"}
                            {#if item.attributes.payload.body.title}
                              <h4
                                class="text-sm font-semibold mb-2 text-gray-800"
                              >
                                {item.attributes.payload.body.title}
                              </h4>
                            {/if}
                            {#if item.attributes.payload.body.content}
                              {@const cleanContent =
                                typeof item.attributes.payload.body.content ===
                                "string"
                                  ? item.attributes.payload.body.content
                                      .replace(/<[^>]*>/g, "")
                                      .replace(/\s+/g, " ")
                                      .trim()
                                  : JSON.stringify(
                                      item.attributes.payload.body.content
                                    )}
                              <div
                                class="text-xs text-gray-600 leading-relaxed"
                              >
                                {cleanContent.substring(0, 150)}
                                {#if cleanContent.length > 150}
                                  <span class="text-gray-400">...</span>
                                {/if}
                              </div>
                            {/if}
                            {#if item.attributes.payload.body.description}
                              <div class="text-xs text-gray-500 mt-1 italic">
                                {item.attributes.payload.body.description}
                              </div>
                            {/if}
                          {:else}
                            {@const jsonPreview = JSON.stringify(
                              item.attributes.payload.body,
                              null,
                              2
                            )}
                            <pre
                              class="text-xs overflow-hidden text-gray-700 font-mono bg-white p-2 rounded border">
            {jsonPreview.substring(0, 200)}
            {#if jsonPreview.length > 200}
                                <span class="text-gray-400">...</span>
                              {/if}
          </pre>
                          {/if}
                        </div>
                      {:else}
                        <!-- Plain text or other content types -->
                        {@const cleanText = item.attributes.payload.body
                          .replace(/<[^>]*>/g, "") // Remove HTML tags
                          .replace(/\s+/g, " ") // Normalize whitespace
                          .trim()}
                        <div
                          class="bg-gray-50 p-3 rounded-lg preview-content border"
                        >
                          {#if cleanText}
                            <div class="text-sm text-gray-700 leading-relaxed">
                              {cleanText.substring(0, 200)}
                              {#if cleanText.length > 200}
                                <span class="text-gray-400">...</span>
                              {/if}
                            </div>
                            {#if cleanText.length > 200}
                              <div
                                class="mt-2 flex items-center justify-between"
                              >
                                <span
                                  class="text-xs text-gray-400 uppercase tracking-wide"
                                >
                                  {item.attributes?.payload.content_type ||
                                    "Text"}
                                </span>
                                <span
                                  class="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                  Read more
                                </span>
                              </div>
                            {/if}
                          {:else}
                            <div class="text-xs text-gray-400 italic">
                              No readable content available
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <div class="card-content-tags">
                    {#each item.attributes?.tags.slice(0, 3) as tag}
                      <button
                        aria-label={`Filter by tag: ${tag}`}
                        class="content-tag-badge {selectedContentTags.includes(
                          tag
                        )
                          ? 'content-tag-badge-selected'
                          : ''}"
                        onclick={(e) => handleCardTagClick(e, tag)}
                      >
                        {tag}
                      </button>
                    {/each}
                    {#if item.attributes?.tags.length > 3}
                      <span class="more-tags"
                        >+{formatNumberInText(
                          item.attributes?.tags.length - 3,
                          $locale
                        )} more</span
                      >
                    {/if}
                  </div>
                </div>

                <div class="card-stats">
                  <div class="stats-left">
                    <!-- Comment Count -->
                    <div class="stat-item">
                      <svg
                        class="stat-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span class="stat-number"
                        >{formatNumberInText(item.commentCount, $locale) ||
                          formatNumberInText(0, $locale)}</span
                      >
                    </div>

                    <!-- Reaction Count -->
                    <div class="stat-item stat-reactions">
                      <svg
                        class="stat-icon"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span class="stat-number"
                        >{formatNumberInText(item.reactionCount, $locale) ||
                          0}</span
                      >
                    </div>

                    <div class="stat-item me-4 stat-media">
                      <svg
                        class="stat-icon"
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
                      <span class="stat-number"
                        >{formatNumberInText(item.mediaCount, $locale) ||
                          0}</span
                      >
                    </div>
                  </div>

                  <div class="stats-right">
                    <button
                      class="action-button share-button"
                      onclick={(e) => {
                        e.stopPropagation();
                        shareItem(item);
                      }}
                      title={$_("catalog_contents.card.share")}
                      aria-label={$_("catalog_contents.card.share")}
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
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367 2.684z"
                        />
                      </svg>
                    </button>

                    <button
                      class="action-button report-button"
                      onclick={(e) => {
                        e.stopPropagation();
                        reportItem(item);
                      }}
                      title={$_("catalog_contents.card.report")}
                      aria-label={$_("catalog_contents.card.report")}
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          {#if hasMoreItems && !searchQuery.trim()}
            <div class="load-more-section">
              <div class="load-more-info">
                <span class="load-more-text">
                  {$_("catalog_contents.pagination.loaded_items", {
                    values: {
                      loaded: formatNumberInText(allContents.length, $locale),
                    },
                  })}
                </span>
              </div>
              <button
                onclick={loadMoreItems}
                disabled={isLoadingMore}
                class="load-more-button"
                aria-label={$_("catalog_contents.pagination.load_more")}
              >
                {#if isLoadingMore}
                  <div class="load-more-spinner">
                    <Diamonds color="#ffffff" size="20" unit="px" />
                  </div>
                  {$_("catalog_contents.pagination.loading")}
                {:else}
                  <svg
                    class="load-more-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    ></path>
                  </svg>
                  {$_("catalog_contents.pagination.load_more")} ({formatNumberInText(
                    itemsPerLoad,
                    $locale
                  )})
                {/if}
              </button>
            </div>
          {:else if displayedContents.length > 0}
            <div class="end-of-results">
              <div class="end-of-results-icon">
                <svg
                  class="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <p class="end-of-results-text">
                {searchQuery.trim()
                  ? $_("catalog_contents.search.end_of_results")
                  : $_("catalog_contents.pagination.end_of_results")}
              </p>
              <p class="end-of-results-count">
                {searchQuery.trim()
                  ? $_("catalog_contents.search.total_found", {
                      values: {
                        count: formatNumberInText(
                          searchResults.length,
                          $locale
                        ),
                      },
                    })
                  : $_("catalog_contents.pagination.total_loaded", {
                      values: {
                        loaded: formatNumberInText(allContents.length, $locale),
                      },
                    })}
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">
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
          <h3 class="empty-title">
            {$_("catalog_contents.empty.title")}
          </h3>
          <p class="empty-message">
            {searchQuery || selectedContentTags.length > 0
              ? $_("catalog_contents.empty.no_matches")
              : $_("catalog_contents.empty.space_empty")}
          </p>
          {#if searchQuery || selectedContentTags.length > 0}
            <button
              aria-label={`Clear all filters`}
              onclick={clearAllFilters}
              class="clear-filters-button"
            >
              {$_("catalog_contents.filters.clear_all")}
            </button>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .catalog-contents-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
  }

  .rtl {
    direction: rtl;
  }

  /* Header Section */
  .header-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .header-nav {
    margin-bottom: 1.5rem;
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

  .rtl .back-icon {
    transform: rotate(180deg);
  }

  .back-button:hover .back-icon {
    transform: translateX(-0.25rem);
  }

  .rtl .back-button:hover .back-icon {
    transform: rotate(180deg) translateX(-0.25rem);
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .rtl .header-content {
    text-align: right;
  }

  .header-info {
    flex: 1;
  }

  .page-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }

  .page-description {
    color: #64748b;
    font-size: 1.125rem;
    margin-bottom: 1rem;
  }

  .content-stats {
    display: flex;
    gap: 2rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .stat-icon {
    width: 1rem;
    height: 1rem;
  }

  /* Tags Filter Section */
  .tags-filter-section {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .tags-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .tags-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .tags-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .tags-actions {
    display: flex;
    gap: 1rem;
  }

  .show-all-tags-button,
  .clear-filters-button {
    font-size: 0.875rem;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s ease;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
  }

  .show-all-tags-button {
    color: #2563eb;
  }

  .show-all-tags-button:hover {
    color: #1d4ed8;
    background: rgba(37, 99, 235, 0.1);
  }

  .clear-filters-button {
    color: #ef4444;
  }

  .clear-filters-button:hover {
    color: #dc2626;
    background: rgba(239, 68, 68, 0.1);
  }

  .content-tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .content-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.8);
  }

  .content-tag-unselected {
    color: #64748b;
    border-color: rgba(148, 163, 184, 0.3);
  }

  .content-tag-unselected:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
    border-color: rgba(59, 130, 246, 0.3);
    transform: translateY(-1px);
  }

  .content-tag-selected {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-color: #2563eb;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .content-tag-name {
    font-weight: 600;
  }

  .content-tag-count {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .content-tag-check {
    width: 1rem;
    height: 1rem;
  }

  .selected-tags-section {
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    padding-top: 1rem;
  }

  .selected-tags-header {
    margin-bottom: 0.75rem;
  }

  .selected-tags-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .selected-tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
    color: #1e40af;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .remove-tag-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #64748b;
    transition: color 0.2s ease;
    border-radius: 0.25rem;
  }

  .remove-tag-button:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .remove-tag-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5rem 0;
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    color: #64748b;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .error-icon,
  .empty-icon {
    width: 6rem;
    height: 6rem;
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .empty-icon {
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    border: 1px solid rgba(107, 114, 128, 0.2);
  }

  .error-title,
  .empty-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .error-message,
  .empty-message {
    color: #64748b;
    font-size: 1.125rem;
    margin-bottom: 1.5rem;
  }

  .retry-button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-radius: 0.5rem;
    font-weight: 500;
    border: 1px solid rgba(37, 99, 235, 0.3);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    cursor: pointer;
  }

  .retry-button:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
  }

  .search-filter-section {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .search-filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
  }

  .clear-all-filters-button {
    font-size: 0.875rem;
    color: #ef4444;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .clear-all-filters-button:hover {
    color: #dc2626;
    text-decoration: underline;
  }

  .search-filter-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .search-input-group {
    flex: 1;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    flex-direction: column;
  }

  .search-icon {
    position: absolute;
    width: 1.25rem;
    height: 1.25rem;
    color: #9ca3af;
    z-index: 1;
    left: 0.75rem;
  }

  .rtl .search-icon {
    left: auto;
    right: 0.75rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.75rem;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.875rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .rtl .search-input {
    padding: 0.75rem 2.75rem 0.75rem 1rem;
    text-align: right;
  }

  .search-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .clear-search-button {
    position: absolute;
    color: #9ca3af;
    transition: color 0.2s ease;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    right: 2.5rem;
  }

  .rtl .clear-search-button {
    right: auto;
    left: 2.5rem;
  }

  .clear-search-button:hover {
    color: #6b7280;
    background-color: rgba(107, 114, 128, 0.1);
  }

  .search-loading-indicator {
    position: absolute;
    right: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rtl .search-loading-indicator {
    right: auto;
    left: 0.75rem;
  }

  /* Filter Controls */
  .filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: end;
  }

  /* .rtl .filter-controls {
    flex-direction: row-reverse;
  } */

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 140px;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .rtl .filter-label {
    text-align: right;
  }

  .filter-select {
    padding: 0.75rem 1rem;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.875rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .rtl .filter-select {
    text-align: right;
  }

  .filter-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  /* Results Summary */
  .results-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    margin-top: 1.5rem;
  }

  .results-info {
    font-size: 0.875rem;
    color: #64748b;
  }

  .card-list-container {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .card-list {
    divide-y: 1px solid rgba(148, 163, 184, 0.1);
  }

  .content-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
    cursor: pointer;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .content-card:last-child {
    border-bottom: none;
  }

  .content-card:hover {
    background: rgba(59, 130, 246, 0.02);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .card-avatar {
    flex-shrink: 0;
    position: relative;
  }

  .avatar-fallback {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1.125rem;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .avatar-unknown {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Content Section */
  .card-content {
    flex: 1;
    min-width: 0;
  }

  .rtl .card-content {
    text-align: right;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.2s ease;
    flex: 1;
  }

  .content-card:hover .card-title {
    color: #2563eb;
  }

  .title-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .meta-text {
    color: #9ca3af;
  }

  .meta-author {
    font-weight: 500;
    color: #374151;
  }

  .meta-separator {
    color: #d1d5db;
  }

  .meta-time {
    color: #64748b;
  }

  .meta-folder {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: #0369a1;
    font-weight: 500;
  }

  .folder-icon {
    font-size: 0.875rem;
  }

  /* Card Preview Styles */
  .card-preview {
    margin-bottom: 0.75rem;
  }

  .preview-content {
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.5;
    max-height: 4rem;
    overflow: hidden;
  }
  .prose {
    word-break: break-word;
  }
  .card-content-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
    align-items: center;
  }

  .content-tag-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    color: #0369a1;
    border: 1px solid rgba(3, 105, 161, 0.2);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .content-tag-badge:hover {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    transform: translateY(-1px);
  }

  .content-tag-badge-selected {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-color: #2563eb;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  .more-tags {
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
  }

  /* Stats Section */
  .card-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    margin-top: 0.5rem;
  }

  .stats-left {
    display: flex;
    gap: 0.75rem;
  }

  .stats-right {
    display: flex;
    gap: 0.5rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: #334155;
    padding: 0.375rem 0.75rem;
    background: rgba(248, 250, 252, 0.9);
    border-radius: 0.5rem;
    border: 1px solid rgba(203, 213, 225, 0.6);
    transition: background 0.2s ease;
  }

  .stat-reactions {
    color: #dc2626;
    background: rgba(254, 242, 242, 0.9);
    border-color: rgba(254, 202, 202, 0.5);
  }

  .stat-media {
    color: #0ea5e9;
    background: rgba(224, 242, 254, 0.8);
    border-color: rgba(125, 211, 252, 0.6);
  }

  .stat-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .stat-number {
    font-weight: 600;
    min-width: 1.5rem;
    text-align: center;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(203, 213, 225, 0.6);
    background: rgba(255, 255, 255, 0.9);
    color: #334155;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-icon {
    width: 1rem;
    height: 1rem;
  }

  .share-button:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .report-button:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  /* Load More Section */
  .load-more-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .load-more-info {
    text-align: center;
  }

  .load-more-text {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }

  .load-more-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 2rem;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    border: 1px solid rgba(37, 99, 235, 0.3);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    cursor: pointer;
    min-width: 160px;
    justify-content: center;
  }

  .load-more-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  }

  .load-more-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .load-more-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .load-more-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
  }

  .load-more-button:hover:not(:disabled) .load-more-icon {
    transform: translateY(2px);
  }

  /* End of Results */
  .end-of-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    text-align: center;
  }

  .end-of-results-icon {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .end-of-results-text {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .end-of-results-count {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  @media (min-width: 640px) {
    .search-filter-controls {
      flex-direction: row;
      gap: 1.5rem;
    }

    /* .rtl .search-filter-controls {
      flex-direction: row-reverse;
    } */

    .search-input-group {
      flex: 2;
    }

    .filter-controls {
      flex: 1;
      justify-content: flex-start;
    }

    .rtl .filter-controls {
      justify-content: flex-end;
    }

    .results-summary {
      flex-direction: row;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .content-stats {
      justify-content: center;
    }

    .tags-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .rtl .tags-header {
      align-items: flex-end;
    }

    .tags-actions {
      flex-direction: column;
      gap: 0.5rem;
    }

    .content-tags-container {
      gap: 0.5rem;
    }

    .selected-tags-header {
      margin-bottom: 0.5rem;
    }

    .search-filter-controls {
      gap: 1rem;
    }

    .filter-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .rtl .filter-controls {
      flex-direction: column;
    }

    .filter-group {
      min-width: auto;
    }

    .results-summary {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }

    .rtl .results-summary {
      align-items: flex-end;
    }

    .content-card {
      padding: 1rem;
      gap: 0.75rem;
    }

    .card-avatar .avatar-fallback,
    .card-avatar .avatar-unknown {
      width: 2.5rem;
      height: 2.5rem;
    }

    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .rtl .card-header {
      align-items: flex-end;
    }

    .card-stats {
      flex-direction: column;
      gap: 0.75rem;
      align-items: stretch;
    }

    .stats-left {
      justify-content: space-between;
    }

    .stats-right {
      justify-content: center;
    }

    .load-more-button {
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
    }
  }
</style>
