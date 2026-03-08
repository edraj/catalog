<script lang="ts">
  import { _ } from "@/i18n";
  import { marked } from "marked";
  import { mangle } from "marked-mangle";
  import { gfmHeadingId } from "marked-gfm-heading-id";
  import { getPostContent } from "@/lib/utils/postUtils";

  import { getSpaceSchema } from "@/lib/dmart_services/dmart_services";
  import DynamicSchemaBasedForms from "@/components/forms/DynamicSchemaBasedForms.svelte";

  marked.use(mangle());
  marked.use(
    gfmHeadingId({
      prefix: "my-prefix-",
    }),
  );

  let { postData, spaceName = "" } = $props();

  let schema: any = $state(null);
  let isLoadingSchema = $state(false);

  $effect(() => {
    if (postData?.payload?.content_type === "json") {
      if (postData?.payload?.schema_shortname && spaceName) {
        loadSchema(postData.payload.schema_shortname);
      } else if (typeof postData.payload.body === "object" && postData.payload.body !== null && !Array.isArray(postData.payload.body)) {
        schema = generateSimpleSchema(postData.payload.body);
      } else {
        schema = null;
      }
    } else {
      schema = null;
    }
  });

  function generateSimpleSchema(data: any): any {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return null;
    }

    const properties: any = {};
    for (const [key, value] of Object.entries(data)) {
      let type = "string";
      if (typeof value === "number") type = "number";
      else if (typeof value === "boolean") type = "boolean";
      else if (Array.isArray(value)) type = "array";
      else if (typeof value === "object" && value !== null) type = "object";

      properties[key] = {
        type,
        title: key
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
      };
    }

    return {
      type: "object",
      properties,
    };
  }

  async function loadSchema(schemaShortname: string) {
    if (schema && schema.shortname === schemaShortname) return;
    
    isLoadingSchema = true;
    try {
      const response = await getSpaceSchema(spaceName, "", schemaShortname);
      if (response?.status === "success" && response?.records && response.records.length > 0) {
        const record = response.records.find((r: any) => r.shortname === schemaShortname) || response.records[0];
        schema = record.attributes?.payload?.body;
      } else if (typeof postData?.payload?.body === "object" && postData?.payload?.body !== null) {
        // Fallback to auto-generated schema if fetch fails
        schema = generateSimpleSchema(postData.payload.body);
      }
    } catch (err) {
      console.error("Error loading schema for PostContent:", err);
      if (typeof postData?.payload?.body === "object" && postData?.payload?.body !== null) {
        schema = generateSimpleSchema(postData.payload.body);
      }
    } finally {
      isLoadingSchema = false;
    }
  }

  function renderContent(postData: any): string {
    if (!postData?.payload?.body) {
      return "";
    }

    const contentType = postData.payload.content_type;
    const body = postData.payload.body;

    if (contentType === "html") {
      return body;
    } else if (contentType === "json") {
      if (typeof body === "object" && body !== null) {
        return `<pre class="bg-gray-50 rounded-xl p-4 text-sm overflow-x-auto text-gray-700 leading-relaxed">${JSON.stringify(body, null, 2)}</pre>`;
      } else {
        return body;
      }
    } else {
      // By default, parse string body as Markdown (covers "markdown", "md", or missing type)
      if (typeof body === "string") {
        return marked.parse(body) as string;
      }
      // Fallback for unexpected non-string bodies without a known type
      return `<pre class="bg-gray-50 rounded-xl p-4 text-sm whitespace-pre-wrap text-gray-700">${JSON.stringify(body)}</pre>`;
    }
  }
</script>

{#if getPostContent(postData)}
  <section class="content-section mx-6 my-4">

    <div class="post-content">
      <div class="content-text">
        <div class="content-display bg-white p-6">
          <div class="markdown-preview">
            {#if postData?.payload?.content_type === "json" && schema}
              <DynamicSchemaBasedForms content={postData.payload.body} {schema} readOnly={true} />
            {:else if isLoadingSchema}
               <div class="flex justify-center p-4">
                 <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
               </div>
            {:else}
              {@html renderContent(postData)}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  .markdown-preview {
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
    background: white;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    line-height: 1.6;
    color: #374151;
  }

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
  .markdown-preview :global(h1) {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem 0;
    color: #1f2937;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .markdown-preview :global(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: #1f2937;
  }

  .markdown-preview :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: #1f2937;
  }

  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    color: #1e293b;
    font-weight: 600;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .markdown-preview :global(p) {
    margin: 0.75rem 0;
  }

  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .markdown-preview :global(ul) {
    list-style-type: disc;
  }

  .markdown-preview :global(ol) {
    list-style-type: decimal;
  }

  .markdown-preview :global(li) {
    margin: 0.25rem 0;
  }

  .markdown-preview :global(code) {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
  }

  .markdown-preview :global(pre) {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .markdown-preview :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  .markdown-preview :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    text-align: left;
  }

  .markdown-preview :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  .markdown-preview :global(strong) {
    font-weight: 600;
  }

  .markdown-preview :global(em) {
    font-style: italic;
  }

  .markdown-preview :global(del) {
    text-decoration: line-through;
  }

  .markdown-preview :global(a) {
    color: #3b82f6;
    text-decoration: underline;
  }

  .markdown-preview :global(blockquote) {
    border-left: 4px solid #3b82f6;
    padding-left: 1rem;
    margin: 1.5rem 0;
    font-style: italic;
    color: #64748b;
  }

  .markdown-preview :global(br) {
    margin-bottom: 0.5rem;
  }
</style>
