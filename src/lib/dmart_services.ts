import {
  type ActionRequest,
  type ActionResponse,
  type ApiQueryResponse,
  ContentType,
  Dmart,
  type QueryRequest,
  QueryType,
  RequestType,
  ResourceType,
  SortyType,
} from "@edraj/tsdmart";
import { user } from "@/stores/user";
import { get } from "svelte/store";
import type { Translation } from "@edraj/tsdmart/dmart.model";
import { getFileType } from "./helpers";

/**
 * Retrieves the current user's profile information
 * @returns The user's profile record if successful, null if no profile found, or error object if failed
 */
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

/**
 * Retrieves the avatar URL for a specific user
 * @param shortname - The shortname of the user whose avatar to retrieve
 * @returns The avatar URL if found, null if no avatar exists
 */
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
  const results = await Dmart.query(query, "public");

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

/**
 * Sets/uploads an avatar image for a specific user
 * @param shortname - The shortname of the user
 * @param attachment - The image file to set as avatar
 * @returns True if avatar was successfully set, false otherwise
 */
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

/**
 * Updates a user's profile information including displayname, description, and email
 * @param data - Object containing user data with shortname, displayname, description, and email
 * @returns True if profile was successfully updated, false otherwise
 */
export async function updateProfile(data: any) {
  const request = {
    resource_type: ResourceType.user,
    shortname: data.shortname,
    subpath: "users",
    attributes: {
      displayname: data.displayname,
      description: data.description,
      email: data.email,
    },
  };
  const response = await Dmart.update_user(request);
  return response.status == "success";
}

/**
 * Updates a user's password
 * @param data - Object containing user shortname and new password
 * @returns True if password was successfully updated, false otherwise
 */
export async function updatePassword(data: any) {
  const request = {
    resource_type: ResourceType.user,
    shortname: data.shortname,
    subpath: "users",
    attributes: {
      password: data.password,
    },
  };
  const response = await Dmart.update_user(request);
  return response.status == "success";
}

export async function getEntities(search) {
  const result = await getSpaces();
  const spaces = result.records.map((space) => space.shortname);

  const promises = spaces.map(async (space) => {
    const queryRequest: QueryRequest = {
      filter_shortnames: [],
      type: QueryType.subpath,
      space_name: space,
      subpath: "/",
      exact_subpath: false,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      search: search,
      retrieve_json_payload: true,
      retrieve_attachments: true,
    };

    const response: ApiQueryResponse = await Dmart.query(queryRequest);
    return response?.records ?? [];
  });

  const allRecordsArrays = await Promise.all(promises);

  return allRecordsArrays.flat();
}

