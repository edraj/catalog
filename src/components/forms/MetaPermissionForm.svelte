<script lang="ts">
  import { RequestType, ResourceType } from "@edraj/tsdmart";
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    getChildren,
    getChildrenAndSubChildren,
    getSpaces,
  } from "@/lib/dmart_services";
  import { errorToastMessage } from "@/lib/toasts_messages";

  let {
    formData = $bindable(),
    validateFn = $bindable(),
  }: {
    formData: any;
    validateFn: () => boolean;
  } = $props();

  let form;

  formData = {
    ...formData,
    subpaths: formData.subpaths || {},
    resource_types: formData.resource_types || [],
    actions: formData.actions || [],
    conditions: formData.conditions || [],
    restricted_fields: formData.restricted_fields || [],
    allowed_fields_values: formData.allowed_fields_values || {},
  };

  const resourceTypeOptions = Object.keys(ResourceType).map((key) => ({
    name: key,
    value: ResourceType[key],
  }));

  const requestTypeOptions = Object.keys(RequestType).map((key) => ({
    name: key,
    value: RequestType[key],
  }));
  requestTypeOptions.unshift({
    name: "view",
    value: "view",
  });
  requestTypeOptions.unshift({
    name: "query",
    value: "query",
  });

  let selectedResourceType = "";
  let selectedAction = "";
  let newCondition = "";
  let newRestrictedField = "";

  let spaces = $state([]);
  let subpaths = $state([]);
  let selectedSpace = $state("");
  let selectedSubpath = $state("");
  let loadingSpaces = $state(true);
  let loadingSubpaths = $state(false);

  let accordionStates = $state({
    subpaths: false,
    conditions: false,
    restrictedFields: false,
    allowedFields: false,
  });

  onMount(async () => {
    try {
      const spacesResponse = await getSpaces();
      spaces = spacesResponse.records.map((space) => ({
        name: space.shortname,
        value: space.shortname,
      }));
      spaces.unshift({
        name: "__all_spaces__",
        value: "__all_spaces__",
      });
    } catch (error) {
      console.error("Failed to load spaces:", error);
    } finally {
      loadingSpaces = false;
    }
  });

  function addResourceType() {
    if (
      selectedResourceType &&
      !formData.resource_types.includes(selectedResourceType)
    ) {
      formData.resource_types = [
        ...formData.resource_types,
        selectedResourceType,
      ];
      selectedResourceType = "";
    }
  }

  function removeResourceType(item) {
    formData.resource_types = formData.resource_types.filter((i) => i !== item);
  }

  function addAction() {
    if (selectedAction && !formData.actions.includes(selectedAction)) {
      formData.actions = [...formData.actions, selectedAction];
      selectedAction = "";
    }
  }

  function removeAction(item) {
    formData.actions = formData.actions.filter((i) => i !== item);
  }

  function addCondition() {
    if (newCondition && !formData.conditions.includes(newCondition)) {
      formData.conditions = [...formData.conditions, newCondition];
      newCondition = "";
    }
  }

  function removeCondition(item) {
    formData.conditions = formData.conditions.filter((i) => i !== item);
  }

  function addRestrictedField() {
    if (
      newRestrictedField &&
      !formData.restricted_fields.includes(newRestrictedField)
    ) {
      formData.restricted_fields = [
        ...formData.restricted_fields,
        newRestrictedField,
      ];
      newRestrictedField = "";
    }
  }

  async function loadSubpaths(spaceName) {
    if (!spaceName) return;

    loadingSubpaths = true;
    try {
      const subpathsResponse = [];
      const childSubpaths = await getChildren(spaceName, "/");
      await getChildrenAndSubChildren(
        subpathsResponse,
        spaceName,
        "",
        childSubpaths
      );
      subpaths = subpathsResponse.map((record) => ({
        name: record,
        value: record,
      }));
    } catch (error) {
      console.error("Failed to load subpaths:", error);
      subpaths = [];
    } finally {
      subpaths.unshift({
        name: "__all_subpaths__",
        value: "__all_subpaths__",
      });
      subpaths.unshift({
        name: "/",
        value: "/",
      });
      loadingSubpaths = false;
    }
  }

  function addSubpathToSpace() {
    if (!selectedSpace || !selectedSubpath) return;

    if (!formData.subpaths[selectedSpace]) {
      formData.subpaths[selectedSpace] = [];
    }

    if (!formData.subpaths[selectedSpace].includes(selectedSubpath)) {
      formData.subpaths[selectedSpace] = [
        ...formData.subpaths[selectedSpace],
        selectedSubpath,
      ];
    }

    selectedSubpath = "";
  }

  function removeSubpath(space, subpath) {
    formData.subpaths[space] = formData.subpaths[space].filter(
      (p) => p !== subpath
    );

    if (formData.subpaths[space].length === 0) {
      const { [space]: _, ...rest } = formData.subpaths;
      formData.subpaths = rest;
    }
  }

  function removeRestrictedField(item) {
    formData.restricted_fields = formData.restricted_fields.filter(
      (i) => i !== item
    );
  }

  let jsonEditorContent = "";

  function updateJsonEditor() {
    try {
      jsonEditorContent = JSON.stringify(
        formData.allowed_fields_values,
        null,
        2
      );
    } catch (e) {
      jsonEditorContent = "{}";
    }
  }

  function saveJsonEditor() {
    try {
      formData.allowed_fields_values = JSON.parse(jsonEditorContent);
    } catch (e) {
      alert($_("errors.invalid_json"));
    }
  }

  function validate() {
    try {
      formData.allowed_fields_values = JSON.parse(jsonEditorContent);
    } catch (e) {
      errorToastMessage($_("validation.json_syntax_error"));
    }

    const isValid = form.checkValidity();

    if (!isValid) {
      form.reportValidity();
    }

    return isValid;
  }

  function toggleAccordion(section) {
    accordionStates[section] = !accordionStates[section];
  }

  $effect(() => {
    validateFn = validate;
  });

  $effect(() => {
    if (selectedSpace) {
      loadSubpaths(selectedSpace);
    }
  });

  const subpathEntries = $derived(Object.entries(formData.subpaths));

  // Reactive declarations for selectedResourceType, selectedAction, newCondition, newRestrictedField, and jsonEditorContent
