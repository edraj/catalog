<script lang="ts">
    import {_} from "@/i18n";
    import type {Breadcrumb} from "@/lib/utils/postUtils";

    export let breadcrumbs: Breadcrumb[];
  export let onNavigate: (path: string) => void;
  export let onGoBack: () => void;
</script>

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
                onclick={() => onNavigate(crumb.path)}
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

    <button aria-label="Go back" onclick={onGoBack} class="back-button">
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

<style>
  .page-header {
    background: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 16px 0;
    margin-bottom: 24px;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .breadcrumbs {
    flex: 1;
    min-width: 0;
  }

  .breadcrumb-list {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    flex-wrap: wrap;
  }

  .breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .breadcrumb-separator {
    width: 16px;
    height: 16px;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .breadcrumb-link {
    background: none;
    border: none;
    color: #4f46e5;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;
    text-decoration: none;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breadcrumb-link:hover {
    background-color: #f3f4f6;
    color: #3730a3;
  }

  .breadcrumb-link:focus {
    outline: 2px solid #4f46e5;
    outline-offset: 2px;
  }

  .breadcrumb-current {
    color: #6b7280;
    font-size: 14px;
    font-weight: 600;
    padding: 4px 8px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #475569;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 8px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .back-button:hover {
    background-color: #f1f5f9;
    border-color: #cbd5e1;
    color: #334155;
  }

  .back-button:focus {
    outline: 2px solid #4f46e5;
    outline-offset: 2px;
  }

  .back-icon {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }

    .breadcrumbs {
      order: 2;
    }

    .back-button {
      order: 1;
      align-self: flex-start;
    }

    .breadcrumb-list {
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .breadcrumb-link,
    .breadcrumb-current {
      max-width: 100px;
    }
  }
</style>