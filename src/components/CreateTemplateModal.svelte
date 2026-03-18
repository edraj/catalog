<script lang="ts">
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import { createTemplate, getSpaceSchema } from "@/lib/dmart_services/dmart_services";
  import { _ } from "@/i18n";
  import { writable } from "svelte/store";
  import { onMount } from "svelte";

  interface Props {
    currentSpace: string;
    currentSubpath: string;
    onClose: () => void;
    onSuccess: () => void;
    lockedSpace?: string; // If provided, space is read-only and schema is mandatory
  }

  let { currentSpace, currentSubpath, onClose, onSuccess, lockedSpace = "" }: Props = $props();

  let templateName = writable("");
  let content = writable({
    title: "New Template",
    content: "# New Template\n\nStart writing your template content here...",
  });
  let isSaving = writable(false);
  let saveMessage = writable("");
  let saveError = writable("");
  
  // Optional/Mandatory fields
  let targetSpaceName = writable("");
  let schemaShortname = writable("");
  let showOptionalFields = writable(false);
  
  // Schema-related state
  let availableSchemas = writable([]);
  let loadingSchemas = writable(false);
  let schemaKeys = writable([]);
  
  let isSpaceLocked = $derived(!!lockedSpace);

  // Initialize and react to lockedSpace changes
  $effect(() => {
    if (lockedSpace) {
      targetSpaceName.set(lockedSpace);
      showOptionalFields.set(true);
      loadSchemasForSpace(lockedSpace);
    }
  });

  async function loadSchemasForSpace(spaceName: string) {
    if (!spaceName) {
      availableSchemas.set([]);
      return;
    }
    loadingSchemas.set(true);
    try {
      const response = await getSpaceSchema(spaceName, "managed");
      if (response.status === "success") {
        availableSchemas.set(response.records || []);
      }
    } catch (error) {
      console.error("Error loading schemas:", error);
      availableSchemas.set([]);
    } finally {
      loadingSchemas.set(false);
    }
  }

  function handleSchemaChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    schemaShortname.set(select.value);
    schemaKeys.set([]);
    
    if (select.value && $targetSpaceName) {
      const selectedSchema = $availableSchemas.find(s => s.shortname === select.value);
      if (selectedSchema?.attributes?.payload?.body) {
        extractSchemaKeys(selectedSchema.attributes.payload.body);
      }
    }
  }

  function extractSchemaKeys(schemaBody: any) {
    const keys: any[] = [];
    if (!schemaBody) return;
    
    if (schemaBody.properties) {
      Object.keys(schemaBody.properties).forEach(key => {
        const prop = schemaBody.properties[key];
        keys.push({
          name: key,
          type: prop.type || 'string',
          title: prop.title || key
        });
      });
    } else if (typeof schemaBody === 'object') {
      Object.keys(schemaBody).forEach(key => {
        keys.push({
          name: key,
          type: 'string',
          title: key
        });
      });
    }
    schemaKeys.set(keys);
  }

  function handleDragStart(key: any) {
    // Handle drag start for schema keys
  }

  function handleDragEnd() {
    // Handle drag end
  }

  async function handleSave() {
    if (!$templateName.trim()) {
      saveError.set("Please enter a template name");
      return;
    }

    // When space is locked, schema is mandatory
    if (isSpaceLocked && !$schemaShortname.trim()) {
      saveError.set("Schema is required when creating a template for this space");
      return;
    }

    try {
      isSaving.set(true);
      saveError.set("");
      saveMessage.set("");

      const data: any = {
        title: $content.title,
        content: $content.content,
      };
      
      // Add optional fields if provided
      if ($targetSpaceName.trim()) {
        data.space_name = $targetSpaceName.trim();
      }
      if ($schemaShortname.trim()) {
        data.schema_shortname = $schemaShortname.trim();
      }

      const response = await createTemplate(
        $templateName.trim(),
        data,
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
  
  function toggleOptionalFields() {
    showOptionalFields.update(v => !v);
  }
  
  function handleContentChange() {
    // Handle content changes if needed
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

      <!-- Optional Fields Toggle (hidden when space is locked) -->
      {#if !isSpaceLocked}
        <button
          type="button"
          class="optional-fields-toggle"
          onclick={toggleOptionalFields}
        >
          <span class="toggle-icon">{$showOptionalFields ? "▼" : "▶"}</span>
          {$_("templates.form.optional_fields_toggle")}
        </button>
      {/if}
      
      {#if $showOptionalFields || isSpaceLocked}
        <div class="optional-fields" class:locked={isSpaceLocked}>
          <div class="form-row">
            <div class="form-group flex-1">
              <label for="template-target-space">
                {$_("templates.form.target_space_label")}
                {#if isSpaceLocked}
                  <!-- No badge when locked -->
                {:else}
                  <span class="optional-badge">{$_("common.optional")}</span>
                {/if}
              </label>
              {#if isSpaceLocked}
                <input
                  id="template-target-space"
                  type="text"
                  value={$targetSpaceName}
                  disabled={true}
                  class="locked-input"
                />
              {:else}
                <input
                  id="template-target-space"
                  type="text"
                  bind:value={$targetSpaceName}
                  placeholder={$_("templates.form.target_space_placeholder")}
                  disabled={$isSaving}
                />
              {/if}
            </div>
            <div class="form-group flex-1">
              <label for="template-schema">
                {$_("templates.form.schema_label")}
                {#if isSpaceLocked}
                  <span class="required-badge">*</span>
                {:else}
                  <span class="optional-badge">{$_("common.optional")}</span>
                {/if}
              </label>
              <select
                id="template-schema"
                value={$schemaShortname}
                onchange={handleSchemaChange}
                disabled={$isSaving || (!$targetSpaceName && !isSpaceLocked) || $loadingSchemas}
                class="form-select"
              >
                <option value="">
                  {#if $loadingSchemas}
                    {$_("common.loading")}
                  {:else if !$targetSpaceName && !isSpaceLocked}
                    {$_("templates.form.select_space_first")}
                  {:else}
                    {$_("templates.form.select_schema")}
                  {/if}
                </option>
                {#each $availableSchemas as schema}
                  <option value={schema.shortname}>
                    {schema.attributes?.displayname?.en || schema.shortname}
                  </option>
                {/each}
              </select>
            </div>
          </div>
          
          <!-- Schema Keys - Draggable Badges -->
          {#if $schemaKeys.length > 0}
            <div class="schema-keys-section">
              <h4 class="schema-keys-title">
                {$_("templates.form.schema_keys_title")}
                <span class="schema-keys-hint">{$_("templates.form.schema_keys_hint")}</span>
              </h4>
              <div class="schema-keys-container">
                {#each $schemaKeys as key}
                  <div
                    class="schema-key-badge"
                    role="button"
                    tabindex="0"
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

      <div class="editor-container">
        <MarkdownEditor
          bind:content={$content.content}
          handleSave={handleContentChange}
          onDropKey={(key) => {
            // Key is already inserted by the editor, just log or handle any additional logic
            console.log("Dropped key:", key);
          }}
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
          {#if $targetSpaceName}
            <div>
              <strong>{$_("templates.form.target_space_label")}:</strong>
              {$targetSpaceName}
            </div>
          {/if}
          {#if $schemaShortname}
            <div>
              <strong>{$_("templates.form.schema_label")}:</strong>
              {$schemaShortname}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button
        class="btn btn-primary"
        onclick={handleSave}
        disabled={$isSaving || !$templateName.trim() || (isSpaceLocked && !$schemaShortname.trim())}
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

  .form-group input,
  .form-select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
    background-color: white;
  }

  .form-group input:focus,
  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group input:disabled,
  .form-select:disabled {
    background-color: #f9fafb;
    color: #6b7280;
  }
  
  .locked-input {
    background-color: #eff6ff !important;
    color: #1e40af !important;
    border-color: #bfdbfe !important;
    font-weight: 500;
    cursor: default !important;
  }
  
  .form-row {
    display: flex;
    gap: 1rem;
  }
  
  .form-row .form-group {
    flex: 1;
    margin-bottom: 0;
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
  
  .optional-fields.locked {
    background: #eff6ff;
    border-color: #bfdbfe;
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
    background-color: #5850ec;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #4338ca;
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

  /* Schema Keys */
  .schema-keys-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed #d1d5db;
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
    padding: 0.375rem 0.75rem;
    background: #e0e7ff;
    border: 1px solid #c7d2fe;
    border-radius: 9999px;
    font-size: 0.75rem;
    cursor: grab;
    transition: all 0.2s ease;
  }

  .schema-key-badge:hover {
    background: #c7d2fe;
    transform: translateY(-1px);
  }

  .schema-key-badge .key-name {
    font-weight: 600;
    color: #3730a3;
  }

  .schema-key-badge .key-type {
    font-size: 0.625rem;
    color: #6366f1;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.5);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
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
    
    .form-row {
      flex-direction: column;
    }
  }
</style>
