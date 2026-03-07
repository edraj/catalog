import { Dmart, QueryType } from "@edraj/tsdmart";

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
