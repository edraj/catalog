import plantumlEncoder from "plantuml-encoder";

export function generateJsonDiagram(data: any, title: string = "JSON"): string {
  const jsonStr = JSON.stringify(data, null, 2);
  return `@startjson
!theme plain
title ${title}
${jsonStr}
@endjson`;
}

export function generateClassDiagram(data: any, title: string = "Structure"): string {
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

  const visited = new Set();
  lines.push(...generateClassDefinition("Root", data, visited));
  lines.push("@enduml");
  
  return lines.join("\n");
}

function generateClassDefinition(name: string, data: any, visited: Set<any>): string[] {
  const lines: string[] = [];
  
  if (visited.has(data)) return lines;
  
  const type = getType(data);
  
  if (type === "object" && data !== null) {
    visited.add(data);
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

export function encodePlantUML(code: string): string {
  try {
    return plantumlEncoder.encode(code);
  } catch (e) {
    console.error("Error encoding PlantUML:", e);
    return "";
  }
}

export function getPlantUMLImageUrl(code: string): string {
  const encoded = encodePlantUML(code);
  if (!encoded) return "";
  return `https://www.plantuml.com/plantuml/svg/${encoded}`;
}
