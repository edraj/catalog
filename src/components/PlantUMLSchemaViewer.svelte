<script lang="ts">
  import plantumlEncoder from "plantuml-encoder";

  let { 
    schema = {}, 
    content = {},
    title = "Schema View"
  }: { 
    schema: any;
    content?: any;
    title?: string;
  } = $props();

  let plantumlCode = $derived(generateSchemaDiagram(schema, content, title));
  let imageUrl = $derived(generateImageUrl(plantumlCode));

  function generateSchemaDiagram(schemaData: any, data: any, diagramTitle: string): string {
    const lines = [
      "@startuml",
      "!theme plain",
      `title ${diagramTitle}`,
      "skinparam classAttributeIconSize 0",
      "skinparam class {",
      "  BackgroundColor<<required>> #FECACA",
      "  BackgroundColor<<optional>> #E0E7FF",
      "  BackgroundColor<<filled>> #D1FAE5",
      "}"
    ];

    // Generate schema-based class diagram
    lines.push(...generateSchemaClass("Data", schemaData, data));
    
    lines.push("@enduml");
    return lines.join("\n");
  }

  function generateSchemaClass(name: string, schema: any, data: any, visited = new Set()): string[] {
    const lines: string[] = [];
    
    if (!schema?.properties || visited.has(schema)) return lines;
    visited.add(schema);

    const required: string[] = schema.required || [];
    
    lines.push(`class ${name} {`);
    
    for (const [key, propDef] of Object.entries(schema.properties)) {
      const prop = propDef as any;
      const isRequired = required.includes(key);
      const hasValue = data && data[key] !== undefined;
      
      const type = prop.type || "any";
      const badge = isRequired ? " (required)" : "";
      const filled = hasValue ? " <<filled>>" : (isRequired ? " <<required>>" : " <<optional>>");
      
      if (type === "object" && prop.properties) {
        const nestedClass = `${name}_${capitalize(key)}`;
        lines.push(`  +{static} ${key}: ${nestedClass}${filled}`);
        
        // Add relationship
        const nestedData = data?.[key] || {};
        lines.push(...generateSchemaClass(nestedClass, prop, nestedData, visited));
        lines.push(`${name} --> ${nestedClass}`);
      } else if (type === "array" && prop.items) {
        const itemType = prop.items.type || "any";
        if (itemType === "object" && prop.items.properties) {
          const itemClass = `${name}_${capitalize(key)}Item`;
          lines.push(`  +{static} ${key}[]: ${itemClass}${filled}`);
          lines.push(...generateSchemaClass(itemClass, prop.items, {}, visited));
          lines.push(`${name} --> "*" ${itemClass}`);
        } else {
          const displayValue = hasValue && data[key] ? ` = ${formatValue(data[key])}` : "";
          lines.push(`  +{static} ${key}[]: ${itemType}${badge}${displayValue}${filled}`);
        }
      } else {
        const displayValue = hasValue ? ` = ${formatValue(data[key])}` : "";
        const constraint = [];
        if (prop.minLength) constraint.push(`min:${prop.minLength}`);
        if (prop.maxLength) constraint.push(`max:${prop.maxLength}`);
        if (prop.pattern) constraint.push(`pattern`);
        if (prop.format) constraint.push(prop.format);
        
        const constraintStr = constraint.length > 0 ? ` {${constraint.join(", ")}}` : "";
        lines.push(`  +{static} ${key}: ${type}${badge}${constraintStr}${displayValue}${filled}`);
      }
    }
    
    lines.push("}");
    return lines;
  }

  function formatValue(value: any): string {
    if (value === null) return "null";
    if (typeof value === "string") return `"${value.substring(0, 30)}${value.length > 30 ? "..." : ""}"`;
    if (typeof value === "object") {
      const str = JSON.stringify(value);
      return str.substring(0, 30) + (str.length > 30 ? "..." : "");
    }
    return String(value);
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function generateImageUrl(code: string): string {
    try {
      const encoded = plantumlEncoder.encode(code);
      return `https://www.plantuml.com/plantuml/svg/${encoded}`;
    } catch (e) {
      console.error("Error encoding PlantUML:", e);
      return "";
    }
  }
</script>

<div class="plantuml-schema-viewer">
  <div class="viewer-header">
    <h4 class="viewer-title">
      <svg class="title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {title}
    </h4>
    <div class="legend">
      <span class="legend-item required">Required</span>
      <span class="legend-item optional">Optional</span>
      <span class="legend-item filled">Filled</span>
    </div>
  </div>
  
  <div class="diagram-container">
    {#if imageUrl}
      <img 
        src={imageUrl} 
        alt={title}
        class="diagram-image"
        onerror={(e) => console.error("Failed to load PlantUML diagram:", e)}
      />
    {/if}
  </div>
  
  <details class="code-details">
    <summary>View PlantUML Code</summary>
    <pre class="code-block"><code>{plantumlCode}</code></pre>
  </details>
</div>

<style>
  .plantuml-schema-viewer {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .viewer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
    border-bottom: 1px solid #e5e7eb;
  }

  .viewer-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #374151;
  }

  .title-icon {
    width: 20px;
    height: 20px;
    color: #6b7280;
  }

  .legend {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .legend-item.required {
    background: #FECACA;
    color: #991B1B;
  }

  .legend-item.optional {
    background: #E0E7FF;
    color: #3730A3;
  }

  .legend-item.filled {
    background: #D1FAE5;
    color: #065F46;
  }

  .diagram-container {
    display: flex;
    justify-content: center;
    padding: 24px;
    background: #f8fafc;
    min-height: 200px;
    overflow-x: auto;
  }

  .diagram-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .code-details {
    border-top: 1px solid #e5e7eb;
  }

  .code-details summary {
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    background: #f9fafb;
    user-select: none;
    transition: background-color 0.2s;
  }

  .code-details summary:hover {
    background: #f3f4f6;
  }

  .code-block {
    margin: 0;
    padding: 20px;
    background: #1e293b;
    color: #e2e8f0;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
  }

  .code-block code {
    white-space: pre;
  }
</style>
