<script lang="ts">
  import { _ } from "@/i18n";
  import { getPostTitle, formatDate } from "@/lib/utils/postUtils";
  
  export let postData: any;
  export let locale: string;
  export let isOwner: boolean;
</script>

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
        <div class="meta-item">
          <span class="meta-label">{$_("post_detail.meta.created")}</span>
          <span class="meta-value">
            {formatDate(postData.created_at, locale, $_("common.not_available"))}
          </span>
        </div>
        <div class="meta-item">
          <span class="meta-label">{$_("post_detail.meta.updated")}</span>
          <span class="meta-value">
            {formatDate(postData.updated_at, locale, $_("common.not_available"))}
          </span>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-item">
          <span class="meta-label">{$_("post_detail.meta.owner")}</span>
          <span class="meta-value">{postData.owner_shortname}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">{$_("post_detail.meta.uuid")}</span>
          <span class="meta-value uuid-text">{postData.uuid}</span>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-item">
          <span class="meta-label">{$_("post_detail.meta.resource_type")}</span>
          <span class="meta-value">{postData.resource_type}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">{$_("post_detail.meta.subpath")}</span>
          <span class="meta-value">{postData.subpath}</span>
        </div>
      </div>
    </div>
  </div>
</header>

<style>
  .post-header {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    margin-bottom: 24px;
  }

  .post-title-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .post-icon {
    font-size: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .post-title-content {
    flex: 1;
  }

  .post-title {
    font-size: 28px;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 12px 0;
    line-height: 1.2;
  }

  .post-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-primary {
    background-color: #ddd6fe;
    color: #5b21b6;
  }

  .badge-success {
    background-color: #dcfce7;
    color: #166534;
  }

  .badge-error {
    background-color: #fecaca;
    color: #dc2626;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-active {
    background-color: #22c55e;
  }

  .status-inactive {
    background-color: #ef4444;
  }

  .meta-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 768px) {
    .meta-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .meta-value {
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
  }

  .uuid-text {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    word-break: break-all;
  }
</style>