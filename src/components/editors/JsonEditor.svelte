<script>
  import { createEventDispatcher, untrack } from "svelte";
  import { _ } from "@/i18n";

  const { content = {}, isEditMode = false } = $props();

  const dispatch = createEventDispatcher();

  let jsonData = $state({});
  let fieldTypes = $state({});

  $effect(() => {
    if (content && typeof content === "object") {
      untrack(() => {
        jsonData = { ...content };
        detectFieldTypes();
      });
    } else if (typeof content === "string") {
      try {
        untrack(() => {
          jsonData = JSON.parse(content);
          detectFieldTypes();
        });
      } catch (e) {
        untrack(() => {
          jsonData = {};
          fieldTypes = {};
        });
      }
    }
  });

  function detectFieldTypes() {
    const types = {};
    for (const [key, value] of Object.entries(jsonData)) {
      if (typeof value === "number") {
        types[key] = Number.isInteger(value) ? "integer" : "number";
      } else if (typeof value === "boolean") {
        types[key] = "boolean";
      } else if (Array.isArray(value)) {
        types[key] = "array";
      } else if (typeof value === "object" && value !== null) {
        types[key] = "object";
      } else {
        types[key] = "string";
      }
    }
    fieldTypes = types;
  }

  function handleFieldChange(key, value, type) {
    let processedValue = value;

    switch (type) {
      case "integer":
        processedValue = parseInt(value) || 0;
        break;
      case "number":
        processedValue = parseFloat(value) || 0;
        break;
      case "boolean":
        processedValue = Boolean(value);
        break;
      case "array":
        try {
          processedValue =
            typeof value === "string"
              ? value
                  .split(",")
                  .map((item) => item.trim())
                  .filter((item) => item)
              : value;
        } catch (e) {
          processedValue = [];
        }
        break;
      case "object":
        try {
          processedValue =
            typeof value === "string" ? JSON.parse(value) : value;
        } catch (e) {
          processedValue = {};
        }
        break;
      default:
        processedValue = String(value);
    }

    jsonData[key] = processedValue;

    dispatch("contentChange", jsonData);
  }

  function addNewField() {
    const newKey = prompt(
      $_("json_editor.new_field_prompt") || "Enter field name:"
    );
    if (newKey && !jsonData.hasOwnProperty(newKey)) {
      jsonData[newKey] = "";
      fieldTypes[newKey] = "string";
      dispatch("contentChange", jsonData);
    }
  }

  function removeField(key) {
    if (
      confirm(
        $_("json_editor.remove_field_confirm") || `Remove field "${key}"?`
      )
    ) {
      delete jsonData[key];
      delete fieldTypes[key];
      jsonData = { ...jsonData };
      fieldTypes = { ...fieldTypes };
      dispatch("contentChange", jsonData);
    }
  }

  function changeFieldType(key, newType) {
    fieldTypes[key] = newType;

    const currentValue = jsonData[key];
    let convertedValue;

    switch (newType) {
      case "integer":
        convertedValue = parseInt(currentValue) || 0;
        break;
      case "number":
        convertedValue = parseFloat(currentValue) || 0;
        break;
      case "boolean":
        convertedValue = Boolean(currentValue);
        break;
      case "array":
        convertedValue = Array.isArray(currentValue) ? currentValue : [];
        break;
      case "object":
        convertedValue =
          typeof currentValue === "object" && !Array.isArray(currentValue)
            ? currentValue
            : {};
        break;
      default:
        convertedValue = String(currentValue);
    }

    jsonData[key] = convertedValue;
    dispatch("contentChange", jsonData);
  }

  function formatArrayValue(value) {
    return Array.isArray(value) ? value.join(", ") : "";
  }

  function formatObjectValue(value) {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : "";
  }
</script>

