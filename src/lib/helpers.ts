import {ContentType, ResourceType} from "@edraj/tsdmart";

export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const MM = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${MM}`;
}

export function truncateString(str: string): string {
  return str && str.length > 100 ? str.slice(0, 100) + "..." : str;
}

export function renderStateString(entity: any) {
  if (entity.is_active === false) {
    return "Inactive";
  }
  if (entity.state === "pending") {
    return "Pending";
  }
  if (entity.state === "in_progress") {
    return "In Progress";
  }
  if (entity.state === "approved") {
    return "Approved";
  }
  if (entity.state === "rejected") {
    return "Rejected";
  }
  return "N/A";
}

export function getFileType(
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

export function formatNumber(number: number, locale): string {
  if (locale === "ar") {
    return number.toLocaleString("ar-EG");
  }
  return number.toLocaleString("en-US");
}

export function formatNumberInText(number: number, locale): string {
  if (locale === "ar") {
    const westernDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٢", "٩"];
    let arabicNumber = number.toString();
    westernDigits.forEach((digit, index) => {
      arabicNumber = arabicNumber.replace(
        new RegExp(digit, "g"),
        arabicDigits[index]
      );
    });
    return arabicNumber;
  }
  return number.toString();
}
