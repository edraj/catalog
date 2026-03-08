import {
    type ActionRequest,
    type ActionResponse,
    type ApiQueryResponse,
    ContentType,
    Dmart,
    type QueryRequest,
    QueryType,
    RequestType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";

/**
 * Get an entity by its shortname
 */
export async function getEntityByShortname(
    shortname: string,
    spaceName: string,
    subpath: string,
    resourceType: ResourceType = ResourceType.content,
    scope: string = "managed",
    retrieve_json_payload: boolean = true,
    retrieve_attachments: boolean = true
) {
    let cleanSubpath = subpath.startsWith("/") ? subpath.substring(1) : subpath;
    if (!cleanSubpath || cleanSubpath === "/") {
        cleanSubpath = "__root__";
    }

    try {
        return await Dmart.retrieveEntry(
            {
                resource_type: resourceType,
                space_name: spaceName,
                subpath: cleanSubpath,
                shortname,
                retrieve_json_payload,
                retrieve_attachments,
                validate_schema: true,
            },
            scope
        );
    } catch (error) {
        console.error(`Error retrieving item ${shortname}:`, error);
        return null;
    }
}

/**
 * Get entities of a specific subpath
 */
export async function getEntitiesOfSubpath(
    spaceName: string,
    subpath: string,
    scope: string = "managed",
    offset: number = 0,
    limit: number = 100,
    search: string = "",
    exactSubpath: boolean = false,
    sortBy: string = "created_at",
    sortType: SortyType = SortyType.descending,
    retrieveJson: boolean = true,
    retrieveAttachments: boolean = true
): Promise<ApiQueryResponse> {
    const queryRequest: QueryRequest = {
        filter_shortnames: [],
        type: QueryType.subpath,
        space_name: spaceName,
        subpath,
        exact_subpath: exactSubpath,
        sort_by: sortBy,
        sort_type: sortType,
        search,
        limit,
        offset,
        retrieve_json_payload: retrieveJson,
        retrieve_attachments: retrieveAttachments,
    };

    return await Dmart.query(queryRequest, scope);
}

/**
 * Get entities of a specific space using search query
 */
export async function getEntitiesOfSpace(
    spaceName: string,
    scope: string = "managed",
    offset: number = 0,
    limit: number = 100,
    search: string = "",
    exactSubpath: boolean = false,
    sortBy: string = "created_at",
    sortType: SortyType = SortyType.descending,
    retrieveJson: boolean = true,
    retrieveAttachments: boolean = true
): Promise<ApiQueryResponse> {
    const queryRequest: QueryRequest = {
        filter_shortnames: [],
        type: QueryType.search,
        space_name: spaceName,
        subpath: "/",
        exact_subpath: exactSubpath,
        sort_by: sortBy,
        sort_type: sortType,
        search,
        limit,
        offset,
        retrieve_json_payload: retrieveJson,
        retrieve_attachments: retrieveAttachments,
    };

    return await Dmart.query(queryRequest, scope);
}

/**
 * Search entities with full query support
 */
export async function searchEntities(
    spaceName: string,
    subpath: string = "/",
    search: string = "",
    limit: number = 100,
    offset: number = 0,
    sortBy: string = "created_at",
    sortType: SortyType = SortyType.descending,
    scope: string = "managed",
    retrieveJson: boolean = true,
    retrieveAttachments: boolean = true,
    exactSubpath: boolean = false
): Promise<ApiQueryResponse> {
    const queryRequest: QueryRequest = {
        filter_shortnames: [],
        type: QueryType.search,
        space_name: spaceName,
        subpath,
        exact_subpath: exactSubpath,
        sort_by: sortBy,
        sort_type: sortType,
        search,
        limit,
        offset,
        retrieve_json_payload: retrieveJson,
        retrieve_attachments: retrieveAttachments,
    };

    return await Dmart.query(queryRequest, scope);
}

/**
 * Create a generic entity
 */
export async function createEntity(
    spaceName: string,
    subpath: string,
    resourceType: ResourceType,
    attributes: any,
    shortname: string = "auto"
) {
    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
            {
                resource_type: resourceType,
                shortname,
                subpath,
                attributes,
            },
        ],
    };

    try {
        const response: ActionResponse = await Dmart.request(actionRequest);
        if (response.status === "success" && response.records.length > 0) {
            return response.records[0].shortname;
        }
        return null;
    } catch (error) {
        console.error(`Error creating entity in ${spaceName}/${subpath}:`, error);
        throw error;
    }
}

/**
 * Update an existing entity
 */
export async function updateEntity(
    shortname: string,
    spaceName: string,
    subpath: string,
    resourceType: ResourceType,
    attributes: any,
) {
    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.update,
        records: [
            {
                resource_type: resourceType,
                shortname,
                subpath,
                attributes,
            },
        ],
    };

    try {
        const response = await Dmart.request(actionRequest);
        return response.status === "success";
    } catch (error) {
        console.error(`Error updating entity ${shortname}:`, error);
        throw error;
    }
}

