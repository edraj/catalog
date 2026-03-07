import {
    Dmart,
    QueryType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";

/**
 * Retrieves the current user's profile information
 * @returns The user's profile record if successful, null if no profile found, or error object if failed
 */
export async function getProfile() {
    try {
        const profile = await Dmart.getProfile();
        if (profile === null) {
            return null;
        }
        if (profile.status == "success" && profile.records.length > 0) {
            return profile.records[0];
        }

        return null;
    } catch (e) {
        return e;
    }
}

/**
 * Retrieves the avatar URL for a specific user
 * @param shortname - The shortname of the user whose avatar to retrieve
 * @returns The avatar URL if found, null if no avatar exists
 */
export async function getAvatar(shortname: string) {
    const query = {
        filter_shortnames: [],
        type: QueryType.attachments,
        space_name: "personal",
        subpath: `people/${shortname}/protected/avatar`,
        limit: 1,
        sort_by: "shortname",
        sort_type: SortyType.ascending,
        offset: 0,
        search: "@resource_type:media",
        retrieve_json_payload: false,
    };
    const results = await Dmart.query(query, "public");

    if (results.records.length === 0) {
        return null;
    }

    return Dmart.getAttachmentUrl({
        ext: null,
        resource_type: ResourceType.media,
        space_name: "personal",
        subpath: `people/${shortname}/protected/`,
        parent_shortname: "avatar",
        shortname: results.records[0].attributes.payload.body
    });
}

/**
 * Sets/uploads an avatar image for a specific user
 * @param shortname - The shortname of the user
 * @param attachment - The image file to set as avatar
 * @returns True if avatar was successfully set, false otherwise
 */
export async function setAvatar(shortname: string, attachment: File) {
    const response = await Dmart.uploadWithPayload({
        space_name: "personal",
        subpath: `people/${shortname}/protected/avatar`,
        shortname: "avatar",
        resource_type: ResourceType.media,
        payload_file: attachment,
    });

    return response.status == "success" && response.records.length > 0;
}

/**
 * Updates a user's profile information including displayname, description, and email
 * @param data - Object containing user data with shortname, displayname, description, and email
 * @returns True if profile was successfully updated, false otherwise
 */
export async function updateProfile(data: any) {
    const request = {
        resource_type: ResourceType.user,
        shortname: data.shortname,
        subpath: "users",
        attributes: {
            displayname: data.displayname,
            description: data.description,
            email: data.email,
            payload: data.payload,
        },
    };
    const response = await Dmart.updateUser(request);
    return response.status == "success";
}

/**
 * Updates a user's password
 * @param data - Object containing user shortname and new password
 * @returns True if password was successfully updated, false otherwise
 */
export async function updatePassword(data: any) {
    const request = {
        resource_type: ResourceType.user,
        shortname: data.shortname,
        subpath: "users",
        attributes: {
            password: data.password,
        },
    };
    const response = await Dmart.updateUser(request);
    return response.status == "success";
}
