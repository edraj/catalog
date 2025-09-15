<script lang="ts">
  import {
    transformFormToJson,
    transformJsonToForm,
  } from "@/lib/schemaEditorUtils";
  import { _, locale } from "@/i18n";

  let {
    content = $bindable({}),
  }: {
    content: any;
  } = $props();

  if (!content || Object.keys(content).length === 0) {
    content = {
      type: "object",
      properties: {},
      required: [],
    };
  }

  let formContent = $state(transformJsonToForm($state.snapshot(content)));

  const schemaTypes = [
    { value: "string", name: "String" },
    { value: "number", name: "Number" },
    { value: "integer", name: "Integer" },
    { value: "boolean", name: "Boolean" },
    { value: "object", name: "Object" },
    { value: "array", name: "Array" },
    { value: "null", name: "Null" },
  ];

  function addProperty(parentPath = "") {
    const newProperty = {
      id: crypto.randomUUID(),
      name: "",
      type: "string",
      title: "",
      description: "",
    };

    if (parentPath) {
      const parent = getPropertyByPath(formContent, parentPath);
      if (parent && !parent.properties) {
        parent.properties = [];
      }
      if (parent) {
        parent.properties.push(newProperty);
      }
    } else {
      if (!formContent.properties) {
        formContent.properties = [];
      }
      formContent.properties.push(newProperty);
    }

    formContent = { ...formContent };
  }

  function addArrayItem(parentPath) {
    const parent = getPropertyByPath(formContent, parentPath);
    if (parent) {
      if (!parent.items) {
        parent.items = {
          id: crypto.randomUUID(),
          type: "string",
        };
      }

      if (parent.items.type === "object" && !parent.items.properties) {
        parent.items.properties = [];
      }

      formContent = { ...formContent };
    }
  }

  function removeProperty(path, index) {
    const parts = path.split(".");
    let current = formContent;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) return;
      current = current[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    if (!current[lastPart]) return;

    current[lastPart].splice(index, 1);
    formContent = { ...formContent };
  }

  function getPropertyByPath(obj, path) {
    const parts = path.split(".");
    let current = obj;

    for (const part of parts) {
      if (!current[part]) return null;
      current = current[part];
    }

    return current;
  }

  function toggleRequired(propertyName) {
    if (!formContent.required) {
      formContent.required = [];
    }

    const index = formContent.required.indexOf(propertyName);
    if (index === -1) {
      formContent.required.push(propertyName);
    } else {
      formContent.required.splice(index, 1);
    }

    formContent = { ...formContent };
  }

  function isRequired(propertyName) {
    return formContent.required && formContent.required.includes(propertyName);
  }

  function toggleAccordion(event) {
    const button = event.currentTarget;
    const content = button.nextElementSibling;
    const isExpanded = button.getAttribute("aria-expanded") === "true";

    button.setAttribute("aria-expanded", !isExpanded);
    content.style.display = isExpanded ? "none" : "block";

    // Toggle chevron rotation
    const chevron = button.querySelector(".chevron");
    if (chevron) {
      chevron.style.transform = isExpanded ? "rotate(0deg)" : "rotate(180deg)";
    }
  }

  $effect(() => {
    const schemaContent = transformFormToJson(
      structuredClone($state.snapshot(formContent))
    );
    content = schemaContent;
  });
</script>

