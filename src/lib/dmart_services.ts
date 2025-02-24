import Dmart, {
    type ActionRequest,
    type ActionResponse,
    type ApiQueryResponse,
    ContentType,
    type QueryRequest,
    QueryType,
    RequestType,
    ResourceType,
    SortyType
} from "@edraj/tsdmart";

export interface ProjectIdeasSearch {
    limit: number;
    offset: number;
    shortname: string;
    search: string;
}

function getFileType(file: File): { contentType: ContentType, resourceType: ResourceType } | null {
    const mimeType = file.type;

    let contentType: ContentType;
    let resourceType: ResourceType;

    if(mimeType.startsWith("image")){
        contentType = ContentType.image;
        resourceType = ResourceType.media;
    } else if (mimeType.startsWith("audio")){
        contentType = ContentType.audio;
        resourceType = ResourceType.media;
    } else if (mimeType.startsWith("video")){
        contentType = ContentType.video;
        resourceType = ResourceType.media
    } else {
        switch (mimeType) {
            case "application/pdf":
                contentType = ContentType.pdf;
                resourceType = ResourceType.media;
                break;
            case "text/plain":
                contentType = ContentType.text;
                resourceType = ResourceType.media;
                break;
            case "application/json":
                contentType = ContentType.json;
                resourceType = ResourceType.json;
                break;
            default:
                return null;
        }
    }

    return { contentType, resourceType };
}

export async function getProfile(){
    const profile = await Dmart.get_profile()
    if (profile === null){
        return null;
    }
    if (profile.status == "success" && profile.records.length > 0) {
        return profile.records[0];
    }

    return null;
}

export async function getAvatar(shortname: string){
    const query: QueryRequest = {
        "filter_shortnames": [],
        "type": QueryType.attachments,
        "space_name": "personal",
        "subpath": `people/${shortname}/protected/avatar`,
        "limit": 1,
        "sort_by": "shortname",
        "sort_type": SortyType.ascending,
        "offset": 0,
        "search": "@resource_type:media",
        "retrieve_json_payload": false
    }
    const results = await Dmart.query(query);

    if (results.records.length === 0){
        return null
    }

    return Dmart.get_attachment_url(
        ResourceType.media,
        "personal",
        `people/${shortname}/protected/`,
        "avatar",
        results.records[0].attributes.payload.body,
    );
}

export async function updateProfile(data: any){
    const request = {
        resource_type: "user",
        shortname: data.shortname,
        subpath: "users",
        attributes: {
            displayname: {
                "en": data.displayname,
            },
            description: {
                "en": data.description,
            },
        }
    }
    const response = await Dmart.update_user(request);
    return response.status == "success";
}

export async function createUser(user: User){
    const data = {
        "request_type": "create",
        "space_name": "management",
        "records": [
        {
            "shortname": user.shortname,
            "resource_type": "user",
            "subpath": "users",
            "attributes": {
                "is_active": true,
                "displayname": user.displayname,
                "description": user.description,
                "tags": [],
                "password": user.password,
                "type": "web",
                "roles": [
                    "catalog_role"
                ],
                "groups": [],
                "firebase_token": "",
                "is_email_verified": true,
                "is_msisdn_verified": true,
                "force_password_change": false,
                "relationships": [],
                "invitation": ""
            }
        }
    ]
    }
    const response: ActionResponse = await Dmart.create_user(data);
    return response.status == "success" && response.records.length > 0;

}

export async function getProjectIdeas(ideaSearch: ProjectIdeasSearch = null) {
    const { limit, offset, shortname, search } = ideaSearch === null ? {
        limit: 15, offset: 0, shortname: "", search: ""
    } : ideaSearch;

    const queryRequest: QueryRequest = {
        filter_shortnames: [],
        type: QueryType.search,
        space_name: "catalog",
        subpath: "posts",
        exact_subpath: true,
        limit: limit,
        sort_by: "shortname",
        sort_type: SortyType.ascending,
        offset: offset,
        search: search,
        retrieve_json_payload: true
    }

    if(shortname){
        queryRequest.search = `@owner_shortname:${shortname}`
    }

    const response: ApiQueryResponse = await Dmart.query(queryRequest);
    if (response === null){
        return null;
    }
    return response.records;
}

export async function getProjectIdea(shortname: string){
    try {
        return Dmart.retrieve_entry(ResourceType.ticket, "catalog", "posts", shortname, true, true);
    } catch (e) {
        return null;
    }
}

export async function createProjectIdea(data: ProjectIdea){
    const actionRequest: ActionRequest = {
        "space_name": "catalog",
        "request_type": RequestType.create,
        "records": [
            {
                "resource_type": ResourceType.ticket,
                "shortname": "auto",
                "subpath": "posts",
                "attributes": {
                    "is_active": data.is_active,
                    "workflow_shortname": "catalog_idea_workflow",
                    "relationships": [],
                    "tags": data.tags,
                    "payload": {
                        "content_type": "json",
                        "schema_shortname": "catelog_post",
                        "body": {
                            "title": data.title,
                            "content": data.content
                        }
                    }
                }
            }
        ]
    }
    const response: ActionResponse = await Dmart.request(actionRequest);
    if( response.status == "success" && response.records.length > 0){
        return response.records[0].shortname;
    }
    return null;
}

