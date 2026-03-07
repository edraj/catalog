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
        space_name: "catalog",
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
                        ar: reportData.title,
                        ku: reportData.title,
                    },
                    tags: [reportData.report_type, reportData.status || "pending"],
                    workflow_shortname: workflow_shortname,
                    payload: {
                        content_type: ContentType.json,
                        schema_shortname: schema_shortname,
                        body: {
                            title: reportData.title,
                            description: reportData.description,
                            reported_entry: reportData.reported_entry,
                            reported_entry_title: reportData.reported_entry_title,
                            reported_space: reportData.space_name,
                            reported_subpath: reportData.subpath,
                            report_type: reportData.report_type,
                            created_at: new Date().toISOString(),
                            replies: [],
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
        searchQuery += ` AND @tags:${status}`;
    }

    const response = await Dmart.query(
        {
            type: QueryType.search,
            space_name: "catalog",
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
            "catalog",
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
    newStatus: "Pending" | "Resolved" | "Canceled",
    adminReply?: string
) {
    try {
        const currentReport = await getReportDetails(reportShortname);
        if (!currentReport) {
            return false;
        }

        const currentBody = currentReport.payload.body;
        const updatedReplies = [...(currentBody.replies || [])];

        if (adminReply) {
            updatedReplies.push({
                timestamp: new Date().toISOString(),
                admin_shortname: "dmart",
                reply: adminReply,
                action:
                    newStatus === "Resolved"
                        ? "Resolved"
                        : newStatus === "Canceled"
                            ? "Canceled"
                            : "Replied",
            });
        }

        const updatedBody = {
            ...currentBody,
            replies: updatedReplies,
            updated_at: new Date().toISOString(),
        };

        const workflowAction = newStatus;
        const updateRequest: ActionRequest = {
            space_name: "catalog",
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
            space_name: "report",
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
    action?: "delete_entry" | "warn_user" | "no_action"
) {
    try {
        let newStatus: "Pending" | "Resolved" | "Canceled" = action
            ? "Resolved"
            : "Pending";

        const reportDetails = await getReportDetails(reportShortname);
        if (!reportDetails?.payload.body.reported_entry) {
            console.warn("No reported entry found in report details");
            return await updateReportStatus(
                reportShortname,
                newStatus,
                `${reply}${action ? ` [Action taken: ${action}]` : ""}`
            );
        }

        const entryShortname = reportDetails.payload.body.reported_entry;
        const spaceName = reportDetails.payload.body.reported_space;
        const subpath = reportDetails.payload.body.reported_subpath;

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
