<script lang="ts">
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import { createTemplate } from "@/lib/dmart_services";
  import { _ } from "@/i18n";
  import { writable } from "svelte/store";

  interface Props {
    currentSpace: string;
    currentSubpath: string;
    onClose: () => void;
    onSuccess: () => void;
  }

  let { currentSpace, currentSubpath, onClose, onSuccess }: Props = $props();

  let templateName = writable("");
  let content = writable({
    title: "New Template",
    content: "# New Template\n\nStart writing your template content here...",
  });
  let isSaving = writable(false);
  let saveMessage = writable("");
  let saveError = writable("");

  function handleContentChange() {
    // Handle content changes if needed
  }

  async function handleSave() {
    if (!$templateName.trim()) return;

    try {
      isSaving.set(true);
      saveError.set("");
      saveMessage.set("");

      const response = await createTemplate(
        currentSpace,
        currentSubpath,
        $templateName.trim(),
        $content
      );

      if (response) {
        saveMessage.set("Template created successfully!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        saveError.set("Failed to create template");
      }
    } catch (error) {
      saveError.set("An error occurred while creating the template");
    } finally {
      isSaving.set(false);
    }
  }

  function closeModal() {
    if (!$isSaving) {
      onClose();
    }
  }
</script>

<!-- Create Template Modal -->
<div
  class="modal-overlay"
  role="button"
  tabindex="0"
  onclick={closeModal}
  onkeydown={(e) => {
    if (e.key === "Escape") closeModal();
  }}
>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
  >
    <div class="modal-header">
      <h2>{$_("templates.create_modal.title")}</h2>
      <button class="close-btn" type="button" onclick={closeModal}>
        &times;
      </button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="create-template-name">
          {$_("templates.form.name_label")}
        </label>
        <input
          id="create-template-name"
          type="text"
          bind:value={$templateName}
          placeholder={$_("templates.form.name_placeholder")}
          disabled={$isSaving}
        />
      </div>

      {#if $saveMessage}
        <div class="alert alert-success">
          <strong>{$_("common.success")}</strong>
          {$saveMessage}
        </div>
      {/if}

      {#if $saveError}
        <div class="alert alert-error">
          <strong>{$_("common.error")}</strong>
          {$saveError}
        </div>
      {/if}

      <div class="editor-container">
        <MarkdownEditor
          bind:content={$content.content}
          handleSave={handleContentChange}
        />
      </div>

      <div class="template-info">
        <h3>{$_("templates.info.title")}</h3>
        <div class="info-grid">
          <div>
            <strong>{$_("templates.info.space")}</strong>
            {currentSpace}
          </div>
          <div>
            <strong>{$_("templates.info.subpath")}</strong>
            {currentSubpath}/{$templateName || "[template-name]"}
          </div>
          <div>
            <strong>{$_("templates.info.content_type")}</strong> Markdown
          </div>
          <div>
            <strong>{$_("templates.info.resource_type")}</strong> Template
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button
        class="btn btn-primary"
        onclick={handleSave}
        disabled={$isSaving || !$templateName.trim()}
      >
        {#if $isSaving}
          <span class="spinner-sm"></span>
          {$_("common.saving")}
        {:else}
          {$_("templates.form.save_button")}
        {/if}
      </button>
      <button
        class="btn btn-secondary"
        onclick={closeModal}
        disabled={$isSaving}
      >
        {$_("common.cancel")}
      </button>
    </div>
  </div>
</div>

<style>
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #374151;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  /* Form Styles */
  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group input:disabled {
    background-color: #f9fafb;
    color: #6b7280;
  }

  /* Button Styles */
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .btn-primary:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Alert Styles */
  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1.5rem;
  }

  .alert-success {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }

  .alert-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  /* Editor Container */
  .editor-container {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    height: 400px;
    margin-bottom: 1.5rem;
  }

  /* Template Info */
  .template-info {
    padding: 1rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .template-info h3 {
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .info-grid > div {
    color: #6b7280;
  }

  .info-grid strong {
    color: #374151;
  }

  /* Spinner */
  .spinner-sm {
    width: 1rem;
    height: 1rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 640px) {
    .modal {
      margin: 0;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
