<script>
  import { onMount } from "svelte";
  import { marked } from "marked";
  import { createEntity, getTemplates } from "@/lib/dmart_services";
  import { ContentType, ResourceType } from "@edraj/tsdmart";
  import { params } from "@roxi/routify";

  let templates = [];
  let selectedTemplate = null;
  let templateFields = [];
  let fieldValues = {};
  let previewContent = "";

  let entityShortname = "";
  let entityTags = [];
  let newTag = "";
  let isCreating = false;
  let createMessage = "";

  onMount(async () => {
    const response = await getTemplates();
    templates = response.records;
  });

  function extractFields(content) {
    const fieldRegex = /\{\{(\w+):(\w+)\}\}/g;
    const fields = [];
    let match;

    while ((match = fieldRegex.exec(content)) !== null) {
      const [, name, type] = match;
      fields.push({ name, type });
    }

    return fields;
  }

  function handleTemplateSelect() {
    if (selectedTemplate) {
      const template = templates.find((t) => t.uuid === selectedTemplate);
      if (template) {
        const content = template.attributes.payload.body.content;
        templateFields = extractFields(content);
        fieldValues = {};
        templateFields.forEach((field) => {
          fieldValues[field.name] = "";
        });
        updatePreview();
      }
    } else {
      templateFields = [];
      fieldValues = {};
      previewContent = "";
    }
  }

  function updatePreview() {
    if (selectedTemplate) {
      const template = templates.find((t) => t.uuid === selectedTemplate);
      if (template) {
        let content = template.attributes.payload.body.content;

        templateFields.forEach((field) => {
          const placeholder = `{{${field.name}:${field.type}}}`;
          const value = fieldValues[field.name] || "";
          content = content.replace(placeholder, value);
        });

        previewContent = content;
      }
    }
  }

  function getFieldType(type) {
    switch (type) {
      case "string":
        return "text";
      case "number":
        return "number";
      case "date":
        return "date";
      case "text":
        return "textarea";
      default:
        return "text";
    }
  }

  function addTag() {
    if (newTag.trim() && !entityTags.includes(newTag.trim())) {
      entityTags = [...entityTags, newTag.trim()];
      newTag = "";
    }
  }

  function removeTag(tagToRemove) {
    entityTags = entityTags.filter((tag) => tag !== tagToRemove);
  }

  function handleTagKeypress(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  }

  async function handleCreate() {
    if (!selectedTemplate) {
      createMessage = "Please select a template first";
      return;
    }

    const template = templates.find((t) => t.uuid === selectedTemplate);
    if (!template) {
      createMessage = "Template not found";
      return;
    }

    const emptyFields = templateFields.filter(
      (field) => !fieldValues[field.name]?.trim()
    );
    if (emptyFields.length > 0) {
      createMessage = `Please fill in all fields: ${emptyFields.map((f) => f.name).join(", ")}`;
      return;
    }

    isCreating = true;
    createMessage = "";

    try {
      let content = template.attributes.payload.body.content;
      templateFields.forEach((field) => {
        const placeholder = `{{${field.name}:${field.type}}}`;
        const value = fieldValues[field.name] || "";
        content = content.replace(placeholder, value);
      });

      const entityData = {
        shortname: entityShortname.trim() || "auto",
        tags: entityTags,
        is_active: true,
        body: content,
      };

      const result = await createEntity(
        entityData,
        $params.space_name,
        $params.subpath,
        ResourceType.content,
        null,
        "templates",
        ContentType.markdown
      );

      if (result) {
        createMessage = `Entity created successfully with shortname: ${result}`;
        resetForm();
      } else {
        createMessage = "Failed to create entity";
      }
    } catch (error) {
      console.error("Error creating entity:", error);
      createMessage = "Error creating entity: " + error.message;
    } finally {
      isCreating = false;
    }
  }

  function resetForm() {
    selectedTemplate = null;
    templateFields = [];
    fieldValues = {};
    previewContent = "";
    entityShortname = "";
    entityTags = [];
    newTag = "";
  }

  $: if (selectedTemplate && Object.keys(fieldValues).length > 0) {
    updatePreview();
  }
</script>

