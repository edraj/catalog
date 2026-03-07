import {
    type ActionRequest,
    type ActionResponse,
    ContentType,
    Dmart,
    type QueryRequest,
    QueryType,
    RequestType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";

export async function createComment(
    spaceName: string,
    subpath: string,
    shortname: string,
    comment: string,
    parentCommentId?: string
) {
    const data: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
            {
                resource_type: ResourceType.comment,
                shortname: "auto",
                subpath: `${subpath}/${shortname}`,
                attributes: {
                    is_active: true,
                    payload: {
                        content_type: ContentType.json,
                        body: {
                            state: "commented",
                            body: comment,
                            parent_comment_id: parentCommentId || null,
                        },
                    },
                },
            },
        ],
    };
    const response: ActionResponse = await Dmart.request(data);
    return response.status == "success" && response.records.length > 0;
}

export async function deleteComment(
    commentShortname: string,
    spaceName: string,
    subpath: string,
    entryShortname: string
) {
    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.delete,
        records: [
            {
                resource_type: ResourceType.comment,
                shortname: commentShortname,
                subpath: `${subpath}/${entryShortname}`,
                attributes: {},
            },
        ],
    };

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success" && response.records.length > 0;
}

export async function deleteMultipleComments(
    commentShortnames: string[],
    spaceName: string,
    subpath: string,
    entryShortname: string
) {
    if (commentShortnames.length === 0) return true;

    const records = commentShortnames.map((shortname) => ({
        resource_type: ResourceType.comment,
        shortname: shortname,
        subpath: `${subpath}/${entryShortname}`,
        attributes: {},
    }));

    const actionRequest: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.delete,
        records: records,
    };

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success";
}

export function findAllChildComments(
    parentCommentId: string,
    allComments: any[]
): string[] {
    const childIds: string[] = [];

    const directChildren = allComments.filter(
        (comment) =>
            comment.attributes?.payload?.body?.parent_comment_id === parentCommentId
    );

    directChildren.forEach((child) => {
        childIds.push(child.shortname);
        const nestedChildren = findAllChildComments(child.shortname, allComments);
        childIds.push(...nestedChildren);
    });

    return childIds;
}

export async function createReaction(
    shortname: string,
    spaceName: string,
    subpath: string
) {
    const data: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.create,
        records: [
            {
                resource_type: ResourceType.reaction,
                shortname: "auto",
                subpath: `${subpath}/${shortname}`,
                attributes: {
                    is_active: true,
                    payload: {
                        content_type: ContentType.json,
                        body: {
                            state: "commented",
                            body: { type: "like" },
                        },
                    },
                },
            },
        ],
    };
    const response: ActionResponse = await Dmart.request(data);
    return response.status == "success" && response.records.length > 0;
}

export async function deleteReactionComment(
    type: ResourceType,
    entry: string,
    shortname: string,
    spaceName: string
) {
    const data: ActionRequest = {
        space_name: spaceName,
        request_type: RequestType.delete,
        records: [
            {
                resource_type: type,
                shortname: shortname,
                subpath: entry,
                attributes: {},
            },
        ],
    };

    const response: ActionResponse = await Dmart.request(data);
    return response.status == "success" && response.records.length > 0;
}

export async function checkCurrentUserReactedIdea(
    user_shortname: string,
    entry_shortname: string,
    spaceName: string,
    subpath: string
) {
    const data: QueryRequest = {
        filter_shortnames: [],
        type: QueryType.attachments,
        space_name: spaceName,
        subpath: `${subpath}/${entry_shortname}`,
        limit: 100,
        sort_by: "shortname",
        sort_type: SortyType.ascending,
        offset: 0,
        search: `@owner_shortname:${user_shortname} @resource_type:reaction`,
        retrieve_json_payload: true,
    };
    const response = await Dmart.query(data);
    if (response.records.length === 0) {
        return null;
    }
    return response.records[0].shortname;
}