<div class="json-editor">
  <div class="editor-header">
    <h4 class="editor-title">
      <svg
        class="title-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      JSON Editor
    </h4>
    <button type="button" class="add-field-btn" onclick={addNewField}>
      <svg
        class="btn-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      Add Field
    </button>
  </div>

  <div class="fields-container">
    {#each Object.entries(jsonData) as [key, value]}
      <div class="field-row">
        <div class="field-header">
          <label class="field-label">{key}</label>
          <div class="field-controls">
            <select
              class="type-select"
              bind:value={fieldTypes[key]}
              onchange={(e) => changeFieldType(key, e.target.value)}
            >
              <option value="string">String</option>
              <option value="integer">Integer</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="array">Array</option>
              <option value="object">Object</option>
            </select>
            <button
              type="button"
              class="remove-field-btn"
              onclick={() => removeField(key)}
              title="Remove field"
            >
              <svg
                class="btn-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="field-input">
          {#if fieldTypes[key] === "boolean"}
            <label class="checkbox-container">
              <input
                type="checkbox"
                bind:checked={jsonData[key]}
                onchange={(e) =>
                  handleFieldChange(key, e.target.checked, "boolean")}
              />
              <span class="checkbox-label">{value ? "True" : "False"}</span>
            </label>
          {:else if fieldTypes[key] === "integer"}
            <input
              type="number"
              step="1"
              bind:value={jsonData[key]}
              onchange={(e) =>
                handleFieldChange(key, e.target.value, "integer")}
              class="field-input-element"
            />
          {:else if fieldTypes[key] === "number"}
            <input
              type="number"
              step="any"
              bind:value={jsonData[key]}
              onchange={(e) => handleFieldChange(key, e.target.value, "number")}
              class="field-input-element"
            />
          {:else if fieldTypes[key] === "array"}
            <input
              type="text"
              value={formatArrayValue(value)}
              onchange={(e) => handleFieldChange(key, e.target.value, "array")}
              class="field-input-element"
              placeholder="Enter comma-separated values"
            />
          {:else if fieldTypes[key] === "object"}
            <textarea
              value={formatObjectValue(value)}
              onchange={(e) => handleFieldChange(key, e.target.value, "object")}
              class="field-textarea"
              placeholder="Enter JSON object"
              rows="3"
            ></textarea>
          {:else}
            <input
              type="text"
              bind:value={jsonData[key]}
              onchange={(e) => handleFieldChange(key, e.target.value, "string")}
              class="field-input-element"
            />
          {/if}
        </div>
      </div>
    {/each}

    {#if Object.keys(jsonData).length === 0}
      <div class="empty-state">
        <svg
          class="empty-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p class="empty-text">No fields available</p>
        <button type="button" class="add-first-field-btn" onclick={addNewField}>
          Add your first field
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .json-editor {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    min-height: 300px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .editor-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .title-icon {
    width: 20px;
    height: 20px;
    color: #6b7280;
  }

  .add-field-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .add-field-btn:hover {
    background: #2563eb;
  }

  .btn-icon {
    width: 16px;
    height: 16px;
  }

  .fields-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field-row {
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
  }

  .field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .field-label {
    font-weight: 500;
    color: #374151;
    font-size: 14px;
  }

  .field-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .type-select {
    padding: 4px 8px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 12px;
    background: white;
    color: #374151;
  }

  .remove-field-btn {
    padding: 4px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .remove-field-btn:hover {
    background: #dc2626;
  }

  .field-input {
    width: 100%;
  }

  .field-input-element {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.2s;
  }

  .field-input-element:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .field-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    resize: vertical;
    transition: border-color 0.2s;
  }

  .field-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .checkbox-container {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-container input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }

  .checkbox-label {
    font-size: 14px;
    color: #374151;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: #9ca3af;
    margin-bottom: 12px;
  }

  .empty-text {
    color: #6b7280;
    font-size: 16px;
    margin: 0 0 16px 0;
  }

  .add-first-field-btn {
    padding: 10px 20px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .add-first-field-btn:hover {
    background: #2563eb;
  }
</style>
