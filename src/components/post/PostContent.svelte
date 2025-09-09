<script lang="ts">
  import { _ } from "@/i18n";
  import { marked } from "marked";
  import { getPostContent } from "@/lib/utils/postUtils";

  export let postData: any;

  function isHtmlContent(content: string): boolean {
    if (typeof content !== "string") return false;
    const htmlRegex = /<[^>]*>/;
    return htmlRegex.test(content);
  }

  function isMarkdownContent(content: string): boolean {
    if (typeof content !== "string") return false;
    const markdownPatterns = [
      /^#{1,6}\s+/m,
      /\*\*.*?\*\*/,
      /\*.*?\*/,
      /\[.*?\]\(.*?\)/,
      /^[-*+]\s+/m,
      /\`\`\`[\s\S]*?\`\`\`/,
    ];
    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  function isStructuredData(data: any): boolean {
    if (!data || typeof data !== "object") return false;
    const meaningfulKeys = Object.keys(data).filter(
      (key) => key !== "content" && data[key] && data[key].toString().trim()
    );
    return meaningfulKeys.length > 0;
  }

  function hasDirectContent(postData: any): boolean {
    return !!(
      postData?.payload?.body?.content ||
      (postData?.payload?.body && typeof postData.payload.body === "string")
    );
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
        {#if postData?.payload?.content_type === "html"}
          <div
            class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
          >
            {@html getPostContent(postData)}
          </div>
        {:else if postData?.payload?.content_type === "markdown"}
          <div
            class="markdown-content bg-white p-6 rounded-lg shadow-sm border"
          >
            <div
              class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
            >
              {@html marked(getPostContent(postData))}
            </div>
          </div>
        {:else if postData?.payload?.content_type === "json"}
          {#if hasDirectContent(postData) && isHtmlContent(getPostContent(postData))}
            <div
              class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
            >
              {@html getPostContent(postData)}
            </div>
          {:else if hasDirectContent(postData) && isMarkdownContent(getPostContent(postData))}
            <div
              class="markdown-content bg-white p-6 rounded-lg shadow-sm border"
            >
              <div
                class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
              >
                {@html marked(getPostContent(postData))}
              </div>
            </div>
          {:else if isStructuredData(postData.payload.body)}
            <div
              class="structured-content bg-white rounded-lg shadow-sm border p-6"
            >
              <h4 class="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
                Content Details
              </h4>
              {#each Object.entries(postData.payload.body) as [key, value]}
                {#if key !== "content" && value}
                  <div class="mb-3 flex flex-wrap">
                    <span
                      class="font-semibold text-gray-700 capitalize min-w-24"
                      >{key.replace(/_/g, " ")}:</span
                    >
                    <span class="ml-3 text-gray-600 flex-1">{value}</span>
                  </div>
                {/if}
              {/each}

              {#if postData.payload.body.content}
                <div class="mt-6 pt-4 border-t">
                  <span class="font-semibold text-gray-700 block mb-3"
                    >Content:</span
                  >
                  <div
                    class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800"
                  >
                    {@html postData.payload.body.content}
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Fallback for simple structured data display -->
            <div class="bg-white p-6 rounded-lg shadow-sm border">
              <div
                class="whitespace-pre-wrap leading-relaxed text-gray-700 text-base font-mono"
              >
                {getPostContent(postData)}
              </div>
            </div>
          {/if}
        {:else if getPostContent(postData) && (getPostContent(postData).includes("#") || getPostContent(postData).includes("*") || getPostContent(postData).includes("_"))}
          <div
            class="markdown-content bg-white p-6 rounded-lg shadow-sm border"
          >
            <div
              class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
            >
              {@html marked(getPostContent(postData))}
            </div>
          </div>
        {:else}
          <div class="bg-white p-6 rounded-lg shadow-sm border">
            <div
              class="whitespace-pre-wrap leading-relaxed text-gray-700 text-base"
            >
              {getPostContent(postData)}
            </div>
          </div>
        {/if}
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

  .structured-content {
    line-height: 1.6;
  }

  .markdown-content {
    font-feature-settings:
      "kern" 1,
      "liga" 1;
  }
</style>
