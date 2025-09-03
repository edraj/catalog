// FORM -> JSON
import {generateUUID} from "./uuid";

export function transformFormToJson(obj: any) {
    if (obj === null){
        return null;
    }
    if(obj.id){
        delete obj.id;
    }

    if (typeof obj !== "object") {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(transformFormToJson);
    }

    for (const key in obj) {
        if (key !== "id") {
            obj[key] = transformFormToJson(obj[key]);
        }
        if (key === "properties") {
            obj.properties = convertArrayToObject(obj.properties);
        }
    }

    if (obj.type === "array" || obj.type === "array"){
        if (obj.items) {
            if (Object.keys(obj?.items?.properties ?? []).length === 1) {
                obj.items.type = obj.items.properties[Object.keys(obj.items.properties)[0]].type;
                // Also set type for items
                obj.items.type = obj.items.type;
            } else {
                obj.items.type = "object";
                obj.items.type = "object";
                if (obj.items.additionalProperties === undefined) {
                    obj.items.additionalProperties = false;
                }
            }

            if (obj.items.type) {
                delete obj.items.type;
            }
        }
    }

    return obj;
}

export function convertArrayToObject(arr) {
    if (!Array.isArray(arr)) {
        return arr;
    }
    const obj = {};

    for (const item of arr) {
        const key = item["name"];
        delete item.name;
        obj[key] = item;
    }
    return obj;
}

// JSON -> FORM
export function transformJsonToForm(obj: any) {
    if (!obj || typeof obj !== "object") {
        return obj;
    }
    if (obj.id === undefined){
        obj.id = generateUUID();
    }
    if (Array.isArray(obj)) {
        return obj.map(transformJsonToForm);
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

export function convertObjectToArray(obj) {
    if (!obj || typeof obj !== "object") {
        return obj;
    }

    const arr = [];

    for (const key in obj) {
        if (key !== "id" && obj.hasOwnProperty(key)) {
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
