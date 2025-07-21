import {
  Dmart,
  type ActionRequest,
  type ActionResponse,
  type ApiQueryResponse,
  type QueryRequest,
  ContentType,
  QueryType,
  RequestType,
  ResourceType,
  SortyType,
} from "@edraj/tsdmart";
import { user } from "@/stores/user";
import { get } from "svelte/store";
import type { Translation } from "@edraj/tsdmart/dmart.model";

export interface EntitySearch {
  limit: number;
  offset: number;
  shortname: string;
  search: string;
}

function getFileType(
  file: File
): { contentType: ContentType; resourceType: ResourceType } | null {
  const mimeType = file.type;

  let contentType: ContentType;
  let resourceType: ResourceType;

  if (mimeType.startsWith("image")) {
    contentType = ContentType.image;
    resourceType = ResourceType.media;
  } else if (mimeType.startsWith("audio")) {
    contentType = ContentType.audio;
    resourceType = ResourceType.media;
  } else if (mimeType.startsWith("video")) {
    contentType = ContentType.video;
    resourceType = ResourceType.media;
  } else {
    switch (mimeType) {
      case "application/pdf":
        contentType = ContentType.pdf;
        resourceType = ResourceType.media;
        break;
      case "text/plain":
        contentType = ContentType.text;
        resourceType = ResourceType.media;
        break;
      case "application/json":
        contentType = ContentType.json;
        resourceType = ResourceType.json;
        break;
      default:
        return null;
    }
  }

  return { contentType, resourceType };
}

export async function getProfile() {
  try {
    const profile = await Dmart.get_profile();
    if (profile === null) {
      return null;
    }
    if (profile.status == "success" && profile.records.length > 0) {
      return profile.records[0];
    }

    return null;
  } catch (e) {
    return e;
  }
}

export async function getAvatar(shortname: string) {
  const query: QueryRequest = {
    filter_shortnames: [],
    type: QueryType.attachments,
    space_name: "personal",
    subpath: `people/${shortname}/protected/avatar`,
    limit: 1,
    sort_by: "shortname",
    sort_type: SortyType.ascending,
    offset: 0,
    search: "@resource_type:media",
    retrieve_json_payload: false,
  };
  const results = await Dmart.query(query);

  if (results.records.length === 0) {
    return null;
  }

  return Dmart.get_attachment_url(
    ResourceType.media,
    "personal",
    `people/${shortname}/protected/`,
    "avatar",
    results.records[0].attributes.payload.body
  );
}

export async function setAvatar(shortname: string, attachment: File) {
  const response = await Dmart.upload_with_payload(
    "personal",
    `people/${shortname}/protected/avatar`,
    "avatar",
    ResourceType.media,
    attachment,
    ContentType.image
  );
  return response.status == "success" && response.records.length > 0;
}

export async function updateProfile(data: any) {
  const request = {
    resource_type: ResourceType.user,
    shortname: data.shortname,
    subpath: "users",
    attributes: {
      displayname: {
        en: data.displayname,
      },
      description: {
        en: data.description,
      },
    },
  };
  const response = await Dmart.update_user(request);
  return response.status == "success";
}

export async function createUser(user: User) {
  const data = {
    shortname: user.shortname,
    resource_type: ResourceType.user,
    subpath: "users",
    attributes: {
      is_active: true,
      displayname: user.displayname,
      description: user.description,
      tags: [],
      password: user.password,
      type: "web",
      roles: ["catalog_role"],
      groups: [],
      firebase_token: "",
      is_email_verified: true,
      is_msisdn_verified: true,
      force_password_change: false,
      relationships: [],
      invitation: "",
    },
  };
  const response: ActionResponse = await Dmart.create_user(data);
  return response.status == "success" && response.records.length > 0;
}

export async function getEntities() {
  const result = await getSpaces();
  const spaces = result.records.map((space) => space.shortname);

  const promises = spaces.map(async (space) => {
    const { search } = {
      search: "",
    };

    const queryRequest: QueryRequest = {
      filter_shortnames: [],
      type: QueryType.subpath,
      space_name: space,
      subpath: "/",
      exact_subpath: false,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      search,
      retrieve_json_payload: true,
      retrieve_attachments: true,
    };

    const response: ApiQueryResponse = await Dmart.query(queryRequest);
    return response?.records ?? [];
  });

  const allRecordsArrays = await Promise.all(promises);

  return allRecordsArrays.flat();
}

