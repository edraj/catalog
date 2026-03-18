<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal } from "flowbite-svelte";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import { successToastMessage, errorToastMessage } from "@/lib/toasts_messages";
  import { getChildren, getChildrenAndSubChildren } from "@/lib/dmart_services";
  import PlusOutline from "flowbite-icons-direct/PlusOutline.svelte";
  import TrashBinSolid from "flowbite-icons-direct/TrashBinSolid.svelte";
  import PenSolid from "flowbite-icons-direct/PenSolid.svelte";
  import CloseOutline from "flowbite-icons-direct/CloseOutline.svelte";

  let {
    isOpen = $bindable(false),
    relationships = $bindable([]),
    space_name,
    subpath,
    resource_type,
    parent_shortname,
  }: {
    isOpen: boolean;
    relationships: any[];
    space_name: string;
    subpath: string;
    resource_type: ResourceType;
    parent_shortname: string;
  } = $props();

  let isSaving = $state(false);

  // Form state
  let isEditing = $state(false);
  let editIndex = $state(-1);
  let showForm = $state(false);

  // Locator fields
  let relSpaceName = $state("");
  let relSubpath = $state("/");
  let relShortname = $state("");
  let relType = $state(ResourceType.content);
  let relSchemaShortname = $state("");

  // Attributes
  let relAttributesJson: string = $state("{}");

  // Dropdown data
  let spaces: any[] = $state([]);
  let subpaths: string[] = $state([]);
  let shortnames: any[] = $state([]);
  let isLoadingSubpaths = $state(false);
  let isLoadingShortnames = $state(false);

  async function loadSpaces() {
    try {
      const result = await Dmart.getSpaces();
      spaces = result.records || [];
    } catch (e) {
      spaces = [];
    }
  }

  async function loadSubpaths(spaceName: string) {
    if (!spaceName) {
      subpaths = [];
      return;
    }
    isLoadingSubpaths = true;
    try {
      const tempSubpaths: string[] = [];
      const rootChildren = await getChildren(spaceName, "/", 100);
      await getChildrenAndSubChildren(
        tempSubpaths,
        spaceName,
        "",
        rootChildren,
      );
      subpaths = tempSubpaths.reverse();
    } catch (e) {
      subpaths = [];
    } finally {
      isLoadingSubpaths = false;
    }
  }

  async function loadShortnames(spaceName: string, subpathVal: string) {
    if (!spaceName || !subpathVal) {
      shortnames = [];
      return;
    }
    isLoadingShortnames = true;
    try {
      const result = await getChildren(spaceName, subpathVal, 100);
      shortnames = (result.records || []).filter(
        (r: any) => r.resource_type !== "folder",
      );
    } catch (e) {
      shortnames = [];
    } finally {
      isLoadingShortnames = false;
    }
  }

  $effect(() => {
    if (isOpen && spaces.length === 0) {
      loadSpaces();
    }
  });

  $effect(() => {
    if (relSpaceName) {
      loadSubpaths(relSpaceName);
      relSubpath = "/";
      relShortname = "";
      shortnames = [];
    }
  });

  $effect(() => {
    if (relSpaceName && relSubpath) {
      loadShortnames(relSpaceName, relSubpath);
      relShortname = "";
    }
  });

  function resetForm() {
    relSpaceName = "";
    relSubpath = "/";
    relShortname = "";
    relType = ResourceType.content;
    relSchemaShortname = "";
    relAttributesJson = "{}";
    isEditing = false;
    editIndex = -1;
    showForm = false;
  }

  function populateFormForEdit(index: number) {
    const rel = relationships[index];
    const locator = rel.related_to || {};
    relSpaceName = locator.space_name || "";
    relSubpath = locator.subpath || "/";
    relShortname = locator.shortname || "";
    relType = locator.type || ResourceType.content;
    relSchemaShortname = locator.schema_shortname || "";
    relAttributesJson = JSON.stringify(rel.attributes || {}, null, 2);
    isEditing = true;
    editIndex = index;
    showForm = true;
  }

  function buildRelationship() {
    const locator: any = {
      type: relType,
      space_name: relSpaceName,
      subpath: relSubpath,
      shortname: relShortname,
    };
    if (relSchemaShortname) {
      locator.schema_shortname = relSchemaShortname;
    }

    let attrs = {};
    try {
      attrs = JSON.parse(relAttributesJson);
    } catch {
      attrs = {};
    }

    return {
      related_to: locator,
      attributes: attrs,
    };
  }

  async function saveRelationships(updatedRelationships: any[]) {
    isSaving = true;
    try {
      await Dmart.request({
        space_name,
        request_type: RequestType.update,
        records: [
          {
            resource_type,
            shortname: parent_shortname,
            subpath,
            attributes: {
              relationships: updatedRelationships,
            },
          },
        ],
      });
      successToastMessage($_("relationship_modal.save_success"));
    } catch (e: any) {
      errorToastMessage(
        e.response?.data?.error?.message || $_("relationship_modal.save_error"),
      );
    } finally {
      isSaving = false;
    }
  }

  async function addRelationship() {
    const rel = buildRelationship();
    if (!rel.related_to.space_name || !rel.related_to.shortname) return;

    let updated: any[];
    if (isEditing && editIndex >= 0) {
      updated = [...relationships];
      updated[editIndex] = rel;
    } else {
      updated = [...relationships, rel];
    }

    await saveRelationships(updated);
    relationships = updated;
    resetForm();
  }

  async function removeRelationship(index: number) {
    if (!confirm($_("relationship_modal.confirm_delete"))) {
      return;
    }
    const updated = relationships.filter(
      (_: any, i: number) => i !== index,
    );
    await saveRelationships(updated);
    relationships = updated;
  }

  function getLocatorDisplay(rel: any) {
    const loc = rel.related_to || {};
    return `${loc.space_name || "?"}:${loc.subpath || "/"}/${loc.shortname || "?"}`;
  }
