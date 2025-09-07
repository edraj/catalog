import {ContentType, ResourceType} from "@edraj/tsdmart";

/**
 * Formats a date string into YYYY-MM-DD HH:MM format
 * @param dateString - The date string to format
 * @returns Formatted date string in YYYY-MM-DD HH:MM format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const MM = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${MM}`;
}

/**
 * Truncates a string to 100 characters and adds ellipsis if longer
 * @param str - The string to truncate
 * @returns Truncated string with ellipsis if longer than 100 characters, original string otherwise
 */
export function truncateString(str: string): string {
  return str && str.length > 100 ? str.slice(0, 100) + "..." : str;
}

/**
 * Renders a human-readable state string based on entity state and activity status
 * @param entity - The entity object containing is_active and state properties
 * @returns Human-readable state string (Inactive, Pending, In Progress, Approved, Rejected, or N/A)
 */
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

/**
 * Determines the content type and resource type for a file based on its MIME type
 * @param file - The file to analyze
 * @returns Object containing contentType and resourceType, or null if unsupported file type
 */
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

/**
 * Formats a number according to the specified locale
 * @param number - The number to format
 * @param locale - The locale string (e.g., 'ar' for Arabic, defaults to English)
 * @returns Formatted number string according to locale
 */
export function formatNumber(number: number, locale): string {
  if (locale === "ar") {
    return number.toLocaleString("ar-EG");
  }
  return number.toLocaleString("en-US");
}

/**
 * Format number text with proper locale digits
 * @param number - Number to format
 * @param locale - Locale string (e.g., 'ar' for Arabic)
 * @returns Formatted number string
 */
export function formatNumberInText(number: number, locale: string): string {
  if (locale === "ar") {
    const westernDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
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
