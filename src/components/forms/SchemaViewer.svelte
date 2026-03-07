<script lang="ts">
    let {
        content = {},
    }: {
        content: any;
    } = $props();

    // Normalise: content can be a JSON string or an object
    let schema = $derived.by(() => {
        if (typeof content === "string") {
            try {
                return JSON.parse(content);
            } catch {
                return {};
            }
        }
        return content || {};
    });

    const typeColors: Record<string, string> = {
        string: "bg-green-100 text-green-800",
        number: "bg-blue-100 text-blue-800",
        integer: "bg-blue-100 text-blue-800",
        boolean: "bg-purple-100 text-purple-800",
        object: "bg-orange-100 text-orange-800",
        array: "bg-yellow-100 text-yellow-800",
        null: "bg-gray-100 text-gray-600",
    };

    function typeColor(type: string) {
        return typeColors[type] ?? "bg-gray-100 text-gray-700";
    }

    function getProperties(s: any) {
        if (!s?.properties) return [];
        const required: string[] = s.required ?? [];
        return Object.entries(s.properties).map(
            ([name, def]: [string, any]) => {
                const constraints: string[] = [];
                if (def.minLength != null)
                    constraints.push(`minLength: ${def.minLength}`);
                if (def.maxLength != null)
                    constraints.push(`maxLength: ${def.maxLength}`);
                if (def.minimum != null)
                    constraints.push(`min: ${def.minimum}`);
                if (def.maximum != null)
                    constraints.push(`max: ${def.maximum}`);
                if (def.pattern) constraints.push(`pattern: ${def.pattern}`);
                if (def.format) constraints.push(`format: ${def.format}`);
                if (def.minItems != null)
                    constraints.push(`minItems: ${def.minItems}`);
                if (def.maxItems != null)
                    constraints.push(`maxItems: ${def.maxItems}`);
                return {
                    name,
                    type: def.type ?? "any",
                    title: def.title as string | undefined,
                    description: def.description as string | undefined,
                    required: required.includes(name),
                    constraints,
                    properties: def.properties,
                    items: def.items,
                };
            },
        );
    }

    let props = $derived(getProperties(schema));
</script>

<div class="schema-viewer">
    <!-- Header -->
    <div class="viewer-header">
        <div class="header-meta">
            {#if schema.title}
                <h4 class="schema-title">{schema.title}</h4>
            {/if}
            {#if schema.description}
                <p class="schema-description">{schema.description}</p>
            {/if}
        </div>
        <span class="schema-badge">JSON Schema</span>
    </div>

    <!-- Properties table -->
    {#if props.length > 0}
        <div class="props-container">
            <table class="props-table">
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    {#each props as prop}
                        <tr class="prop-row">
                            <td class="prop-name-cell">
                                <span class="prop-name">{prop.name}</span>
                                {#if prop.title && prop.title !== prop.name}
                                    <span class="prop-title">{prop.title}</span>
                                {/if}
                            </td>
                            <td>
                                <span class="type-badge {typeColor(prop.type)}"
                                    >{prop.type}</span
                                >
                                {#if prop.type === "array" && prop.items?.type}
                                    <span class="items-type"
                                        >of {prop.items.type}</span
                                    >
                                {/if}
                            </td>
                            <td>
                                {#if prop.required}
                                    <span class="required-badge">Required</span>
                                {:else}
                                    <span class="optional-badge">Optional</span>
                                {/if}
                            </td>
                            <td class="details-cell">
                                {#if prop.description}
                                    <p class="prop-desc">{prop.description}</p>
                                {/if}
                                {#if prop.constraints.length > 0}
                                    <div class="constraints">
                                        {#each prop.constraints as c}
                                            <code class="constraint">{c}</code>
                                        {/each}
                                    </div>
                                {/if}
                                {#if prop.type === "object" && prop.properties}
                                    <details class="nested-schema">
                                        <summary>Nested properties</summary>
                                        <div class="nested-list">
                                            {#each Object.entries(prop.properties) as [subName, subDef]}
                                                <div class="nested-row">
                                                    <span class="prop-name"
                                                        >{subName}</span
                                                    >
                                                    <span
                                                        class="type-badge {typeColor(
                                                            (subDef as any)
                                                                .type ?? 'any',
                                                        )}"
                                                        >{(subDef as any)
                                                            .type ??
                                                            "any"}</span
                                                    >
                                                </div>
                                            {/each}
                                        </div>
                                    </details>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <div class="empty-state">
            <svg
                class="empty-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
            </svg>
            <p>No properties defined in this schema.</p>
        </div>
    {/if}
</div>

<style>
    .schema-viewer {
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        overflow: hidden;
        background: white;
    }

    .viewer-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
    }

    .schema-title {
        font-size: 1rem;
        font-weight: 600;
        color: #111827;
        margin: 0 0 0.25rem;
    }

    .schema-description {
        font-size: 0.8125rem;
        color: #6b7280;
        margin: 0;
    }

    .schema-badge {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        background: #dbeafe;
        color: #1e40af;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.025em;
    }

    .props-container {
        overflow-x: auto;
    }

    .props-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
    }

    .props-table thead tr {
        background: #f3f4f6;
    }

    .props-table th {
        padding: 0.6rem 1rem;
        text-align: left;
        font-size: 0.75rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid #e5e7eb;
    }

    .prop-row {
        border-bottom: 1px solid #f3f4f6;
        transition: background 0.15s;
    }

    .prop-row:last-child {
        border-bottom: none;
    }

    .prop-row:hover {
        background: #f9fafb;
    }

    .props-table td {
        padding: 0.75rem 1rem;
        vertical-align: top;
    }

    .prop-name-cell {
        min-width: 140px;
    }

    .prop-name {
        display: block;
        font-weight: 600;
        color: #1f2937;
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo,
            monospace;
        font-size: 0.8125rem;
    }

    .prop-title {
        display: block;
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 2px;
    }

    .type-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        font-family: ui-monospace, monospace;
    }

    .items-type {
        font-size: 0.75rem;
        color: #9ca3af;
        margin-left: 0.25rem;
    }

    .required-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 500;
        background: #fef2f2;
        color: #dc2626;
    }

    .optional-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 500;
        background: #f3f4f6;
        color: #6b7280;
    }

    .details-cell {
        min-width: 200px;
    }

    .prop-desc {
        margin: 0 0 0.4rem;
        color: #4b5563;
        font-size: 0.8125rem;
        line-height: 1.4;
    }

    .constraints {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
    }

    .constraint {
        display: inline-block;
        padding: 0.1rem 0.4rem;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        font-size: 0.72rem;
        color: #475569;
    }

    .nested-schema {
        margin-top: 0.5rem;
    }

    .nested-schema summary {
        font-size: 0.75rem;
        color: #6b7280;
        cursor: pointer;
        user-select: none;
    }

    .nested-list {
        margin-top: 0.4rem;
        padding: 0.5rem;
        background: #f9fafb;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .nested-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2.5rem 1rem;
        color: #9ca3af;
        gap: 0.75rem;
        text-align: center;
    }

    .empty-icon {
        width: 2.5rem;
        height: 2.5rem;
        color: #d1d5db;
    }

    .empty-state p {
        margin: 0;
        font-size: 0.875rem;
    }
</style>