</script>

<div class="permission-card">
  <h2 class="form-title">{$_("permissions.title")}</h2>

  <form bind:this={form}>
    <div class="form-group">
      <label class="form-label" for="resourceTypeSelect"
        >{$_("permissions.resource_types")}</label
      >
      <div class="input-group">
        <select
          class="form-select"
          bind:value={selectedResourceType}
          id="resourceTypeSelect"
        >
          <option value="">{$_("options.select_resource_type")}</option>
          {#each resourceTypeOptions as option}
            <option value={option.value}>{option.name}</option>
          {/each}
        </select>
        <button
          type="button"
          class="btn btn-primary btn-small"
          onclick={addResourceType}>+</button
        >
      </div>

      {#if formData.resource_types.length > 0}
        <div class="tag-container">
          {#each formData.resource_types as item}
            <div class="tag tag-blue">
              <span>{item}</span>
              <button
                type="button"
                class="tag-remove"
                onclick={() => removeResourceType(item)}>×</button
              >
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">{$_("empty_states.no_resource_types")}</div>
      {/if}
    </div>

    <div class="form-group">
      <label class="form-label" for="actionSelect"
        >{$_("permissions.actions")}</label
      >
      <div class="input-group">
        <select
          class="form-select"
          bind:value={selectedAction}
          id="actionSelect"
        >
          <option value="">{$_("options.select_action")}</option>
          {#each requestTypeOptions as option}
            <option value={option.value}>{option.name}</option>
          {/each}
        </select>
        <button
          type="button"
          class="btn btn-primary btn-small"
          onclick={addAction}>+</button
        >
      </div>

      {#if formData.actions.length > 0}
        <div class="tag-container">
          {#each formData.actions as item}
            <div class="tag tag-green">
              <span>{item}</span>
              <button
                type="button"
                class="tag-remove"
                onclick={() => removeAction(item)}>×</button
              >
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">{$_("empty_states.no_actions")}</div>
      {/if}
    </div>

    <div class="accordion">
      <div class="accordion-item">
        <div
          class="accordion-header"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("subpaths")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("subpaths");
          }}
        >
          <span>{$_("sections.subpaths")}</span>
          <span class="accordion-icon" class:open={accordionStates.subpaths}
            >▼</span
          >
        </div>
        {#if accordionStates.subpaths}
          <div class="accordion-content">
            <div class="grid grid-cols-2">
              <div class="form-group">
                <label class="form-label" for="spaceSelect"
                  >{$_("fields.space")}</label
                >
                {#if loadingSpaces}
                  <div class="loading-container">
                    <div class="spinner"></div>
                    <span>{$_("loading.spaces")}</span>
                  </div>
                {:else}
                  <select
                    class="form-select"
                    bind:value={selectedSpace}
                    id="spaceSelect"
                  >
                    <option value="">{$_("options.select_space")}</option>
                    {#each spaces as space}
                      <option value={space.value}>{space.name}</option>
                    {/each}
                  </select>
                {/if}
              </div>

              <div class="form-group">
                <label class="form-label" for="subpathSelect"
                  >{$_("fields.subpath")}</label
                >
                {#if loadingSubpaths}
                  <div class="loading-container">
                    <div class="spinner"></div>
                    <span>{$_("loading.subpaths")}</span>
                  </div>
                {:else}
                  <div class="input-group">
                    <select
                      class="form-select"
                      bind:value={selectedSubpath}
                      disabled={!selectedSpace}
                      id="subpathSelect"
                    >
                      <option value="">{$_("options.select_subpath")}</option>
                      {#each subpaths as subpath}
                        <option value={subpath.value}>{subpath.name}</option>
                      {/each}
                    </select>
                    <button
                      type="button"
                      class="btn btn-primary btn-small"
                      onclick={addSubpathToSpace}
                      disabled={!selectedSpace || !selectedSubpath}>+</button
                    >
                  </div>
                {/if}
              </div>
            </div>

            {#if Object.keys(formData.subpaths).length > 0}
              <div class="subpath-display">
                {#each subpathEntries as [space, paths]}
                  <div class="subpath-space">
                    <div class="subpath-space-title">{space}</div>
                    <div class="tag-container">
                      {#each Array.isArray(paths) ? paths : [] as path}
                        <div class="tag tag-purple">
                          <span>{path}</span>
                          <button
                            type="button"
                            class="tag-remove"
                            onclick={() => removeSubpath(space, path)}>×</button
                          >
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">{$_("empty_states.no_subpaths")}</div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="accordion-item">
        <div
          class="accordion-header"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("conditions")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("conditions");
          }}
        >
          <span>{$_("sections.conditions")}</span>
          <span class="accordion-icon" class:open={accordionStates.conditions}
            >▼</span
          >
        </div>
        {#if accordionStates.conditions}
          <div class="accordion-content">
            <div class="input-group">
              <select class="form-select" bind:value={newCondition}>
                <option value="">{$_("options.select_condition")}</option>
                <option value="own">{$_("conditions.own")}</option>
                <option value="is_active">{$_("conditions.is_active")}</option>
              </select>
              <button
                type="button"
                class="btn btn-primary btn-small"
                onclick={addCondition}>+</button
              >
            </div>

            {#if formData.conditions.length > 0}
              <div class="tag-container">
                {#each formData.conditions as item}
                  <div class="tag tag-yellow">
                    <span>{item}</span>
                    <button
                      type="button"
                      class="tag-remove"
                      onclick={() => removeCondition(item)}>×</button
                    >
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">{$_("empty_states.no_conditions")}</div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="accordion-item">
        <div
          class="accordion-header"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("restrictedFields")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("restrictedFields");
          }}
        >
          <span>{$_("sections.restricted_fields")}</span>
          <span
            class="accordion-icon"
            class:open={accordionStates.restrictedFields}>▼</span
          >
        </div>
        {#if accordionStates.restrictedFields}
          <div class="accordion-content">
            <div class="input-group">
              <input
                type="text"
                class="form-input"
                placeholder={$_("placeholders.restricted_field")}
                bind:value={newRestrictedField}
                id="restrictedFieldInput"
              />
              <button
                type="button"
                class="btn btn-primary btn-small"
                onclick={addRestrictedField}>+</button
              >
            </div>

            {#if formData.restricted_fields.length > 0}
              <div class="tag-container">
                {#each formData.restricted_fields as item}
                  <div class="tag tag-red">
                    <span>{item}</span>
                    <button
                      type="button"
                      class="tag-remove"
                      onclick={() => removeRestrictedField(item)}>×</button
                    >
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                {$_("empty_states.no_restricted_fields")}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="accordion-item">
        <div
          class="accordion-header"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("allowedFields")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("allowedFields");
          }}
        >
          <span>{$_("sections.allowed_fields_values")}</span>
          <span
            class="accordion-icon"
            class:open={accordionStates.allowedFields}>▼</span
          >
        </div>
        {#if accordionStates.allowedFields}
          <div class="accordion-content">
            <label class="form-label" for="jsonEditor"
              >{$_("fields.json_editor")}</label
            >
            <div class="helper-text">{$_("help.json_editor")}</div>
            <textarea
              class="textarea"
              bind:value={jsonEditorContent}
              id="jsonEditor"
            ></textarea>
            <div
              style="display: flex; justify-content: flex-end; margin-top: 12px;"
            >
              <button
                type="button"
                class="btn btn-secondary"
                onclick={saveJsonEditor}>{$_("buttons.apply_changes")}</button
              >
            </div>
          </div>
        {/if}
      </div>
    </div>
  </form>
</div>

<style>
  .permission-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 24px;
    margin: 16px 0;
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-label {
    display: block;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .form-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
    background: white;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .btn {
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
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
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .btn-small {
    padding: 8px 12px;
    font-size: 12px;
    min-width: 40px;
    height: 40px;
  }

  .input-group {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .input-group .form-input,
  .input-group .form-select {
    flex: 1;
  }

  .tag-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  }

  .tag-blue {
    background: #dbeafe;
    color: #1e40af;
  }

  .tag-green {
    background: #dcfce7;
    color: #166534;
  }

  .tag-purple {
    background: #f3e8ff;
    color: #7c3aed;
  }

  .tag-yellow {
    background: #fef3c7;
    color: #92400e;
  }

  .tag-red {
    background: #fee2e2;
    color: #dc2626;
  }

  .tag-remove {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    margin: 0;
  }

  .tag-remove:hover {
    opacity: 0.7;
  }

  .empty-state {
    padding: 24px;
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    text-align: center;
    color: #6b7280;
    font-size: 14px;
    margin-top: 12px;
  }

  .accordion {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .accordion-item {
    border-bottom: 1px solid #e5e7eb;
  }

  .accordion-item:last-child {
    border-bottom: none;
  }

  .accordion-header {
    background: #f9fafb;
    padding: 16px 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: #374151;
    transition: background-color 0.2s ease;
  }

  .accordion-header:hover {
    background: #f3f4f6;
  }

  .accordion-icon {
    transition: transform 0.2s ease;
    font-size: 12px;
  }

  .accordion-icon.open {
    transform: rotate(180deg);
  }

  .accordion-content {
    padding: 20px;
    background: white;
  }

  .grid {
    display: grid;
    gap: 16px;
  }

  .grid-cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f4f6;
    border-top: 2px solid #3b82f6;
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

  .loading-container {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
  }

  .subpath-display {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
  }

  .subpath-space {
    margin-bottom: 16px;
  }

  .subpath-space:last-child {
    margin-bottom: 0;
  }

  .subpath-space-title {
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
  }

  .textarea {
    width: 100%;
    min-height: 200px;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    transition: all 0.2s ease;
  }

  .textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .helper-text {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 8px;
  }

  .form-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 16px;
  }
</style>
