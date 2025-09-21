<script lang="ts">
  import { _ } from "@/i18n";
  import { marked } from "marked";
  import { mangle } from "marked-mangle";
  import { gfmHeadingId } from "marked-gfm-heading-id";
  import { getPostContent } from "@/lib/utils/postUtils";

  marked.use(mangle());
  marked.use(
    gfmHeadingId({
      prefix: "my-prefix-",
    })
  );

  export let postData: any;

  function renderContent(postData: any): string {
    if (!postData?.payload?.body) {
      return "";
    }

    const contentType = postData.payload.content_type;
    const body = postData.payload.body;

    if (contentType === "html") {
      if (typeof body === "string" && body.includes("#")) {
        return marked.parse(body);
      }
      return body;
    } else if (contentType === "json") {
      if (typeof body === "object") {
        return Object.entries(body)
          .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
          .join("<br>");
      } else {
        return body;
      }
    }
  }
</script>

{#if getPostContent(postData)}
  <section class="content-section mx-6 my-4">
    <h3 class="content-title">
      <span class="title-accent"></span>
      {$_("post_detail.sections.content")}
    </h3>

    <div class="post-content">
      <div class="content-text my-4 mx-6">
        <div class="content-display bg-white p-6 rounded-lg shadow-sm border">
          <div
            class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-ul:list-disc prose-ol:list-decimal prose-li:mb-1"
          >
            {@html renderContent(postData)}
          </div>
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  .content-section {
    margin-bottom: 32px;
  }

  .content-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 20px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e5e7eb;
  }

  .title-accent {
    width: 4px;
    height: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 2px;
  }

  .post-content {
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .content-text {
    padding: 0;
  }

  :global(.content-text .prose) {
    max-width: none;
  }

  :global(.content-text pre) {
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* Enhanced markdown styles */
  .post-content :global(ul),
  .post-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .post-content :global(li) {
    margin: 0.25rem 0;
  }

  .post-content :global(code) {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
  }

  .post-content :global(pre) {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .post-content :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  .post-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  .post-content :global(th),
  .post-content :global(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    text-align: left;
  }

  .post-content :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  .post-content :global(strong) {
    font-weight: 600;
  }

  .post-content :global(em) {
    font-style: italic;
  }

  .post-content :global(del) {
    text-decoration: line-through;
  }

  /* JSON content styles */
  .post-content :global(br) {
    margin-bottom: 0.5rem;
  }

  .post-content {
    margin-bottom: 2rem;
    line-height: 1.7;
    color: #374151;
  }

  .post-content :global(h1),
  .post-content :global(h2),
  .post-content :global(h3),
  .post-content :global(h4),
  .post-content :global(h5),
  .post-content :global(h6) {
    color: #1e293b;
    font-weight: 600;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .post-content :global(p) {
    margin-bottom: 1.25rem;
  }

  .post-content :global(a) {
    color: #3b82f6;
    text-decoration: underline;
  }

  .post-content :global(blockquote) {
    border-left: 4px solid #3b82f6;
    padding-left: 1rem;
    margin: 1.5rem 0;
    font-style: italic;
    color: #64748b;
  }
</style>
