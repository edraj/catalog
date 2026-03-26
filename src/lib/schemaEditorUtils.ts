/**
 * Schema transformation utilities for converting between form and JSON representations
 */
import {generateUUID} from "./uuid";

/**
 * Transform form data to JSON schema format
 * @param obj - Form object to transform
 * @returns Transformed JSON object
 */
export function transformFormToJson(obj: any): any {
    if (obj === null) {
        return null;
    }
    
    // Remove form-specific id field
    if (obj?.id) {
        delete obj.id;
    }

    if (typeof obj !== "object") {
        return obj;
    }

    if (Array.isArray(obj)) {
        // Filter out null items but keep __removed markers
        return obj.filter(item => item !== null).map(transformFormToJson);
    }

    // Deep transform all properties except id
    for (const key in obj) {
        if (key !== "id") {
            obj[key] = transformFormToJson(obj[key]);
        }
        if (key === "properties") {
            obj.properties = convertArrayToObject(obj.properties);
        }
    }

    // Handle array type items configuration
    if (obj.type === "array" && obj.items) {
        const itemProperties = obj.items?.properties;
        const propertyCount = Object.keys(itemProperties ?? {}).length;
        
        if (propertyCount === 1) {
            // Single property - use its type
            const firstPropertyKey = Object.keys(itemProperties)[0];
            obj.items.type = itemProperties[firstPropertyKey].type;
        } else if (propertyCount > 1) {
            // Multiple properties - object type
            obj.items.type = "object";
            if (obj.items.additionalProperties === undefined) {
                obj.items.additionalProperties = false;
            }
        }
    }

    return obj;
}

/**
 * Converts an array of form items to an object keyed by the 'name' property
 * @param arr - Array of form items with 'name' properties
 * @returns Object with keys from item names and values from item data
 */
export function convertArrayToObject(arr) {
    if (!Array.isArray(arr)) {
        return arr;
    }
    const obj = {};

    for (const item of arr) {
        // Skip null items (removed properties)
        if (item === null) {
            continue;
        }
        // Handle removed properties - keep them with null value
        if (item.__removed && item.name) {
            obj[item.name] = null;
            continue;
        }
        const key = item["name"];
        delete item.name;
        obj[key] = item;
    }
    return obj;
}

/**
 * Transform JSON schema format to form data representation
 * @param obj - JSON object to transform to form format
 * @returns Transformed form object with added id fields and array conversions
 */
export function transformJsonToForm(obj: any) {
    if (!obj || typeof obj !== "object") {
        return obj;
    }
    if (obj.id === undefined){
        obj.id = generateUUID();
    }
    if (Array.isArray(obj)) {
        return obj.filter(item => item !== null).map(transformJsonToForm);
    }

    const result = { ...obj };

    for (const key in result) {
        if (key !== "id") {
            result[key] = transformJsonToForm(result[key]);
        }
        if (key === "properties") {
            result.properties = convertObjectToArray(result.properties);
        }
    }

    return result;
}

/**
 * Converts an object to an array with keys as 'name' properties
 * @param obj - Object to convert to array format
 * @returns Array of items with 'name' property containing the original key
 */
export function convertObjectToArray(obj) {
    if (!obj || typeof obj !== "object") {
        return obj;
    }

    const arr = [];

    for (const key in obj) {
        if (key !== "id" && obj.hasOwnProperty(key)) {
            // Handle null values (removed properties) - mark them as removed
            if (obj[key] === null) {
                arr.push({ name: key, __removed: true });
                continue;
            }
            const item = { name: key, ...obj[key] };
            if (item.title === undefined){
                item.title = "";
            }
            if (item.description === undefined){
                item.description = "";
            }
            arr.push(item);
        }
    }

    return arr;
}
