<script lang="ts">
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import {
    createTemplate,
    deleteTemplate,
    getTemplates,
    updateTemplates,
  } from "@/lib/dmart_services";
  import { onMount } from "svelte";
  import { _, locale } from "@/i18n";
  import { params } from "@roxi/routify";

  let templates = $state([]);
  let isLoading = $state(true);
  let loadError = $state("");

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let editingTemplate = $state(null);
  let deletingTemplate = $state(null);

  let templateName = $state("");
  let content = $state(
    "# New Template\n\nStart writing your template content here..."
  );
  let isSaving = $state(false);
  let isDeleting = $state(false);
  let saveMessage = $state("");
  let saveError = $state("");
  let deleteError = $state("");

  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    try {
      isLoading = true;
      loadError = "";
      const response = await getTemplates();

      if (response.status === "success") {
        templates = response.records || [];
      } else {
        loadError = "Failed to load templates";
      }
    } catch (error) {
      console.error("[v0] Error loading templates:", error);
      loadError = "An error occurred while loading templates";
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    templateName = "";
    content = "# New Template\n\nStart writing your template content here...";
    saveMessage = "";
    saveError = "";
    showCreateModal = true;
  }

  function openEditModal(template) {
    editingTemplate = template;
    templateName = getTemplateName(template);
    content =
      template.attributes?.payload?.body?.content ||
      "# Template Content\n\nEdit your template content here...";
    saveMessage = "";
    saveError = "";
    showEditModal = true;
  }

  function openDeleteModal(template) {
    deletingTemplate = template;
    deleteError = "";
    showDeleteModal = true;
  }

  function closeModals() {
    showCreateModal = false;
    showEditModal = false;
    showDeleteModal = false;
    editingTemplate = null;
    deletingTemplate = null;
  }

  async function handleSave() {
    if (!templateName.trim()) {
      saveError = "Please enter a template name";
      return;
    }

    if (!content.trim()) {
      saveError = "Please enter some content";
      return;
    }

    isSaving = true;
    saveError = "";
    saveMessage = "";
    let data = {
      title: templateName.trim(),
      content: content.trim(),
    };

    try {
      let success;

      if (editingTemplate) {
        success = await updateTemplates(
          editingTemplate.shortname,
          editingTemplate.attributes.space_name,
          editingTemplate.subpath,
          data
        );
      } else {
        success = await createTemplate(
          $params.space_name || "",
          "templates",
          templateName.trim(),
          data
        );
      }

      if (success) {
        saveMessage = editingTemplate
          ? "Template updated successfully!"
          : "Template saved successfully!";
        await loadTemplates();
        setTimeout(() => {
          closeModals();
        }, 1500);
      } else {
        saveError = editingTemplate
          ? "Failed to update template. Please try again."
          : "Failed to save template. Please try again.";
      }
    } catch (error) {
      console.error("[v0] Error saving template:", error);
      saveError = "An error occurred while saving. Please try again.";
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (!deletingTemplate) return;

    isDeleting = true;
    deleteError = "";

    try {
      const success = await deleteTemplate(
        deletingTemplate.shortname,
        deletingTemplate.attributes.space_name,
        deletingTemplate.subpath
      );

      if (success) {
        await loadTemplates();
        closeModals();
      } else {
        deleteError = "Failed to delete template. Please try again.";
      }
    } catch (error) {
      console.error("[v0] Error deleting template:", error);
      deleteError = "An error occurred while deleting. Please try again.";
    } finally {
      isDeleting = false;
    }
  }

  function handleContentChange() {
    if (saveMessage || saveError) {
      saveMessage = "";
      saveError = "";
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTemplateName(template) {
    const pathParts = template.subpath.split("/");
    return (
      template.attributes?.payload?.body?.title ||
      pathParts[pathParts.length - 1]
    );
  }

  function getTemplateTitle(template) {
    return (
      template.attributes?.payload?.body?.title || getTemplateName(template)
    );
  }
</script>

<svelte:head>
  <title>Templates</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <div class="header-content">
      <h1>{$_("templates.title")}</h1>
      <p>{$_("templates.subtitle")}</p>
    </div>
    <button class="btn btn-primary" onclick={openCreateModal}>
      {$_("templates.create_button")}
    </button>
  </header>

  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <span>{$_("templates.loading")}</span>
    </div>
  {/if}

  {#if loadError}
    <div class="error-alert">
      <strong>{$_("common.error")}</strong>
      {loadError}
      <button class="btn btn-sm" onclick={loadTemplates}
        >{$_("common.retry")}</button
      >
    </div>
  {/if}

  {#if !isLoading && !loadError}
    {#if templates.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>{$_("templates.empty_title")}</h3>
        <p>{$_("templates.empty_subtitle")}</p>
        <button class="btn btn-primary" onclick={openCreateModal}>
          {$_("templates.empty_create_button")}
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table class="templates-table">
          <thead>
            <tr>
              <th>{$_("templates.table.template")}</th>
              <th>{$_("templates.table.uuid")}</th>
              <th>{$_("templates.table.owner")}</th>
              <th>{$_("templates.table.created")}</th>
              <th>{$_("templates.table.updated")}</th>
              <th>{$_("templates.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each templates as template (template.uuid)}
              <tr>
                <td class="template-name">
                  <strong>{getTemplateTitle(template)}</strong>
                  <div class="subpath">{template.subpath}</div>
                </td>
                <td class="uuid">
                  <code>{template.shortname}</code>
                </td>
                <td>{template.attributes.owner_shortname}</td>
                <td>{formatDate(template.attributes.created_at)}</td>
                <td>{formatDate(template.attributes.updated_at)}</td>
                <td class="actions">
                  <button
                    class="btn btn-sm btn-outline"
                    onclick={() => openEditModal(template)}
                  >
                    {$_("templates.table.edit")}
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    onclick={() => openDeleteModal(template)}
                  >
                    {$_("templates.table.delete")}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closeModals}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") closeModals();
    }}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <div class="modal-header">
        <h2>{$_("templates.create_modal.title")}</h2>
        <button class="close-btn" type="button" onclick={closeModals}
          >&times;</button
        >
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="create-template-name"
            >{$_("templates.form.name_label")}</label
          >
          <input
            id="create-template-name"
            type="text"
            bind:value={templateName}
            placeholder={$_("templates.form.name_placeholder")}
            disabled={isSaving}
          />
        </div>

        {#if saveMessage}
          <div class="alert alert-success">
            <strong>{$_("common.success")}</strong>
            {saveMessage}
          </div>
        {/if}

        {#if saveError}
          <div class="alert alert-error">
            <strong>{$_("common.error")}</strong>
            {saveError}
          </div>
        {/if}

        <div class="editor-container">
          <MarkdownEditor bind:content handleSave={handleContentChange} />
        </div>

        <div class="template-info">
          <h3>{$_("templates.info.title")}</h3>
          <div class="info-grid">
            <div>
              <strong>{$_("templates.info.space")}</strong> applications
            </div>
            <div>
              <strong>{$_("templates.info.subpath")}</strong>
              templates/{templateName || "[template-name]"}
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
          disabled={isSaving || !templateName.trim()}
        >
          {#if isSaving}
            <span class="spinner-sm"></span>
            {$_("common.saving")}
          {:else}
            {$_("templates.form.save_button")}
          {/if}
        </button>
        <button
          class="btn btn-secondary"
          onclick={closeModals}
          disabled={isSaving}
        >
          {$_("common.cancel")}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div class="modal-overlay" onclick={closeModals}>
    <div class="modal" onclick={(event) => event.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("templates.edit_modal.title")}</h2>
        <button class="close-btn" onclick={closeModals}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="edit-template-name"
            >{$_("templates.form.name_label")}</label
          >
          <input
            id="edit-template-name"
            type="text"
            bind:value={templateName}
            placeholder={$_("templates.form.name_placeholder")}
            disabled={isSaving}
          />
        </div>

        {#if saveMessage}
          <div class="alert alert-success">
            <strong>{$_("common.success")}</strong>
            {saveMessage}
          </div>
        {/if}

        {#if saveError}
          <div class="alert alert-error">
            <strong>{$_("common.error")}</strong>
            {saveError}
          </div>
        {/if}

        <div class="editor-container">
          <MarkdownEditor bind:content handleSave={handleContentChange} />
        </div>

        {#if editingTemplate}
          <div class="template-info">
            <h3>{$_("templates.info.title")}</h3>
            <div class="info-grid">
              <div>
                <strong>{$_("templates.info.uuid")}</strong>
                {editingTemplate.uuid}
              </div>
              <div>
                <strong>{$_("templates.info.space")}</strong>
                {editingTemplate.attributes.space_name}
              </div>
              <div>
                <strong>{$_("templates.info.subpath")}</strong>
                {editingTemplate.subpath}
              </div>
              <div>
                <strong>{$_("templates.info.owner")}</strong>
                {editingTemplate.attributes.owner_shortname}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-primary"
          onclick={handleSave}
          disabled={isSaving || !templateName.trim()}
        >
          {#if isSaving}
            <span class="spinner-sm"></span>
            {$_("common.updating")}
          {:else}
            {$_("templates.form.update_button")}
          {/if}
        </button>
        <button
          class="btn btn-secondary"
          onclick={closeModals}
          disabled={isSaving}
        >
          {$_("common.cancel")}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closeModals}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") closeModals();
    }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <div class="modal-header">
        <h2>{$_("templates.delete_modal.title")}</h2>
        <button class="close-btn" onclick={closeModals}>&times;</button>
      </div>

      <div class="modal-body">
        {#if deletingTemplate}
          <p>
            {$_(
              "templates.delete_modal.confirm",
              getTemplateTitle(deletingTemplate)
            )}
          </p>
          <p class="warning-text">{$_("templates.delete_modal.warning")}</p>
        {/if}

        {#if deleteError}
          <div class="alert alert-error">
            <strong>{$_("common.error")}</strong>
            {deleteError}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-danger"
          onclick={handleDelete}
          disabled={isDeleting}
        >
          {#if isDeleting}
            <span class="spinner-sm"></span>
            {$_("common.deleting")}
          {:else}
            {$_("templates.delete_modal.delete_button")}
          {/if}
        </button>
        <button
          class="btn btn-secondary"
          onclick={closeModals}
          disabled={isDeleting}
        >
          {$_("common.cancel")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Page Layout */
  .page-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    min-height: calc(100vh - 4rem);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }

  .header-content h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .header-content p {
    color: #6b7280;
    margin: 0;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #e5e7eb;
  }

  .btn-outline {
    background-color: transparent;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-outline:hover:not(:disabled) {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-danger {
    background-color: #dc2626;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #b91c1c;
  }

  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  /* Actions column */
  .actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Loading State */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
    gap: 0.75rem;
    color: #6b7280;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-sm {
    width: 1rem;
    height: 1rem;
    border: 2px solid #e5e7eb;
    border-top: 2px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Error State */
  .error-alert {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    color: #dc2626;
    margin-bottom: 1rem;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 4rem 0;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: #6b7280;
    margin: 0 0 1.5rem 0;
  }

  /* Table Styles */
  .table-container {
    background: white;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .templates-table {
    width: 100%;
    border-collapse: collapse;
  }

  .templates-table th {
    background-color: #f9fafb;
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
  }

  .templates-table td {
    padding: 1rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }

  .templates-table tbody tr:hover {
    background-color: #fafafa;
  }

  .templates-table tbody tr:last-child td {
    border-bottom: none;
  }

  .template-name strong {
    color: #111827;
    font-weight: 600;
  }

  .subpath {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .uuid code {
    background-color: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: #374151;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
    max-width: 90vw;
    max-height: 90vh;
    width: 100%;
    max-width: 800px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-sm {
    max-width: 500px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
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
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    justify-content: flex-end;
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
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    height: 500px;
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
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .warning-text {
    color: #dc2626;
    font-size: 0.875rem;
    margin: 0.5rem 0 0 0;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .page-container {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .templates-table {
      font-size: 0.875rem;
    }

    .templates-table th,
    .templates-table td {
      padding: 0.5rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .modal {
      max-width: 95vw;
    }

    .actions {
      flex-direction: column;
      gap: 0.25rem;
    }
  }

  @media (max-width: 640px) {
    .templates-table th:nth-child(2),
    .templates-table td:nth-child(2),
    .templates-table th:nth-child(3),
    .templates-table td:nth-child(3) {
      display: none;
    }
  }
</style>
