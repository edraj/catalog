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
import { getEntity, createEntity, updateEntity } from "./core";

export async function getAllUsers(
    limit: number = 100,
    offset: number = 0
): Promise<ApiQueryResponse> {
    try {
        return await Dmart.query({
            type: QueryType.search,
            space_name: "management",
            subpath: "users",
            search: "@resource_type:user",
            limit: limit,
            sort_by: "shortname",
            sort_type: SortyType.ascending,
            offset: offset,
            retrieve_json_payload: true,
            exact_subpath: false,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return { status: "failed", records: [], attributes: {} } as ApiQueryResponse;
    }
}

export async function filterUserByRole(
    role: string,
    limit: number = 100,
    offset: number = 0
): Promise<ApiQueryResponse> {
    try {
        return await Dmart.query({
            type: QueryType.search,
            space_name: "management",
            subpath: "users",
            search: `@resource_type:user @roles:${role}`,
            limit: limit,
            sort_by: "shortname",
            sort_type: SortyType.ascending,
            offset: offset,
            retrieve_json_payload: true,
            exact_subpath: false,
        });
    } catch (error) {
        console.error("Error filtering users by role:", error);
        return { status: "failed", records: [], attributes: {} } as ApiQueryResponse;
    }
}

export async function updateUserRoles(
    userShortname: string,
    roles: string[]
): Promise<boolean> {
    try {
        const actionRequest: ActionRequest = {
            space_name: "management",
            request_type: RequestType.update,
            records: [
                {
                    resource_type: ResourceType.user,
                    shortname: userShortname,
                    subpath: `users/${userShortname}`,
                    attributes: {
                        roles: roles,
                    },
                },
            ],
        };

        const response: ActionResponse = await Dmart.request(actionRequest);
        return response.status === "success";
    } catch (error) {
        console.error("Error updating user roles:", error);
        return false;
    }
}

export async function getUsersByShortnames(
    shortnames: string[]
): Promise<ApiQueryResponse> {
    try {
        if (shortnames.length === 0) {
            return await Dmart.query(
                {
                    type: QueryType.search,
                    space_name: "management",
                    subpath: "users",
                    limit: 0,
                    sort_by: "shortname",
                    sort_type: SortyType.ascending,
                    offset: 0,
                    search: "",
                    retrieve_json_payload: true,
                    retrieve_attachments: false,
                    exact_subpath: true,
                },
                "managed"
            );
        }

        const query: QueryRequest = {
            filter_shortnames: shortnames,
            type: QueryType.search,
            space_name: "management",
            subpath: "users",
            limit: shortnames.length,
            sort_by: "shortname",
            sort_type: SortyType.ascending,
            offset: 0,
            search: "",
            retrieve_json_payload: true,
            retrieve_attachments: false,
            exact_subpath: true,
        };

        return await Dmart.query(query, "managed");
    } catch (error) {
        console.error("Error fetching users by shortnames:", error);
        return await Dmart.query(
            {
                type: QueryType.search,
                space_name: "management",
                subpath: "users",
                limit: 0,
                sort_by: "shortname",
                sort_type: SortyType.ascending,
                offset: 0,
                search: "",
                retrieve_json_payload: true,
                retrieve_attachments: false,
                exact_subpath: true,
            },
            "managed"
        );
    }
}

export async function setDefaultUserRole(
    roleShortname: string
): Promise<boolean> {
    try {
        const existingConfig = await getEntity(
            "web_config",
            "applications",
            "public",
            ResourceType.content,
            "managed",
            true,
            false
        );

        if (existingConfig) {
            const payload = existingConfig.payload.body;
            let updatedItems = payload.items || [];

            const existingItemIndex = updatedItems.findIndex(
                (item) => item.key === "default_user_role"
            );

            if (existingItemIndex !== -1) {
                updatedItems[existingItemIndex] = {
                    key: "default_user_role",
                    value: roleShortname,
                };
            } else {
                updatedItems.push({
                    key: "default_user_role",
                    value: roleShortname,
                });
            }

            const result = await updateEntity(
                "web_config",
                "applications",
                "public",
                ResourceType.content,
                {
                    payload: {
                        content_type: ContentType.json,
                        body: {
                            items: updatedItems,
                        },
                    },
                },
            );

            return result !== null;
        } else {
            const attributes: any = {
                displayname: { en: "Default User Role Configuration" },
                description: { en: `Default role assigned to new users: ${roleShortname}`, ar: "", ku: "" },
                is_active: true,
                tags: ["config", "user_role"],
                relationships: [],
                payload: {
                    content_type: ContentType.json,
                    body: {
                        items: [{
                            key: "default_user_role",
                            value: roleShortname
                        }]
                    }
                }
            };

            const result = await createEntity(
                "applications",
                "configs",
                ResourceType.content,
                attributes,
                "web_config"
            );
            return result !== null;
        }
    } catch (error) {
        console.error("Error setting default user role:", error);
        return false;
    }
}