export async function getMyEntities(shortname = "") {
  const result = await getSpaces();
  const spaces = result.records.map((space) => space.shortname);

  const promises = spaces.map(async (space) => {
    let currentUser = get(user);
    const search = `@owner_shortname:${shortname || currentUser.shortname}`;

    const queryRequest: QueryRequest = {
      filter_shortnames: [],
      type: QueryType.subpath,
      space_name: space,
      subpath: "/",
      exact_subpath: false,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      search,
      retrieve_json_payload: true,
      retrieve_attachments: true,
    };

    const response: ApiQueryResponse = await Dmart.query(queryRequest);
    return response?.records ?? [];
  });

  const allRecordsArrays = await Promise.all(promises);

  return allRecordsArrays.flat();
}

export async function getEntity(
  shortname: string,
  spaceName: string,
  subpath: string,
  resourceType: ResourceType,
  retrieve_json_payload: boolean = true,
  retrieve_attachments: boolean = true
) {
  try {
    return Dmart.retrieve_entry(
      resourceType,
      spaceName,
      subpath,
      shortname,
      retrieve_json_payload,
      retrieve_attachments
    );
  } catch (e) {
    return null;
  }
}

export async function createEntity(
  data: Entity,
  spaceName: string,
  subpath: string,
  resourceType: ResourceType
) {
  let actionRequest: ActionRequest;
  if (spaceName === "catalog") {
    actionRequest = {
      space_name: spaceName,
      request_type: RequestType.create,
      records: [
        {
          resource_type: resourceType,
          shortname: "auto",
          subpath: subpath,
          attributes: {
            is_active: data.is_active,
            workflow_shortname: "catalog_idea_workflow",
            relationships: [],
            tags: data.tags,
            payload: {
              content_type: "json",
              schema_shortname: "catelog_post",
              body: {
                title: data.title,
                content: data.content,
              },
            },
          },
        },
      ],
    };
  } else {
    actionRequest = {
      space_name: spaceName,
      request_type: RequestType.create,
      records: [
        {
          resource_type: resourceType,
          shortname: "auto",
          subpath: subpath,
          attributes: {
            is_active: data.is_active,
            relationships: [],
            tags: data.tags,
            payload: {
              content_type: "json",
              body: {
                title: data.title,
                content: data.content,
              },
            },
          },
        },
      ],
    };
  }
  const response: ActionResponse = await Dmart.request(actionRequest);
  if (response.status == "success" && response.records.length > 0) {
    return response.records[0].shortname;
  }
  return null;
}

export async function updateEntity(
  shortname,
  space_name,
  subpath,
  resourceType: ResourceType,
  data: Entity
) {
  const isCatalog = space_name === "catalog";

  const attributes: any = {
    is_active: data.is_active,
    relationships: [],
    tags: data.tags,
    payload: {
      content_type: "json",
      body: {
        title: data.title,
        content: data.content,
      },
    },
  };

  if (isCatalog) {
    attributes.workflow_shortname = "catalog_idea_workflow";
    attributes.payload.schema_shortname = "catelog_post";
  }

  const actionRequest: ActionRequest = {
    space_name,
    request_type: RequestType.update,
    records: [
      {
        resource_type: resourceType,
        shortname,
        subpath,
        attributes,
      },
    ],
  };

  const response: ActionResponse = await Dmart.request(actionRequest);
  return response.status === "success" && response.records.length > 0
    ? response.records[0].shortname
    : null;
}

export async function attachAttachmentsToEntity(
  shortname: string,
  attachment: File
) {
  const { contentType, resourceType } = getFileType(attachment);
  const response = await Dmart.upload_with_payload(
    "catalog",
    `posts/${shortname}`,
    "auto",
    resourceType,
    attachment,
    contentType
  );
  return response.status == "success" && response.records.length > 0;
}

export async function getEntityAttachmentsCount(
  shortname: string,
  spaceName: string,
  subpath: string
) {
  const query: QueryRequest = {
    filter_shortnames: [],
    type: QueryType.attachments_aggregation,
    space_name: spaceName,
    subpath: `${subpath}/${shortname}`,
    limit: 100,
    sort_by: "shortname",
    sort_type: SortyType.ascending,
    offset: 0,
    search: "",
    retrieve_json_payload: true,
  };
  const response = await Dmart.query(query);

  return response.records;
}

export async function progressEntity(
  shrotname: string,
  action: string,
  resolution?: string,
  comment?: string
) {
  const r = await Dmart.progress_ticket(
    "catalog",
    "posts",
    shrotname,
    action,
    resolution,
    comment
  );
  return r.status == "success";
}

