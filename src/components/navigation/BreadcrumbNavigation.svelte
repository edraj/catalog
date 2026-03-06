<script lang="ts">
  import { _ } from "@/i18n";
  import type { Breadcrumb } from "@/lib/utils/postUtils";

  export let breadcrumbs: Breadcrumb[];
  export let onNavigate: (path: string) => void;
  export let onGoBack: () => void;

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  $: parentCrumb =
    breadcrumbs && breadcrumbs.length > 1
      ? breadcrumbs[breadcrumbs.length - 2]
      : null;
</script>

<header class="page-header">
  <div class="header-content">
    <button aria-label="Go back" onclick={onGoBack} class="back-button">
      <svg
        class="back-icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      <span
        >{$_("common.back_to", { default: "Back to" })}
        {parentCrumb
          ? parentCrumb.name
          : $_("common.list", { default: "List" })}</span
      >
    </button>

    <button aria-label="Copy link" onclick={copyLink} class="copy-link-btn">
      <svg
        class="link-icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <span>{$_("common.copy_link", { default: "Copy link" })}</span>
    </button>
  </div>
</header>

<style>
  .page-header {
    background: transparent;
    padding: 16px 0;
    margin-bottom: 24px;
    max-width: 80rem;
    margin: 0 auto;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    padding: 0;
    transition: color 0.2s ease;
  }

  .back-button:hover {
    color: #0f172a;
  }

  .back-icon {
    width: 16px;
    height: 16px;
  }

  .copy-link-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: #f1f5f9;
    border: none;
    border-radius: 9999px;
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .copy-link-btn:hover {
    background-color: #e2e8f0;
  }

  .link-icon {
    width: 14px;
    height: 14px;
  }
</style>
