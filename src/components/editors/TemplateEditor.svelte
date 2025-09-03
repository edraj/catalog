<script>
    import {createEventDispatcher, onMount} from "svelte";
    import {getTemplates} from "@/lib/dmart_services";
    import {derived, writable} from "svelte/store";

    const dispatch = createEventDispatcher();
  export let content = "";
  let onContentChange = (newContent) => {
    content = newContent;
  };

  let templates = [];
  let originalTemplate = null;
  let templateFields = [];
  let fieldValues = {};

  const originalTemplateStore = writable(originalTemplate);
  const templateFieldsStore = writable(templateFields);
  const fieldValuesStore = writable(fieldValues);

  const previewContentStore = derived(
    [originalTemplateStore, templateFieldsStore, fieldValuesStore],
    ([$originalTemplate, $templateFields, $fieldValues]) => {
      if (!$originalTemplate) return "";

      let newContent = $originalTemplate.attributes.payload.body.content;

      $templateFields.forEach((field) => {
        const placeholder = `{{${field.name}:${field.type}}}`;
        const value = $fieldValues[field.name] || "";
        newContent = newContent.replace(placeholder, value);
      });

      return newContent;
    }
  );

  $: if ($previewContentStore) {
    onContentChange($previewContentStore);
    dispatch("contentChange", $previewContentStore);
  }

  onMount(async () => {
    const response = await getTemplates();
    templates = response.records;

    await detectAndParseTemplate();
  });

  async function detectAndParseTemplate() {
    if (!content || templates.length === 0) return;

    for (const template of templates) {
      const templateContent = template.attributes.payload.body.content;
      const fields = extractFields(templateContent);

      if (fields.length > 0) {
        const filledValues = extractValuesFromContent(
          content,
          templateContent,
          fields
        );

        if (
          filledValues &&
          Object.keys(filledValues).length === fields.length
        ) {
          originalTemplate = template;
          templateFields = fields;
          fieldValues = filledValues;

          originalTemplateStore.set(template);
          templateFieldsStore.set(fields);
          fieldValuesStore.set(filledValues);

          break;
        }
      }
    }
  }

  function extractFields(templateContent) {
    const fieldRegex = /\{\{(\w+):(\w+)\}\}/g;
    const fields = [];
    let match;

    while ((match = fieldRegex.exec(templateContent)) !== null) {
      const [, name, type] = match;
      fields.push({ name, type });
    }

    return fields;
  }

  function extractValuesFromContent(filledContent, templateContent, fields) {
    let values = {};
    let tempContent = templateContent;

    fields.forEach((field) => {
      const placeholder = `{{${field.name}:${field.type}}}`;
      tempContent = tempContent.replace(placeholder, `__FIELD_${field.name}__`);
    });

    let escapedTemplate = tempContent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    fields.forEach((field) => {
      const marker = `__FIELD_${field.name}__`;
      escapedTemplate = escapedTemplate.replace(marker, "(.+?)");
    });

    try {
      const regex = new RegExp(escapedTemplate, "s");
      const match = filledContent.match(regex);

      if (match) {
        fields.forEach((field, index) => {
          let value = match[index + 1] || "";
          if (field.type === "checkbox") {
            if (typeof value === "string") {
              value = value === "true" || value === "1" || value === "on";
            } else {
              value = !!value;
            }
          }
          values[field.name] = value;
        });
        return values;
      }
    } catch (error) {
      console.error("Error extracting values:", error);
    }

    return null;
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
      case "checkbox":
        return "checkbox";
      default:
        return "text";
    }
  }

  function handleFieldChange(fieldName, value) {
    fieldValues = { ...fieldValues, [fieldName]: value };
    fieldValuesStore.set(fieldValues);
  }
</script>

{#if originalTemplate && templateFields.length > 0}
  <div class="template-editor">
    <div class="template-info">
      <h4>
        Editing Template: {originalTemplate.attributes.payload.body.title}
      </h4>
      <p class="template-description">
        Edit the dynamic fields below. The template structure will remain
        unchanged.
      </p>
    </div>

    <div class="template-fields">
      {#each templateFields as field}
        <div class="field-group">
          <label for={field.name} class="field-label">
            {field.name} ({field.type})
          </label>
          {#if getFieldType(field.type) === "textarea"}
            <textarea
              id={field.name}
              value={fieldValues[field.name] || ""}
              on:input={(e) => handleFieldChange(field.name, e.target.value)}
              class="field-textarea"
              placeholder={`Enter ${field.name}...`}
              rows="3"
            ></textarea>
          {:else if getFieldType(field.type) === "checkbox"}
            <input
              id={field.name}
              type="checkbox"
              checked={fieldValues[field.name] || false}
              on:change={(e) => handleFieldChange(field.name, e.target.checked)}
              class="field-checkbox"
            />
          {:else}
            <input
              id={field.name}
              type={getFieldType(field.type)}
              value={fieldValues[field.name] || ""}
              on:input={(e) => handleFieldChange(field.name, e.target.value)}
              class="field-input"
              placeholder={`Enter ${field.name}...`}
            />
          {/if}
        </div>
      {/each}
    </div>

    {#if $previewContentStore}
      <div class="template-preview">
        <h5>Preview</h5>
        <div class="preview-content">
          {$previewContentStore}
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="template-loading">
    <p>Loading template editor...</p>
  </div>
{/if}

<style>
  .template-editor {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
  }

  .template-info {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #dee2e6;
  }

  .template-info h4 {
    margin: 0 0 8px 0;
    color: #495057;
    font-size: 16px;
    font-weight: 600;
  }

  .template-description {
    margin: 0;
    color: #6c757d;
    font-size: 14px;
  }

  .template-fields {
    margin-bottom: 20px;
  }

  .field-group {
    margin-bottom: 16px;
  }

  .field-label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #495057;
    font-size: 14px;
    text-transform: capitalize;
  }

  .field-input,
  .field-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
    transition:
      border-color 0.15s ease-in-out,
      box-shadow 0.15s ease-in-out;
    box-sizing: border-box;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }

  .field-textarea {
    resize: vertical;
    font-family: inherit;
  }

  .field-checkbox {
    transform: scale(1.2);
    margin: 8px 0;
  }

  .template-preview {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 15px;
  }

  .template-preview h5 {
    margin: 0 0 12px 0;
    color: #495057;
    font-size: 14px;
    font-weight: 600;
  }

  .preview-content {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 12px;
    white-space: pre-wrap;
    font-family: "Monaco", "Menlo", monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #495057;
  }

  .template-loading {
    text-align: center;
    padding: 40px;
    color: #6c757d;
  }
</style>
