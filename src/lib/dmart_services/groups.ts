import {
    type ApiQueryResponse,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import {
    getEntity,
    getEntitiesOfSubpath,
    createEntity,
    updateEntity,
    searchEntities
} from "./core";

export async function createGroup(data: {
    name: string;
    description?: string;
    participants: string[];
    createdBy: string;
}) {
    const attributes = {
        displayname: { en: data.name },
        description: { en: data.description || "" },
        is_active: true,
        payload: {
            content_type: "json",
            body: {
                participants: data.participants,
                adminIds: [data.createdBy],
                createdBy: data.createdBy,
                groupType: "group_chat",
            },
        },
    };

    return await createEntity(
        "messages",
        "/groups",
        ResourceType.content,
        attributes,
        "auto"
    );
}

export async function updateGroup(
    groupShortname: string,
    data: {
        name?: string;
        description?: string;
        participants?: string[];
        adminIds?: string[];
    }
) {
    const group = await getEntity(
        groupShortname,
        "messages",
        "/groups",
        ResourceType.content,
        "managed"
    );

    if (!group) return false;

    const currentPayload = group.payload?.body || {};

    const attributes = {
        displayname: data.name
            ? { en: data.name }
            : group.displayname,
        description: {
            en: data.description !== undefined
                ? data.description
                : group.description?.en || "",
        },
        payload: {
            content_type: "json",
            body: {
                ...currentPayload,
                participants: data.participants || currentPayload.participants,
                adminIds: data.adminIds || currentPayload.adminIds,
            },
        },
    };

    const result = await updateEntity(
        groupShortname,
        "messages",
        "/groups",
        ResourceType.content,
        attributes
    );
    return result !== null;
}

export async function getUserGroups(
    userShortname: string
): Promise<ApiQueryResponse> {
    return await searchEntities(
        "messages",
        "/groups",
        "",
        100,
        0,
        "created_at",
        SortyType.descending,
        "managed"
    );
}

export async function getGroupDetails(groupShortname: string) {
    return await getEntity(
        groupShortname,
        "messages",
        "/groups",
        ResourceType.content,
        "managed",
        true,
        false
    );
}

export async function createGroupMessage(data: {
    groupId: string;
    sender: string;
    content: string;
}) {
    const attributes = {
        is_active: true,
        payload: {
            content_type: "json",
            body: {
                sender: data.sender,
                groupId: data.groupId,
                content: data.content,
                messageType: "group_message",
            },
        },
    };

    return await createEntity(
        "messages",
        "/messages",
        ResourceType.content,
        attributes,
        "auto"
    );
}

export async function getGroupMessages(
    groupId: string,
    limit: number = 10,
    offset: number = 0
) {
    try {
        const response = await searchEntities(
            "messages",
            "messages",
            "",
            limit,
            offset,
            "created_at",
            SortyType.descending,
            "managed",
            true,
            true,
            true
        );

        if (response && response.status === "success") {
            const filteredRecords = response.records.filter((record) => {
                const payload = record.attributes.payload?.body;
                if (!payload) return false;
                return payload.groupId === groupId;
            });

            return {
                status: "success",
                records: filteredRecords,
            };
        } else {
            throw new Error("Failed to fetch messages");
        }
    } catch (err) {
        console.error("Error fetching messages between users:", err);
        return { status: "error", records: [] };
    }
}

export async function getGroupMessageByShortname(shortname: string) {
    try {
        const record = await getEntity(
            shortname,
            "messages",
            "messages",
            ResourceType.content,
            "managed",
            true,
            true
        );

        if (record) {
            const payload = record.payload?.body;
            if (payload) {
                return {
                    id: record.shortname,
                    senderId: payload.sender,
                    groupId: payload.groupId,
                    content: payload.content,
                    timestamp: new Date(record.created_at || Date.now()),
                    attachments: record.attachments?.media || null,
                };
            }
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch group message by shortname:", error);
        return null;
    }
}

export async function addUserToGroup(
    groupShortname: string,
    userShortname: string
) {
    const group = await getGroupDetails(groupShortname);
    if (!group) return false;

    const currentParticipants =
        group.payload?.body?.participants || [];
    if (currentParticipants.includes(userShortname)) {
        return true;
    }

    const updatedParticipants = [...currentParticipants, userShortname];
    return await updateGroup(groupShortname, {
        participants: updatedParticipants,
    });
}

export async function removeUserFromGroup(
    groupShortname: string,
    userShortname: string
) {
    const group = await getGroupDetails(groupShortname);
    if (!group) return false;

    const currentParticipants =
        group.payload?.body?.participants || [];
    const updatedParticipants = currentParticipants.filter(
        (p) => p !== userShortname
    );

    const currentAdmins = group.payload?.body?.adminIds || [];
    const updatedAdmins = currentAdmins.filter((a) => a !== userShortname);

    return await updateGroup(groupShortname, {
        participants: updatedParticipants,
        adminIds: updatedAdmins,
    });
}

export async function makeUserGroupAdmin(
    groupShortname: string,
    userShortname: string
) {
    const group = await getGroupDetails(groupShortname);
    if (!group) return false;

    const currentAdmins = group.payload?.body?.adminIds || [];
    if (currentAdmins.includes(userShortname)) {
        return true;
    }

    const updatedAdmins = [...currentAdmins, userShortname];
    return await updateGroup(groupShortname, { adminIds: updatedAdmins });
}
