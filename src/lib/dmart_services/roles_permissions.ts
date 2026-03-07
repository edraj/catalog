import {
    type ActionRequest,
    type ActionResponse,
    Dmart,
    RequestType,
    ResourceType,
} from "@edraj/tsdmart";

export async function createRole(
    data: any,
    space_name: string,
    subpath: string,
    resourceType: ResourceType,
    workflow_shortname: string,
    schema_shortname: string
) {
    const attributes: any = {
        is_active: data.is_active ?? true,
        tags: data.tags || [],
        relationships: data.relationships || [],
        permissions: data.permissions || [],
        displayname: data.displayname || {},
        description: data.description || {},
        slug: data.slug || null,
    };
    if (workflow_shortname && schema_shortname) {
        attributes.workflow_shortname = workflow_shortname;
        attributes.schema_shortname = schema_shortname;
    }

    const actionRequest: ActionRequest = {
        space_name,
        request_type: RequestType.create,
        records: [
            {
                resource_type: resourceType,
                shortname: data.title || "auto",
                subpath,
                attributes,
            },
        ],
    };
    const response: ActionResponse = await Dmart.request(actionRequest);
    if (response.status == "success" && response.records.length > 0) {
        return response.records[0].shortname;
    }
    return null;
}

export async function updateRole(
    shortname: string,
    space_name: string,
    subpath: string,
    resourceType: ResourceType,
    data: any,
    workflow_shortname: string,
    schema_shortname: string
) {
    const attributes: any = {
        is_active: data.is_active ?? true,
        tags: data.tags || [],
        relationships: data.relationships || [],
        permissions: data.permissions || [],
        displayname: data.displayname || {},
        description: data.description || {},
        slug: data.slug || null,
    };

    if (workflow_shortname && schema_shortname) {
        attributes.workflow_shortname = workflow_shortname;
        attributes.schema_shortname = schema_shortname;
    }

    const actionRequest: ActionRequest = {
        space_name,
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

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success" && response.records.length > 0
        ? response.records[0].shortname
        : null;
}

export async function createPermission(
    data: any,
    space_name: string,
    subpath: string,
    resourceType: ResourceType,
    workflow_shortname: string,
    schema_shortname: string
) {
    const attributes: any = {
        is_active: data.is_active ?? true,
        tags: data.tags || [],
        relationships: data.relationships || [],
        acl: data.acl || [],
        subpaths: data.subpaths || {},
        resource_types: data.resource_types || [],
        actions: data.actions || [],
        conditions: data.conditions || [],
        restricted_fields: data.restricted_fields || [],
        allowed_fields_values: data.allowed_fields_values || {},
        attachments: data.attachments || {},
        slug: data.slug || null,
    };

    if (workflow_shortname && schema_shortname) {
        attributes.workflow_shortname = workflow_shortname;
        attributes.schema_shortname = schema_shortname;
    }

    const actionRequest: ActionRequest = {
        space_name,
        request_type: RequestType.create,
        records: [
            {
                resource_type: resourceType,
                shortname: data.shortname || "auto",
                subpath,
                attributes,
            },
        ],
    };

    const response: ActionResponse = await Dmart.request(actionRequest);
    if (response.status == "success" && response.records.length > 0) {
        return response.records[0].shortname;
    }
    return null;
}

export async function updatePermission(
    shortname: string,
    space_name: string,
    subpath: string,
    resourceType: ResourceType,
    data: any,
    workflow_shortname: string,
    schema_shortname: string
) {
    const attributes: any = {
        is_active: data.is_active ?? true,
        tags: data.tags || [],
        relationships: data.relationships || [],
        acl: data.acl || [],
        subpaths: data.subpaths || {},
        resource_types: data.resource_types || [],
        actions: data.actions || [],
        conditions: data.conditions || [],
        restricted_fields: data.restricted_fields || [],
        allowed_fields_values: data.allowed_fields_values || {},
        attachments: data.attachments || {},
        slug: data.slug || null,
    };

    if (workflow_shortname && schema_shortname) {
        attributes.workflow_shortname = workflow_shortname;
        attributes.schema_shortname = schema_shortname;
    }

    const actionRequest: ActionRequest = {
        space_name,
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

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success" && response.records.length > 0
        ? response.records[0].shortname
        : null;
}
