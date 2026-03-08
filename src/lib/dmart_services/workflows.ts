import { Dmart, QueryType, ResourceType } from "@edraj/tsdmart";
import { getEntityByShortname } from "./core";

export async function fetchWorkflows(space_name: string) {
    try {
        const result = await Dmart.query({
            search: "",
            type: QueryType.search,
            space_name,
            subpath: "/workflows",
        });
        return result.records || [];
    } catch (e) {
        console.error("Failed to fetch workflows");
    }
}

export async function getWorkflow(shortname: string, space_name: string = "catalog") {
    try {
        return await getEntityByShortname(
            shortname,
            space_name,
            "workflows",
            ResourceType.content,
            "managed",
            true,
            true
        );
    } catch (e) {
        console.error(`Failed to fetch workflow ${shortname}`);
        return null;
    }
}
