import { ResourceType } from '@edraj/tsdmart/dmart.model';

export function getDisplayName(item: any, locale?: string): string {
  if (item.displayname) {
    return (
      item.displayname[locale] ||
      item.displayname.ar ||
      item.displayname.en ||
      item.shortname
    );
  }
  return item.attributes?.payload?.body?.title || item.shortname;
}

export function getDescription(item: any, locale?: string): string {
  if (item.description) {
    return (
      item.description[locale] ||
      item.description.ar ||
      item.description.en ||
      ""
    );
  }
  return "";
}

export function formatDate(dateString: string, locale: string, fallback: string): string {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getAuthorInfo(item: any, fallback: string): string {
  const relationships = item.attributes?.relationships || [];
  const author = relationships.find(
    (rel: any) => rel.attributes?.role === "editor"
  );
  return (
    author?.related_to?.shortname ||
    item.owner_shortname ||
    fallback
  );
}

export function getPostTitle(postData: any): string {
  if (postData?.payload?.body?.title) {
    return postData.payload.body.title;
  }
  return getDisplayName(postData);
}

export function getPostContent(postData: any): string {
  if (postData?.payload?.body?.content) {
    return postData.payload.body.content;
  }
  if (postData?.payload?.body && typeof postData.payload.body === "string") {
    return postData.payload.body;
  }
  return "";
}

export interface CategorizedAttachments {
  reactions: any[];
  comments: any[];
  mediaFiles: any[];
}

export function categorizeAttachments(item: any): CategorizedAttachments {
  const reactions: any[] = [];
  const comments: any[] = [];
  const mediaFiles: any[] = [];

  if (item.attachments) {
    Object.keys(item.attachments).forEach((key) => {
      if (Array.isArray(item.attachments[key])) {
        item.attachments[key].forEach((attachment: any) => {
          if (attachment.resource_type === ResourceType.reaction) {
            reactions.push(attachment);
          } else if (attachment.resource_type === ResourceType.comment) {
            comments.push(attachment);
          } else if (
            attachment.resource_type === ResourceType.media ||
            (attachment.attributes?.payload?.content_type &&
              (attachment.attributes.payload.content_type.startsWith("image/") ||
                attachment.attributes.payload.content_type.startsWith("video/") ||
                attachment.attributes.payload.content_type.startsWith("audio/") ||
                attachment.attributes.payload.content_type === "application/pdf"))
          ) {
            mediaFiles.push(attachment);
          }
        });
      }
    });
  }

  return { reactions, comments, mediaFiles };
}

export function getReactionType(reaction: any): string {
  return (
    reaction?.attributes?.payload?.body?.body?.type ||
    reaction?.payload?.body?.body?.type ||
    "unknown"
  );
}

export function getCommentText(comment: any, fallback: string): string {
  return (
    comment?.attributes?.displayname?.ar ||
    comment?.attributes?.displayname?.en ||
    comment?.attributes?.payload?.body?.body ||
    comment?.payload?.body?.body ||
    fallback
  );
}

export function getCommentState(comment: any): string {
  return (
    comment?.attributes?.payload?.body?.state ||
    comment?.payload?.body?.state ||
    "unknown"
  );
}

export function getReactionEmoji(type: string): string {
  switch (type) {
    case "like":
      return "👍";
    case "love":
      return "❤️";
    default:
      return "❤️";
  }
}

export interface Breadcrumb {
  name: string;
  path: string | null;
}

export function generateBreadcrumbs(
  spaceName: string,
  actualSubpath: string,
  itemShortname: string,
  catalogsLabel: string
): Breadcrumb[] {
  const pathParts = actualSubpath
    .split("/")
    .filter((part) => part.length > 0);
    
  const breadcrumbs: Breadcrumb[] = [
    { name: catalogsLabel, path: "/catalogs" },
    { name: spaceName, path: `/catalog/${spaceName}` },
  ];

  let currentUrlPath = "";
  pathParts.forEach((part, index) => {
    currentUrlPath += (index === 0 ? "" : "-") + part;
    breadcrumbs.push({
      name: part,
      path: `/catalog/${spaceName}/${currentUrlPath}`,
    });
  });

  breadcrumbs.push({
    name: itemShortname,
    path: null,
  });

  return breadcrumbs;
}