export async function deleteEntity(
  shortname: string,
  spaceName: string,
  subpath: string
) {
  const resourceType =
    spaceName === "catalog" ? ResourceType.ticket : ResourceType.content;

  const actionRequest: ActionRequest = {
    space_name: spaceName,
    request_type: RequestType.delete,
    records: [
      {
        resource_type: resourceType,
        shortname: shortname,
        subpath: subpath,
        attributes: {},
      },
    ],
  };

  const response: ActionResponse = await Dmart.request(actionRequest);
  return response.status === "success" && response.records.length > 0;
}

export async function getSpaces(
  ignoreFilter = false,
  scope: string = "managed"
): Promise<ApiQueryResponse> {
  const _spaces: any = await Dmart.query(
    {
      type: QueryType.spaces,
      space_name: "management",
      subpath: "/",
      search: "",
      limit: 100,
    },
    scope
  );

  if (ignoreFilter === false) {
    _spaces.records = _spaces.records.filter((e) => !e.attributes.hide_space);
  }

  _spaces.records = _spaces.records.map((e) => {
    if (e.attributes.ordinal === null) {
      e.attributes.ordinal = 9999;
    }
    return e;
  });

  _spaces.records.sort((a, b) => a.attributes.ordinal - b.attributes.ordinal);

  return _spaces;
}

export async function getSpaceContents(
  spaceName: string,
  subpath = "/",
  scope: string
): Promise<ApiQueryResponse> {
  const response = await Dmart.query(
    {
      type: QueryType.search,
      space_name: spaceName,
      subpath: subpath,
      search: "-@shortname:schema",
      limit: 100,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: 0,
      retrieve_json_payload: true,
      exact_subpath: true,
    },
    scope
  );
  return response;
}

export async function getCatalogWorkflow() {
  try {
    const response = await Dmart.retrieve_entry(
      ResourceType.content,
      "catalog",
      "workflows",
      "catalog_idea_workflow",
      true,
      false
    );
    return response.payload.body;
  } catch (e) {
    if (e.error.code) {
      return {};
    }
    return null;
  }
}

export async function getCatalogItem(
  spaceName: string,
  subpath: string,
  shortname: string,
  resourceType: ResourceType = ResourceType.content,
  scope: string = "managed"
): Promise<any> {
  try {
    let cleanSubpath = subpath.startsWith("/") ? subpath.substring(1) : subpath;
    if (!cleanSubpath || cleanSubpath === "/") {
      cleanSubpath = "__root__";
    }

    const response = await Dmart.retrieve_entry(
      resourceType,
      spaceName,
      cleanSubpath,
      shortname,
      true,
      true,
      true,
      scope
    );
    return response;
  } catch (error) {
    console.error(`Error retrieving item ${shortname}:`, error);

    if (resourceType === ResourceType.content) {
      try {
        return await getCatalogItem(
          spaceName,
          subpath,
          shortname,
          ResourceType.post
        );
      } catch (postError) {
        try {
          return await getCatalogItem(
            spaceName,
            subpath,
            shortname,
            ResourceType.ticket
          );
        } catch (ticketError) {
          throw error;
        }
      }
    }

    throw error;
  }
}

export async function createComment(
  spaceName: string,
  subpath: string,
  shortname: string,
  comment: string
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
            },
          },
        },
      },
    ],
  };
  const response: ActionResponse = await Dmart.request(data);
  return response.status == "success" && response.records.length > 0;
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

export async function fetchMyNotifications(shortname: string) {
  const data: QueryRequest = {
    filter_shortnames: [],
    type: QueryType.search,
    space_name: "personal",
    subpath: `people/${shortname}/notifications`,
    limit: 100,
    sort_by: "shortname",
    sort_type: SortyType.descending,
    offset: 0,
    search: "",
    retrieve_json_payload: true,
  };
  const response = await Dmart.query(data);
  return response.records;
}

export async function markNotification(
  user_shortname: string,
  shortname: string,
  markRead: boolean = true
) {
  const response = await Dmart.request({
    space_name: "personal",
    request_type: RequestType.update,
    records: [
      {
        resource_type: ResourceType.content,
        shortname: shortname,
        subpath: `people/${user_shortname}/notifications`,
        attributes: {
          payload: {
            schema_shortname: null,
            body: {
              is_read: markRead ? "yes" : "no",
            },
          },
        },
      },
    ],
  });
  return response.status == "success";
}

