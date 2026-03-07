import {
    type ApiQueryResponse,
    ContentType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import { user } from "@/stores/user";
import { get } from "svelte/store";
import {
    getEntity,
    getEntitiesOfSubpath,
    createEntity,
    updateEntity,
    searchEntities
} from "./core";

export async function getSurveys(
    space_name: string = "surveys",
    scope: string = "managed",
    limit = 100,
    offset = 0,
    exact_subpath = false
): Promise<ApiQueryResponse> {
    return await searchEntities(
        space_name,
        "/surveys",
        "@resource_type:content",
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

export async function submitSurveyResponse(
    survey_shortname: string,
    responses: any
) {
    const currentUser = get(user);
    if (!currentUser?.shortname) {
        throw new Error("User not authenticated");
    }

    const existingResponse = await getUserSurveyResponseRecord(survey_shortname);

    const attributes: any = {
        is_active: true,
        owner_shortname: currentUser.shortname,
        payload: {
            content_type: ContentType.json,
            body: responses,
        },
    };

    if (existingResponse) {
        return await updateEntity(
            existingResponse.shortname,
            "surveys",
            `surveys/${survey_shortname}`,
            ResourceType.json,
            attributes
        );
    } else {
        return await createEntity(
            "surveys",
            `surveys/${survey_shortname}`,
            ResourceType.json,
            attributes,
            "auto"
        );
    }
}

export async function getUserSurveyResponseRecord(
    survey_shortname: string
): Promise<any | null> {
    const currentUser = get(user);
    if (!currentUser?.shortname) {
        return null;
    }

    try {
        const survey = await getEntity(
            survey_shortname,
            "surveys",
            "surveys",
            ResourceType.content,
            "managed",
            true,
            true
        );

        if (!survey || !(survey as any).attachments || !(survey as any).attachments.json) {
            return null;
        }

        const userResponse = (survey as any).attachments.json.find(
            (attachment: any) =>
                attachment.attributes?.owner_shortname === currentUser.shortname
        );

        return userResponse || null;
    } catch (error) {
        console.error("Error getting user survey response record:", error);
        return null;
    }
}

export async function hasUserRespondedToSurvey(
    survey_shortname: string
): Promise<boolean> {
    const response = await getUserSurveyResponseRecord(survey_shortname);
    return !!response;
}

export async function getUserSurveyResponses(
    survey_shortname: string
): Promise<any | null> {
    const userResponse = await getUserSurveyResponseRecord(survey_shortname);
    return userResponse?.attributes?.payload?.body || null;
}

export async function getAllSurveyResponses() {
    const response = await searchEntities(
        "surveys",
        "/surveys",
        "@resource_type:json",
        1000,
        0,
        "created_at",
        SortyType.descending
    );
    return response.records || [];
}

export async function getUserSurveys() {
    const currentUser = get(user);
    if (!currentUser?.shortname) {
        return [];
    }

    const response = await searchEntities(
        "surveys",
        "/surveys",
        `@owner_shortname:${currentUser.shortname}`,
        100,
        0,
        "created_at",
        SortyType.descending
    );
    return response.records || [];
}