export async function getMyEntities(shortname: string = "") {
  const result = await getSpaces();
  const spaces = result.records.map((space) => space.shortname);

  const promises = spaces.map(async (space) => {
    let currentUser = get(user);
    const search = `@owner_shortname:${
      shortname || currentUser.shortname
    } and -@space_name:messages`;

    const queryRequest: QueryRequest = {
      filter_shortnames: [],
      type: QueryType.subpath,
      space_name: space,
      subpath: "/",
      exact_subpath: false,
      sort_by: "created_at",
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
  scope: string,
  retrieve_json_payload: boolean = true,
  retrieve_attachments: boolean = true
) {
  let cleanSubpath = subpath.startsWith("/") ? subpath.substring(1) : subpath;
  if (!cleanSubpath || cleanSubpath === "/") {
    cleanSubpath = "__root__";
  }

  try {
    const response = await Dmart.retrieve_entry(
      resourceType,
      spaceName,
      cleanSubpath,
      shortname,
      retrieve_json_payload,
      retrieve_attachments,
      true,
      scope
    );
    return response;
  } catch (error) {
    console.error(`Error retrieving item ${shortname}:`, error);
    return error;
  }
}

export async function createEntity(
  data: any,
  spaceName: string,
  subpath: string,
  resourceType: ResourceType = ResourceType.content,
  workflow_shortname: string,
  schema_shortname: string,
  content_type: string = "json"
) {
  let actionRequest: ActionRequest;
  if (workflow_shortname || schema_shortname) {
    actionRequest = {
      space_name: spaceName,
      request_type: RequestType.create,
      records: [
        {
          resource_type: resourceType,
          shortname: data.shortname || "auto",
          subpath: subpath,
          attributes: {
            is_active: data.is_active || true,
            workflow_shortname: workflow_shortname,
            relationships: [],
            tags: data.tags || [],
            payload: {
              schema_shortname: schema_shortname,
              content_type: content_type,
              body: data.body,
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
          shortname: data?.shortname || "auto",
          subpath: subpath,
          attributes: {
            is_active: data.is_active,
            relationships: [],
            tags: data.tags,
            payload: {
              content_type: content_type,
              body: data.body,
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
  data: any,
  workflow_shortname: string,
  schema_shortname: string
) {
  const contentType = data.content_type || "html";

  const attributes: any = {
    is_active: data.is_active,
    displayname: data.displayname,
    relationships: [],
    tags: data.tags,
    payload: {
      content_type: contentType,
      body: data.content,
    },
  };

  if (workflow_shortname && schema_shortname) {
    attributes.workflow_shortname = workflow_shortname;
    attributes.payload.schema_shortname = schema_shortname;
  }

  const actionRequest = {
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

  const response = await Dmart.request(actionRequest);
  return response.status === "success" && response.records.length > 0
    ? response.records[0].shortname
    : null;
}

export async function updatePermission(
  shortname: string,
  space_name: string,
  subpath: string,
  resourceType: ResourceType,
  data: any,
  workflow_shortname: string,
  schema_shortname: string
) {
  const attributes: any = {
    is_active: data.is_active ?? true,
    tags: data.tags || [],
    relationships: data.relationships || [],
    acl: data.acl || [],
    subpaths: data.subpaths || {},
    resource_types: data.resource_types || [],
    actions: data.actions || [],
    conditions: data.conditions || [],
    restricted_fields: data.restricted_fields || [],
    allowed_fields_values: data.allowed_fields_values || {},
    attachments: data.attachments || {},
    slug: data.slug || null,
  };

  if (workflow_shortname && schema_shortname) {
    attributes.workflow_shortname = workflow_shortname;
    attributes.schema_shortname = schema_shortname;
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

export async function updateRole(
  shortname: string,
  space_name: string,
  subpath: string,
  resourceType: ResourceType,
  data: any,
  workflow_shortname: string,
  schema_shortname: string
) {
  const attributes: any = {
    is_active: data.is_active ?? true,
    tags: data.tags || [],
    relationships: data.relationships || [],
    permissions: data.permissions || [],
    displayname: data.displayname || {},
    description: data.description || {},
    slug: data.slug || null,
  };

  if (workflow_shortname && schema_shortname) {
    attributes.workflow_shortname = workflow_shortname;
    attributes.schema_shortname = schema_shortname;
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

export async function getTemplates(
  space_name: string = "applications",
  scope: string = "managed",
  limit = 100,
  offset = 0,
  exact_subpath = false
): Promise<ApiQueryResponse> {
  const response = await Dmart.query(
    {
      type: QueryType.search,
      space_name: space_name,
      subpath: "/templates",
      search: "-@shortname:schema",
      limit: limit,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: offset,
      retrieve_json_payload: true,
      retrieve_attachments: true,
      exact_subpath: exact_subpath,
    },
    scope
  );
  return response;
}

export async function createTemplate(
  spaceName: string,
  subpath: string,
  shortname: string,
  data: {
    title: string;
    content: string;
  }
) {
  const request: ActionRequest = {
    space_name: spaceName,
    request_type: RequestType.create,
    records: [
      {
        resource_type: ResourceType.content,
        shortname: "auto",
        subpath: `${subpath}/${shortname}`,
        attributes: {
          is_active: true,
          payload: {
            content_type: ContentType.json,
            body: {
              title: data.title,
              content: data.content,
            },
          },
        },
      },
    ],
  };
  const response: ActionResponse = await Dmart.request(request);
  return response.status == "success" && response.records.length > 0;
}

export async function updateTemplates(
  shortname,
  space_name,
  subpath,
  data: any
) {
  const attributes: any = {
    is_active: data.is_active,
    displayname: data.displayname,
    relationships: [],
    tags: data.tags,
    payload: {
      content_type: ContentType.json,
      body: {
        title: data.title,
        content: data.content,
      },
    },
  };

  const actionRequest = {
    space_name,
    request_type: RequestType.update,
    records: [
      {
        resource_type: ResourceType.content,
        shortname,
        subpath,
        attributes,
      },
    ],
  };

  const response = await Dmart.request(actionRequest);
  return response.status === "success" && response.records.length > 0
    ? response.records[0].shortname
    : null;
}

export async function deleteTemplate(
  shortname: string,
  spaceName: string,
  subpath: string
) {
  const actionRequest: ActionRequest = {
    space_name: spaceName,
    request_type: RequestType.delete,
    records: [
      {
        resource_type: ResourceType.content,
        shortname: shortname,
        subpath: subpath,
        attributes: {},
      },
    ],
  };

  const response: ActionResponse = await Dmart.request(actionRequest);
  return response.status === "success" && response.records.length > 0;
}

export async function createRole(
  data: any,
  space_name: string,
  subpath: string,
  resourceType: ResourceType,
  workflow_shortname: string,
  schema_shortname: string
) {
  const attributes: any = {
    is_active: data.is_active ?? true,
    tags: data.tags || [],
    relationships: data.relationships || [],
    permissions: data.permissions || [],
    displayname: data.displayname || {},
    description: data.description || {},
    slug: data.slug || null,
  };
  if (workflow_shortname && schema_shortname) {
    attributes.workflow_shortname = workflow_shortname;
    attributes.schema_shortname = schema_shortname;
  }

  const actionRequest: ActionRequest = {
    space_name,
    request_type: RequestType.create,
    records: [
      {
        resource_type: resourceType,
        shortname: data.title || "auto",
        subpath,
        attributes,
      },
    ],
  };
  const response: ActionResponse = await Dmart.request(actionRequest);
  if (response.status == "success" && response.records.length > 0) {
    return response.records[0].shortname;
  }
  return null;
}

export async function createPermission(
  data: any,
  space_name: string,
  subpath: string,
  resourceType: ResourceType,
  workflow_shortname: string,
  schema_shortname: string
) {
  const attributes: any = {
    is_active: data.is_active ?? true,
    tags: data.tags || [],
    relationships: data.relationships || [],
    acl: data.acl || [],
    subpaths: data.subpaths || {},
    resource_types: data.resource_types || [],
    actions: data.actions || [],
    conditions: data.conditions || [],
    restricted_fields: data.restricted_fields || [],
    allowed_fields_values: data.allowed_fields_values || {},
    attachments: data.attachments || {},
    slug: data.slug || null,
  };

  if (workflow_shortname && schema_shortname) {
    attributes.workflow_shortname = workflow_shortname;
    attributes.schema_shortname = schema_shortname;
  }

  const actionRequest: ActionRequest = {
    space_name,
    request_type: RequestType.create,
    records: [
      {
        resource_type: resourceType,
        shortname: data.shortname || "auto",
        subpath,
        attributes,
      },
    ],
  };

  const response: ActionResponse = await Dmart.request(actionRequest);
  if (response.status == "success" && response.records.length > 0) {
    return response.records[0].shortname;
  }
  return null;
}

export async function attachAttachmentsToEntity(
  shortname: string,
  spaceName: string,
  subpath: string,
  attachment: File
) {
  const { contentType, resourceType } = getFileType(attachment);
  const response = await Dmart.upload_with_payload(
    spaceName,
    `${subpath}/${shortname}`,
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
    retrieve_attachments: true,
  };
  const response = await Dmart.query(query, "public");

  return response.records;
}

export async function deleteEntity(
  shortname: string,
  spaceName: string,
  subpath: string,
  resource_type: ResourceType
) {
  const actionRequest: ActionRequest = {
    space_name: spaceName,
    request_type: RequestType.delete,
    records: [
      {
        resource_type: resource_type,
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
    _spaces.records = _spaces.records.filter(
      (e) => !e.shortname.includes("applications")
    );
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
  scope: string,
  limit = 100,
  offset = 0,
  exact_subpath = false,
  queryType: QueryType = QueryType.search
): Promise<ApiQueryResponse> {
  let search = "";
  if (scope === "public") {
    search = "-@shortname:schema";
  }
  const response = await Dmart.query(
    {
      type: queryType,
      space_name: spaceName,
      subpath: subpath,
      search: search,
      limit: limit,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: offset,
      retrieve_json_payload: true,
      retrieve_attachments: true,
      exact_subpath: exact_subpath,
    },
    scope
  );
  return response;
}

export async function getRelatedContents(
  spaceName: string,
  subpath = "/",
  scope: string,
  currentTags: string[] = [],
  editorShortname?: string,
  limit = 10,
  offset = 0
): Promise<ApiQueryResponse> {
  let searchQuery = "-@shortname:" + editorShortname;

  const response = await Dmart.query(
    {
      type: QueryType.search,
      space_name: spaceName,
      subpath: subpath,
      search: searchQuery,
      limit: limit,
      sort_by: "updated_at",
      sort_type: SortyType.descending,
      offset: offset,
      retrieve_json_payload: true,
      retrieve_attachments: false,
      exact_subpath: false,
    },
    scope
  );
  return response;
}

export async function getSpaceFolders(
  spaceName: string,
  subpath = "/",
  scope: string,
  limit = 100,
  offset = 0
): Promise<ApiQueryResponse> {
  const response = await Dmart.query(
    {
      type: QueryType.search,
      space_name: spaceName,
      subpath: subpath,
      search: "-@shortname:schema",
      limit: limit,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: offset,
      retrieve_json_payload: true,
      retrieve_attachments: true,
      exact_subpath: false,
      filter_types: [ResourceType.folder],
    },
    scope
  );
  return response;
}
export async function getSpaceSchema(
  spaceName: string,
  subpath: string,
  scope: string,
  limit = 100,
  offset = 0
): Promise<ApiQueryResponse> {
  const response = await Dmart.query(
    {
      type: QueryType.search,
      space_name: spaceName,
      subpath: subpath,
      search: "",
      limit: limit,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: offset,
      retrieve_json_payload: true,
      retrieve_attachments: true,
      exact_subpath: false,
    },
    scope
  );
  return response;
}

export async function getSpaceContentsByTags(
  spaceName: string,
  subpath = "/",
  scope: string,
  limit = 100,
  offset = 0,
  tags: string[] = []
): Promise<ApiQueryResponse> {
  let searchQuery = "";
  if (tags.length > 0) {
    const tagQuery = tags.map((tag) => `${tag}`).join(" OR ");
    searchQuery = `@tags:${tagQuery}`;
  }

  const response = await Dmart.query(
    {
      type: QueryType.search,
      space_name: spaceName,
      subpath: subpath,
      search: searchQuery,
      limit: limit,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: offset,
      retrieve_json_payload: true,
      retrieve_attachments: true,
      exact_subpath: false,
    },
    scope
  );

  return response;
}

export async function getSpaceTags(
  spaceName: string
): Promise<ApiQueryResponse> {
  const response = await Dmart.query(
    {
      type: QueryType.tags,
      space_name: spaceName,
      subpath: "/",
      search: "",
      limit: 10,
      sort_by: "",
      sort_type: SortyType.ascending,
      offset: 0,
      retrieve_json_payload: true,
      retrieve_attachments: true,
      exact_subpath: false,
    },
    "public"
  );

  return response;
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

export async function getChildren(
  space_name: string,
  subpath: string,
  limit: number = 20,
  offset: number = 0,
  restrict_types: Array<ResourceType> = [],
  spaces: any = null,
  ignoreFilter = false
): Promise<ApiQueryResponse> {
  const folders = await Dmart.query({
    type: QueryType.search,
    space_name: space_name,
    subpath: subpath,
    filter_types: restrict_types,
    exact_subpath: true,
    search: "",
    limit: limit,
    offset: offset,
  });
  if (ignoreFilter == false && spaces !== null) {
    const selectedSpace = spaces.records.find(
      (record) => record.shortname === space_name
    );
    const hiddenFolders: string[] = selectedSpace.attributes.hide_folders;
    if (hiddenFolders) {
      folders.records = folders.records.filter(
        (record) => hiddenFolders.includes(record.shortname) === false
      );
    }
  }

  folders.records = folders.records.sort((leftSide, rightSide) => {
    if (leftSide.shortname.toLowerCase() < rightSide.shortname.toLowerCase())
      return -1;
    if (leftSide.shortname.toLowerCase() > rightSide.shortname.toLowerCase())
      return 1;
    return 0;
  });
  return folders;
}

export async function getChildrenAndSubChildren(
  subpathsPTR: any,
  spacename,
  base: string,
  _subpaths: any
) {
  for (const _subpath of _subpaths.records) {
    if (_subpath.resource_type === "folder") {
      const childSubpaths = await getChildren(spacename, _subpath.shortname);
      await getChildrenAndSubChildren(
        subpathsPTR,
        spacename,
        `${base}/${_subpath.shortname}`,
        childSubpaths
      );
      subpathsPTR.push(`${base}/${_subpath.shortname}`);
    }
  }
}

export async function updateDmartEntity(
  shortname: string,
  space_name: string,
  subpath: string,
  resourceType: ResourceType,
  data: any,
  isReplace: boolean = false
) {
  try {
    const response = await Dmart.request({
      space_name: space_name,
      request_type: isReplace ? RequestType.replace : RequestType.update,
      records: [
        {
          resource_type: resourceType,
          shortname: shortname,
          subpath: subpath,
          attributes: data,
        },
      ],
    });
    return response.status === "success" && response.records.length > 0
      ? response.records[0].shortname
      : null;
  } catch (error) {
    console.error("Error setting default user role:", error);
    return false;
  }
}

export async function setDefaultUserRole(
  roleShortname: string
): Promise<boolean> {
  try {
    const existingConfig = await getEntity(
      "web_config",
      "applications",
      "public",
      ResourceType.content,
      "managed",
      true,
      false
    );

    if (existingConfig) {
      const payload = existingConfig.payload.body;
      let updatedItems = payload.items || [];

      const existingItemIndex = updatedItems.findIndex(
        (item) => item.key === "default_user_role"
      );

      if (existingItemIndex !== -1) {
        updatedItems[existingItemIndex] = {
          key: "default_user_role",
          value: roleShortname,
        };
      } else {
        updatedItems.push({
          key: "default_user_role",
          value: roleShortname,
        });
      }

      const result = await updateDmartEntity(
        "web_config",
        "applications",
        "public",
        ResourceType.content,
        {
          payload: {
            content_type: ContentType.json,
            body: {
              items: updatedItems,
            },
          },
        },
        true
      );

      return result !== null;
    } else {
      const result = await createEntity(
        {
          title: "Default User Role Configuration",
          content: `Default role assigned to new users: ${roleShortname}`,
          is_active: true,
          tags: ["config", "user_role"],
          shortname: "web_config",
        },
        "applications",
        "configs",
        ResourceType.content,
        "",
        ""
      );
      return result !== null;
    }
  } catch (error) {
    console.error("Error setting default user role:", error);
    return false;
  }
}

export async function getAllUsers(): Promise<ApiQueryResponse> {
  try {
    const response = await Dmart.query({
      type: QueryType.search,
      space_name: "management",
      subpath: "users",
      search: "@resource_type:user",
      limit: 100,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: 0,
      retrieve_json_payload: true,
      exact_subpath: false,
    });
    return response;
  } catch (error) {
    console.error("Error fetching users:", error);
    return null;
  }
}

export async function updateUserRoles(
  userShortname: string,
  roles: string[]
): Promise<boolean> {
  try {
    const actionRequest: ActionRequest = {
      space_name: "management",
      request_type: RequestType.update,
      records: [
        {
          resource_type: ResourceType.user,
          shortname: userShortname,
          subpath: `users/${userShortname}`,
          attributes: {
            roles: roles,
          },
        },
      ],
    };

    const response: ActionResponse = await Dmart.request(actionRequest);
    return response.status === "success";
  } catch (error) {
    console.error("Error updating user roles:", error);
    return false;
  }
}

export async function searchInCatalog(search: string = "") {
  const result = await getSpaces(false, "public");
  const spaces = result.records.map((space) => space.shortname);

  const promises = spaces.map(async (space) => {
    const queryRequest: QueryRequest = {
      filter_shortnames: [],
      type: QueryType.subpath,
      space_name: space,
      subpath: "/",
      exact_subpath: false,
      sort_by: "created_at",
      sort_type: SortyType.ascending,
      search,
      retrieve_json_payload: true,
      retrieve_attachments: false,
    };

    const response: ApiQueryResponse = await Dmart.query(
      queryRequest,
      "public"
    );
    return response?.records ?? [];
  });

  const allRecordsArrays = await Promise.all(promises);

  return allRecordsArrays.flat();
}

export async function createMessages(data: any) {
  let actionRequest: ActionRequest;

  const messageId = `msg_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  actionRequest = {
    space_name: "messages",
    request_type: RequestType.create,
    records: [
      {
        resource_type: ResourceType.content,
        shortname: messageId,
        subpath: "messages",
        attributes: {
          is_active: true,
          relationships: [],
          tags: [],
          payload: {
            content_type: ContentType.json,
            body: data,
          },
        },
      },
    ],
  };

  const response: ActionResponse = await Dmart.request(actionRequest);
  if (response.status == "success" && response.records.length > 0) {
    return response.records[0].shortname;
  }
  return null;
}

export async function getUserConversations(userShortname: string) {
  try {
    const query = {
      type: QueryType.search,
      space_name: "messages",
      subpath: "messages",
      search: "",
      sort_by: "created_at",
      sort_type: SortyType.ascending,
      retrieve_json_payload: true,
      exact_subpath: true,
      filter_shortnames: [],
      retrieve_attachments: false,
      limit: 1000,
    };

    const response = await Dmart.query(query);

    if (response && response.status === "success") {
      const userMessages = response.records.filter((record) => {
        const payload = record.attributes.payload;
        return (
          payload &&
          (payload.sender === userShortname ||
            payload.receiver === userShortname)
        );
      });

      const conversations = new Map();
      userMessages.forEach((record) => {
        const payload = record.attributes.payload;
        const partnerId =
          payload.sender === userShortname ? payload.receiver : payload.sender;

        if (
          !conversations.has(partnerId) ||
          new Date(record.attributes.created_at) >
            new Date(conversations.get(partnerId).attributes.created_at)
        ) {
          conversations.set(partnerId, record);
        }
      });

      return {
        status: "success",
        records: Array.from(conversations.values()),
      };
    } else {
      throw new Error("Failed to fetch conversations");
    }
  } catch (err) {
    console.error("Error fetching conversations:", err);
    return { status: "error", records: [] };
  }
}

export async function getMessagesBetweenUsers(
  currentUserShortname: string,
  otherUserShortname: string
) {
  try {
    const query = {
      type: QueryType.search,
      space_name: "messages",
      subpath: "messages",
      search: "",
      sort_by: "created_at",
      sort_type: SortyType.descending,
      retrieve_json_payload: true,
      exact_subpath: true,
      filter_shortnames: [],
      retrieve_attachments: false,
    };

    const response = await Dmart.query(query);

    if (response && response.status === "success") {
      const filteredRecords = response.records.filter((record) => {
        const payload = record.attributes.payload?.body;
        if (!payload) return false;

        const isConversation =
          (payload.sender === currentUserShortname &&
            payload.receiver === otherUserShortname) ||
          (payload.sender === otherUserShortname &&
            payload.receiver === currentUserShortname);

        return isConversation;
      });

      return {
        status: "success",
        records: filteredRecords,
      };
    } else {
      throw new Error("Failed to fetch messages");
    }
  } catch (err) {
    console.error("Error fetching messages between users:", err);
    return { status: "error", records: [] };
  }
}

export async function getMessageByShortname(shortname: string) {
  try {
    const query: QueryRequest = {
      filter_shortnames: [shortname],
      type: QueryType.search,
      space_name: "messages",
      subpath: "messages",
      limit: 1,
      sort_by: "created_at",
      sort_type: SortyType.descending,
      offset: 0,
      search: "",
      retrieve_json_payload: true,
      retrieve_attachments: false,
      exact_subpath: true,
    };

    const response = await Dmart.query(query);

    if (
      response &&
      response.status === "success" &&
      response.records &&
      response.records.length > 0
    ) {
      const record = response.records[0];
      const payload = record.attributes.payload;
      const body = payload?.body;

      if (!body) {
        console.error("No message body found in payload");
        return null;
      }

      return {
        id: record.shortname,
        senderId: body.sender,
        receiverId: body.receiver,
        content: body.content,
        timestamp: new Date(record.attributes.created_at || Date.now()),
        messageType: body.message_type || "text",
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch message by shortname:", error);
    return null;
  }
}

export async function getConversationPartners(currentUserShortname: string) {
  try {
    console.log("Fetching conversation partners for:", currentUserShortname);

    const query = {
      type: QueryType.search,
      space_name: "messages",
      subpath: "messages",
      search: "",
      sort_by: "created_at",
      sort_type: SortyType.descending,
      retrieve_json_payload: true,
      exact_subpath: true,
      filter_shortnames: [],
      retrieve_attachments: false,
      limit: 1000, // Get more messages to find all conversation partners
    };

    const response = await Dmart.query(query);
    console.log("Messages query response:", response);

    if (response && response.status === "success" && response.records) {
      const partnerShortnames = new Set<string>();

      response.records.forEach((record) => {
        const payload = record.attributes.payload?.body;
        if (!payload) return;

        // If current user is sender, add receiver as conversation partner
        if (payload.sender === currentUserShortname && payload.receiver) {
          partnerShortnames.add(payload.receiver);
        }
        // If current user is receiver, add sender as conversation partner
        else if (payload.receiver === currentUserShortname && payload.sender) {
          partnerShortnames.add(payload.sender);
        }
      });

      const partners = Array.from(partnerShortnames);
      console.log("Found conversation partners:", partners);

      return partners;
    } else {
      console.log("No messages found or error in response");
      return [];
    }
  } catch (error) {
    console.error("Error fetching conversation partners:", error);
    return [];
  }
}

export async function getUsersByShortnames(
  shortnames: string[]
): Promise<ApiQueryResponse> {
  try {
    if (shortnames.length === 0) {
      return await Dmart.query(
        {
          type: QueryType.search,
          space_name: "management",
          subpath: "users",
          limit: 0,
          sort_by: "shortname",
          sort_type: SortyType.ascending,
          offset: 0,
          search: "",
          retrieve_json_payload: true,
          retrieve_attachments: false,
          exact_subpath: true,
        },
        "managed"
      );
    }

    console.log("Fetching users by shortnames:", shortnames);

    const query: QueryRequest = {
      filter_shortnames: shortnames,
      type: QueryType.search,
      space_name: "management",
      subpath: "users",
      limit: shortnames.length,
      sort_by: "shortname",
      sort_type: SortyType.ascending,
      offset: 0,
      search: "",
      retrieve_json_payload: true,
      retrieve_attachments: false,
      exact_subpath: true,
    };

    const response = await Dmart.query(query, "managed");
    console.log("Users by shortnames response:", response);

    return response;
  } catch (error) {
    console.error("Error fetching users by shortnames:", error);
    // Return an empty response that matches the expected structure
    return await Dmart.query(
      {
        type: QueryType.search,
        space_name: "management",
        subpath: "users",
        limit: 0,
        sort_by: "shortname",
        sort_type: SortyType.ascending,
        offset: 0,
        search: "",
        retrieve_json_payload: true,
        retrieve_attachments: false,
        exact_subpath: true,
      },
      "managed"
    );
  }
}
