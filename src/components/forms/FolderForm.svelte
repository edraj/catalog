<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Dmart, QueryType } from "@edraj/tsdmart";
  import { _ } from "svelte-i18n";

  const dispatch = createEventDispatcher();

  let {
    content = $bindable({}),
  }: {
    content: any;
  } = $props();

  content = {
    icon: content.icon || "",
    icon_closed: content.icon_closed || "",
    icon_opened: content.icon_opened || "",
    shortname_title: content.shortname_title || "",

    index_attributes: content.index_attributes || [],

    query: content.query || {
      type: "",
      search: "",
      filter_types: [],
    },

    search_columns: content.search_columns || [],
    csv_columns: content.csv_columns || [],

    sort_by: content.sort_by || "",
    sort_type: content.sort_type || "",

    content_resource_types: content.content_resource_types || [],
    content_schema_shortnames: content.content_schema_shortnames || [],
    workflow_shortnames: content.workflow_shortnames || [],
    enable_pdf_schema_shortnames: content.enable_pdf_schema_shortnames || [],

    allow_view: content.allow_view || true,
    allow_create: content.allow_create || true,
    allow_update: content.allow_update || true,
    allow_delete: content.allow_delete || false,
    allow_create_category: content.allow_create_category || false,
    allow_csv: content.allow_csv || false,
    allow_upload_csv: content.allow_upload_csv || false,
    use_media: content.use_media || false,
    stream: content.stream || false,
    expand_children: content.expand_children || false,
    disable_filter: content.disable_filter || false,

    ...content,
  };

  if (!content.query) content.query = {};

  let errors = $state({});

  function validateForm() {
    errors = {};

    if (!content.index_attributes || content.index_attributes.length === 0) {
      errors["index_attributes"] = $_("validation.index_attributes_required");
    }

    return Object.keys(errors).length === 0;
  }

  function onSave() {
    if (validateForm()) {
      dispatch("save", content);
    }
  }

  function addItem(path, template = {}) {
    let target = content;
    const parts = path.split(".");

    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    if (!target[lastPart]) target[lastPart] = [];

    target[lastPart] = [...target[lastPart], structuredClone(template)];
    content = { ...content };
  }

  function removeItem(path, index) {
    let target = content;
    const parts = path.split(".");

    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) return;
      target = target[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    if (!target[lastPart]) return;

    target[lastPart] = target[lastPart].filter((_, i) => i !== index);
    content = { ...content };
  }

  function handleResourceTypeChange(e) {
    const target = e.target as HTMLSelectElement;
    if (target.value) {
      content.content_resource_types = [target.value];
    } else {
      content.content_resource_types = [];
    }
  }

  function addSchemaShortname(e) {
    if (
      e.target.value &&
      !content.content_schema_shortnames.includes(e.target.value)
    ) {
      content.content_schema_shortnames = [
        ...content.content_schema_shortnames,
        e.target.value,
      ];
      e.target.value = "";
    }
  }

  function removeSchemaShortname(schema) {
    content.content_schema_shortnames =
      content.content_schema_shortnames.filter((s) => s !== schema);
  }

  function addWorkflowShortname(e) {
    if (
      e.target.value &&
      !content.workflow_shortnames.includes(e.target.value)
    ) {
      content.workflow_shortnames = [
        ...content.workflow_shortnames,
        e.target.value,
      ];
      e.target.value = "";
    }
  }

  function removeWorkflowShortname(workflow) {
    content.workflow_shortnames = content.workflow_shortnames.filter(
      (w) => w !== workflow
    );
  }
</script>

