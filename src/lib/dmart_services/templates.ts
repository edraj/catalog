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

export async function createTemplate(
    spaceName: string,
    subpath: string,
    shortname: string,
    data: {
        title: string;
        content: string;
    }
) {
    const request: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
            {
                resource_type: ResourceType.content,
                shortname: "auto",
                subpath: `${subpath}/${shortname}`,
                attributes: {
                    is_active: true,
                    payload: {
                        content_type: ContentType.json,
                        body: {
                            title: data.title,
                            content: data.content,
                        },
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
    return response.status === "success" && response.records.length > 0
        ? response.records[0].shortname
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
    return response.status === "success" && response.records.length > 0;
}
