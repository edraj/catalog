export type SchemaFieldType =
  | 'string' 
  | 'boolean' 
  | 'array' 
  | 'array-object' 
  | 'localized' 
  | 'object';

export const schemaTypeMap: Record<string, SchemaFieldType> = {
  // Arrays of strings
  conditions: 'array',
  restricted_fields: 'array',
  resource_types: 'array',
  actions: 'array',
  permissions: 'array',
  tags: 'array',
  languages: 'array',
  mirrors: 'array',
  hide_folders: 'array',
  active_plugins: 'array',
  branches: 'array',

  is_active: 'boolean',
  indexing_enabled: 'boolean',
  capture_misses: 'boolean',
  check_health: 'boolean',

  displayname: 'localized',
  description: 'localized',

  allowed_fields_values: 'object',
  subpaths: 'object',
  attachments: 'object',
  payload: 'object',

  relationships: 'array-object',

  uuid: 'string',
  shortname: 'string',
  created_at: 'string',
  updated_at: 'string',
  root_registration_signature: 'string',
  primary_website: 'string',
  icon: 'string',
  owner_shortname: 'string',
  schema_shortname: 'string',
};

export function parseValueByType(value: any, type: SchemaFieldType): any {
  if (value === '' || value === null || value === undefined) {
    if (type === 'array' || type === 'array-object') return [];
    if (type === 'boolean') return false;
    if (type === 'object' || type === 'localized') return {};
    return value;
  }

  switch (type) {
    case 'array':
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value.split(',').map((s: string) => s.trim()).filter(Boolean);
      } catch {
        return value.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

    case 'array-object':
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }

    case 'boolean':
      return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';

    case 'localized':
      if (typeof value === 'object' && value !== null) return value;
      try {
        return JSON.parse(value);
      } catch {
        return { en: value };
      }

    case 'object':
      if (typeof value === 'object' && value !== null) return value;
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }

    case 'string':
    default:
      return String(value);
  }
}

export function getFieldType(key: string): SchemaFieldType {
  if (key.includes('.')) {
    const parts = key.split('.');
    const lastPart = parts[parts.length - 1];
    // Check the last part first (e.g., 'tags' in 'payload.body.tags')
    if (schemaTypeMap[lastPart]) {
      return schemaTypeMap[lastPart];
    }
    // Fall back to first part (e.g., 'payload' in 'payload.body')
    const firstPart = parts[0];
    return schemaTypeMap[firstPart] || 'string';
  }
  return schemaTypeMap[key] || 'string';
}

export function formatValueForEdit(value: any, type: SchemaFieldType): any {
  if (value === undefined || value === null) {
    if (type === 'array' || type === 'array-object') return [];
    if (type === 'boolean') return false;
    if (type === 'object' || type === 'localized') return {};
    return '';
  }

  if (type === 'array' || type === 'array-object') {
    return Array.isArray(value) ? [...value] : [];
  }
  if (type === 'object' || type === 'localized') {
    return typeof value === 'object' ? { ...value } : {};
  }
  if (type === 'boolean') {
    return value === true || value === 'true';
  }
  return String(value);
}

export function setNestedValue(obj: any, key: string, value: any): void {
  if (key.includes('.')) {
    const keys = key.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    current[keys[keys.length - 1]] = value;
  } else {
    obj[key] = value;
  }
}

export function getNestedValue(obj: any, key: string): any {
  if (key.includes('.')) {
    const keys = key.split('.');
    let current = obj;
    for (const k of keys) {
      if (current === null || current === undefined) return '';
      current = current[k];
    }
    return current ?? '';
  }
  return obj?.[key] ?? '';
}
