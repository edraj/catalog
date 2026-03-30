<script lang="ts">
    import {Dmart, QueryType, ResourceType} from "@edraj/tsdmart";
    import {warningToastMessage, successToastMessage} from "@/lib/toasts_messages";

    interface Props {
        space_name: string;
        subpath: string;
        isOpen?: boolean;
        onUploadSuccess?: () => void;
        availableSpaces?: {shortname: string; displayname?: string}[];
    }

    let { 
        space_name, 
        subpath, 
        isOpen = $bindable(false), 
        onUploadSuccess = () => {}, 
        availableSpaces = [] 
    }: Props = $props();

    let selectedSpace = $state(space_name);
    let selectedResourceType = $state(ResourceType.content);
    let selectedSchema = $state<string | null>(null);
    let payloadFiles: File[] = $state([]);
    let isUploading = $state(false);
    let resourceTypeError = $state(false);
    let schemaError = $state(false);
    let responseError = $state<any>(null);
    let isUpdate = $state(false);

    // Reset selected space when modal opens
    $effect(() => {
        if (isOpen) {
            selectedSpace = space_name;
            selectedSchema = null;
            payloadFiles = [];
            responseError = null;
        }
    });

    function parseQuerySchemaResponse(schemas: any){
        if (schemas === null) {
            return [];
        }
        let result = [];
        const _schemas = schemas.records.map((e: any) => e.shortname);
        result = _schemas.filter(
            (e: any) => !["meta_schema", "folder_rendering"].includes(e)
        );

        let r = result.map((e: any) => ({
            name: e,
            value: e
        }));
        return r;
    }

    function parseSpacesForSelect(spaces: typeof availableSpaces) {
        return spaces.map(s => ({
            name: s.displayname || s.shortname,
            value: s.shortname
        }));
    }

    function handleFileChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
            payloadFiles = Array.from(files);
        }
    }

    async function handleCSVUpload() {
        resourceTypeError = false;
        schemaError = false;

        let hasError = false;

        if (!selectedResourceType) {
            warningToastMessage("Please select a resource type");
            resourceTypeError = true;
            hasError = true;
        }

        if (!selectedSchema) {
            warningToastMessage("Please select a schema");
            schemaError = true;
            hasError = true;
        }

        if (!payloadFiles.length) {
            warningToastMessage("Please select a CSV file");
            hasError = true;
        }

        if (hasError) {
            return;
        }

        try {
            isUploading = true;
            const response: any = await Dmart.resourcesFromCsv(
                {
                    space_name: selectedSpace,
                    subpath,
                    resourceType: selectedResourceType,
                    schema: selectedSchema as string,
                    payload: payloadFiles[0],
                    isUpdate: isUpdate
                }
            );

            if (response.status === "success") {
                if((response?.attributes?.failed_shortnames ?? []).length !== 0){
                    warningToastMessage("Some entries failed to upload");
                    responseError = response.attributes.failed_shortnames;
                } else {
                    successToastMessage("CSV uploaded successfully");
                    onUploadSuccess();
                    isOpen = false;
                    // Reset state
                    selectedSchema = null;
                    payloadFiles = [];
                    responseError = null;
                }
            } else {
                warningToastMessage("Failed to upload CSV");
            }
        } catch (error) {
            warningToastMessage("Error uploading CSV");
        } finally {
            isUploading = false;
        }
    }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div class="bg-white rounded-[24px] shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 modal-container">
      <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-white modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Upload CSV</h2>
        </div>
        <button onclick={() => (isOpen = false)} aria-label="Close modal" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors modal-close-btn">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="p-6 max-h-[60vh] overflow-y-auto bg-gray-50/30 modal-content">
        <div class="space-y-4">
            {#if availableSpaces.length > 0}
                <div class="space-y-1.5">
                    <label for="space" class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1">Space</label>
                    <select 
                        id="space"
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900" 
                        bind:value={selectedSpace}
                    >
                        {#each parseSpacesForSelect(availableSpaces) as space}
                            <option value={space.value}>{space.name}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            <div class="space-y-1.5">
                <label for="resourceType" class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1">Resource Type</label>
                <select 
                    id="resourceType"
                    class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 {resourceTypeError ? 'ring-2 ring-red-500' : ''}" 
                    bind:value={selectedResourceType} 
                    onchange={() => resourceTypeError = false}
                >
                    <option value={ResourceType.content}>{ResourceType.content.toString()}</option>
                    <option value={ResourceType.folder}>{ResourceType.folder.toString()}</option>
                    <option value={ResourceType.ticket}>{ResourceType.ticket.toString()}</option>
                </select>
                {#if resourceTypeError}
                    <p class="text-red-500 text-xs mt-1 px-1">Resource type is required</p>
                {/if}
            </div>

            <div class="space-y-1.5">
                <label for="schema" class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1">Schema</label>
                {#await Dmart.query({
                    space_name: selectedSpace,
                    type: QueryType.search,
                    subpath: "/schema",
                    search: "",
                    retrieve_json_payload: true,
                    limit: 100
                })}
                    <div role="status" class="w-full animate-pulse h-10 bg-gray-200 rounded-xl"></div>
                {:then schemas}
                    <select 
                        id="schema"
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 {schemaError ? 'ring-2 ring-red-500' : ''}" 
                        bind:value={selectedSchema} 
                        onchange={() => schemaError = false}
                    >
                        {#each parseQuerySchemaResponse(schemas) as schema}
                            <option value={schema.value}>{schema.name}</option>
                        {/each}
                    </select>
                    {#if schemaError}
                        <p class="text-red-500 text-xs mt-1 px-1">Schema is required</p>
                    {/if}
                {:catch}
                    <p class="text-red-500 text-sm mt-2 px-1">Failed to load schemas</p>
                {/await}
            </div>

            <div class="space-y-1.5">
                <label for="csvFile" class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1">CSV File</label>
                <input 
                    id="csvFile"
                    type="file" 
                    accept=".csv" 
                    onchange={handleFileChange} 
                    class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                />
            </div>

            <div class="flex items-start gap-3 pt-2 px-1">
                <input
                    id="isUpdate"
                    type="checkbox"
                    bind:checked={isUpdate}
                    class="mt-1 w-4 h-4 text-indigo-600 bg-gray-50 border border-gray-200 rounded focus:ring-indigo-500 focus:ring-2"
                />
                <div class="flex-1">
                    <label for="isUpdate" class="text-[10px] uppercase font-bold text-gray-400 tracking-wider cursor-pointer block">Update entries</label>
                    <p class="text-xs text-gray-500 mt-1">
                        {#if isUpdate}
                            Will update existing entries with matching shortname
                        {:else}
                            Will create new entries from CSV data
                        {/if}
                    </p>
                </div>
            </div>

            {#if responseError}
                <div class="mt-4 p-4 border border-red-300 bg-red-50 rounded-lg">
                    <h4 class="text-red-800 font-semibold mb-2">Some entries failed to upload:</h4>
                    <pre class="text-xs bg-white p-2 rounded overflow-auto max-h-40 border border-gray-200"><code>{JSON.stringify(responseError, null, 2)}</code></pre>
                </div>
            {/if}
        </div>
      </div>

      <div class="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-white modal-footer">
        <button
          onclick={() => (isOpen = false)}
          class="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors border border-transparent"
        >
          Cancel
        </button>
        <button
          onclick={handleCSVUpload}
          disabled={isUploading}
          class="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {#if isUploading}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Uploading...
          {:else}
            Upload
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