<div class="editor-card">
  <h2 class="editor-title">{$_("editor.title")}</h2>

  <div class="editor-content">
    <!-- Index Attributes Section -->
    <div class="section">
      <h3 class="section-title">{$_("sections.index_attributes.title")}</h3>
      <p class="section-description">
        {$_("sections.index_attributes.description")}
      </p>

      {#if errors["index_attributes"]}
        <p class="error-message">{errors["index_attributes"]}</p>
      {/if}

      {#if content.index_attributes?.length > 0}
        {#each content.index_attributes as attribute, index}
          <div class="attribute-item">
            <div class="attribute-input">
              <label for="index_attribute_key_{index}"></label>
              <input
                class="input-field"
                bind:value={attribute.key}
                placeholder={$_("placeholders.key")}
              />
            </div>
            <div class="attribute-input">
              <label for="index_attribute_name_{index}"></label>
              <input
                class="input-field"
                bind:value={attribute.name}
                placeholder={$_("placeholders.name")}
              />
            </div>
            <button
              type="button"
              class="button-danger button-small"
              onclick={() => removeItem("index_attributes", index)}
            >
              {$_("buttons.remove")}
            </button>
          </div>
        {/each}
      {/if}

      <button
        type="button"
        class="button-outline button-small add-button"
        onclick={() => addItem("index_attributes", { key: "", name: "" })}
      >
        {$_("buttons.add_index_attribute")}
      </button>
    </div>

    <!-- Sort Settings -->
    <div class="grid-2">
      <div class="field-group">
        <label for="sort_by" class="field-label">{$_("fields.sort_by")}</label>
        <input
          id="sort_by"
          class="input-field"
          placeholder={$_("placeholders.sort_by")}
          bind:value={content.sort_by}
        />
      </div>

      <div class="field-group">
        <label for="sort_type" class="field-label"
          >{$_("fields.sort_order")}</label
        >
        <select
          id="sort_type"
          class="select-field"
          bind:value={content.sort_type}
        >
          <option value="">{$_("options.select_sort_order")}</option>
          <option value="ascending">{$_("options.ascending")}</option>
          <option value="descending">{$_("options.descending")}</option>
        </select>
      </div>
    </div>

    <!-- Content Resource Types -->
    <div class="section">
      <h3 class="section-title">
        {$_("sections.content_resource_types.title")}
      </h3>
      <div class="field-group">
        <select
          id="resource-type-select"
          class="select-field"
          onchange={handleResourceTypeChange}
        >
          <option value="">{$_("options.select_type")}</option>
          <option
            value="ticket"
            selected={content.content_resource_types.includes("ticket")}
          >
            {$_("resource_types.ticket")}
          </option>
          <option
            value="content"
            selected={content.content_resource_types.includes("content")}
          >
            {$_("resource_types.content")}
          </option>
        </select>
      </div>
    </div>

    <!-- Schema Shortnames -->
    <div class="section">
      <h3 class="section-title">{$_("sections.schema_shortnames.title")}</h3>
      <div class="field-group">
        <select class="select-field" onchange={addSchemaShortname}>
          <option value="">{$_("options.select_schema_to_add")}</option>
          {#await Dmart.query( { space_name: "template_test", type: QueryType.search, subpath: "/schema", search: "", retrieve_json_payload: true, limit: 99 } ) then schemas}
            {#each schemas.records.map((e) => e.shortname) as schema}
              <option value={schema}>{schema}</option>
            {/each}
          {:catch error}
            <option disabled>{$_("errors.loading_schemas")}</option>
          {/await}
        </select>

        {#if content.content_schema_shortnames.length > 0}
          <div class="tags-container">
            {#each content.content_schema_shortnames as schema}
              <span class="tag">
                {schema}
                <button
                  aria-label={`Remove schema ${schema}`}
                  type="button"
                  class="tag-remove"
                  onclick={() => removeSchemaShortname(schema)}
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Workflow Shortnames -->
    <div class="section">
      <h3 class="section-title">{$_("sections.workflow_shortnames.title")}</h3>
      <div class="field-group">
        <select class="select-field" onchange={addWorkflowShortname}>
          <option value="">{$_("options.select_workflow_to_add")}</option>
          {#await Dmart.query( { space_name: "management", type: QueryType.search, subpath: "/workflow", search: "", retrieve_json_payload: true, limit: 99 } ) then workflows}
            {#each workflows.records.map((e) => e.shortname) as workflow}
              <option value={workflow}>{workflow}</option>
            {/each}
          {:catch error}
            <option disabled>{$_("errors.loading_workflows")}</option>
          {/await}
        </select>

        {#if content.workflow_shortnames.length > 0}
          <div class="tags-container">
            {#each content.workflow_shortnames as workflow}
              <span class="tag">
                {workflow}
                <button
                  aria-label={`Remove workflow ${workflow}`}
                  type="button"
                  class="tag-remove"
                  onclick={() => removeWorkflowShortname(workflow)}
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .editor-card {
    background: white;
    border-radius: 12px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    max-width: 90rem;
    margin: 0.5rem auto;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
  }

  .editor-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 1.5rem;
    margin-top: 0;
  }

  .editor-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1.5rem;
    background-color: #fafafa;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
    margin-top: 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
    margin-top: 0;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .grid-2 {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    font-weight: 500;
    font-size: 0.875rem;
    color: #374151;
  }

  .input-field {
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.15s ease-in-out;
    background: white;
    width: 100%;
  }

  .input-field:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .select-field {
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    width: 100%;
  }

  .select-field:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .attribute-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .attribute-input {
    flex: 1;
  }

  .button-small {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    white-space: nowrap;
  }

  .button-danger {
    background-color: #ef4444;
    color: white;
    border: 1px solid #ef4444;
  }

  .button-danger:hover {
    background-color: #dc2626;
    border-color: #dc2626;
  }

  .button-outline {
    background-color: transparent;
    color: #6b7280;
    border: 1px solid #d1d5db;
  }

  .button-outline:hover {
    background-color: #f9fafb;
    color: #374151;
    border-color: #9ca3af;
  }

  .add-button {
    margin-top: 0.75rem;
    align-self: flex-start;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .tag {
    background-color: #dbeafe;
    color: #1e40af;
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    border: 1px solid #93c5fd;
  }

  .tag-remove {
    background: none;
    border: none;
    color: #1e40af;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.15s ease-in-out;
  }

  .tag-remove:hover {
    background-color: #1e40af;
    color: white;
  }

  .error-message {
    color: #ef4444;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    margin-top: 0;
  }

  option:disabled {
    color: #9ca3af;
    font-style: italic;
  }

  @media (max-width: 640px) {
    .attribute-item {
      flex-direction: column;
      align-items: stretch;
    }

    .attribute-input {
      width: 100%;
    }

    .tags-container {
      margin-top: 0.5rem;
    }
  }
</style>
