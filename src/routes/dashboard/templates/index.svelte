<script lang="ts">
    import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
    import {createTemplate, deleteTemplate, getTemplates, updateTemplates,} from "@/lib/dmart_services";
    import {onMount} from "svelte";

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
      console.log("[v0] Templates response:", response);

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
          "applications",
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
      <h1>Templates</h1>
      <p>Manage your application templates collection.</p>
    </div>
    <button class="btn btn-primary" on:click={openCreateModal}>
      Create Template
    </button>
  </header>

  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <span>Loading templates...</span>
    </div>
  {/if}

  {#if loadError}
    <div class="error-alert">
      <strong>Error!</strong>
      {loadError}
      <button class="btn btn-sm" on:click={loadTemplates}>Retry</button>
    </div>
  {/if}

  {#if !isLoading && !loadError}
    {#if templates.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>No templates found</h3>
        <p>Get started by creating your first template.</p>
        <button class="btn btn-primary" on:click={openCreateModal}>
          Create Your First Template
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table class="templates-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>UUID</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
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
                    on:click={() => openEditModal(template)}
                  >
                    Edit
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    on:click={() => openDeleteModal(template)}
                  >
                    Delete
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
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Create New Template</h2>
        <button class="close-btn" on:click={closeModals}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="create-template-name">Template Name</label>
          <input
            id="create-template-name"
            type="text"
            bind:value={templateName}
            placeholder="Enter template name..."
            disabled={isSaving}
          />
        </div>

        {#if saveMessage}
          <div class="alert alert-success">
            <strong>Success!</strong>
            {saveMessage}
          </div>
        {/if}

        {#if saveError}
          <div class="alert alert-error">
            <strong>Error!</strong>
            {saveError}
          </div>
        {/if}

        <div class="editor-container">
          <MarkdownEditor bind:content handleSave={handleContentChange} />
        </div>

        <div class="template-info">
          <h3>Template Information</h3>
          <div class="info-grid">
            <div><strong>Space:</strong> applications</div>
            <div>
              <strong>Subpath:</strong> templates/{templateName ||
                "[template-name]"}
            </div>
            <div><strong>Content Type:</strong> Markdown</div>
            <div><strong>Resource Type:</strong> Template</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-primary"
          on:click={handleSave}
          disabled={isSaving || !templateName.trim()}
        >
          {#if isSaving}
            <span class="spinner-sm"></span>
            Saving...
          {:else}
            Save Template
          {/if}
        </button>
        <button
          class="btn btn-secondary"
          on:click={closeModals}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Edit Template</h2>
        <button class="close-btn" on:click={closeModals}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="edit-template-name">Template Name</label>
          <input
            id="edit-template-name"
            type="text"
            bind:value={templateName}
            placeholder="Enter template name..."
            disabled={isSaving}
          />
        </div>

        {#if saveMessage}
          <div class="alert alert-success">
            <strong>Success!</strong>
            {saveMessage}
          </div>
        {/if}

        {#if saveError}
          <div class="alert alert-error">
            <strong>Error!</strong>
            {saveError}
          </div>
        {/if}

        <div class="editor-container">
          <MarkdownEditor bind:content handleSave={handleContentChange} />
        </div>

        {#if editingTemplate}
          <div class="template-info">
            <h3>Template Information</h3>
            <div class="info-grid">
              <div><strong>UUID:</strong> {editingTemplate.uuid}</div>
              <div>
                <strong>Space:</strong>
                {editingTemplate.attributes.space_name}
              </div>
              <div><strong>Subpath:</strong> {editingTemplate.subpath}</div>
              <div>
                <strong>Owner:</strong>
                {editingTemplate.attributes.owner_shortname}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-primary"
          on:click={handleSave}
          disabled={isSaving || !templateName.trim()}
        >
          {#if isSaving}
            <span class="spinner-sm"></span>
            Updating...
          {:else}
            Update Template
          {/if}
        </button>
        <button
          class="btn btn-secondary"
          on:click={closeModals}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal modal-sm" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Confirm Delete</h2>
        <button class="close-btn" on:click={closeModals}>&times;</button>
      </div>

      <div class="modal-body">
        {#if deletingTemplate}
          <p>
            Are you sure you want to delete the template <strong
              >"{getTemplateTitle(deletingTemplate)}"</strong
            >?
          </p>
          <p class="warning-text">This action cannot be undone.</p>
        {/if}

        {#if deleteError}
          <div class="alert alert-error">
            <strong>Error!</strong>
            {deleteError}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-danger"
          on:click={handleDelete}
          disabled={isDeleting}
        >
          {#if isDeleting}
            <span class="spinner-sm"></span>
            Deleting...
          {:else}
            Delete Template
          {/if}
        </button>
        <button
          class="btn btn-secondary"
          on:click={closeModals}
          disabled={isDeleting}
        >
          Cancel
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
    border: 1px solid #d1d5db;
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
