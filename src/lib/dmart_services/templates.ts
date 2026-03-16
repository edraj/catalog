import {
    type ActionRequest,
    type ActionResponse,
    type ApiQueryResponse,
    ContentType,
    Dmart,
    QueryType,
    RequestType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import { getSpaces } from "./spaces";

export async function getTemplates(
    space_name: string = "applications",
    scope: string = "managed",
    limit = 100,
    offset = 0,
    exact_subpath = false
): Promise<ApiQueryResponse> {
    const response = await Dmart.query(
        {
            type: QueryType.search,
            space_name: space_name,
            subpath: "/templates",
            search: "-@shortname:schema",
            limit: limit,
            sort_by: "shortname",
            sort_type: SortyType.ascending,
            offset: offset,
            retrieve_json_payload: true,
            retrieve_attachments: true,
            exact_subpath: exact_subpath,
        },
        scope
    );
    return response;
}

/**
 * Fetches templates from all managed spaces that have a /templates folder
 */
export async function getAllTemplates(): Promise<ApiQueryResponse> {
    // First get all spaces (ignoreFilter=true to include "applications")
    const spacesResponse = await getSpaces(true, "managed", []);
    if (spacesResponse.status !== "success" || !spacesResponse.records) {
        return {
            status: "success",
            records: [],
            attributes: { total: 0 },
        } as ApiQueryResponse;
    }

    const allTemplates: any[] = [];
    const spaces = spacesResponse.records;

    // Fetch templates from each space
    for (const space of spaces) {
        try {
            const response = await getTemplates(space.shortname, "managed", 1000);
            if (response.status === "success" && response.records) {
                // Add space_name info to each template
                const templatesWithSpace = response.records.map((t: any) => ({
                    ...t,
                    attributes: {
                        ...t.attributes,
                        space_name: space.shortname,
                    },
                }));
                allTemplates.push(...templatesWithSpace);
            }
        } catch (error) {
            console.warn(`Failed to fetch templates from ${space.shortname}:`, error);
        }
    }

    return {
        status: "success",
        records: allTemplates,
        attributes: { total: allTemplates.length },
    } as ApiQueryResponse;
}

async function ensureTemplatesFolder(spaceName: string): Promise<boolean> {
    try {
        // Check if /templates folder exists
        const checkResponse = await Dmart.query(
            {
                type: QueryType.search,
                space_name: spaceName,
                subpath: "/",
                search: "@shortname:templates",
                limit: 1,
            },
            "managed"
        );

        if (checkResponse.status === "success" && checkResponse.records.length > 0) {
            return true; // Folder already exists
        }

        // Create the /templates folder
        const createRequest: ActionRequest = {
            space_name: spaceName,
            request_type: RequestType.create,
            records: [
                {
                    resource_type: ResourceType.folder,
                    shortname: "templates",
                    subpath: "/",
                    attributes: {
                        is_active: true,
                        displayname: { en: "Templates", ar: "القوالب", ku: "داڕێژەکان" },
                    },
                },
            ],
        };

        const response = await Dmart.request(createRequest);
        return response.status === "success";
    } catch (error) {
        console.error("Error ensuring templates folder:", error);
        return false;
    }
}

export async function createTemplate(
    shortname: string,
    data: {
        title: string;
        content: string;
        space_name?: string;
        schema_shortname?: string;
    }
) {
    const body: any = {
        title: data.title,
        content: data.content,
    };

    // Add optional fields if provided
    if (data.space_name) {
        body.space_name = data.space_name;
    }
    if (data.schema_shortname) {
        body.schema_shortname = data.schema_shortname;
    }

    // Determine target space and subpath
    // If schema is provided, save in that space's /templates folder
    // Otherwise, default to "applications" space
    const targetSpace = data.schema_shortname && data.space_name
        ? data.space_name
        : "applications";

    // Ensure templates folder exists in target space (create if not exists)
    const folderCreated = await ensureTemplatesFolder(targetSpace);
    if (!folderCreated) {
        console.error("Failed to create templates folder in", targetSpace);
        return false;
    }

    const request: ActionRequest = {
        space_name: targetSpace,
        request_type: RequestType.create,
        records: [
            {
                resource_type: ResourceType.content,
                shortname: shortname,
                subpath: "/templates",
                attributes: {
                    is_active: true,
                    payload: {
                        content_type: ContentType.json,
                        body,
                    },
                },
            },
        ],
    };
    const response: ActionResponse = await Dmart.request(request);
    return response.status == "success" && response.records.length > 0;
}

export async function updateTemplates(
    shortname,
    space_name,
    subpath,
    data: any
) {
    const attributes: any = {
        is_active: data.is_active,
        displayname: data.displayname,
        relationships: [],
        tags: data.tags,
        payload: {
            content_type: ContentType.json,
            body: {
                title: data.title,
                content: data.content,
            },
        },
    };

    const actionRequest = {
        space_name,
        request_type: RequestType.update,
        records: [
            {
                resource_type: ResourceType.content,
                shortname,
                subpath,
                attributes,
            },
        ],
    };

    const response = await Dmart.request(actionRequest);
    return response.status === "success"
        ? shortname
        : null;
}

export async function deleteTemplate(
    shortname: string,
    spaceName: string,
    subpath: string
) {
    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.delete,
        records: [
            {
                resource_type: ResourceType.content,
                shortname: shortname,
                subpath: subpath,
                attributes: {},
            },
        ],
    };

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success";
}