/**
 * Delete an entity
 */
export async function deleteEntity(
    shortname: string,
    spaceName: string,
    subpath: string,
    resourceType: ResourceType
) {
    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.delete,
        records: [
            {
                resource_type: resourceType,
                shortname: shortname,
                subpath: subpath,
                attributes: {},
            },
        ],
    };

    try {
        const response: ActionResponse = await Dmart.request(actionRequest);
        return response.status === "success" && response.records.length > 0;
    } catch (error) {
        console.error(`Error deleting entity ${shortname}:`, error);
        throw error;
    }
}

/**
 * Create an attachment for an entity
 */
export async function createAttachment(
    shortname: string,
    spaceName: string,
    subpath: string,
    resourceType: ResourceType,
    file: File
) {
    let cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath.substring(1) : subpath) : "";
    if (cleanSubpath === "__root__" || cleanSubpath === "/") {
        cleanSubpath = "";
    }
    const targetSubpath = cleanSubpath ? `${cleanSubpath}/${shortname}` : shortname;

    try {
        const response = await Dmart.uploadWithPayload({
            space_name: spaceName,
            subpath: targetSubpath,
            shortname: "auto",
            resource_type: resourceType,
            payload_file: file,
        });
        return response.status === "success" && response.records.length > 0
            ? response.records[0].shortname
            : null;
    } catch (error) {
        console.error(`Error creating attachment for ${shortname}:`, error);
        return null;
    }
}

/**
 * Update an entity's attachment by replacing the file
 */
export async function updateAttachment(
    shortname: string,
    spaceName: string,
    subpath: string,
    resourceType: ResourceType,
    attachmentShortname: string,
    file: File
) {
    let cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath.substring(1) : subpath) : "";
    if (cleanSubpath === "__root__" || cleanSubpath === "/") {
        cleanSubpath = "";
    }
    const targetSubpath = cleanSubpath ? `${cleanSubpath}/${shortname}` : shortname;

    try {
        // First delete the old attachment
        const deleted = await deleteAttachment(shortname, spaceName, subpath, attachmentShortname, resourceType);

        if (!deleted) {
            console.warn(`Could not delete previous attachment ${attachmentShortname}`);
        }

        // Then upload the new one
        return await createAttachment(shortname, spaceName, subpath, resourceType, file);
    } catch (error) {
        console.error(`Error updating attachment ${attachmentShortname} for ${shortname}:`, error);
        return null;
    }
}

/**
 * Delete an attachment from an entity
 */
export async function deleteAttachment(
    entityShortname: string,
    spaceName: string,
    entitySubpath: string,
    attachmentShortname: string,
    resourceType: ResourceType
) {
    let cleanSubpath = entitySubpath ? (entitySubpath.startsWith("/") ? entitySubpath.substring(1) : entitySubpath) : "";
    if (cleanSubpath === "__root__" || cleanSubpath === "/") {
        cleanSubpath = "";
    }
    const targetSubpath = cleanSubpath ? `${cleanSubpath}/${entityShortname}` : entityShortname;

    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.delete,
        records: [
            {
                resource_type: resourceType,
                shortname: attachmentShortname,
                subpath: targetSubpath,
                attributes: {},
            },
        ],
    };

    try {
        const response: ActionResponse = await Dmart.request(actionRequest);
        return response.status === "success" && response.records.length > 0;
    } catch (error) {
        console.error(`Error deleting attachment ${attachmentShortname}:`, error);
        return false;
    }
}

/**
 * Get all attachments of an entity
 */
export async function getEntityAttachments(
    shortname: string,
    spaceName: string,
    subpath: string,
    scope: string = "public"
) {
    let cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath.substring(1) : subpath) : "";
    if (cleanSubpath === "__root__" || cleanSubpath === "/") {
        cleanSubpath = "";
    }
    const targetSubpath = cleanSubpath ? `${cleanSubpath}/${shortname}` : shortname;

    const query: QueryRequest = {
        filter_shortnames: [],
        type: QueryType.attachments_aggregation,
        space_name: spaceName,
        subpath: targetSubpath,
        limit: 100,
        sort_by: "shortname",
        sort_type: SortyType.ascending,
        offset: 0,
        search: "",
        retrieve_json_payload: true,
        retrieve_attachments: true,
    };

    try {
        const response = await Dmart.query(query, scope);
        return response.records || [];
    } catch (error) {
        console.error(`Error getting attachments for ${shortname}:`, error);
        return [];
    }
}

// Aliases for backward compatibility with existing Svelte components
export const getEntity = getEntityByShortname;
export const replaceEntity = async (
    shortname: string,
    spaceName: string,
    subpath: string,
    resourceType: ResourceType,
    attributes: any
) => await updateEntity(shortname, spaceName, subpath, resourceType, attributes);
