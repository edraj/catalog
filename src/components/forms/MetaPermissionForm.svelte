<script lang="ts">
  import { RequestType, ResourceType } from "@edraj/tsdmart";
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    getChildren,
    getChildrenAndSubChildren,
    getSpaces,
  } from "@/lib/dmart_services/dmart_services";
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

  let selectedResourceType = $state("");
  let selectedAction = $state("");
  let newCondition = $state("");
  let newRestrictedField = $state("");

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
      const spacesResponse = await getSpaces(true);
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
        childSubpaths,
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
      (p) => p !== subpath,
    );

    if (formData.subpaths[space].length === 0) {
      const { [space]: _, ...rest } = formData.subpaths;
      formData.subpaths = rest;
    }
  }

  function removeRestrictedField(item) {
    formData.restricted_fields = formData.restricted_fields.filter(
      (i) => i !== item,
    );
  }

  let jsonEditorContent = $state("");

  function updateJsonEditor() {
    try {
      jsonEditorContent = JSON.stringify(
        formData.allowed_fields_values,
        null,
        2,
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
  <h2 class="form-title text-xl font-semibold text-gray-900 mb-6">
    Permission Settings
  </h2>

  <form bind:this={form}>
    <div class="form-group mb-6">
      <label
        class="form-label text-sm font-medium text-gray-700 mb-2 block"
        for="resourceTypeSelect">{$_("permissions.resource_types")}</label
      >
      <div class="input-group flex gap-3">
        <select
          class="form-select bg-gray-50 border-0 rounded-lg flex-1"
          bind:value={selectedResourceType}
          id="resourceTypeSelect"
        >
          <option value="">{$_("options.select_resource_type")}</option>
          {#each resourceTypeOptions as option}
            <option value={option.value}>{option.name}</option>
          {/each}
        </select>
        <button
          aria-label={`Add resource type`}
          type="button"
          class="btn btn-primary bg-indigo-500 hover:bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center p-0"
          onclick={addResourceType}>+</button
        >
      </div>

      {#if formData.resource_types.length > 0}
        <div class="tag-container flex flex-wrap gap-2 mt-3">
          {#each formData.resource_types as item}
            <div
              class="tag bg-blue-50 text-blue-500 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
            >
              <span>{item}</span>
              <button
                aria-label={`Remove resource type ${item}`}
                type="button"
                class="tag-remove hover:text-blue-700"
                onclick={() => removeResourceType(item)}>×</button
              >
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="form-group mb-8">
      <label
        class="form-label text-sm font-medium text-gray-700 mb-2 block"
        for="actionSelect">{$_("permissions.actions")}</label
      >
      <div class="input-group flex gap-3">
        <select
          class="form-select bg-gray-50 border-0 rounded-lg flex-1"
          bind:value={selectedAction}
          id="actionSelect"
        >
          <option value="">{$_("options.select_action")}</option>
          {#each requestTypeOptions as option}
            <option value={option.value}>{option.name}</option>
          {/each}
        </select>
        <button
          aria-label={`Add action`}
          type="button"
          class="btn btn-primary bg-indigo-500 hover:bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center p-0"
          onclick={addAction}>+</button
        >
      </div>

      {#if formData.actions.length > 0}
        <div class="tag-container flex flex-wrap gap-2 mt-3">
          {#each formData.actions as item}
            <div
              class="tag bg-orange-50 text-orange-500 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
            >
              <span>{item}</span>
              <button
                aria-label={`Remove action ${item}`}
                type="button"
                class="tag-remove hover:text-orange-700"
                onclick={() => removeAction(item)}>×</button
              >
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div
      class="accordion border-0 border-t border-gray-100 rounded-none overflow-hidden mt-6 pt-2"
    >
      <div class="accordion-item border-b border-gray-100">
        <div
          class="accordion-header bg-transparent py-4 px-0 cursor-pointer flex justify-between items-center text-sm font-semibold text-gray-900"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("subpaths")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("subpaths");
          }}
        >
          <span>{$_("sections.subpaths")}</span>
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            class:rotate-180={accordionStates.subpaths}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path></svg
          >
        </div>
        {#if accordionStates.subpaths}
          <div class="accordion-content bg-transparent px-0 pb-4 pt-2">
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group mb-0">
                <label
                  class="form-label text-xs font-medium text-gray-500 mb-1"
                  for="spaceSelect">{$_("fields.space")}</label
                >
                {#if loadingSpaces}
                  <div
                    class="loading-container flex items-center gap-2 text-sm text-gray-500"
                  >
                    <div class="spinner w-4 h-4 border-2"></div>
                    <span>{$_("loading.spaces")}</span>
                  </div>
                {:else}
                  <select
                    class="form-select bg-gray-50 border-0 rounded-lg w-full"
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

              <div class="form-group mb-0">
                <label
                  class="form-label text-xs font-medium text-gray-500 mb-1"
                  for="subpathSelect">{$_("fields.subpath")}</label
                >
                {#if loadingSubpaths}
                  <div
                    class="loading-container flex items-center gap-2 text-sm text-gray-500"
                  >
                    <div class="spinner w-4 h-4 border-2"></div>
                    <span>{$_("loading.subpaths")}</span>
                  </div>
                {:else}
                  <div class="input-group flex gap-3">
                    <select
                      class="form-select bg-gray-50 border-0 rounded-lg flex-1"
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
                      aria-label={`Add subpath ${selectedSubpath} to space ${selectedSpace}`}
                      type="button"
                      class="btn btn-primary bg-indigo-500 hover:bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center p-0"
                      onclick={addSubpathToSpace}
                      disabled={!selectedSpace || !selectedSubpath}>+</button
                    >
                  </div>
                {/if}
              </div>
            </div>

            {#if Object.keys(formData.subpaths).length > 0}
              <div
                class="subpath-display bg-gray-50 border border-gray-100 rounded-lg p-4 mt-4"
              >
                {#each subpathEntries as [space, paths]}
                  <div class="subpath-space mb-4 last:mb-0">
                    <div
                      class="subpath-space-title text-sm font-semibold text-blue-500 mb-2"
                    >
                      {space}
                    </div>
                    <div class="tag-container flex flex-wrap gap-2">
                      {#each Array.isArray(paths) ? paths : [] as path}
                        <div
                          class="tag bg-white text-blue-600 border border-blue-100 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2"
                        >
                          <span>{path}</span>
                          <button
                            aria-label={`Remove subpath ${path} from space ${space}`}
                            type="button"
                            class="tag-remove hover:text-blue-800"
                            onclick={() => removeSubpath(space, path)}>×</button
                          >
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="accordion-item border-b border-gray-100">
        <div
          class="accordion-header bg-transparent py-4 px-0 cursor-pointer flex justify-between items-center text-sm font-semibold text-gray-900"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("conditions")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("conditions");
          }}
        >
          <span>{$_("sections.conditions")}</span>
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            class:rotate-180={accordionStates.conditions}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path></svg
          >
        </div>
        {#if accordionStates.conditions}
          <div class="accordion-content bg-transparent px-0 pb-4 pt-2">
            <div class="input-group flex gap-3">
              <select
                class="form-select bg-gray-50 border-0 rounded-lg flex-1"
                bind:value={newCondition}
              >
                <option value="">{$_("options.select_condition")}</option>
                <option value="own">{$_("conditions.own")}</option>
                <option value="is_active">{$_("conditions.is_active")}</option>
              </select>
              <button
                aria-label={`Add condition ${newCondition}`}
                type="button"
                class="btn btn-primary bg-indigo-500 hover:bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center p-0"
                onclick={addCondition}>+</button
              >
            </div>

            {#if formData.conditions.length > 0}
              <div class="tag-container flex flex-wrap gap-2 mt-3">
                {#each formData.conditions as item}
                  <div
                    class="tag bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
                  >
                    <span>{item}</span>
                    <button
                      aria-label={`Remove condition ${item}`}
                      type="button"
                      class="tag-remove hover:text-amber-800"
                      onclick={() => removeCondition(item)}>×</button
                    >
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="accordion-item border-b border-gray-100">
        <div
          class="accordion-header bg-transparent py-4 px-0 cursor-pointer flex justify-between items-center text-sm font-semibold text-gray-900"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("restrictedFields")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("restrictedFields");
          }}
        >
          <span>{$_("sections.restricted_fields")}</span>
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            class:rotate-180={accordionStates.restrictedFields}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path></svg
          >
        </div>
        {#if accordionStates.restrictedFields}
          <div class="accordion-content bg-transparent px-0 pb-4 pt-2">
            <div class="input-group flex gap-3">
              <label for="restrictedFieldInput" class="hidden" tabindex="-1"
              ></label>
              <input
                type="text"
                class="form-input bg-gray-50 border-0 rounded-lg flex-1 px-4 py-2"
                placeholder={$_("placeholders.restricted_field")}
                bind:value={newRestrictedField}
                id="restrictedFieldInput"
              />
              <button
                aria-label={`Add restricted field ${newRestrictedField}`}
                type="button"
                class="btn btn-primary bg-indigo-500 hover:bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center p-0"
                onclick={addRestrictedField}>+</button
              >
            </div>

            {#if formData.restricted_fields.length > 0}
              <div class="tag-container flex flex-wrap gap-2 mt-3">
                {#each formData.restricted_fields as item}
                  <div
                    class="tag bg-red-50 text-red-500 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
                  >
                    <span>{item}</span>
                    <button
                      aria-label={`Remove restricted field ${item}`}
                      type="button"
                      class="tag-remove hover:text-red-700"
                      onclick={() => removeRestrictedField(item)}>×</button
                    >
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="accordion-item">
        <div
          class="accordion-header bg-transparent py-4 px-0 cursor-pointer flex justify-between items-center text-sm font-semibold text-gray-900"
          role="button"
          tabindex="0"
          onclick={() => toggleAccordion("allowedFields")}
          onkeydown={(e) => {
            if (e.key === "Enter") toggleAccordion("allowedFields");
          }}
        >
          <span>{$_("sections.allowed_fields_values")}</span>
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            class:rotate-180={accordionStates.allowedFields}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path></svg
          >
        </div>
        {#if accordionStates.allowedFields}
          <div class="accordion-content bg-transparent px-0 pb-4 pt-2">
            <label
              class="form-label text-xs font-medium text-gray-500 mb-1 block"
              for="jsonEditor"
              tabindex="-1">{$_("fields.json_editor")}</label
            >
            <div class="helper-text text-xs text-gray-400 mb-2">
              {$_("help.json_editor")}
            </div>
            <textarea
              class="textarea w-full bg-gray-50 border-0 rounded-lg p-4 font-mono text-sm min-h-[200px]"
              bind:value={jsonEditorContent}
              id="jsonEditor"
            ></textarea>
            <div class="flex justify-end mt-3">
              <button
                aria-label={`Apply changes to JSON editor`}
                type="button"
                class="btn btn-secondary bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2"
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
</style>
