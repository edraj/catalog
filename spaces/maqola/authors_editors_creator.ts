import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RelatedData {
  shortname: string;
  uuid: string;
  space_name: string;
  typename: string;
  resource_type: string;
  tags?: string[];
}

interface Relationship {
  related_to: RelatedData;
  attributes: {
    role: string;
  };
}

interface MetaData {
  relationships?: Relationship[];
  created_at?: string;
  updated_at?: string;
}

// Check if text contains Arabic characters
function isArabic(text: string): boolean {
  // Arabic Unicode ranges (including Arabic presentation forms)
  const arabicRegex =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

// Normalize shortname: preserve Arabic but replace dashes with underscores
function normalizeShortname(text: string): string {
  return text
    .replace(/\./g, "_") // Replace dashes with underscores
    .replace(/\-/g, "_") // Replace dashes with underscores
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_{2,}/g, "_"); // Replace consecutive underscores with single underscore
}

// Format date with microsecond precision without 'Z'
function formatDateWithMicroseconds(dateStr: string): string {
  // If not a valid string, return current date in required format
  if (!dateStr || typeof dateStr !== "string") {
    const now = new Date();
    const isoStr = now.toISOString();
    return `${isoStr.slice(0, -1)}000`;
  }

  // Try to parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Invalid date, return current date
    const now = new Date();
    const isoStr = now.toISOString();
    return `${isoStr.slice(0, -1)}000`;
  }

  // Format with microsecond precision (extending milliseconds)
  const isoStr = date.toISOString(); // Format: 2023-04-25T15:30:45.123Z
  const withoutZ = isoStr.slice(0, -1); // Remove 'Z'
  const parts = withoutZ.split(".");
  const microseconds = parts[1].padEnd(6, "0");

  return `${parts[0]}.${microseconds}`;
}

async function createProfileEntry(
  shortname: string,
  role: string,
  relatedData: RelatedData
): Promise<void> {
  const profilesPath = path.join(__dirname, "authors");
  const dmPath = path.join(profilesPath, ".dm");

  // Just normalize the shortname without translation
  const normalizedShortname = normalizeShortname(shortname);
  const entryPath = path.join(dmPath, normalizedShortname);

  // Create all necessary directories
  if (!fs.existsSync(profilesPath)) {
    fs.mkdirSync(profilesPath, { recursive: true });
  }

  if (!fs.existsSync(dmPath)) {
    fs.mkdirSync(dmPath, { recursive: true });

    // Create meta.folder.json for .dm folder with fixed date format
    const dmFolderMeta = {
      uuid: randomUUID(),
      shortname: "authors",
      is_active: true,
      created_at: formatDateWithMicroseconds(new Date().toISOString()),
      updated_at: formatDateWithMicroseconds(new Date().toISOString()),
      owner_shortname: "dmart",
      tags: [],
    };

    fs.writeFileSync(
      path.join(dmPath, "meta.folder.json"),
      JSON.stringify(dmFolderMeta, null, 2)
    );
  }

  if (!fs.existsSync(entryPath)) {
    fs.mkdirSync(entryPath, { recursive: true });
  }

  // Determine the language and set displayname accordingly
  const displayname = isArabic(shortname)
    ? { ar: shortname } // Arabic
    : { en: shortname }; // English

  // Create meta.content.json for the entry with fixed date format
  const entryContentMeta = {
    tags: relatedData.tags || [],
    shortname: normalizedShortname,
    displayname: displayname,
    created_at: formatDateWithMicroseconds(new Date().toISOString()),
    updated_at: formatDateWithMicroseconds(new Date().toISOString()),
    uuid: relatedData.uuid,
    owner_shortname: "dmart",
    is_active: true,
  };

  fs.writeFileSync(
    path.join(entryPath, "meta.content.json"),
    JSON.stringify(entryContentMeta, null, 2)
  );

  console.log(
    `Created profile entry for ${normalizedShortname} (${
      isArabic(shortname) ? "Arabic" : "English"
    })`
  );
}

async function processFolder(folderPath: string): Promise<void> {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      await processFolder(filePath);
    } else if (file.endsWith(".json") && file.includes("meta")) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const data: MetaData = JSON.parse(content);
        let hasChanges = false;

        // Fix date formats if present
        if (data.created_at) {
          data.created_at = formatDateWithMicroseconds(data.created_at);
          hasChanges = true;
        }

        if (data.updated_at) {
          data.updated_at = formatDateWithMicroseconds(data.updated_at);
          hasChanges = true;
        }

        if (data.relationships && Array.isArray(data.relationships)) {
          for (const relationship of data.relationships) {
            const { related_to, attributes } = relationship;

            // Process authors and editors
            if (
              related_to &&
              related_to.shortname &&
              attributes &&
              (attributes.role === "author" || attributes.role === "editor")
            ) {
              await createProfileEntry(
                related_to.shortname,
                attributes.role,
                related_to
              );
            }
          }
        }

        // Write changes if dates were updated
        if (hasChanges) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          console.log(`Updated date formats in ${filePath}`);
        }
      } catch (error) {
        console.error(
          `Error processing file ${filePath}:`,
          (error as Error).message
        );
      }
    }
  }
}

// Start processing from current directory and handle the promise
const startPath = process.argv[2] || __dirname;
processFolder(startPath)
  .then(() =>
    console.log("Finished processing folder and creating author profiles")
  )
  .catch((error) => console.error("Error during processing:", error));
