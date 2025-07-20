<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Button, Card, Input, Label, Select, } from "flowbite-svelte";
    import {Dmart, QueryType} from "@edraj/tsdmart";

    const dispatch = createEventDispatcher();

    let {
        content = $bindable({})
    } : {
        content: any
    } = $props();

    content = {
        icon: content.icon || '',
        icon_closed: content.icon_closed || '',
        icon_opened: content.icon_opened || '',
        shortname_title: content.shortname_title || '',

        index_attributes: content.index_attributes || [],

        query: content.query || {
            type: '',
            search: '',
            filter_types: []
        },

        search_columns: content.search_columns || [],
        csv_columns: content.csv_columns || [],

        sort_by: content.sort_by || '',
        sort_type: content.sort_type || '',

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

        ...content
    };

    if (!content.query) content.query = {};

    let errors = $state({});

    function validateForm() {
        errors = {};

        if (!content.index_attributes || content.index_attributes.length === 0) {
            errors['index_attributes'] = 'Index attributes is required';
        }

        return Object.keys(errors).length === 0;
    }

    function onSave() {
        if (validateForm()) {
            dispatch('save', content);
        }
    }

    function addItem(path, template = {}) {
        let target = content;
        const parts = path.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]]) target[parts[i]] = {};
            target = target[parts[i]];
        }

        const lastPart = parts[parts.length - 1];
        if (!target[lastPart]) target[lastPart] = [];

        target[lastPart] = [...target[lastPart], structuredClone(template)];
        content = {...content};
    }

    function removeItem(path, index) {
        let target = content;
        const parts = path.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]]) return;
            target = target[parts[i]];
        }

        const lastPart = parts[parts.length - 1];
        if (!target[lastPart]) return;

        target[lastPart] = target[lastPart].filter((_, i) => i !== index);
        content = {...content};
    }
</script>

<Card class="p-4 max-w-4xl mx-auto my-2">
    <h2 class="text-xl font-bold mb-4">Folder Schema Editor</h2>

    <div class="space-y-6">
        <div class="border p-4 rounded-lg">
            <h3 class="font-semibold mb-2">Index Attributes</h3>
            <p class="text-sm text-gray-500 mb-2">The attributes from the schema that should be displayed in index page</p>

            {#if errors['index_attributes']}
                <p class="text-red-500 text-sm">{errors['index_attributes']}</p>
            {/if}

            {#if content.index_attributes?.length > 0}
                {#each content.index_attributes as attribute, index}
                    <div class="flex items-center gap-2 mt-2 p-2 bg-gray-50 rounded">
                        <div class="flex-1">
                            <Input bind:value={attribute.key} placeholder="Key" />
                        </div>
                        <div class="flex-1">
                            <Input bind:value={attribute.name} placeholder="Name" />
                        </div>
                        <Button size="xs" color="red" onclick={() => removeItem('index_attributes', index)}>Remove</Button>
                    </div>
                {/each}
            {/if}
            <Button size="sm" class="mt-2 text-gray hover:text-gray cursor-pointer" outline onclick={() => addItem('index_attributes', {key: '', name: ''})}>Add Index Attribute</Button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label for="sort_by">Sort By</Label>
                <Input id="sort_by" placeholder="Field name for sorting" bind:value={content.sort_by} />
            </div>

            <div>
                <Label for="sort_type">Sort Order</Label>
                <Select id="sort_type" bind:value={content.sort_type}>
                    <option value="ascending">Ascending</option>
                    <option value="descending">Descending</option>
                </Select>
            </div>
        </div>

        <div class="grid">

            <h3 class="font-semibold">Content Resource Types</h3>

            <div class="mb-3">
                <Select id="resource-type-select" onchange={(e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) {
                content.content_resource_types = [target.value];
            } else {
                content.content_resource_types = [];
            }
        }}>
                    <option value="">Select a type...</option>
                    <option value="ticket" selected={content.content_resource_types.includes('ticket')}>Ticket</option>
                    <option value="content" selected={content.content_resource_types.includes('content')}>Content</option>
                </Select>
            </div>

            <h3 class="font-semibold">Schema Shortnames</h3>

            <div class="mb-3">
                <Select class="mb-2" onclick={(e) => {
                    if (e.target.value && !content.content_schema_shortnames.includes(e.target.value)) {
                        content.content_schema_shortnames = [...content.content_schema_shortnames, e.target.value];
                        e.target.value = "";
                    }
                }}>
                    {#await Dmart.query({ space_name: "management", type: QueryType.search, subpath: "/schema", search: "", retrieve_json_payload: true, limit: 99 }) then schemas}
                        {#each schemas.records.map(e => e.shortname) as schema}
                            <option value={schema}>{schema}</option>
                        {/each}
                    {/await}
                </Select>


                <div class="flex flex-wrap gap-1 mt-1">
                    {#each content.content_schema_shortnames as schema}
                <span class="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-md flex items-center gap-1">
                    {schema}
                    <button type="button" class="text-xs" onclick={() => {
                        content.content_schema_shortnames = content.content_schema_shortnames.filter(s => s !== schema);
                    }}>×</button>
                </span>
                    {/each}
                </div>
            </div>

            <h3 class="font-semibold">Workflow Shortnames</h3>

            <Select class="mb-2" onclick={(e) => {
                        if (e.target.value && !content.workflow_shortnames.includes(e.target.value)) {
                            content.workflow_shortnames = [...content.workflow_shortnames, e.target.value];
                            e.target.value = "";
                        }
                    }}>
                {#await Dmart.query({ space_name: "management", type: QueryType.search, subpath: "/workflow", search: "", retrieve_json_payload: true, limit: 99 }) then workflows}
                    {#each workflows.records.map(e => e.shortname) as workflow}
                        <option value={workflow}>{workflow}</option>
                    {/each}
                {/await}
            </Select>

            <div class="mb-3">
                <div class="flex flex-wrap gap-1 mt-1">
                    {#each content.workflow_shortnames as workflow}
                <span class="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-md flex items-center gap-1">
                    {workflow}
                    <button type="button" class="text-xs" onclick={() => {
                        content.workflow_shortnames = content.workflow_shortnames.filter(w => w !== workflow);
                    }}>×</button>
                </span>
                    {/each}
                </div>
            </div>
        </div>


    </div>
</Card>