<div class="schema-editor">
  <h2 class="schema-title">{$_("schema_editor.title")}</h2>

  <div class="schema-content">
    <!-- Schema Metadata -->
    <div class="metadata-section">
      <div class="form-group">
        <label for="schema-title"
          >{$_("schema_editor.schema_title_label")}</label
        >
        <input
          id="schema-title"
          type="text"
          placeholder={$_("schema_editor.schema_title_placeholder")}
          bind:value={formContent.title}
        />
      </div>
      <div class="form-group">
        <label for="schema-description"
          >{$_("schema_editor.schema_description_label")}</label
        >
        <input
          id="schema-description"
          type="text"
          placeholder={$_("schema_editor.schema_description_placeholder")}
          bind:value={formContent.description}
        />
      </div>
    </div>

    <!-- Properties -->
    <div class="properties-section">
      <div class="section-header">
        <h3>{$_("schema_editor.properties_title")}</h3>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => addProperty()}
        >
          {$_("schema_editor.add_property_button")}
        </button>
      </div>

      {#if formContent.properties && formContent.properties.length > 0}
        <div class="accordion">
          {#each formContent.properties as property, index}
            <div class="accordion-item">
              <button
                type="button"
                class="accordion-header"
                onclick={toggleAccordion}
                aria-expanded="false"
              >
                <div class="property-info">
                  <span class="property-name"
                    >{property.name || $_("schema_editor.new_property")}</span
                  >
                  {#if property.type}
                    <span class="badge badge-type">{property.type}</span>
                  {/if}
                  {#if isRequired(property.name)}
                    <span class="badge badge-required"
                      >{$_("schema_editor.required")}</span
                    >
                  {/if}
                </div>
                <svg
                  class="chevron"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path
                    d="M4.427 9.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 9H4.604a.25.25 0 00-.177.427z"
                  />
                </svg>
              </button>

              <div class="accordion-content" style="display: none;">
                <div class="property-form">
                  <div class="form-grid">
                    <div class="form-group">
                      <label for={`property-name-${index}`}
                        >{$_("schema_editor.property_name_label")}</label
                      >
                      <input
                        id={`property-name-${index}`}
                        type="text"
                        placeholder={$_(
                          "schema_editor.property_name_placeholder"
                        )}
                        bind:value={property.name}
                      />
                    </div>
                    <div class="form-group">
                      <label for={`property-type-${index}`}
                        >{$_("schema_editor.property_type_label")}</label
                      >
                      <select
                        id={`property-type-${index}`}
                        bind:value={property.type}
                      >
                        {#each schemaTypes as type}
                          <option value={type.value}>{type.name}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="form-group">
                      <label for={`property-title-${index}`}
                        >{$_("schema_editor.property_title_label")}</label
                      >
                      <input
                        id={`property-title-${index}`}
                        type="text"
                        placeholder={$_(
                          "schema_editor.property_title_placeholder"
                        )}
                        bind:value={property.title}
                      />
                    </div>
                    <div class="form-group">
                      <label for={`property-description-${index}`}
                        >{$_("schema_editor.property_description_label")}</label
                      >
                      <input
                        id={`property-description-${index}`}
                        type="text"
                        placeholder={$_(
                          "schema_editor.property_description_placeholder"
                        )}
                        bind:value={property.description}
                      />
                    </div>
                  </div>

                  <!-- Type-specific options -->
                  {#if property.type === "string"}
                    <div class="type-options">
                      <h4>{$_("schema_editor.string_options_title")}</h4>
                      <div class="form-grid">
                        <div class="form-group">
                          <label for={`property-minLength-${index}`}
                            >{$_("schema_editor.min_length_label")}</label
                          >
                          <input
                            id={`property-minLength-${index}`}
                            type="number"
                            placeholder={$_(
                              "schema_editor.min_length_placeholder"
                            )}
                            bind:value={property.minLength}
                          />
                        </div>
                        <div class="form-group">
                          <label for={`property-maxLength-${index}`}
                            >{$_("schema_editor.max_length_label")}</label
                          >
                          <input
                            id={`property-maxLength-${index}`}
                            type="number"
                            placeholder={$_(
                              "schema_editor.max_length_placeholder"
                            )}
                            bind:value={property.maxLength}
                          />
                        </div>
                        <div class="form-group">
                          <label for={`property-pattern-${index}`}
                            >{$_("schema_editor.pattern_label")}</label
                          >
                          <input
                            id={`property-pattern-${index}`}
                            type="text"
                            placeholder={$_(
                              "schema_editor.pattern_placeholder"
                            )}
                            bind:value={property.pattern}
                          />
                        </div>
                        <div class="form-group">
                          <label for={`property-format-${index}`}
                            >{$_("schema_editor.format_label")}</label
                          >
                          <select
                            id={`property-format-${index}`}
                            bind:value={property.format}
                          >
                            <option value=""
                              >{$_("schema_editor.format_none")}</option
                            >
                            <option value="date-time"
                              >{$_("schema_editor.format_date_time")}</option
                            >
                            <option value="date"
                              >{$_("schema_editor.format_date")}</option
                            >
                            <option value="time"
                              >{$_("schema_editor.format_time")}</option
                            >
                            <option value="email"
                              >{$_("schema_editor.format_email")}</option
                            >
                            <option value="uri"
                              >{$_("schema_editor.format_uri")}</option
                            >
                          </select>
                        </div>
                      </div>
                    </div>
                  {:else if property.type === "number" || property.type === "integer"}
                    <div class="type-options">
                      <h4>{$_("schema_editor.number_options_title")}</h4>
                      <div class="form-grid">
                        <div class="form-group">
                          <label for={`property-minimum-${index}`}
                            >{$_("schema_editor.minimum_label")}</label
                          >
                          <input
                            id={`property-minimum-${index}`}
                            type="number"
                            placeholder={$_(
                              "schema_editor.minimum_placeholder"
                            )}
                            bind:value={property.minimum}
                          />
                        </div>
                        <div class="form-group">
                          <label for={`property-maximum-${index}`}
                            >{$_("schema_editor.maximum_label")}</label
                          >
                          <input
                            id={`property-maximum-${index}`}
                            type="number"
                            placeholder={$_(
                              "schema_editor.maximum_placeholder"
                            )}
                            bind:value={property.maximum}
                          />
                        </div>
                        <div class="form-group">
                          <label for={`property-multipleOf-${index}`}
                            >{$_("schema_editor.multiple_of_label")}</label
                          >
                          <input
                            id={`property-multipleOf-${index}`}
                            type="number"
                            placeholder={$_(
                              "schema_editor.multiple_of_placeholder"
                            )}
                            bind:value={property.multipleOf}
                          />
                        </div>
                      </div>
                    </div>
                  {:else if property.type === "array"}
                    <div class="type-options">
                      <h4>{$_("schema_editor.array_options_title")}</h4>
                      <div class="array-section">
                        <div class="array-header">
                          <span>{$_("schema_editor.array_items_label")}</span>
                          <button
                            type="button"
                            class="btn btn-secondary btn-sm"
                            onclick={() => addArrayItem(`properties.${index}`)}
                          >
                            {$_("schema_editor.configure_items_button")}
                          </button>
                        </div>

                        {#if property.items}
                          <div class="array-content">
                            <div class="form-grid">
                              <div class="form-group">
                                <label for={`items-type-${index}`}
                                  >Items Type</label
                                >
                                <select
                                  id={`items-type-${index}`}
                                  bind:value={property.items.type}
                                >
                                  {#each schemaTypes as type}
                                    <option value={type.value}
                                      >{type.name}</option
                                    >
                                  {/each}
                                </select>
                              </div>
                            </div>

                            {#if property.items.type === "object" && property.items.properties}
                              <div class="nested-section">
                                <div class="nested-header">
                                  <span
                                    >{$_(
                                      "schema_editor.object_properties_label"
                                    )}</span
                                  >
                                  <button
                                    type="button"
                                    class="btn btn-secondary btn-sm"
                                    onclick={() =>
                                      addProperty(`properties.${index}.items`)}
                                  >
                                    {$_("schema_editor.add_property_button")}
                                  </button>
                                </div>

                                {#if property.items.properties.length > 0}
                                  <div class="nested-items">
                                    {#each property.items.properties as itemProperty, itemIndex}
                                      <div class="nested-item">
                                        <div class="form-grid">
                                          <div class="form-group">
                                            <label
                                              for={`item-property-name-${index}-${itemIndex}`}
                                              >{$_(
                                                "schema_editor.property_name_label"
                                              )}</label
                                            >
                                            <input
                                              id={`item-property-name-${index}-${itemIndex}`}
                                              type="text"
                                              placeholder={$_(
                                                "schema_editor.property_name_placeholder"
                                              )}
                                              bind:value={itemProperty.name}
                                            />
                                          </div>
                                          <div class="form-group">
                                            <label
                                              for={`item-property-type-${index}-${itemIndex}`}
                                              >{$_(
                                                "schema_editor.property_type_label"
                                              )}</label
                                            >
                                            <select
                                              id={`item-property-type-${index}-${itemIndex}`}
                                              bind:value={itemProperty.type}
                                            >
                                              {#each schemaTypes as type}
                                                <option value={type.value}
                                                  >{type.name}</option
                                                >
                                              {/each}
                                            </select>
                                          </div>
                                        </div>
                                        <div class="item-actions">
                                          <button
                                            type="button"
                                            class="btn btn-danger btn-sm"
                                            onclick={() =>
                                              removeProperty(
                                                `properties.${index}.items.properties`,
                                                itemIndex
                                              )}
                                          >
                                            {$_("schema_editor.remove_button")}
                                          </button>
                                        </div>
                                      </div>
                                    {/each}
                                  </div>
                                {/if}
                              </div>
                            {/if}

                            <div class="form-grid">
                              <div class="form-group">
                                <label for={`array-minItems-${index}`}
                                  >{$_("schema_editor.min_items_label")}</label
                                >
                                <input
                                  id={`array-minItems-${index}`}
                                  type="number"
                                  placeholder={$_(
                                    "schema_editor.min_items_placeholder"
                                  )}
                                  bind:value={property.minItems}
                                />
                              </div>
                              <div class="form-group">
                                <label for={`array-maxItems-${index}`}
                                  >{$_("schema_editor.max_items_label")}</label
                                >
                                <input
                                  id={`array-maxItems-${index}`}
                                  type="number"
                                  placeholder={$_(
                                    "schema_editor.max_items_placeholder"
                                  )}
                                  bind:value={property.maxItems}
                                />
                              </div>
                            </div>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {:else if property.type === "object"}
                    <div class="type-options">
                      <h4>{$_("schema_editor.object_options_title")}</h4>
                      <div class="object-section">
                        <div class="object-header">
                          <span
                            >{$_("schema_editor.object_properties_label")}</span
                          >
                          <button
                            type="button"
                            class="btn btn-secondary btn-sm"
                            onclick={() => addProperty(`properties.${index}`)}
                          >
                            {$_("schema_editor.add_property_button")}
                          </button>
                        </div>

                        {#if property.properties && property.properties.length > 0}
                          <div class="nested-items">
                            {#each property.properties as nestedProperty, nestedIndex}
                              <div class="nested-item">
                                <div class="form-grid">
                                  <div class="form-group">
                                    <label
                                      for={`nested-property-name-${index}-${nestedIndex}`}
                                      >{$_(
                                        "schema_editor.property_name_label"
                                      )}</label
                                    >
                                    <input
                                      id={`nested-property-name-${index}-${nestedIndex}`}
                                      type="text"
                                      placeholder={$_(
                                        "schema_editor.property_name_placeholder"
                                      )}
                                      bind:value={nestedProperty.name}
                                    />
                                  </div>
                                  <div class="form-group">
                                    <label
                                      for={`nested-property-type-${index}-${nestedIndex}`}
                                      >{$_(
                                        "schema_editor.property_type_label"
                                      )}</label
                                    >
                                    <select
                                      id={`nested-property-type-${index}-${nestedIndex}`}
                                      bind:value={nestedProperty.type}
                                    >
                                      {#each schemaTypes as type}
                                        <option value={type.value}
                                          >{type.name}</option
                                        >
                                      {/each}
                                    </select>
                                  </div>
                                </div>
                                <div class="item-actions">
                                  <button
                                    type="button"
                                    class="btn btn-danger btn-sm"
                                    onclick={() =>
                                      removeProperty(
                                        `properties.${index}.properties`,
                                        nestedIndex
                                      )}
                                  >
                                    {$_("schema_editor.remove_button")}
                                  </button>
                                </div>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <div class="property-controls">
                    <div class="checkbox-group">
                      <input
                        id={`property-required-${index}`}
                        type="checkbox"
                        checked={isRequired(property.name)}
                        onchange={() => toggleRequired(property.name)}
                      />
                      <label for={`property-required-${index}`}
                        >{$_("schema_editor.required")}</label
                      >
                    </div>

                    <div class="property-actions">
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onclick={() => removeProperty("properties", index)}
                      >
                        {$_("schema_editor.remove_property_button")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>{$_("schema_editor.empty_state")}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .schema-editor {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(229, 231, 235, 0.8);
    max-width: 100%;
    overflow: hidden;
  }

  .schema-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
    padding: 1.5rem 2rem 0;
  }

  .schema-content {
    padding: 0 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Metadata Section */
  .metadata-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .metadata-section {
      grid-template-columns: 1fr;
    }
  }

  /* Form Elements */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin: 0;
  }

  .form-group input,
  .form-group select {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    background: white;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Properties Section */
  .properties-section {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    border-bottom: 1px solid #f3f4f6;
  }

  .section-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  /* Buttons */
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
  }

  .btn-secondary:hover {
    background: #4b5563;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  /* Accordion */
  .accordion {
    border-top: 1px solid #f3f4f6;
  }

  .accordion-item {
    border-bottom: 1px solid #f3f4f6;
  }

  .accordion-header {
    width: 100%;
    padding: 1rem 1.5rem;
    background: white;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-size: inherit;
    text-align: left;
  }

  .accordion-header:hover {
    background: #f9fafb;
  }

  .property-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .property-name {
    font-weight: 500;
    color: #111827;
  }

  .badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-weight: 500;
  }

  .badge-type {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .badge-required {
    background-color: #fee2e2;
    color: #dc2626;
  }

  .chevron {
    transition: transform 0.2s ease;
    color: #6b7280;
  }

  .accordion-content {
    background: #fafafa;
    border-top: 1px solid #e5e7eb;
  }

  .property-form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Type Options */
  .type-options {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: white;
  }

  .type-options h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 1rem 0;
  }

  /* Array and Object Sections */
  .array-section,
  .object-section {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 1rem;
    background: #f9fafb;
  }

  .array-header,
  .object-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-weight: 500;
    color: #374151;
  }

  .array-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .nested-section {
    margin-top: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
    background: white;
  }

  .nested-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-weight: 500;
    color: #374151;
  }

  .nested-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .nested-item {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
    background: #fefefe;
  }

  .item-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  /* Property Controls */
  .property-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .checkbox-group input[type="checkbox"] {
    margin: 0;
    width: auto;
  }

  .checkbox-group label {
    margin: 0;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .property-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #6b7280;
  }

  .empty-state p {
    margin: 0;
    font-style: italic;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .schema-content {
      padding: 0 1rem 1rem;
    }

    .section-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .property-controls {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .property-info {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .array-header,
    .object-header,
    .nested-header {
      flex-direction: column;
      gap: 0.75rem;
      align-items: stretch;
    }
  }
</style>