</script>

<Modal 
  bind:open={isOpen} 
  title={$_("relationship_modal.title")} 
  size="xl"
  class="relationship-modal"
  bodyClass="p-6"
  headerClass="flex items-center justify-between p-6 border-b border-gray-200"
  footerClass="flex justify-end p-6 border-t border-gray-200"
>
  <div class="space-y-6 w-full">
    <!-- Existing relationships list -->
    {#if relationships && relationships.length > 0}
      <div class="space-y-3 w-full">
        {#each relationships as rel, index}
          <div class="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3">
                  <span
                    class="inline-block px-2.5 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800"
                  >
                    {rel.related_to?.type || "content"}
                  </span>
                  <span class="font-medium text-sm text-black truncate">
                    {getLocatorDisplay(rel)}
                  </span>
                </div>
                {#if rel.related_to?.schema_shortname}
                  <p class="text-sm text-gray-600 mt-2">
                    Schema: {rel.related_to.schema_shortname}
                  </p>
                {/if}
                {#if rel.attributes && Object.keys(rel.attributes).length > 0}
                  <p class="text-sm text-gray-500 mt-2">
                    Attributes: {JSON.stringify(rel.attributes).substring(0, 100)}{JSON.stringify(rel.attributes).length > 100
                      ? "..."
                      : ""}
                  </p>
                {/if}
              </div>
              <div class="flex items-center gap-2 ml-4">
                <button
                  class="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700"
                  onclick={() => populateFormForEdit(index)}
                  title="Edit"
                >
                  <PenSolid size="sm" />
                </button>
                <button
                  class="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-red-500"
                  onclick={() => removeRelationship(index)}
                  disabled={isSaving}
                  title="Delete"
                >
                  <TrashBinSolid size="sm" />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-gray-500 text-center py-8">
        {$_("relationship_modal.no_relationships")}
      </p>
    {/if}

    <!-- Toggle add form -->
    {#if !showForm}
      <div class="flex justify-center">
        <button
          onclick={() => {
            showForm = true;
          }}
          class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-black border border-black rounded-lg hover:bg-gray-800"
        >
          <PlusOutline size="sm" class="mr-2" />
          {$_("relationship_modal.add_relationship")}
        </button>
      </div>
    {:else}
      <div class="p-6 bg-gray-50 rounded-xl border border-gray-200 w-full">
        <div class="flex items-center justify-between mb-6">
          <h4 class="text-lg font-semibold text-black">
            {isEditing ? $_("relationship_modal.edit_title") : $_("relationship_modal.new_title")}
          </h4>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            onclick={resetForm}
          >
            <CloseOutline size="sm" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Space Name -->
          <div>
            <label for="rel-space" class="block text-sm font-medium text-gray-900">{$_("relationship_modal.fields.space_name")}</label>
            <select
              id="rel-space"
              bind:value={relSpaceName}
              class="mt-1 w-full px-3 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- {$_("relationship_modal.select_space")} --</option>
              {#each spaces as space}
                <option value={space.shortname}>{space.shortname}</option>
              {/each}
            </select>
          </div>

          <!-- Subpath -->
          <div>
            <label for="rel-subpath" class="block text-sm font-medium text-gray-900">{$_("relationship_modal.fields.subpath")}</label>
            <select
              id="rel-subpath"
              bind:value={relSubpath}
              disabled={!relSpaceName || isLoadingSubpaths}
              class="mt-1 w-full px-3 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="/">/</option>
              {#each subpaths as path}
                <option value={path}>{path}</option>
              {/each}
            </select>
            {#if isLoadingSubpaths}
              <p class="text-xs text-gray-500 mt-1">
                {$_("relationship_modal.loading_subpaths")}
              </p>
            {/if}
          </div>

          <!-- Shortname -->
          <div>
            <label for="rel-shortname" class="block text-sm font-medium text-gray-900">{$_("relationship_modal.fields.shortname")}</label>
            <select
              id="rel-shortname"
              bind:value={relShortname}
              disabled={!relSpaceName || isLoadingShortnames}
              class="mt-1 w-full px-3 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">-- {$_("relationship_modal.select_entry")} --</option>
              {#each shortnames as item}
                <option value={item.shortname}>{item.shortname}</option>
              {/each}
            </select>
            {#if isLoadingShortnames}
              <p class="text-xs text-gray-500 mt-1">
                {$_("relationship_modal.loading_entries")}
              </p>
            {/if}
          </div>

          <!-- Resource Type -->
          <div>
            <label for="rel-type" class="block text-sm font-medium text-gray-900">{$_("relationship_modal.fields.resource_type")}</label>
            <select
              id="rel-type"
              bind:value={relType}
              class="mt-1 w-full px-3 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {#each Object.values(ResourceType) as rt}
                <option value={rt}>{rt}</option>
              {/each}
            </select>
          </div>

          <!-- Schema Shortname (optional) -->
          <div>
            <label for="rel-schema" class="block text-sm font-medium text-gray-900">
              {$_("relationship_modal.fields.schema_shortname")}
            </label>
            <input
              id="rel-schema"
              type="text"
              bind:value={relSchemaShortname}
              placeholder={$_("relationship_modal.schema_placeholder")}
              class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <!-- Attributes JSON editor -->
          <div>
            <label for="rel-attributes" class="block text-sm font-medium text-gray-900">{$_("relationship_modal.fields.attributes")}</label>
            <textarea
              id="rel-attributes"
              bind:value={relAttributesJson}
              class="mt-1 w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              placeholder="JSON attributes"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">{$_("relationship_modal.json_format_hint")}</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onclick={resetForm}
              class="px-4 py-2 text-sm font-medium text-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {$_("common.cancel")}
            </button>
            <button
              onclick={addRelationship}
              disabled={!relSpaceName ||
                !relShortname ||
                isSaving}
              class="px-4 py-2 text-sm font-medium text-white bg-black border border-black rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isSaving}
                {$_("common.saving")}...
              {:else}
                {isEditing ? $_("common.update") : $_("common.add")}
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <svelte:fragment slot="footer">
    <button
      onclick={() => {
        isOpen = false;
      }}
      class="px-4 py-2 text-sm font-medium text-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      {$_("common.close")}
    </button>
  </svelte:fragment>
</Modal>

<style>
  :global(.relationship-modal) {
    background-color: white !important;
  }
  
  :global(.relationship-modal .modal-content) {
    background-color: white !important;
  }
  
  :global(.relationship-modal h3) {
    color: black !important;
  }
</style>
