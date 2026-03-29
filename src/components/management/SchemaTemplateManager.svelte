<script lang="ts">
  import { _ } from "@/i18n";
  import { Button, Modal } from "flowbite-svelte";
  import { marked } from "marked";
  import { mangle } from "marked-mangle";
  import { gfmHeadingId } from "marked-gfm-heading-id";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import {
    FileCodeOutline,
    TrashBinOutline,
    PlusOutline,
    EyeOutline,
    CheckOutline,
    CloseOutline,
    PenOutline,
  } from "flowbite-svelte-icons";
  import { ResourceType, ContentType, RequestType } from "@edraj/tsdmart";
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import { Dmart } from "@edraj/tsdmart";

  marked.use(mangle());
  marked.use(
    gfmHeadingId({
      prefix: "schema-template-",
    })
  );

  interface Props {
    space_name: string;
    subpath: string;
    parent_shortname: string;
    templateAttachment: any | null;
    onTemplateUpdate: () => void;
  }

  let {
    space_name,
    subpath,
    parent_shortname,
    templateAttachment,
    onTemplateUpdate,
  }: Props = $props();

  let isEditing = $state(false);
  let isCreating = $state(false);
  let isDeleting = $state(false);
  let showPreview = $state(false);
  let templateContent = $state("");
  let editedContent = $state("");
  let isSaving = $state(false);

  // Initialize content from attachment
  $effect(() => {
    if (templateAttachment) {
      const body = templateAttachment.attributes?.payload?.body;
      if (typeof body === "string") {
        templateContent = body;
      } else if (typeof body === "object" && body !== null) {
        templateContent = body.content || body.body || JSON.stringify(body, null, 2);
      } else {
        templateContent = "";
      }
    } else {
      templateContent = "";
    }
  });

  function startEditing() {
    editedContent = templateContent;
    isEditing = true;
  }

  function startCreating() {
    editedContent = "# Template\n\nEnter your markdown template here...\n\nYou can use placeholders like {{field_name}} to reference schema fields.";
    isCreating = true;
  }

  function cancelEdit() {
    isEditing = false;
    isCreating = false;
    editedContent = "";
  }

  async function saveTemplate() {
    if (!editedContent.trim()) {
      errorToastMessage("Template content cannot be empty");
      return;
    }

    isSaving = true;

    try {
      // Clean subpath for upload
      let cleanSubpath = subpath.startsWith("/") ? subpath.substring(1) : subpath;
      if (cleanSubpath === "__root__" || cleanSubpath === "/") {
        cleanSubpath = "";
      }
      const targetSubpath = cleanSubpath
        ? `${cleanSubpath}/${parent_shortname}`
        : parent_shortname;

      if (isCreating) {
        // Create new template attachment
        const response = await Dmart.request({
          space_name,
          request_type: RequestType.create,
          records: [
            {
              resource_type: ResourceType.media,
              shortname: "template",
              subpath: targetSubpath,
              attributes: {
                is_active: true,
                payload: {
                  content_type: ContentType.markdown,
                  body: editedContent,
                },
              },
            },
          ],
        });

        if (response && response.status === "success") {
          successToastMessage("Template created successfully");
          isCreating = false;
          editedContent = "";
          onTemplateUpdate();
        } else {
          errorToastMessage("Failed to create template");
        }
      } else {
        // Update existing template attachment
        const response = await Dmart.request({
          space_name,
          request_type: RequestType.update,
          records: [
            {
              resource_type: ResourceType.media,
              shortname: "template",
              subpath: targetSubpath,
              attributes: {
                is_active: true,
                payload: {
                  content_type: ContentType.markdown,
                  body: editedContent,
                },
              },
            },
          ],
        });

        if (response && response.status === "success") {
          successToastMessage("Template updated successfully");
          isEditing = false;
          templateContent = editedContent;
          editedContent = "";
          onTemplateUpdate();
        } else {
          errorToastMessage("Failed to update template");
        }
      }
    } catch (error) {
      console.error("Error saving template:", error);
      errorToastMessage("Error saving template: " + (error.message || "Unknown error"));
    } finally {
      isSaving = false;
    }
  }

  async function deleteTemplate() {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    isDeleting = true;

    try {
      let cleanSubpath = subpath.startsWith("/") ? subpath.substring(1) : subpath;
      if (cleanSubpath === "__root__" || cleanSubpath === "/") {
        cleanSubpath = "";
      }
      const targetSubpath = cleanSubpath
        ? `${cleanSubpath}/${parent_shortname}`
        : parent_shortname;

      const response = await Dmart.request({
        space_name,
        request_type: RequestType.delete,
        records: [
          {
            resource_type: ResourceType.media,
            shortname: "template",
            subpath: targetSubpath,
            attributes: {},
          },
        ],
      });

      if (response && response.status === "success") {
        successToastMessage("Template deleted successfully");
        templateContent = "";
        onTemplateUpdate();
      } else {
        errorToastMessage("Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      errorToastMessage("Error deleting template: " + (error.message || "Unknown error"));
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="schema-template-manager">
  {#if !templateAttachment && !isCreating}
    <!-- No template exists - Show create button -->
    <div class="empty-template-state">
      <div class="empty-icon">
        <FileCodeOutline class="w-12 h-12 text-gray-400" />
      </div>
      <h3 class="empty-title">No Template Attached</h3>
      <p class="empty-description">
        This schema doesn't have a template yet. Create a markdown template to enable structured entry creation with preview.
      </p>
      <button
        onclick={startCreating}
        class="create-template-btn"
      >
        <PlusOutline class="w-5 h-5" />
        Create Template
      </button>
    </div>
  {:else if isCreating || isEditing}
    <!-- Editing/Creating mode -->
    <div class="template-editor-container">
      <div class="editor-header">
        <h3 class="editor-title">
          {isCreating ? "Create Template" : "Edit Template"}
        </h3>
        <div class="editor-actions">
          <button
            onclick={() => showPreview = !showPreview}
            class="action-btn preview-btn"
            class:active={showPreview}
          >
            <EyeOutline class="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
          <button
            onclick={cancelEdit}
            class="action-btn cancel-btn"
            disabled={isSaving}
          >
            <CloseOutline class="w-4 h-4" />
            Cancel
          </button>
          <button
            onclick={saveTemplate}
            class="action-btn save-btn"
            disabled={isSaving}
          >
            {#if isSaving}
              <svg class="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            {:else}
              <CheckOutline class="w-4 h-4" />
              Save
            {/if}
          </button>
        </div>
      </div>

      <div class="editor-body" class:split-view={showPreview}>
        <div class="markdown-editor-pane">
          <MarkdownEditor bind:content={editedContent} />
        </div>
        
        {#if showPreview}
          <div class="preview-pane">
            <div class="preview-header">Preview</div>
            <div class="preview-content markdown-preview">
              {@html marked(editedContent)}
            </div>
          </div>
        {/if}
      </div>

      <div class="editor-help">
        <p class="help-text">
          <strong>Tip:</strong>           Use placeholders like <code>{"{{field_name}}"}</code> to reference schema fields.
          When creating structured entries, these placeholders will be replaced with actual values.
        </p>
      </div>
    </div>
  {:else}
    <!-- Template exists and not editing - Show view mode -->
    <div class="template-view-container">
      <div class="template-header">
        <div class="template-info">
          <FileCodeOutline class="w-6 h-6 text-blue-600" />
          <div>
            <h3 class="template-title">Template</h3>
            <p class="template-meta">
              {templateAttachment?.attributes?.payload?.content_type || "markdown"} • 
              {templateContent.length} characters
            </p>
          </div>
        </div>
        <div class="template-actions">
          <button
            onclick={() => showPreview = !showPreview}
            class="action-btn preview-btn"
            class:active={showPreview}
          >
            <EyeOutline class="w-4 h-4" />
            {showPreview ? "Hide" : "Preview"}
          </button>
          <button
            onclick={startEditing}
            class="action-btn edit-btn"
          >
            <PenOutline class="w-4 h-4" />
            Edit
          </button>
          <button
            onclick={deleteTemplate}
            class="action-btn delete-btn"
            disabled={isDeleting}
          >
            {#if isDeleting}
              <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {:else}
              <TrashBinOutline class="w-4 h-4" />
            {/if}
            Delete
          </button>
        </div>
      </div>

      {#if showPreview}
        <div class="template-preview markdown-preview">
          {@html marked(templateContent)}
        </div>
      {:else}
        <div class="template-content">
          <pre class="content-code">{templateContent}</pre>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .schema-template-manager {
    padding: 1.5rem;
  }

  /* Empty State */
  .empty-template-state {
    text-align: center;
    padding: 3rem 1.5rem;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border-radius: 1rem;
    border: 2px dashed #d1d5db;
  }

  .empty-icon {
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .empty-description {
    color: #6b7280;
    margin: 0 0 1.5rem 0;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  .create-template-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-template-btn:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
  }

  /* Editor Container */
  .template-editor-container {
    background: white;
    border-radius: 1rem;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .editor-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
    color: #374151;
  }

  .action-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #2563eb;
  }

  .preview-btn {
    background: #f3f4f6;
  }

  .cancel-btn:hover {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  .save-btn {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .edit-btn:hover {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #2563eb;
  }

  .delete-btn:hover {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  /* Editor Body */
  .editor-body {
    display: flex;
    flex-direction: column;
    min-height: 400px;
  }

  .editor-body.split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .markdown-editor-pane {
    min-height: 400px;
  }

  .editor-body.split-view .markdown-editor-pane {
    border-right: 1px solid #e5e7eb;
  }

  .preview-pane {
    display: flex;
    flex-direction: column;
    background: #f9fafb;
  }

  .preview-header {
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .preview-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    max-height: 600px;
  }

  /* Editor Help */
  .editor-help {
    padding: 1rem 1.5rem;
    background: #eff6ff;
    border-top: 1px solid #dbeafe;
  }

  .help-text {
    margin: 0;
    font-size: 0.875rem;
    color: #1e40af;
  }

  .help-text code {
    background: rgba(255, 255, 255, 0.5);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
  }

  /* Template View */
  .template-view-container {
    background: white;
    border-radius: 1rem;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .template-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .template-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .template-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .template-meta {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  .template-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .template-content {
    padding: 1.5rem;
    background: #f9fafb;
    max-height: 600px;
    overflow-y: auto;
  }

  .content-code {
    margin: 0;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .template-preview {
    padding: 1.5rem;
    max-height: 600px;
    overflow-y: auto;
  }

  /* Markdown Preview Styles */
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

  .markdown-preview :global(p) {
    margin: 0.75rem 0;
    line-height: 1.6;
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

  .markdown-preview :global(blockquote) {
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-left: 4px solid #d1d5db;
    color: #6b7280;
  }

  .markdown-preview :global(code) {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
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

  /* Responsive */
  @media (max-width: 768px) {
    .editor-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .editor-body.split-view {
      grid-template-columns: 1fr;
    }

    .editor-body.split-view .markdown-editor-pane {
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
    }

    .template-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .template-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
