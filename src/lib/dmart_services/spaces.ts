import {
    type ApiQueryResponse,
    Dmart,
    QueryType,
    RequestType,
    ResourceType,
    SortyType,
} from "@edraj/tsdmart";
import type { Translation } from "@edraj/tsdmart/dmart.model";

export async function getSpaces(
    ignoreFilter = false,
    scope: string = "managed",
    hiddenspaces: string[] = []
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
        hiddenspaces.forEach((space) => {
            _spaces.records = _spaces.records.filter(
                (e) => !e.shortname.includes(space)
            );
        });
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
    return await Dmart.query(
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

    return await Dmart.query(
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
}

export async function getSpaceFolders(
    spaceName: string,
    subpath = "/",
    scope: string,
    limit = 100,
    offset = 0
): Promise<ApiQueryResponse> {
    return await Dmart.query(
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
}

export async function getSpaceSchema(
    spaceName: string,
    subpath: string,
    scope: string,
    limit = 100,
    offset = 0
): Promise<ApiQueryResponse> {
    return await Dmart.query(
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

    return await Dmart.query(
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
}

export async function getSpaceTags(
    spaceName: string
): Promise<ApiQueryResponse> {
    return await Dmart.query(
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
        const response = await Dmart.request({
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