<div class="container">
  <h1>Template Form Generator</h1>

  <div class="form-section">
    <div class="field-group">
      <label for="template-select">Select Template</label>
      <select
        id="template-select"
        bind:value={selectedTemplate}
        on:change={handleTemplateSelect}
      >
        <option value="">-- Choose a template --</option>
        {#each templates as template}
          <option value={template.uuid}>
            {template.attributes.payload.body.title}
          </option>
        {/each}
      </select>
    </div>

    {#if templateFields.length > 0}
      <h3>Fill Template Fields</h3>
      {#each templateFields as field}
        <div class="field-group">
          <label for={field.name}>
            {field.name} ({field.type})
          </label>
          {#if getFieldType(field.type) === "textarea"}
            <textarea
              id={field.name}
              bind:value={fieldValues[field.name]}
              placeholder={`Enter ${field.name}...`}
            ></textarea>
          {:else}
            <input
              id={field.name}
              type={getFieldType(field.type)}
              bind:value={fieldValues[field.name]}
              placeholder={`Enter ${field.name}...`}
            />
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if selectedTemplate}
    <div class="create-section">
      <h3>Create New Entity</h3>

      <div class="field-group">
        <label for="entity-shortname">Shortname</label>
        <input
          id="entity-shortname"
          type="text"
          bind:value={entityShortname}
          placeholder="Leave empty for 'auto'"
        />
      </div>

      <div class="field-group">
        <label>Tags</label>
        <div class="tags-container">
          {#each entityTags as tag}
            <span class="tag">
              {tag}
              <span class="remove-tag" on:click={() => removeTag(tag)}>×</span>
            </span>
          {/each}
        </div>
        <div class="tag-input-container">
          <input
            class="tag-input"
            type="text"
            bind:value={newTag}
            on:keypress={handleTagKeypress}
            placeholder="Add a tag..."
          />
          <button
            class="add-tag-btn"
            on:click={addTag}
            disabled={!newTag.trim()}
          >
            Add Tag
          </button>
        </div>
      </div>

      <button
        class="create-button"
        on:click={handleCreate}
        disabled={isCreating || !selectedTemplate}
      >
        {#if isCreating}
          <span class="loading"></span>
        {/if}
        {isCreating ? "Creating..." : "Create Entity"}
      </button>

      {#if createMessage}
        <div
          class="create-message {createMessage.includes('success')
            ? 'success'
            : 'error'}"
        >
          {createMessage}
        </div>
      {/if}
    </div>
  {/if}

  {#if selectedTemplate}
    <div class="preview-section">
      <h3>Preview</h3>

      <div class="two-column">
        <div>
          <h4>Raw Content</h4>
          {#if previewContent}
            <div class="preview-content">{previewContent}</div>
          {:else}
            <div class="empty-state">Fill in the fields to see preview</div>
          {/if}
        </div>

        <div>
          <h4>Rendered Markdown</h4>
          {#if previewContent}
            <div class="markdown-preview">
              {@html marked(previewContent)}
            </div>
          {:else}
            <div class="empty-state">
              Fill in the fields to see rendered preview
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  .form-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .field-group {
    margin-bottom: 15px;
  }

  label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #333;
    text-transform: capitalize;
  }

  select,
  input,
  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }

  select:focus,
  input:focus,
  textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .preview-section {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
  }

  .preview-section h3 {
    margin-top: 0;
    color: #333;
    border-bottom: 2px solid #eee;
    padding-bottom: 10px;
  }

  .preview-content {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 15px;
    margin: 10px 0;
    white-space: pre-wrap;
    font-family: "Monaco", "Menlo", monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .markdown-preview {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 15px;
    line-height: 1.6;
  }

  .markdown-preview :global(h1) {
    border-bottom: 1px solid #eaecef;
    padding-bottom: 10px;
  }

  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(h3),
  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }

  .markdown-preview :global(p) {
    margin-bottom: 16px;
  }

  .markdown-preview :global(strong) {
    font-weight: 600;
  }

  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .tag {
    display: inline-block;
    background: #007bff;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    margin-right: 8px;
    margin-bottom: 8px;
  }

  .tag .remove-tag {
    margin-left: 6px;
    cursor: pointer;
    font-weight: bold;
  }

  .tag .remove-tag:hover {
    color: #ffcccc;
  }

  .tags-container {
    margin-bottom: 10px;
    min-height: 20px;
  }

  .tag-input-container {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .tag-input {
    flex: 1;
  }

  .add-tag-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .add-tag-btn:hover {
    background: #218838;
  }

  .add-tag-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .create-section {
    background: #e8f5e8;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .create-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    width: 100%;
    margin-top: 15px;
  }

  .create-button:hover:not(:disabled) {
    background: #0056b3;
  }

  .create-button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .create-message {
    margin-top: 15px;
    padding: 10px;
    border-radius: 4px;
    font-weight: 500;
  }

  .create-message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .create-message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 1s ease-in-out infinite;
    margin-right: 8px;
  }

  @media (max-width: 768px) {
    .two-column {
      grid-template-columns: 1fr;
    }
  }

  .empty-state {
    text-align: center;
    color: #6c757d;
    font-style: italic;
    padding: 40px;
    background: #f8f9fa;
    border-radius: 4px;
  }
</style>
