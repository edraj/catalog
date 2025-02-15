import Dmart, {
    type ActionRequest,
    type ActionResponse,
    type ApiQueryResponse,
    type QueryRequest,
    QueryType,
    RequestType,
    ResourceType,
    SortyType
} from "@edraj/tsdmart";

export async function getProfile(){
    const profile = await Dmart.get_profile()
    if (profile.status == "success" && profile.records.length > 0) {
        return profile.records[0];
    }
    return null;
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

export async function getProjectIdeas(limit: number = 15, offset: number = 0){
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
        search: "",
        retrieve_json_payload: true
    }

    const response: ApiQueryResponse = await Dmart.query(queryRequest);
    if (response === null){
        return null;
    }
    return response.records;
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
                    "is_active": true,
                    "workflow_shortname": "catalog_idea_workflow",
                    "relationships": [],
                    "payload": {
                        "content_type": "json",
                        "schema_shortname": "catelog_post",
                        "body": data
                    }
                }
            }
        ]
    }
    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status == "success" && response.records.length > 0;
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
