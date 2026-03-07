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
import { user } from "@/stores/user";
import { get } from "svelte/store";
import { getFileType } from "../helpers";
import { getSpaces } from "./spaces";

export async function getEntities(search) {
    const result = await getSpaces();
    const spaces = result.records.map((space) => space.shortname);

    const promises = spaces.map(async (space) => {
        const queryRequest: QueryRequest = {
            filter_shortnames: [],
            type: QueryType.subpath,
            space_name: space,
            subpath: "/",
            exact_subpath: false,
            sort_by: "shortname",
            sort_type: SortyType.ascending,
            search: search,
            retrieve_json_payload: true,
            retrieve_attachments: true,
        };

        const response: ApiQueryResponse = await Dmart.query(queryRequest);
        return response?.records ?? [];
    });

    const allRecordsArrays = await Promise.all(promises);

    return allRecordsArrays.flat();
}

export async function getMyEntities(shortname: string = "") {
    const result = await getSpaces(false, "managed", [
        "messages",
        "poll",
        "surveys",
    ]);
    const spaces = result.records.map((space) => space.shortname);

    const promises = spaces.map(async (space) => {
        let currentUser = get(user);
        const search = `@owner_shortname:${shortname || currentUser.shortname}`;

        const queryRequest: QueryRequest = {
            filter_shortnames: [],
            type: QueryType.subpath,
            space_name: space,
            subpath: "/",
            exact_subpath: false,
            sort_by: "created_at",
            sort_type: SortyType.ascending,
            search,
            retrieve_json_payload: true,
            retrieve_attachments: true,
        };

        const response: ApiQueryResponse = await Dmart.query(queryRequest);
        return response?.records ?? [];
    });

    const allRecordsArrays = await Promise.all(promises);

    return allRecordsArrays.flat();
}



export async function getEntityAttachmentsCount(
    shortname: string,
    spaceName: string,
    subpath: string
) {
    let cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath.substring(1) : subpath) : "";
    if (cleanSubpath === "__root__") cleanSubpath = "";
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
    const response = await Dmart.query(query, "public");

    return response.records;
}

export async function attachAttachmentsToEntity(
    shortname: string,
    spaceName: string,
    subpath: string,
    attachment: File
) {
    const fileType = getFileType(attachment);
    const resourceType = fileType ? fileType.resourceType : ResourceType.media;

    let cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath.substring(1) : subpath) : "";
    if (cleanSubpath === "__root__") cleanSubpath = "";
    const targetSubpath = cleanSubpath ? `${cleanSubpath}/${shortname}` : shortname;

    const response = await Dmart.uploadWithPayload({
        space_name: spaceName,
        subpath: targetSubpath,
        shortname: "auto",
        resource_type: resourceType,
        payload_file: attachment
    });
    return response.status == "success" && response.records.length > 0;
}

export async function searchInCatalog(search: string = "") {
    const result = await getSpaces(false, "public");
    const spaces = result.records.map((space) => space.shortname);

    const promises = spaces.map(async (space) => {
        const queryRequest: QueryRequest = {
            filter_shortnames: [],
            type: QueryType.subpath,
            space_name: space,
            subpath: "/",
            exact_subpath: false,
            sort_by: "created_at",
            sort_type: SortyType.ascending,
            search,
            retrieve_json_payload: true,
            retrieve_attachments: false,
        };

        const response: ApiQueryResponse = await Dmart.query(
            queryRequest,
            "public"
        );
        return response?.records ?? [];
    });

    const allRecordsArrays = await Promise.all(promises);

    return allRecordsArrays.flat();
}

export async function createFolder(
    spaceName: string,
    subpath: string,
    data: any
) {
    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
            {
                resource_type: ResourceType.folder,
                shortname: data.shortname || "auto",
                subpath: subpath.startsWith("/") ? subpath : `/${subpath}`,
                attributes: {
                    displayname: data.displayname || {},
                    description: data.description || {},
                    is_active: data.is_active !== undefined ? data.is_active : true,
                    payload: {
                        body: data.folderContent || {},
                        content_type: ContentType.json,
                    },
                },
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
        console.error(`Error creating folder in ${spaceName}/${subpath}:`, error);
        throw error;
    }
}

