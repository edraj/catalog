<script lang="ts">
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import {
    createTemplate,
    deleteTemplate,
    getAllTemplates,
    updateTemplates,
    getSpaces,
    getSpaceSchema,
  } from "@/lib/dmart_services/dmart_services";
  import { onMount } from "svelte";
  import { _, locale } from "@/i18n";

  let templates = $state([]);
  let isLoading = $state(true);
  let loadError = $state("");

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let editingTemplate = $state(null);
  let deletingTemplate = $state(null);

  let templateName = $state("");
  let templateShortname = $state("");
  let content = $state(
    "# New Template\n\nStart writing your template content here...",
  );
  let isSaving = $state(false);
  let isDeleting = $state(false);
  let saveMessage = $state("");
  let saveError = $state("");
  let deleteError = $state("");
  
  // Optional fields
  let targetSpaceName = $state("");
  let schemaShortname = $state("");
  let showOptionalFields = $state(false);
  let availableSpaces = $state([]);
  let availableSchemas = $state([]);
  let loadingSpaces = $state(false);
  let loadingSchemas = $state(false);
  let schemaKeys = $state([]);
  let draggedKey = $state(null);

  let saveSpace = $derived(schemaShortname && targetSpaceName ? targetSpaceName : "applications");

  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    try {
      isLoading = true;
      loadError = "";
      const response = await getAllTemplates();

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

  async function loadSpaces() {
    loadingSpaces = true;
    try {
      const response = await getSpaces(false, "managed", []);
      if (response.status === "success") {
        availableSpaces = response.records || [];
      }
    } catch (error) {
      console.error("Error loading spaces:", error);
    } finally {
      loadingSpaces = false;
    }
  }

  async function loadSchemasForSpace(spaceName: string) {
    if (!spaceName) {
      availableSchemas = [];
      return;
    }
    loadingSchemas = true;
    try {
      const response = await getSpaceSchema(spaceName, "managed");
      if (response.status === "success") {
        availableSchemas = response.records || [];
      }
    } catch (error) {
      console.error("Error loading schemas:", error);
      availableSchemas = [];
    } finally {
      loadingSchemas = false;
    }
  }

  function handleTargetSpaceChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    targetSpaceName = select.value;
    schemaShortname = ""; // Reset schema when space changes
    schemaKeys = []; // Reset schema keys
    if (targetSpaceName) {
      loadSchemasForSpace(targetSpaceName);
    } else {
      availableSchemas = [];
      schemaKeys = [];
    }
  }

  function handleSchemaChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    schemaShortname = select.value;
    schemaKeys = []; // Reset keys
    
    if (schemaShortname && targetSpaceName) {
      // Find the selected schema and extract keys
      const selectedSchema = availableSchemas.find(s => s.shortname === schemaShortname);
      if (selectedSchema?.attributes?.payload?.body) {
        extractSchemaKeys(selectedSchema.attributes.payload.body);
      }
    }
  }

  function extractSchemaKeys(schemaBody: any) {
    schemaKeys = [];
    if (!schemaBody) return;
    
    // Handle JSON Schema format
    if (schemaBody.properties) {
      Object.keys(schemaBody.properties).forEach(key => {
        const prop = schemaBody.properties[key];
        schemaKeys.push({
          name: key,
          type: prop.type || 'string',
          title: prop.title || key
        });
      });
    } else if (typeof schemaBody === 'object') {
      // Handle simple object format
      Object.keys(schemaBody).forEach(key => {
        schemaKeys.push({
          name: key,
          type: 'string',
          title: key
        });
      });
    }
  }

  function handleDragStart(key: any) {
    draggedKey = key;
  }

  function handleDragEnd() {
    draggedKey = null;
  }

  function openCreateModal() {
    templateName = "";
    templateShortname = "";
    content = "# New Template\n\nStart writing your template content here...";
    saveMessage = "";
    saveError = "";
    targetSpaceName = "";
    schemaShortname = "";
    showOptionalFields = false;
    availableSchemas = [];
    schemaKeys = [];
    draggedKey = null;
    loadSpaces();
    showCreateModal = true;
  }

  function openEditModal(template) {
    editingTemplate = template;
    templateName = getTemplateName(template);
    content =
      template.attributes?.payload?.body?.content ||
      "# Template Content\n\nEdit your template content here...";
    
    // Populate target space and schema if they exist in the template body
    const body = template.attributes?.payload?.body;
    targetSpaceName = body?.space_name || "";
    schemaShortname = body?.schema_shortname || "";
    
    // Load schemas for the target space if set
    if (targetSpaceName) {
      loadSchemasForSpace(targetSpaceName);
    }
    
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

    // Shortname is only required for new templates (not when editing)
    if (!editingTemplate && !templateShortname.trim()) {
      saveError = "Please enter a template shortname";
      return;
    }

    if (!content.trim()) {
      saveError = "Please enter some content";
      return;
    }

    // If target space is set, schema is required
    if (targetSpaceName.trim() && !schemaShortname.trim()) {
      saveError = "Please select a schema for the target space";
      return;
    }

    isSaving = true;
    saveError = "";
    saveMessage = "";
    let data: any = {
      title: templateName.trim(),
      content: content.trim(),
    };
    
    // Add schema-based fields if selected
    if (targetSpaceName.trim()) {
      data.space_name = targetSpaceName.trim();
    }
    if (schemaShortname.trim()) {
      data.schema_shortname = schemaShortname.trim();
    }

    try {
      let success;

      if (editingTemplate) {
        success = await updateTemplates(
          editingTemplate.shortname,
          editingTemplate.attributes.space_name,
          editingTemplate.subpath,
          data,
        );
      } else {
        success = await createTemplate(
          templateShortname.trim(),
          data,
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
        deletingTemplate.subpath,
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
  <title>{$_("route_labels.templates_title")}</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <div class="header-content">
      <h1>{$_("templates.title")}</h1>
      <p>{$_("templates.subtitle")}</p>
    </div>
    <button class="btn btn-primary" onclick={openCreateModal}>
      + {$_("templates.create_button")}
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
          + {$_("templates.empty_create_button")}
        </button>
      </div>
    {:else}
      <div class="table-controls">
        <span class="badge">Total {templates.length}</span>
      </div>
      <div class="table-container">
        <table class="templates-table">
          <thead>
            <tr>
              <th>{$_("templates.table.template")}</th>
              <th>Space</th>
              <th>Schema</th>
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
                <td>
                  <span class="space-badge">
                    {template.attributes?.space_name || "applications"}
                  </span>
                </td>
                <td>
                  {#if template.attributes?.payload?.body?.schema_shortname}
                    <span class="schema-badge">
                      {template.attributes.payload.body.schema_shortname}
                    </span>
                  {:else}
                    <span class="text-gray-400 text-sm">-</span>
                  {/if}
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

        <div class="form-group">
          <label for="create-template-shortname"
            >{$_("templates.form.shortname_label")}</label
          >
          <div class="shortname-input-group">
            <input
              id="create-template-shortname"
              type="text"
              bind:value={templateShortname}
              placeholder={$_("templates.form.shortname_placeholder")}
              disabled={isSaving}
              class="shortname-input"
            />
            <button
              class="shortname-auto-btn"
              onclick={() => (templateShortname = "auto")}
              title="Use auto-generated shortname"
              disabled={isSaving}
              type="button"
            >
              Auto
            </button>
          </div>
          <small class="shortname-help">{$_("create_entry.shortname.help_text")}</small>
        </div>

        <!-- Optional Fields Toggle -->
        <button
          type="button"
          class="optional-fields-toggle"
          onclick={() => showOptionalFields = !showOptionalFields}
        >
          <span class="toggle-icon">{showOptionalFields ? "▼" : "▶"}</span>
          {$_("templates.form.optional_fields_toggle")}
        </button>
        
        {#if showOptionalFields}
          <div class="optional-fields">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="template-target-space">
                  {$_("templates.form.target_space_label")}
                  <span class="optional-badge">{$_("common.optional")}</span>
                </label>
                <select
                  id="template-target-space"
                  value={targetSpaceName}
                  onchange={handleTargetSpaceChange}
                  disabled={isSaving || loadingSpaces}
                  class="form-select"
                >
                  <option value="">{$_("templates.form.select_space")}</option>
                  {#each availableSpaces as space}
                    <option value={space.shortname}>
                      {space.attributes?.displayname?.en || space.shortname}
                    </option>
                  {/each}
                </select>
                {#if loadingSpaces}
                  <small class="field-hint">{$_("common.loading")}</small>
                {/if}
              </div>
              <div class="form-group flex-1">
                <label for="template-schema">
                  {$_("templates.form.schema_label")}
                  {#if targetSpaceName}
                    <span class="required-badge">*</span>
                  {:else}
                    <span class="optional-badge">{$_("common.optional")}</span>
                  {/if}
                </label>
                <select
                  id="template-schema"
                  value={schemaShortname}
                  onchange={handleSchemaChange}
                  disabled={isSaving || !targetSpaceName || loadingSchemas}
                  class="form-select"
                >
                  <option value="">
                    {#if loadingSchemas}
                      {$_("common.loading")}
                    {:else if !targetSpaceName}
                      {$_("templates.form.select_space_first")}
                    {:else}
                      {$_("templates.form.select_schema")}
                    {/if}
                  </option>
                  {#each availableSchemas as schema}
                    <option value={schema.shortname}>
                      {schema.attributes?.displayname?.en || schema.shortname}
                    </option>
                  {/each}
                </select>
              </div>
            </div>
            
            <!-- Schema Keys - Draggable Badges -->
            {#if schemaKeys.length > 0}
              <div class="schema-keys-section">
                <h4 class="schema-keys-title">
                  {$_("templates.form.schema_keys_title")}
                  <span class="schema-keys-hint">{$_("templates.form.schema_keys_hint")}</span>
                </h4>
                <div class="schema-keys-container">
                  {#each schemaKeys as key}
                    <div
                      class="schema-key-badge"
                      draggable={true}
                      ondragstart={(e) => {
                        handleDragStart(key);
                        e.dataTransfer.setData("application/json", JSON.stringify(key));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      ondragend={handleDragEnd}
                      title={`${key.title} (${key.type})`}
                    >
                      <span class="key-name">{key.name}</span>
                      <span class="key-type">{key.type}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

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
          <MarkdownEditor 
            bind:content 
            handleSave={handleContentChange} 
            onDropKey={(key) => console.log("Dropped key:", key)}
          />
        </div>

        <div class="template-info">
          <h3>{$_("templates.info.title")}</h3>
          <div class="info-grid">
            <div>
              <strong>{$_("templates.info.space")}</strong>
              {saveSpace}
              {#if schemaShortname}
                <span class="space-badge target">{$_("templates.info.target_space")}</span>
              {/if}
            </div>
            <div>
              <strong>{$_("templates.info.subpath")}</strong>
              templates/{templateShortname || "[shortname]"}
            </div>
            <div>
              <strong>{$_("templates.info.content_type")}</strong> Markdown
            </div>
            <div>
              <strong>{$_("templates.info.resource_type")}</strong> Template
            </div>
            {#if targetSpaceName}
              <div>
                <strong>{$_("templates.form.target_space_label")}:</strong>
                {targetSpaceName}
              </div>
            {/if}
            {#if schemaShortname}
              <div>
                <strong>{$_("templates.form.schema_label")}:</strong>
                {schemaShortname}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-primary"
          onclick={handleSave}
          disabled={isSaving || !templateName.trim() || !templateShortname.trim()}
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
      class="modal modal-sm"
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
            {$_("templates.delete_modal.confirm", {
              values: { name: getTemplateTitle(deletingTemplate) },
            })}
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
    background-color: #5850ec;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #4338ca;
    transform: translateY(-1px);
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
    background-color: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #dc2626;
    transform: translateY(-1px);
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
  .table-controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }

  .badge {
    background-color: #f3f4f6;
    color: #374151;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid #e5e7eb;
  }

  .table-container {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    border: none;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.05),
      0 2px 4px -1px rgba(0, 0, 0, 0.03);
  }

  .templates-table {
    width: 100%;
    border-collapse: collapse;
  }

  .templates-table th {
    background-color: #f9fafb;
    padding: 1rem 1.5rem;
    text-align: left;
    font-weight: 500;
    color: #6b7280;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .templates-table td {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
    color: #374151;
    font-size: 0.875rem;
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
    background-color: #eff6ff;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #2563eb;
    font-family: inherit;
    border: 1px solid #bfdbfe;
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

  .shortname-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  .shortname-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .shortname-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .shortname-auto-btn {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .shortname-auto-btn:hover:not(:disabled) {
    background: #e5e7eb;
    border-color: #9ca3af;
  }

  .shortname-auto-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .shortname-help {
    display: block;
    margin-top: 0.375rem;
    color: #6b7280;
    font-size: 0.75rem;
  }

  .optional-fields-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #5850ec;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.5rem 0;
    margin-bottom: 1rem;
  }

  .optional-fields-toggle:hover {
    color: #4338ca;
  }

  .toggle-icon {
    font-size: 0.75rem;
  }

  .optional-fields {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .optional-badge {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 500;
    color: #6b7280;
    background: #e5e7eb;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    margin-left: 0.5rem;
    text-transform: uppercase;
  }

  .required-badge {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 500;
    color: #dc2626;
    background: #fee2e2;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    margin-left: 0.5rem;
  }

  .space-badge {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    margin-left: 0.5rem;
  }

  .space-badge.target {
    color: #059669;
    background: #d1fae5;
  }

  .form-select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background-color: white;
    color: #374151;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-select:disabled {
    background-color: #f3f4f6;
    color: #6b7280;
    cursor: not-allowed;
  }

  .schema-keys-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px dashed #e5e7eb;
  }

  .schema-keys-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.75rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .schema-keys-hint {
    font-size: 0.75rem;
    font-weight: 400;
    color: #6b7280;
    font-style: italic;
  }

  .schema-keys-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .schema-key-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 2px solid #3b82f6;
    border-radius: 0.5rem;
    padding: 0.375rem 0.75rem;
    cursor: grab;
    transition: all 0.15s ease;
    user-select: none;
  }

  .schema-key-badge:hover {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
  }

  .schema-key-badge:active {
    cursor: grabbing;
  }

  .schema-key-badge.dragging {
    opacity: 0.6;
  }

  .key-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e40af;
  }

  .key-type {
    font-size: 0.625rem;
    font-weight: 500;
    color: #3b82f6;
    background: rgba(255, 255, 255, 0.7);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
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

  .space-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #eef2ff;
    color: #4338ca;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .schema-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #f0fdf4;
    color: #15803d;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    border: 1px solid #bbf7d0;
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

    .shortname-input-group {
      flex-direction: column;
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
    .templates-table th:nth-child(4),
    .templates-table td:nth-child(4),
    .templates-table th:nth-child(5),
    .templates-table td:nth-child(5) {
      display: none;
    }
  }
</style>
