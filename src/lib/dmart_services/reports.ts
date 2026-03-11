import {
    type ActionRequest,
    type ActionResponse,
    type ApiQueryResponse,
    ContentType,
    Dmart,
    QueryType,
    RequestType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import { getEntity, updateEntity } from "./core";
import { createComment } from "./comments_reactions";

export async function createReport(
    reportData: {
        title: string;
        description: string;
        reported_entry: string;
        reported_entry_title: string;
        space_name: string;
        subpath: string;
        report_type: string;
        status?: string;
        type?: string;
    },
    schema_shortname: string = "report",
    workflow_shortname: string = "report_workflow"
) {
    const actionRequest: ActionRequest = {
        space_name: "applications",
        request_type: RequestType.create,
        records: [
            {
                resource_type: ResourceType.ticket,
                shortname: "auto",
                subpath: "/reports",
                attributes: {
                    is_active: true,
                    displayname: {
                        en: reportData.title,
                    },
                    description: {
                        en: reportData.description,
                    },
                    tags: [reportData.report_type, reportData.status || "pending"],
                    workflow_shortname: workflow_shortname,
                    payload: {
                        content_type: ContentType.json,
                        schema_shortname: schema_shortname,
                        body: {
                            entry: reportData.reported_entry,
                            space_name: reportData.space_name,
                            subpath: reportData.subpath,
                            report_type: reportData.report_type,
                        },
                    },
                },
            },
        ],
    };

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success" && response.records.length > 0;
}

export async function getReports(
    status?: string,
    limit = 100,
    offset = 0
): Promise<ApiQueryResponse> {
    let searchQuery = "@resource_type:ticket";
    if (status) {
        searchQuery += ` @state:${status}`;
    }

    const response = await Dmart.query(
        {
            type: QueryType.search,
            space_name: "applications",
            subpath: "/reports",
            search: searchQuery,
            limit: limit,
            sort_by: "created_at",
            sort_type: SortyType.descending,
            offset: offset,
            retrieve_json_payload: true,
            retrieve_attachments: true,
            exact_subpath: false,
        },
        "managed"
    );
    return response;
}

export async function getReportDetails(
    reportShortname: string
): Promise<any | null> {
    try {
        const entity = await getEntity(
            reportShortname,
            "applications",
            "/reports",
            ResourceType.ticket,
            "managed",
            true,
            true
        );
        return entity;
    } catch (error) {
        console.error("Error fetching report details:", error);
        return null;
    }
}

export async function updateReportStatus(
    reportShortname: string,
    newStatus: string,
    adminReply?: string
) {
    try {
        const currentReport = await getReportDetails(reportShortname);
        if (!currentReport) {
            return false;
        }

        const currentBody = currentReport.payload?.body || {};

        if (adminReply) {
            await createComment(
                "applications",
                "reports",
                reportShortname,
                adminReply
            );
        }

        const updatedBody = {
            ...currentBody,
        };

        const workflowAction = newStatus;
        const updateRequest: ActionRequest = {
            space_name: "applications",
            request_type: RequestType.update,
            records: [
                {
                    resource_type: ResourceType.ticket,
                    shortname: reportShortname,
                    subpath: "reports",
                    attributes: {
                        is_active: true,
                        tags: [currentReport.tags?.[0] || "general", newStatus],
                        payload: {
                            content_type: ContentType.json,
                            body: updatedBody,
                        },
                    },
                },
            ],
        };

        const updateResponse: ActionResponse = await Dmart.request(updateRequest);
        if (updateResponse.status !== "success") {
            return false;
        }

        const progressResponse = await Dmart.progressTicket({
            space_name: "applications",
            subpath: "reports",
            shortname: reportShortname,
            action: workflowAction
        });

        return progressResponse.status === "success";
    } catch (error) {
        console.error("Error updating report status:", error);
        return false;
    }
}

export async function replyToReport(
    reportShortname: string,
    reply: string,
    action?: string
) {
    try {
        let newStatus: string = action
            ? action
            : "Pending";

        const reportDetails = await getReportDetails(reportShortname);
        if (!reportDetails?.payload.body.entry && !reportDetails?.payload.body.reported_entry) {
            console.warn("No reported entry found in report details");
            return await updateReportStatus(
                reportShortname,
                newStatus,
                `${reply}${action ? ` [Action taken: ${action}]` : ""}`
            );
        }

        const entryShortname = reportDetails.payload.body.entry || reportDetails.payload.body.reported_entry;
        const spaceName = reportDetails.payload.body.space_name || reportDetails.payload.body.reported_space;
        const subpath = reportDetails.payload.body.subpath || reportDetails.payload.body.reported_subpath;

        let reportedEntity = null;
        let entryOwner = null;

        try {
            const resourceTypesToTry = [
                ResourceType.content,
                ResourceType.ticket,
                ResourceType.media,
            ];

            for (const resourceType of resourceTypesToTry) {
                try {
                    reportedEntity = await getEntity(
                        entryShortname,
                        spaceName,
                        subpath,
                        resourceType,
                        "managed",
                        false,
                        false
                    );

                    if (reportedEntity) {
                        entryOwner = reportedEntity.owner_shortname;
                        break;
                    }
                } catch (e) { }
            }
        } catch (error) {
            console.warn("Could not retrieve reported entity details:", error);
        }

        if (action === "delete_entry" && reportedEntity) {
            try {
                await updateEntity(
                    entryShortname,
                    spaceName,
                    subpath,
                    reportedEntity.resource_type || ResourceType.content,
                    { is_active: false }
                );
            } catch (error) {
                console.error("Error deactivating reported entry:", error);
            }
        }

        return await updateReportStatus(
            reportShortname,
            newStatus,
            `${reply}${action ? ` [Action taken: ${action}]` : ""}`
        );
    } catch (error) {
        console.error("Error replying to report:", error);
        return false;
    }
}
