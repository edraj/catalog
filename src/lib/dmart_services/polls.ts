import {
    type ApiQueryResponse,
    ContentType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import {
    createEntity,
    updateEntity,
    searchEntities
} from "./core";

export async function getPolls(
    space_name: string = "applications",
    scope: string = "managed",
    limit = 100,
    offset = 0,
    exact_subpath = false
): Promise<ApiQueryResponse> {
    return await searchEntities(
        space_name,
        "/polls",
        "-@shortname:schema",
        limit,
        offset,
        "shortname",
        SortyType.ascending,
        scope,
        true,
        true,
        exact_subpath
    );
}

export async function userVote(
    poll_shortname: string,
    candidate_shortname: string,
    voters: any,
    isReplace: boolean = false
) {
    const attributes = {
        is_active: true,
        payload: {
            content_type: ContentType.json,
            body: { voters },
        },
    };

    if (isReplace) {
        return await updateEntity(
            candidate_shortname,
            "applications",
            `polls/${poll_shortname}`,
            ResourceType.json,
            attributes
        );
    } else {
        return await createEntity(
            "applications",
            `polls/${poll_shortname}`,
            ResourceType.json,
            attributes,
            candidate_shortname
        );
    }
}
