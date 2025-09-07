/**
 * Form utility functions for schema-based forms and property initialization
 */
import type {Schema, SchemaProperty, ValidationResult} from './types';

/**
 * Initialize content properties based on schema definition
 * @param properties - Schema properties object
 * @param existingContent - Existing content object to merge with
 * @returns Initialized content object
 */
export function initializeContentFromSchema(properties: Record<string, SchemaProperty>, existingContent: Record<string, any> = {}): Record<string, any> {
    const content = { ...existingContent };
    
    for (const key in properties) {
        const prop = properties[key];
        
        if (content[key] !== undefined) continue;
        
        content[key] = getDefaultValueForProperty(prop);
        
        if (prop.type === 'object' && prop.properties) {
            content[key] = initializeContentFromSchema(prop.properties, content[key] || {});
        }
    }
    
    return content;
}

/**
 * Get default value for a schema property based on its type
 * @param property - Schema property definition
 * @returns Default value for the property
 */
export function getDefaultValueForProperty(property: SchemaProperty): any {
    if (property.default !== undefined) {
        return property.default;
    }
    
    switch (property.type) {
        case 'string':
            return '';
        case 'number':
        case 'integer':
            return null;
        case 'boolean':
            return false;
        case 'array':
            return [];
        case 'object':
            return {};
        default:
            return null;
    }
}

/**
 * Create a new array item based on schema definition
 * @param itemSchema - Schema definition for array items
 * @returns New item object initialized with default values
 */
export function createArrayItemFromSchema(itemSchema: SchemaProperty): any {
    if (itemSchema.type === 'object' && itemSchema.properties) {
        return initializeContentFromSchema(itemSchema.properties);
    }
    
    return getDefaultValueForProperty(itemSchema);
}

/**
 * Navigate to nested property in an object using dot notation path
 * @param obj - Object to navigate
 * @param path - Dot notation path (e.g., "user.profile.name")
 * @returns Target object or undefined if path doesn't exist
 */
export function getNestedProperty(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    
    return current;
}

/**
 * Set nested property in an object using dot notation path
 * @param obj - Object to modify
 * @param path - Dot notation path (e.g., "user.profile.name")
 * @param value - Value to set
 * @returns Modified object
 */
export function setNestedProperty(obj: Record<string, any>, path: string, value: any): Record<string, any> {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return obj;
}

/**
 * Navigate to schema property using dot notation path
 * @param schema - Root schema object
 * @param path - Dot notation path
 * @returns Schema property or null if not found
 */
export function getSchemaPropertyByPath(schema: Schema, path: string): SchemaProperty | null {
    if (!schema || !schema.properties) return null;
    
    const parts = path.split('.');
    let current: SchemaProperty | Record<string, SchemaProperty> = schema.properties;
    
    for (const part of parts) {
        if (typeof current === 'object' && 'type' in current) {
            // current is a SchemaProperty
            if (current.type === 'object' && current.properties && current.properties[part]) {
                current = current.properties[part];
            } else if (current.type === 'array' && current.items?.properties && current.items.properties[part]) {
                current = current.items.properties[part];
            } else {
                return null;
            }
        } else {
            // current is Record<string, SchemaProperty>
            if (!current[part]) return null;
            current = current[part];
        }
    }
    
    return typeof current === 'object' && 'type' in current ? current : null;
}

/**
 * Check if a property is required in the schema
 * @param schema - Schema object
 * @param propertyName - Property name to check
 * @returns True if property is required
 */
export function isPropertyRequired(schema: Schema, propertyName: string): boolean {
    return schema?.required?.includes(propertyName) || false;
}

/**
 * Validate form data against schema
 * @param data - Form data to validate
 * @param schema - Schema to validate against
 * @returns Validation result with errors
 */
export function validateFormData(data: Record<string, any>, schema: Schema): ValidationResult {
    const errors: string[] = [];
    
    if (!schema || !schema.properties) {
        return { valid: true, errors };
    }
    
    // Check required fields
    if (schema.required) {
        for (const requiredField of schema.required) {
            if (data[requiredField] === undefined || data[requiredField] === null || data[requiredField] === '') {
                errors.push(`${requiredField} is required`);
            }
        }
    }
    
    // Additional validation can be added here for type checking, format validation, etc.
    
    return { valid: errors.length === 0, errors };
}