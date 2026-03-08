<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params } from "@roxi/routify";
  import {
    getAvatar,
    getEntityAttachmentsCount,
    getSpaceContentsByTags,
    getSpaceTags,
    searchInCatalog,
  } from "@/lib/dmart_services/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import Avatar from "@/components/Avatar.svelte";
  import ReportModal from "@/components/ReportModal.svelte";
  import { derived } from "svelte/store";
  import { formatNumberInText } from "@/lib/helpers";
  import { Dmart, QueryType, SortyType } from "@edraj/tsdmart";

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

  let showReportModal = $state(false);
  let reportItem = $state(null);
  let subpath = $state("/");

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
    ($locale) => $locale === "ar" || $locale === "ku",
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
          tags,
        );
      } else {
        response = await Dmart.query(
          {
            type: QueryType.search,
            space_name: spaceName,
            subpath: subpath,
            search: "-@shortname:schema -@resource_type:folder|schema",
            limit: itemsPerLoad,
            sort_by: "shortname",
            sort_type: SortyType.ascending,
            offset: currentOffset,
            retrieve_json_payload: true,
            retrieve_attachments: true,
            exact_subpath: false,
          },
          "public",
        );
      }
      totalItemsCount = response?.attributes?.total || 0;

      if (!response || !response.records) {
        if (reset) {
          if (isTagFiltered) {
            tagFilteredContents = [];
            tagFilteredHasMore = false;
          } else {
            allContents = [];
            availableContentTags = [];
            hasMoreItems = false;
          }
        }
        return;
      }

      const basicItems = response.records.map((item) => ({
        ...item,
        owner_avatar: null,
        reactionCount: null,
        commentCount: null,
        mediaCount: null,
        reportCount: null,
        shareCount: null,
        contentTags: [],
        title:
          item.attributes?.displayname?.[$locale] ||
          item.attributes?.displayname?.en ||
          item.attributes?.displayname?.ar ||
          item.attributes?.payload?.body?.title ||
          item.shortname,
        folderPath: item.subpath || "/",
        folderName: getFolderNameFromPath(item.subpath || "/"),
        isLoading: true,
      }));

      if (reset) {
        if (isTagFiltered) {
          tagFilteredContents = basicItems;
          tagFilteredHasMore = basicItems.length === itemsPerLoad;
        } else {
          allContents = basicItems;
          extractContentTags(basicItems);
        }
      } else {
        if (isTagFiltered) {
          tagFilteredContents = [...tagFilteredContents, ...basicItems];
          tagFilteredHasMore = basicItems.length === itemsPerLoad;
        } else {
          allContents = [...allContents, ...basicItems];
          extractContentTags(basicItems, false);
        }
      }

      applyFiltersAndSort();

      enhanceItemsAsync(basicItems);

      if (isTagFiltered) {
        tagFilteredOffset += itemsPerLoad;
      } else {
        currentOffset += itemsPerLoad;
        hasMoreItems = basicItems.length === itemsPerLoad;
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

      const basicSearchResults = results.map((item) => ({
        ...item,
        owner_avatar: null,
        reactionCount: null,
        commentCount: null,
        mediaCount: null,
        reportCount: null,
        shareCount: null,
        contentTags: [],
        title:
          item.attributes?.displayname?.[$locale] ||
          item.attributes?.displayname?.en ||
          item.attributes?.displayname?.ar ||
          item.attributes?.payload?.body?.title ||
          item.shortname,
        folderPath: item.subpath || "/",
        folderName: getFolderNameFromPath(item.subpath || "/"),
        isLoading: true,
      }));

      searchResults = basicSearchResults;

      enhanceSearchResultsAsync(basicSearchResults);

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
          item.subpath || "/",
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

  async function enhanceItemsAsync(items) {
    for (const item of items) {
      try {
        const [avatar, attachmentCounts] = await Promise.all([
          getAvatar(item.attributes?.owner_shortname || item.shortname),
          getEntityAttachmentsCount(
            item.shortname,
            spaceName,
            item.subpath || "/",
          ),
        ]);

        const attachmentData = attachmentCounts?.[0]?.attributes || {};
        const contentTags = extractItemTags(item);

        const enhancedData = {
          owner_avatar: avatar,
          reactionCount: attachmentData.reaction || 0,
          commentCount: attachmentData.comment || 0,
          mediaCount: attachmentData.media || 0,
          reportCount: attachmentData.report || 0,
          shareCount: attachmentData.share || 0,
          contentTags: contentTags,
          isLoading: false,
        };

        updateItemInArray(allContents, item.shortname, enhancedData);
        updateItemInArray(tagFilteredContents, item.shortname, enhancedData);

        allContents = allContents;
        tagFilteredContents = tagFilteredContents;
        applyFiltersAndSort();
      } catch (error) {
        console.warn(`Error enhancing item ${item.shortname}:`, error);
        updateItemInArray(allContents, item.shortname, { isLoading: false });
        updateItemInArray(tagFilteredContents, item.shortname, {
          isLoading: false,
        });
        allContents = allContents;
        tagFilteredContents = tagFilteredContents;
      }
    }
  }

  function updateItemInArray(array, shortname, updates) {
    const index = array.findIndex((item) => item.shortname === shortname);
    if (index !== -1) {
      array[index] = { ...array[index], ...updates };
    }
  }

  async function enhanceSearchResultsAsync(items) {
    for (const item of items) {
      try {
        const [avatar, attachmentCounts] = await Promise.all([
          getAvatar(item.attributes?.owner_shortname || item.shortname),
          getEntityAttachmentsCount(
            item.shortname,
            spaceName,
            item.subpath || "/",
          ),
        ]);

        const attachmentData = attachmentCounts?.[0]?.attributes || {};
        const contentTags = extractItemTags(item);

        const enhancedData = {
          owner_avatar: avatar,
          reactionCount: attachmentData.reaction || 0,
          commentCount: attachmentData.comment || 0,
          mediaCount: attachmentData.media || 0,
          reportCount: attachmentData.report || 0,
          shareCount: attachmentData.share || 0,
          contentTags: contentTags,
          isLoading: false,
        };

        updateItemInArray(searchResults, item.shortname, enhancedData);

        searchResults = searchResults;
      } catch (error) {
        console.warn(`Error enhancing search item ${item.shortname}:`, error);
        updateItemInArray(searchResults, item.shortname, { isLoading: false });
        searchResults = searchResults;
      }
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
            item.attributes?.tags.includes(selectedTag),
          ),
        );
      }
    }

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
    if (!dateString) return $_("common.unknown");
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return $_("catalog_contents.time.just_now");
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)}${$_("catalog_contents.time.minutes_ago")}`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}${$_("catalog_contents.time.hours_ago")}`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}${$_("catalog_contents.time.days_ago")}`;
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
  function openReportModal(item) {
    reportItem = item;
    subpath = item.subpath || "/";
    showReportModal = true;
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
      return $_("space.showing_tagged_content", {
        values: { tags: selectedContentTags.join(", ") },
      });
    }
    return $_("space.showing_all_content");
  });

  $effect(() => {
    if (!searchQuery.trim()) {
      searchResults = [];
      applyFiltersAndSort();
    }
  });
</script>

<div class="z" class:rtl={$isRTL}>
  <!-- Hero Section -->
  <div class="space-hero">
    <div class="hero-content container mx-auto px-4 max-w-7xl">
      <button
        aria-label={$_("navigation.go_back")}
        onclick={goBack}
        class="back-circle-btn"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <div class="hero-main">
        <div class="space-identity">
          <div class="space-icon-badge">
            <svg viewBox="0 0 24 24" fill="none" class="w-8 h-8 text-blue-500">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="currentColor" />
            </svg>
          </div>
          <div class="space-text-content">
            <h1 class="space-title">{spaceName}</h1>
            <p class="space-description">
              {$_("space.all_content_subtitle")}
            </p>
          </div>
        </div>
        <button class="new-post-btn">
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          {$_("space.new_post")}
        </button>
      </div>

      <!-- Stats Bar -->
      <div class="hero-stats-bar">
        <div class="stat-group">
          <span class="stat-icon docs-icon">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fill-rule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <strong
            >{formatNumberInText(
              totalItemsCount || totalDisplayed,
              $locale,
            )}</strong
          >
          <span class="stat-label">{$_("space.stats.posts")}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-group">
          <span class="stat-icon tags-icon">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <strong
            >{formatNumberInText(availableContentTags.length, $locale)}</strong
          >
          <span class="stat-label">{$_("space.stats.tags")}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="main-content container mx-auto px-4 py-8 max-w-[1000px]">
    {#if isLoading && isInitialLoad}
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
            />
          </svg>
        </div>
        <h3 class="error-title">{$_("catalog_contents.error.title")}</h3>
        <p class="error-message">{error}</p>
        <button
          aria-label={`Retry`}
          onclick={() => loadContents(true)}
          class="retry-button"
        >
          {$_("catalog_contents.error.try_again")}
        </button>
      </div>
    {:else}
      <!-- Filter by Tag -->
      {#if availableContentTags.length > 0 && !searchQuery.trim()}
        <div class="tags-section">
          <div class="tags-label">
            <svg
              class="w-4 h-4 mr-1 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            {$_("space.filter_by_tag_label")}
          </div>
          <div class="tag-pills">
            {#each displayedTags as tag}
              <button
                onclick={() => toggleContentTag(tag)}
                class="tag-pill {selectedContentTags.includes(tag)
                  ? 'tag-pill-active'
                  : ''}"
              >
                <div
                  class="bullet {selectedContentTags.includes(tag)
                    ? 'bullet-active'
                    : ''}"
                ></div>
                <span>{tag}</span>
                <span class="tag-count">{tagCounts[tag] || 0}</span>
              </button>
            {/each}
            {#if availableContentTags.length > 12}
              <button
                onclick={() => (showAllTags = !showAllTags)}
                class="tag-pill text-blue-600"
              >
                {showAllTags
                  ? $_("space.show_less_tags")
                  : $_("space.show_all_tags")}
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Search and Sort Bar -->
      <div class="search-sort-bar">
        <div class="search-input-wrapper">
          <svg
            class="search-icon w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={$_("space.search_posts_placeholder")}
            oninput={handleSearchInput}
            class="space-search-input"
          />
          {#if isSearching}
            <div class="search-loading">
              <Diamonds color="#9ca3af" size="20" unit="px" />
            </div>
          {/if}
          {#if searchQuery}
            <button
              onclick={() => {
                searchQuery = "";
                searchResults = [];
                applyFiltersAndSort();
              }}
              class="clear-search-btn"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                /></svg
              >
            </button>
          {/if}
        </div>

        <div class="sort-dropdown">
          <svg
            class="w-4 h-4 text-gray-500 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
          <select
            bind:value={sortBy}
            onchange={() => {
              if (searchQuery.trim()) performSearch(searchQuery);
              else applyFiltersAndSort();
            }}
            class="sort-select"
          >
            {#each sortOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Showing Count and Live Indicator -->
      {#if !searchQuery.trim() && displayedContents.length > 0}
        <div class="showing-status">
          <span class="showing-text">
            {@html $_("space.showing_posts", {
              values: {
                displayed: `<strong>${totalDisplayed}</strong>`,
                total: totalFiltered,
              },
            })}
          </span>
          <div class="live-indicator">
            <span class="live-dot"></span>
            {$_("catalogs.live")}
          </div>
        </div>
      {:else if searchQuery.trim()}
        <div class="showing-status">
          <span class="showing-text">
            {@html $_("space.search_results_count", {
              values: { count: searchResults.length, query: searchQuery },
            })}
          </span>
        </div>
      {/if}

      <!-- Post Cards List -->
      {#if totalDisplayed > 0}
        <div class="post-list">
          {#each displayedContents as item}
            <div
              class="post-card"
              onclick={() => handleItemClick(item)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleItemClick(item);
              }}
            >
              <!-- Card Header -->
              <div class="post-header">
                <div class="post-author-info">
                  <div class="author-avatar-area">
                    {#if item.owner_avatar}
                      <Avatar
                        src={item.owner_avatar}
                        size="40"
                        alt={item.attributes?.owner_shortname ||
                          $_("resource_type.user")}
                      />
                    {:else if item.attributes?.owner_shortname}
                      <div class="avatar-fallback-sm">
                        {item.attributes.owner_shortname
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    {:else}
                      <div class="avatar-unknown-sm">?</div>
                    {/if}
                  </div>
                  <div class="author-meta">
                    <div class="author-name-row">
                      <span class="author-name"
                        >{item.attributes?.owner_shortname ||
                          $_("space.unknown_user")}</span
                      >
                      <span class="author-handle"
                        >@{item.attributes?.owner_shortname?.toLowerCase() ||
                          $_("space.unknown_handle")}</span
                      >
                    </div>
                    <div class="post-time-row">
                      <span class="post-time"
                        >{formatRelativeTime(item.attributes?.created_at)}</span
                      >
                      <span class="dot-separator">•</span>
                      <span class="post-category text-blue-500"
                        >{item.folderName !== $_("catalogs.root_folder")
                          ? item.folderName
                          : $_("space.general")}</span
                      >
                    </div>
                  </div>
                </div>

                <div class="post-actions-right">
                  {#if (item.reactionCount || 0) > 5 || (item.commentCount || 0) > 2}
                    <div class="hot-badge">
                      <svg
                        class="w-3 h-3 text-orange-500 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      {$_("space.hot")}
                    </div>
                  {/if}
                  <button
                    class="more-options-btn"
                    onclick={(e) => {
                      e.stopPropagation();
                      openReportModal(item);
                    }}
                  >
                    <svg
                      class="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Card Body -->
              <div class="post-body">
                <h3 class="post-title">{item.title}</h3>

                <!-- Post Tags -->
                {#if item.attributes?.tags && item.attributes.tags.length > 0}
                  <div class="post-card-tags">
                    {#each item.attributes.tags.slice(0, 3) as tag}
                      <span
                        class="post-tag-pill"
                        onclick={(e) => {
                          e.stopPropagation();
                          toggleContentTag(tag);
                        }}>#{tag}</span
                      >
                    {/each}
                    {#if item.attributes.tags.length > 3}
                      <span class="post-tag-pill bg-gray-100 text-gray-600"
                        >+{item.attributes.tags.length - 3}</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Card Footer -->
              <div class="post-footer">
                <div class="engagement-buttons">
                  <!-- Comments -->
                  <div class="engagement-btn">
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
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    {item.isLoading
                      ? "-"
                      : formatNumberInText(item.commentCount, $locale) || 0}
                    <svg
                      class="w-4 h-4 ml-1 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  <!-- Reactions -->
                  <div class="engagement-btn">
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
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    {item.isLoading
                      ? "-"
                      : formatNumberInText(item.reactionCount, $locale) || 0}
                  </div>

                  <!-- Bookmarks (mapped to mediaCount or shareCount for visual parity) -->
                  <div class="engagement-btn">
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
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    {item.isLoading
                      ? "-"
                      : formatNumberInText(
                          item.mediaCount || item.shareCount || 0,
                          $locale,
                        ) || 0}
                  </div>
                </div>

                <button
                  class="share-action-btn"
                  onclick={(e) => {
                    e.stopPropagation();
                    shareItem(item);
                  }}
                  title={$_("catalog_contents.card.share")}
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367 2.684z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>

        {#if hasMoreItems && !searchQuery.trim()}
          <div class="flex justify-center mt-6 mb-12">
            <button
              onclick={loadMoreItems}
              disabled={isLoadingMore}
              class="px-6 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center shadow-sm"
            >
              {#if isLoadingMore}
                <Diamonds color="#6b7280" size="16" unit="px" />
                <span class="ml-2"
                  >{$_("catalog_contents.pagination.loading")}</span
                >
              {:else}
                {$_("catalog_contents.pagination.load_more")} ({formatNumberInText(
                  itemsPerLoad,
                  $locale,
                )})
              {/if}
            </button>
          </div>
        {:else if displayedContents.length > 0}
          <div class="end-of-results">
            <div class="divider-line"></div>
            <span class="end-text">{$_("space.end_of_results")}</span>
            <div class="divider-line"></div>
          </div>
        {/if}
      {:else}
        <!-- Empty State -->
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
              />
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
              onclick={clearAllFilters}
              class="text-blue-600 hover:underline"
            >
              {$_("catalog_contents.filters.clear_all")}
            </button>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<ReportModal
  bind:isVisible={showReportModal}
  entryShortname={reportItem?.shortname || ""}
  entryTitle={reportItem?.title || ""}
  {spaceName}
  {subpath}
  on:close={() => {
    showReportModal = false;
    reportItem = null;
  }}
  on:reportSubmitted={() => {
    showReportModal = false;
    reportItem = null;
  }}
/>

<style>
  .space-page-container {
    min-height: 100vh;
    background-color: #f9fafb; /* Light gray background for the page body */
    font-family:
      "Inter",
      -apple-system,
      sans-serif;
  }

  .rtl {
    direction: rtl;
  }

  /* --- Hero Banner --- */
  .space-hero {
    position: relative;
    padding: 60px 0 0 0;
    color: black !important;
  }

  /* Using a dark abstract background with a subtle overlay */
  .hero-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    background-size: cover;
    background-position: center;
    z-index: 1;
  }

  .hero-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.6) 0%,
      rgba(15, 23, 42, 0.9) 100%
    );
    z-index: 2;
  }

  .hero-content {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
  }

  .back-circle-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-circle-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .rtl .back-circle-btn svg {
    transform: rotate(180deg);
  }

  .hero-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 3rem;
  }

  .space-identity {
    display: flex;
    gap: 1.5rem;
  }

  .space-icon-badge {
    width: 64px;
    height: 64px;
    background: white;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .space-title {
    font-size: 2.25rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.02em;
  }

  .space-description {
    color: #94a3b8;
    font-size: 1.125rem;
    max-width: 600px;
    margin: 0;
    line-height: 1.5;
  }

  .new-post-btn {
    background: #3f83f8; /* Figma primary blue */
    color: white;
    font-weight: 500;
    padding: 0.75rem 1.5rem;
    border-radius: 9999px;
    border: none;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 0.95rem;
  }

  .new-post-btn:hover {
    background: #1c64f2;
  }

  /* Stats Bar inside Hero */
  .hero-stats-bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: white;
    width: fit-content;
    padding: 0.75rem 1.5rem;
    border-radius: 12px 12px 0 0; /* Attach to bottom of hero */
    margin: auto auto 0 auto;
    color: #4b5563;
    font-size: 0.875rem;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
    border-bottom: 1px solid #e5e7eb;
  }

  .stat-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-group strong {
    color: #111827;
    font-weight: 600;
  }

  .stat-label {
    color: #6b7280;
  }

  .stat-icon {
    display: inline-flex;
  }
  .docs-icon {
    color: #3f83f8;
  }
  .members-icon {
    color: #ec4899;
  }
  .tags-icon {
    color: #eab308;
  }

  .stat-divider {
    width: 1px;
    height: 16px;
    background-color: #e5e7eb;
  }

  .creator-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 0.5rem;
  }

  .creator-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ccfbf1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .online-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background-color: #10b981;
    border-radius: 50%;
    border: 2px solid white;
  }

  .creator-name {
    font-weight: 500;
    color: #374151;
  }

  /* --- Tag Filters --- */
  .tags-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .tags-label {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    color: #9ca3af;
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tag-pill:hover {
    background: #f3f4f6;
  }

  .tag-pill-active {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
  }

  .bullet {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #cbd5e1;
  }

  .bullet-active {
    background: #3f83f8;
  }

  .tag-count {
    color: #9ca3af;
    margin-left: 0.25rem;
  }

  .tag-pill-active .tag-count {
    color: #60a5fa;
  }

  /* --- Search and Sort Bar --- */
  .search-sort-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .search-input-wrapper {
    position: relative;
    flex: 1;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }

  .space-search-input {
    width: 100%;
    padding: 0.875rem 1.5rem 0.875rem 2.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 0.95rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .space-search-input:focus {
    outline: none;
    border-color: #3f83f8;
    box-shadow: 0 0 0 3px rgba(63, 131, 248, 0.1);
  }

  .clear-search-btn {
    position: absolute;
    right: 3rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
  }

  .clear-search-btn:hover {
    color: #4b5563;
  }

  .search-loading {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .sort-dropdown {
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 0 1rem;
    cursor: pointer;
  }

  .sort-select {
    appearance: none;
    background: transparent;
    border: none;
    font-size: 0.95rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    outline: none;
    padding-right: 1.5rem; /* space for custom dropdown arrow if needed */
  }

  /* --- Showing Status --- */
  .showing-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 0 0.5rem;
  }

  .showing-text {
    font-size: 0.875rem;
    color: #6b7280;
  }
  .showing-text strong {
    color: #111827;
  }

  .live-indicator {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #10b981; /* Success green */
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    background-color: #10b981;
    border-radius: 50%;
    margin-right: 0.375rem;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }
    70% {
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }

  /* --- Post Cards List --- */
  .post-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .post-card {
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    transition:
      transform 0.2s,
      box-shadow 0.2s;
    cursor: pointer;
  }

  .post-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .post-author-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar-fallback-sm {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e2e8f0;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }

  .avatar-unknown-sm {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }

  .author-meta {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .author-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .author-name {
    font-weight: 600;
    color: #111827;
    font-size: 0.95rem;
  }

  .author-handle {
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .post-time-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .dot-separator {
    color: #d1d5db;
  }

  .post-category {
    font-weight: 500;
    background: #eff6ff;
    padding: 0.1rem 0.5rem;
    border-radius: 4px;
  }

  .post-actions-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .hot-badge {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #ea580c;
    background: #ffedd5;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
  }

  .more-options-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .more-options-btn:hover {
    background: #f3f4f6;
  }

  .post-body {
    margin-bottom: 1.25rem;
    padding-left: 3.25rem; /* Align with text, not avatar */
  }

  .post-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
  }

  .post-description {
    color: #4b5563;
    font-size: 0.95rem;
    line-height: 1.5;
    margin-bottom: 1rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .post-card-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .post-tag-pill {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: #f0fdf4; /* Light green tint like Figma */
    color: #16a34a;
    font-weight: 500;
  }

  /* Make every second tag light blue for variety like Figma */
  .post-card-tags .post-tag-pill:nth-child(even) {
    background: #eff6ff;
    color: #2563eb;
  }

  .post-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-left: 3.25rem;
    border-top: 1px solid #f3f4f6;
    padding-top: 1rem;
  }

  .engagement-buttons {
    display: flex;
    gap: 1.5rem;
  }

  .engagement-btn {
    display: flex;
    align-items: center;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  /* Specific hover colors for engagement buttons */
  .engagement-btn:nth-child(1):hover {
    color: #3f83f8;
  } /* Comments area blue */
  .engagement-btn:nth-child(2):hover,
  .engagement-btn:nth-child(2):hover svg {
    color: #ec4899;
  } /* Likes pink */
  .engagement-btn:nth-child(3):hover,
  .engagement-btn:nth-child(3):hover svg {
    color: #eab308;
  } /* Bookmarks yellow */

  .share-action-btn {
    color: #9ca3af;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s;
  }

  .share-action-btn:hover {
    color: #4b5563;
  }

  /* --- End of results --- */
  .end-of-results {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 3rem 0;
    gap: 1rem;
  }

  .divider-line {
    height: 1px;
    background: #e5e7eb;
    width: 60px;
  }

  .end-text {
    color: #9ca3af;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* Fallback Empty State CSS (from original) */
  .empty-state {
    text-align: center;
    padding: 4rem 1rem;
  }
  .empty-icon {
    width: 64px;
    height: 64px;
    background: #f3f4f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem auto;
  }
  .empty-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }
  .empty-message {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .hero-main {
      flex-direction: column;
      gap: 1.5rem;
    }

    .hero-stats-bar {
      width: 100%;
      flex-wrap: wrap;
      justify-content: center;
    }

    .stat-divider {
      display: none;
    }

    .search-sort-bar {
      flex-direction: column;
    }

    .sort-dropdown {
      padding: 0.75rem 1rem;
    }

    .post-body,
    .post-footer {
      padding-left: 0;
    }
  }
</style>