export async function updateProjectIdea(shortname, data: ProjectIdea){
    const actionRequest: ActionRequest = {
        "space_name": "catalog",
        "request_type": RequestType.update,
        "records": [
            {
                "resource_type": ResourceType.ticket,
                "shortname": shortname,
                "subpath": "posts",
                "attributes": {
                    "is_active": data.is_active,
                    "workflow_shortname": "catalog_idea_workflow",
                    "relationships": [],
                    "tags": data.tags,
                    "payload": {
                        "content_type": "json",
                        "schema_shortname": "catelog_post",
                        "body": {
                            "title": data.title,
                            "content": data.content
                        }
                    }
                }
            }
        ]
    }
    const response: ActionResponse = await Dmart.request(actionRequest);
    if( response.status == "success" && response.records.length > 0){
        return response.records[0].shortname;
    }
    return null;
}

export async function attachAttachmentsToIdeas(shortname: string, attachment: File){
    const { contentType, resourceType } = getFileType(attachment);
    const response = await Dmart.upload_with_payload(
        "catalog", `posts/${shortname}`, "auto", resourceType, attachment, contentType
    )
    return response.status == "success" && response.records.length > 0
}

export async function getIdeaAttachmentsCount(shortname: string){
    const query: QueryRequest = {
        "filter_shortnames": [],
        "type": QueryType.attachments_aggregation,
        "space_name": "catalog",
        "subpath": `posts/${shortname}`,
        "limit": 100,
        "sort_by": "shortname",
        "sort_type": SortyType.ascending,
        "offset": 0,
        "search": "",
        "retrieve_json_payload": true
    }
    const response = await Dmart.query(query);
    return response.records;
}

export async function progressProjectIdea(
    shrotname: string, action: string,
    resolution?: string, comment?: string
){
    const r = await Dmart.progress_ticket("catalog", "posts", shrotname, action, resolution, comment);
    return r.status == "success";
}

export async function deleteProjectIdea(shortname: string){
    const actionRequest: ActionRequest = {
        "space_name": "catalog",
        "request_type": RequestType.delete,
        "records": [
            {
                "resource_type": ResourceType.ticket,
                "shortname": shortname,
                "subpath": "posts",
                "attributes": {}
            }
        ]
    }
    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status == "success" && response.records.length > 0;
}

export async function getCatalogWorkflow(){
    try {
        const response = await Dmart.retrieve_entry(ResourceType.content, "catalog", "workflows", "catalog_idea_workflow", true, false);
        return response.payload.body
    } catch (e) {
        return null;
    }
}

export async function createComment(shortname: string, comment: string){
    const data: ActionRequest = {
            "space_name": "catalog",
            "request_type": RequestType.create,
            "records": [
            {
                "resource_type": ResourceType.comment,
                "shortname": "auto",
                "subpath": `posts/${shortname}`,
                "attributes": {
                    "is_active": true,
                    "payload": {
                        "content_type": ContentType.json,
                        "body": {
                            "state": "commented",
                            "body": comment
                        }
                    }
                }
            }
        ]
    }
    const response: ActionResponse = await Dmart.request(data);
    return response.status == "success" && response.records.length > 0;
}

export async function createReaction(shortname: string){
    const data: ActionRequest = {
            "space_name": "catalog",
            "request_type": RequestType.create,
            "records": [
            {
                "resource_type": ResourceType.reaction,
                "shortname": "auto",
                "subpath": `posts/${shortname}`,
                "attributes": {
                    "is_active": true,
                    "payload": {
                        "content_type": ContentType.json,
                        "body": {
                            "state": "commented",
                            "body": {"type": "like"},
                        }
                    }
                }
            }
        ]
    }
    const response: ActionResponse = await Dmart.request(data);
    return response.status == "success" && response.records.length > 0;
}

export async function deleteReactionComment(type: ResourceType, entry: string, shortname: string){
    const data: ActionRequest = {
        "space_name": "catalog",
        "request_type": RequestType.delete,
        "records": [
            {
                "resource_type": type,
                "shortname": shortname,
                "subpath": entry,
                "attributes": {}
            }
        ]
    }

    const response: ActionResponse = await Dmart.request(data);
    return response.status == "success" && response.records.length > 0;
}

export async function checkCurrentUserReactedIdea(user_shortname: string, entry_shortname: string){
    const data: QueryRequest = {
        "filter_shortnames": [],
        "type": QueryType.attachments,
        "space_name": "catalog",
        "subpath": `posts/${entry_shortname}`,
        "limit": 100,
        "sort_by": "shortname",
        "sort_type": SortyType.ascending,
        "offset": 0,
        "search": `@owner_shortname:${user_shortname} @resource_type:reaction`,
        "retrieve_json_payload": true
    }
    const response = await Dmart.query(data);
    if(response.records.length === 0){
        return null;
    }
    return response.records[0].shortname;
}

export async function fetchMyNotifications(shortname: string){
    const data: QueryRequest = {
        "filter_shortnames": [],
        "type": QueryType.search,
        "space_name": "personal",
        "subpath": `people/${shortname}/notifications`,
        "limit": 100,
        "sort_by": "shortname",
        "sort_type": SortyType.descending,
        "offset": 0,
        "search": "",
        "retrieve_json_payload": true
    }
    const response = await Dmart.query(data);
    return response.records;
}