export async function markAllNotification(
  user_shortname: string,
  shortnames: string[],
  markRead: boolean = true
) {}

export async function deleteNotification(shortname: string) {
  const response = await Dmart.request({
    space_name: "personal",
    request_type: RequestType.delete,
    records: [
      {
        resource_type: ResourceType.content,
        shortname: shortname,
        subpath: `people/${shortname}/notifications`,
        attributes: {},
      },
    ],
  });
  return response.status == "success";
}

export async function deleteAllNotification(shortnames: string[]) {
  const response = await Dmart.request({
    space_name: "personal",
    request_type: RequestType.delete,
    records: shortnames.map((shortname) => ({
      resource_type: ResourceType.content,
      shortname: shortname,
      subpath: `people/${shortname}/notifications`,
      attributes: {},
    })),
  });
  return response.status == "success";
}

export async function fetchContactMessages() {
  try {
    const query = {
      type: QueryType.search,
      space_name: "applications",
      subpath: "contacts",
      search: "",
      sort_by: "created_at",
      sort_type: SortyType.descending,
      retrieve_json_payload: true,
      exact_subpath: true,
      filter_shortnames: [],
      retrieve_attachments: true,
    };

    const response = await Dmart.query(query);

    if (response && response.status === "success") {
      return response;
    } else {
      throw new Error("Failed to fetch contact messages");
    }
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
  const actionRequest: ActionRequest = {
    space_name: spaceName,
    request_type: RequestType.create,
    records: [
      {
        resource_type: ResourceType.comment,
        shortname: "auto",
        subpath: `${subpath}/${parentShortname}`.replaceAll("//", "/"),
        attributes: {
          is_active: true,
          payload: {
            content_type: ContentType.json,
            body: {
              state: "replied",
              body: replyContent,
            },
          },
        },
      },
    ],
  };

  const response: ActionResponse = await Dmart.request(actionRequest);
  return response.status == "success" && response.records.length > 0;
}

export async function createItem(
  itemName: string,
  itemType: string,
  spaceName: string,
  subpath: string = "/"
) {
  const actionRequest = {
    space_name: spaceName,
    request_type: RequestType.create,
    records: [
      {
        resource_type: itemType as ResourceType,
        shortname: "auto",
        subpath: subpath,
        attributes: {
          is_active: true,
          displayname: {
            en: itemName,
            ar: itemName,
          },
          description: {
            en: `Created via admin panel`,
            ar: `تم إنشاؤه عبر لوحة الإدارة`,
          },
        },
      },
    ],
  };

  const response = await Dmart.request(actionRequest);
  return response.status === "success" && response.records.length > 0;
}

export async function deleteItem(
  shortname: string,
  resourceType: string,
  subpath: string,
  spaceName: string
) {
  const actionRequest = {
    space_name: spaceName,
    request_type: RequestType.delete,
    records: [
      {
        resource_type: resourceType as ResourceType,
        shortname: shortname,
        subpath: subpath || "/",
        attributes: {},
      },
    ],
  };

  const response = await Dmart.request(actionRequest);
  return response.status === "success";
}

export async function createSpace({
  shortname,
  displayname,
  description,
}: {
  shortname: string;
  displayname: Translation;
  description: Translation;
}) {
  try {
    const response = await Dmart.space({
      space_name: shortname.trim(),
      request_type: RequestType.create,
      records: [
        {
          resource_type: ResourceType.space,
          shortname: shortname.trim(),
          subpath: "/",
          attributes: {
            is_active: true,
            displayname: displayname,
            description: description,
          },
        },
      ],
    });
    await getSpaces();
    return response.status;
  } catch (error) {
  } finally {
  }
}

export async function deleteSpace(shortname: string) {
  try {
    await Dmart.request({
      space_name: shortname,
      request_type: RequestType.delete,
      records: [
        {
          resource_type: ResourceType.space,
          shortname: shortname,
          subpath: "/",
          attributes: {},
        },
      ],
    });
    await getSpaces();
  } catch (error) {
  } finally {
  }
}

export async function editSpace(
  shortname: string,
  attributes: Record<string, any>
) {
  try {
    await Dmart.request({
      space_name: shortname,
      request_type: RequestType.replace,
      records: [
        {
          resource_type: ResourceType.space,
          shortname: shortname,
          subpath: "/",
          attributes: attributes,
        },
      ],
    });
    await getSpaces();
  } catch (error) {
  } finally {
  }
}

export { ResourceType };
