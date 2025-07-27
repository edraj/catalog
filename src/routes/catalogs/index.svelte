<script lang="ts">
  import { onMount } from "svelte";
  import { getSpaces } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { derived } from "svelte/store";
  $goto;

  let isLoading = $state(true);
  let spaces = $state([]);
  let filteredSpaces = $state([]);
  let error = $state(null);
  let searchQuery = $state("");
  let sortBy = $state("name");
  let filterActive = $state("all");

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  onMount(async () => {
    try {
      const response = await getSpaces(false, "public");
      spaces = response.records || [];
      filteredSpaces = spaces;
    } catch (err) {
      console.error("Error fetching spaces:", err);
      error = $_("error.failed_load_catalogs");
    } finally {
      isLoading = false;
    }
  });

  function handleSpaceClick(space: any) {
    $goto("/catalogs/[space_name]", {
      space_name: space.shortname,
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
    return space.shortname || $_("common.unnamed_space");
  }

  function getDescription(space: any): string {
    const description = space.attributes?.description;
    if (description) {
      return (
        description[$locale] ||
        description.en ||
        description.ar ||
        $_("common.no_description")
      );
    }
    return $_("common.no_description");
  }

  function formatDate(dateString: string): string {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function applyFilters() {
    let filtered = spaces;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (space) =>
          getDisplayName(space).toLowerCase().includes(query) ||
          getDescription(space).toLowerCase().includes(query) ||
          space.shortname.toLowerCase().includes(query)
      );
    }

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

  $effect(() => {
    applyFilters();
  });
</script>

<div class="catalog-page" class:rtl={$isRTL}>
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          {$_("catalogs.explore_title")}
        </h1>
        <p class="hero-description">
          {$_("catalogs.explore_description")}
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
          placeholder="Search Spaces..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>

      <div class="filters">
        <select bind:value={sortBy} class="filter-select">
          <option value="name">Sort by name</option>
          <option value="created">Sort by created</option>
          <option value="updated">Sort by updated</option>
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
        <h3 class="error-title">{$_("error.loading_catalogs_title")}</h3>
        <p class="error-message">{error}</p>
      </div>
    {:else if filteredSpaces.length === 0}
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
        <h3 class="empty-title">
          {searchQuery
            ? $_("catalogs.no_results_title")
            : $_("catalogs.no_catalogs_title")}
        </h3>
        <p class="empty-message">
          {searchQuery
            ? $_("catalogs.no_results_description")
            : $_("catalogs.no_catalogs_description")}
        </p>
      </div>
    {:else}
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
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
                  {$_("actions.visit")}
                </a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
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

  .spaces-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
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
  }
</style>
