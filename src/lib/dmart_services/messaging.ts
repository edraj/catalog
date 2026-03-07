import {
    ContentType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import {
    getEntity,
    createEntity,
    searchEntities
} from "./core";

export async function getMessageByShortname(shortname: string) {
    try {
        const record = await getEntity(
            shortname,
            "messages",
            "messages",
            ResourceType.content,
            "public",
            true,
            true
        );

        if (record) {
            const payload = (record as any).payload;
            const body = payload?.body;

            if (!body) {
                console.error("No message body found in payload");
                return null;
            }

            if (body.messageType === "group_message" && body.groupId) {
                return {
                    id: record.shortname,
                    senderId: body.sender,
                    groupId: body.groupId,
                    content: body.content,
                    timestamp: new Date((record as any).created_at || Date.now()),
                    messageType: body.messageType || "group_message",
                    isGroupMessage: true,
                };
            } else {
                return {
                    id: record.shortname,
                    senderId: body.sender,
                    receiverId: body.receiver,
                    content: body.content,
                    timestamp: new Date((record as any).created_at || Date.now()),
                    messageType: body.message_type || "text",
                    isGroupMessage: false,
                };
            }
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch message by shortname:", error);
        return null;
    }
}

export async function getConversationPartners(currentUserShortname: string) {
    try {
        const response = await searchEntities(
            "messages",
            "messages",
            "",
            1000,
            0,
            "created_at",
            SortyType.descending,
            "public",
            true,
            true,
            true
        );

        if (response && response.status === "success" && response.records) {
            const partnerShortnames = new Set<string>();

            response.records.forEach((record) => {
                const payload = record.attributes.payload?.body;
                if (!payload) return;

                if (payload.sender === currentUserShortname && payload.receiver) {
                    partnerShortnames.add(payload.receiver);
                } else if (
                    payload.receiver === currentUserShortname &&
                    payload.sender
                ) {
                    partnerShortnames.add(payload.sender);
                }
            });

            return Array.from(partnerShortnames);
        } else {
            return [];
        }
    } catch (error) {
        console.error("Error fetching conversation partners:", error);
        return [];
    }
}

export async function fetchContactMessages() {
    try {
        return await searchEntities(
            "applications",
            "contacts",
            "",
            100,
            0,
            "created_at",
            SortyType.descending,
            "public",
            true,
            true,
            true
        );
    } catch (err) {
        console.error("Error fetching contact messages:", err);
    }
}

export async function markMessageAsReplied(
    spaceName: string,
    subpath: string,
    parentShortname: string,
    replyContent: string
) {
    const attributes = {
        is_active: true,
        payload: {
            content_type: ContentType.json,
            body: {
                state: "replied",
                body: replyContent,
            },
        },
    };

    const targetSubpath = `${subpath}/${parentShortname}`.replaceAll("//", "/");

    return await createEntity(
        spaceName,
        targetSubpath,
        ResourceType.comment,
        attributes,
        "auto"
    );
}

export async function createItem(
    itemName: string,
    itemType: string,
    spaceName: string,
    subpath: string = "/"
) {
    const attributes = {
        is_active: true,
        displayname: {
            en: itemName,
            ar: itemName,
        },
        description: {
            en: `Created via admin panel`,
            ar: `تم إنشاؤه عبر لوحة الإدارة`,
        },
    };

    return await createEntity(
        spaceName,
        subpath,
        itemType as ResourceType,
        attributes,
        "auto"
    );
}

export async function deleteItem(
    shortname: string,
    resourceType: string,
    subpath: string,
    spaceName: string
) {
    const result = await (await import("./core")).deleteEntity(
        shortname,
        spaceName,
        subpath || "/",
        resourceType as ResourceType
    );
    return result;
}
