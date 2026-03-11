<script lang="ts">
  import { onMount } from "svelte";
  import plantumlEncoder from "plantuml-encoder";

  let { 
    data = {}, 
    title = "JSON Structure",
    type: diagramType = "class"
  }: { 
    data: any; 
    title?: string;
    type?: "class" | "component" | "json";
  } = $props();

  let plantumlCode = $derived(generatePlantUML(data, title, diagramType));
  let imageUrl = $derived(generateImageUrl(plantumlCode));

  function generatePlantUML(data: any, title: string, type: string): string {
    if (type === "json") {
      return generateJsonDiagram(data, title);
    } else if (type === "component") {
      return generateComponentDiagram(data, title);
    } else {
      return generateClassDiagram(data, title);
    }
  }

  function generateJsonDiagram(data: any, title: string): string {
    const lines = [
      "@startjson",
      `!theme plain`,
      `"${title}": ${JSON.stringify(data, null, 2)}`,
      "@endjson"
    ];
    return lines.join("\n");
  }

  function generateClassDiagram(data: any, title: string): string {
    const lines = [
      "@startuml",
      "!theme plain",
      `title ${title}`,
      "skinparam classAttributeIconSize 0",
      "skinparam class {",
      "  BackgroundColor<<primitive>> #E8F5E9",
      "  BackgroundColor<<object>> #FFF3E0",
      "  BackgroundColor<<array>> #E3F2FD",
      "}"
    ];

    const className = "Root";
    lines.push(...generateClassDefinition(className, data));
    lines.push("@enduml");
    
    return lines.join("\n");
  }

  function generateComponentDiagram(data: any, title: string): string {
    const lines = [
      "@startuml",
      "!theme plain",
      `title ${title}`,
      "skinparam componentStyle rectangle"
    ];

    lines.push(...generateComponentDefinition("Root", data, 0));
    lines.push("@enduml");
    
    return lines.join("\n");
  }

  function generateClassDefinition(name: string, data: any, visited = new Set()): string[] {
    const lines: string[] = [];
    
    if (visited.has(data)) return lines;
    visited.add(data);

    const type = getType(data);
    
    if (type === "object" && data !== null) {
      lines.push(`class ${name} <<object>> {`);
      
      for (const [key, value] of Object.entries(data)) {
        const valueType = getType(value);
        
        if (valueType === "object" && value !== null) {
          const className = `${name}_${capitalize(key)}`;
          lines.push(`  +${key}: ${className}`);
          lines.push(...generateClassDefinition(className, value, visited));
        } else if (valueType === "array") {
          const itemType = getArrayItemType(value as any[]);
          if (itemType === "object" && (value as any[]).length > 0 && typeof (value as any[])[0] === "object") {
            const className = `${name}_${capitalize(key)}Item`;
            lines.push(`  +${key}[]: ${className}`);
            lines.push(...generateClassDefinition(className, (value as any[])[0], visited));
          } else {
            lines.push(`  +${key}[]: ${itemType} <<array>>`);
          }
        } else {
          lines.push(`  +${key}: ${valueType} <<primitive>>`);
        }
      }
      
      lines.push("}");
    } else if (type === "array") {
      lines.push(`class ${name} <<array>> {`);
      const itemType = getArrayItemType(data);
      lines.push(`  +items: ${itemType}[]`);
      lines.push("}");
      
      if (data.length > 0 && typeof data[0] === "object") {
        lines.push(...generateClassDefinition(`${name}Item`, data[0], visited));
      }
    } else {
      lines.push(`class ${name} <<primitive>> {`);
      lines.push(`  +value: ${type}`);
      lines.push("}");
    }

    return lines;
  }

  function generateComponentDefinition(name: string, data: any, depth: number, visited = new Set()): string[] {
    const lines: string[] = [];
    
    if (visited.has(data) || depth > 5) return lines;
    visited.add(data);

    const type = getType(data);
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_");
    
    if (type === "object" && data !== null) {
      lines.push(`component "${name}" as ${safeName} {`);
      
      for (const [key, value] of Object.entries(data)) {
        const valueType = getType(value);
        const keySafe = `${safeName}_${key}`;
        
        if (valueType === "object" && value !== null) {
          lines.push(`  component "${key}" as ${keySafe}`);
          lines.push(...generateComponentDefinition(key, value, depth + 1, visited));
          lines.push(`  ${safeName} --> ${keySafe}`);
        } else if (valueType === "array") {
          lines.push(`  component "${key}[]" as ${keySafe} <<array>>`);
          if ((value as any[]).length > 0 && typeof (value as any[])[0] === "object") {
            const itemName = `${key}_item`;
            lines.push(...generateComponentDefinition(itemName, (value as any[])[0], depth + 1, visited));
            lines.push(`  ${keySafe} --> ${itemName.replace(/[^a-zA-Z0-9_]/g, "_")}`);
          }
        } else {
          lines.push(`  [${key}: ${valueType}]`);
        }
      }
      
      lines.push("}");
    } else if (type === "array") {
      lines.push(`component "${name}[]" as ${safeName} <<array>>`);
      if (data.length > 0 && typeof data[0] === "object") {
        const itemName = `${name}_item`;
        lines.push(...generateComponentDefinition(itemName, data[0], depth + 1, visited));
        lines.push(`  ${safeName} --> ${itemName.replace(/[^a-zA-Z0-9_]/g, "_")}`);
      }
    } else {
      lines.push(`component "${name}: ${type}" as ${safeName} <<primitive>>`);
    }

    return lines;
  }

  function getType(value: any): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  function getArrayItemType(arr: any[]): string {
    if (arr.length === 0) return "any";
    const first = arr[0];
    if (first === null) return "null";
    if (Array.isArray(first)) return "array";
    return typeof first;
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

<div class="plantuml-renderer">
  <div class="diagram-header">
    <h4 class="diagram-title">
      <svg class="title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      {title}
    </h4>
    <span class="diagram-type-badge">{diagramType}</span>
  </div>
  
  <div class="diagram-container">
    {#if imageUrl}
      <img 
        src={imageUrl} 
        alt={title}
        class="diagram-image"
        onerror={(e) => console.error("Failed to load PlantUML diagram:", e)}
      />
    {:else}
      <div class="loading-state">
        <svg class="loading-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>Generating diagram...</p>
      </div>
    {/if}
  </div>
  
  <details class="code-details">
    <summary>View PlantUML Code</summary>
    <pre class="code-block"><code>{plantumlCode}</code></pre>
  </details>
</div>

<style>
  .plantuml-renderer {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .diagram-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
    border-bottom: 1px solid #e5e7eb;
  }

  .diagram-title {
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

  .diagram-type-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .diagram-container {
    display: flex;
    justify-content: center;
    padding: 24px;
    background: #f8fafc;
    min-height: 200px;
  }

  .diagram-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #9ca3af;
  }

  .loading-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
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
