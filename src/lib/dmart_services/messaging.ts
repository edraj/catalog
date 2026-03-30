import {
    ContentType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import {
    getEntity,
    createEntity,
    searchEntities,
    deleteEntity
} from "./core";

const PERSONAL_SPACE = "personal";
const PROTECTED_SUBPATH_BASE = "people";

/**
 * Get the protected subpath for a user
 * e.g., "people/username/protected"
 */
function getUserProtectedSubpath(userShortname: string): string {
    return `${PROTECTED_SUBPATH_BASE}/${userShortname}/protected`;
}

/**
 * Create a new direct message
 * Messages are stored in the recipient's protected folder in the personal space
 * If user A sends to user B, it's saved in /people/B/protected
 */
export async function createMessages(data: {
    content: string;
    sender: string;
    receiver: string;
    message_type?: string;
    timestamp?: string;
}) {
    const attributes = {
        is_active: true,
        relationships: [],
        tags: [],
        payload: {
            content_type: ContentType.json,
            body: {
                content: data.content,
                sender: data.sender,
                receiver: data.receiver,
                message_type: data.message_type || "text",
                timestamp: data.timestamp || new Date().toISOString(),
            },
        },
    };

    // Store message in recipient's protected folder
    // If A sends to B, store in /people/B/protected
    const targetSubpath = getUserProtectedSubpath(data.receiver);

    return await createEntity(
        PERSONAL_SPACE,
        targetSubpath,
        ResourceType.content,
        attributes,
        'auto'
    );
}

/**
 * Get messages between two users
 * - Fetches messages sent BY currentUser TO otherUser from /people/otherUser/protected?filter_by_owner=currentUser
 * - Fetches messages sent TO currentUser BY otherUser from /people/currentUser/protected?filter_by_owner=otherUser
 */
export async function getMessagesBetweenUsers(
    currentUserShortname: string,
    otherUserShortname: string,
    limit: number = 10,
    offset: number = 0
) {
    try {
        // 1. Fetch messages sent BY currentUser TO otherUser
        // These are stored in /people/otherUser/protected with owner_shortname = currentUser
        const sentByMeResponse = await searchEntities(
            PERSONAL_SPACE,
            getUserProtectedSubpath(otherUserShortname),
            `@owner_shortname:${currentUserShortname}`,
            limit,
            offset,
            "created_at",
            SortyType.descending,
            "managed",
            true,
            true,
            true
        );

        // 2. Fetch messages sent BY otherUser TO currentUser
        // These are stored in /people/currentUser/protected with owner_shortname = otherUser
        const receivedFromOtherResponse = await searchEntities(
            PERSONAL_SPACE,
            getUserProtectedSubpath(currentUserShortname),
            `@owner_shortname:${otherUserShortname}`,
            limit,
            offset,
            "created_at",
            SortyType.descending,
            "managed",
            true,
            true,
            true
        );

        // Combine and sort messages
        const sentByMe = sentByMeResponse?.status === "success" ? sentByMeResponse.records : [];
        const receivedFromOther = receivedFromOtherResponse?.status === "success" ? receivedFromOtherResponse.records : [];

        const allMessages = [...sentByMe, ...receivedFromOther];

        // Sort by created_at ascending (oldest first for conversation view)
        allMessages.sort((a, b) => {
            const dateA = new Date(a.attributes.created_at || 0).getTime();
            const dateB = new Date(b.attributes.created_at || 0).getTime();
            return dateA - dateB;
        });

        // Apply limit after combining
        const limitedMessages = allMessages.slice(0, limit);

        return {
            status: "success",
            records: limitedMessages,
        };
    } catch (err) {
        console.error("Error fetching messages between users:", err);
        return { status: "error", records: [] };
    }
}

/**
 * Get a single message by its shortname
 * Searches in both users' protected folders to find the message
 */
export async function getMessageByShortname(
    shortname: string,
    senderShortname?: string,
    receiverShortname?: string,
    subpath?: string
) {
    try {
        // Try to find the message in either user's protected folder
        const possibleLocations = [];

        if (subpath) {
            // If we know the exact subpath from a notification, try it first
            possibleLocations.push({
                space: PERSONAL_SPACE,
                subpath: subpath.startsWith("/") ? subpath.substring(1) : subpath,
            });
        }

        if (receiverShortname) {
            possibleLocations.push({
                space: PERSONAL_SPACE,
                subpath: getUserProtectedSubpath(receiverShortname),
            });
        }
        if (senderShortname) {
            possibleLocations.push({
                space: PERSONAL_SPACE,
                subpath: getUserProtectedSubpath(senderShortname),
            });
        }

        // Try each location
        for (const location of possibleLocations) {
            try {
                const record = await getEntity(
                    shortname,
                    location.space,
                    location.subpath,
                    ResourceType.content,
                    "managed",
                    true,
                    true
                );

                if (record) {
                    const payload = (record as any).payload;
                    const body = payload?.body;

                    if (body) {
                        return {
                            id: record.shortname,
                            senderId: body.sender,
                            receiverId: body.receiver,
                            content: body.content,
                            timestamp: new Date((record as any).created_at || Date.now()),
                            messageType: body.message_type || "text",
                            isGroupMessage: false,
                            attachments: (record as any).attachments?.media || null,
                        };
                    }
                }
            } catch (e) {
                // Continue to next location
            }
        }

        return null;
    } catch (error) {
        console.error("Failed to fetch message by shortname:", error);
        return null;
    }
}

/**
 * Get all conversation partners for a user
 * Fetches from /people/currentUser/protected to find who sent messages to current user
 * Also needs to check where current user sent messages (from other users' folders)
 * 
 * For now, we check the current user's protected folder to find senders
 */
export async function getConversationPartners(currentUserShortname: string) {
    try {
        // Get messages in current user's protected folder
        // These are messages sent TO currentUser BY others
        const response = await searchEntities(
            PERSONAL_SPACE,
            getUserProtectedSubpath(currentUserShortname),
            "",
            1000,
            0,
            "created_at",
            SortyType.descending,
            "managed",
            true,
            true,
            true
        );

        const partnerShortnames = new Set<string>();

        if (response && response.status === "success" && response.records) {
            response.records.forEach((record) => {
                const payload = record.attributes.payload?.body;
                if (!payload) return;

                // The sender is the owner_shortname or in the payload.sender
                const sender = payload.sender;
                if (sender && sender !== currentUserShortname) {
                    partnerShortnames.add(sender);
                }
            });
        }

        return Array.from(partnerShortnames);
    } catch (error) {
        console.error("Error fetching conversation partners:", error);
        return [];
    }
}

/**
 * Fetch contact messages (for admin contact page)
 * Kept for backward compatibility - uses applications space
 */
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
        return { status: "failed", records: [], attributes: {} };
    }
}

/**
 * Mark a message as replied (for contact form)
 */
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

/**
 * Create a generic item
 */
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

/**
 * Delete an item
 */
export async function deleteItem(
    shortname: string,
    resourceType: string,
    subpath: string,
    spaceName: string
) {
    const result = await deleteEntity(
        shortname,
        spaceName,
        subpath || "/",
        resourceType as ResourceType
    );
    return result;
}
