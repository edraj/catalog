<script lang="ts">
  import { goto, params } from "@roxi/routify";
  import HtmlEditor from "@/components/editors/HtmlEditor.svelte";
  import {
    attachAttachmentsToEntity,
    createEntity,
    getSpaceFolders,
    getSpaces,
    getSpaceSchema,
    getTemplates,
  } from "@/lib/dmart_services/dmart_services";
  import { ensureTemplatesSchemaInSpace } from "@/lib/dmart_services/spaces";
  import { ensureTemplatesFolder } from "@/lib/dmart_services/templates";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import ArrowLeftOutline from "flowbite-icons-direct/ArrowLeftOutline.svelte";
  import CloseCircleOutline from "flowbite-icons-direct/CloseCircleOutline.svelte";
  import CloudArrowUpOutline from "flowbite-icons-direct/CloudArrowUpOutline.svelte";
  import FileCheckSolid from "flowbite-icons-direct/FileCheckSolid.svelte";
  import FileImportSolid from "flowbite-icons-direct/FileImportSolid.svelte";
  import FilePdfOutline from "flowbite-icons-direct/FilePdfOutline.svelte";
  import FloppyDiskSolid from "flowbite-icons-direct/FloppyDiskSolid.svelte";
  import PaperClipOutline from "flowbite-icons-direct/PaperClipOutline.svelte";
  import PaperPlaneSolid from "flowbite-icons-direct/PaperPlaneSolid.svelte";
  import PlayOutline from "flowbite-icons-direct/PlayOutline.svelte";
  import PlusOutline from "flowbite-icons-direct/PlusOutline.svelte";
  import TagOutline from "flowbite-icons-direct/TagOutline.svelte";
  import TextUnderlineOutline from "flowbite-icons-direct/TextUnderlineOutline.svelte";
  import TrashBinSolid from "flowbite-icons-direct/TrashBinSolid.svelte";
  import UploadOutline from "flowbite-icons-direct/UploadOutline.svelte";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { onMount } from "svelte";
  import { ResourceType } from "@edraj/tsdmart";
  import { roles } from "@/stores/user";
  import MarkdownEditor from "@/components/editors/MarkdownEditor.svelte";
  import DynamicSchemaBasedForms from "@/components/forms/DynamicSchemaBasedForms.svelte";
  import { marked } from "marked";
  import { mangle } from "marked-mangle";
  import { gfmHeadingId } from "marked-gfm-heading-id";

  marked.use(mangle());
  marked.use(
    gfmHeadingId({
      prefix: "my-prefix-",
    }),
  );
  $goto;

  let isLoading = $state(false);
  let content = "";
  let resource_type = $state(ResourceType.content);
  let itemResourceType;
  let isAdmin = $state(false);
  let selectedEditorType = $state("html");
  let contentType = $state("json");

  let entryType = $state("content");
  let availableSchemas = $state([]);
  let availableTemplates = $state([]);
  let selectedSchema = $state(null);
  let selectedTemplate = $state(null);
  let loadingSchemas = $state(false);
  let jsonFormData = $state({});
  let templateFormData = $state({});
  let pollFormData = $state({});
  let pollSchema = $state(null);
  let loadingPollSchema = $state(false);
  let bodyContent;
  let isEmpty = false;
  let validationResult = { isValid: true, missingFields: [] };

  let title = $state("");
  let shortname = $state("");
  let isEditing = $state(false);
  let selectedSpace = $state("");
  let spaces = $state([]);
  let subpathHierarchy = $state([]);
  let currentPath = $state("");
  let loadingSpaces = $state(false);
  let loadingSubpaths = $state(false);

  const canCreateEntry = $derived(
    title.trim().length > 0 && shortname.trim().length > 0,
  );
  let workflow_shortname = "";
  let schema_shortname = "";
  let markdownEditorRef = $state(null);
  let markdownContent = $state("");
  let schemas;
  let entity;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let rolesValue;
  roles.subscribe((value) => {
    rolesValue = value;
    isAdmin = value.includes("super_admin");
  });

  async function handleEntryTypeChange() {
    if (entryType === "json" && selectedSpace) {
      await loadSchemasForSpace();
    }
    if (entryType === "template") {
      await loadTemplatesForSpace();
    }
    if (entryType === "poll") {
      selectedSpace = "poll";
      currentPath = "polls";
      resource_type = ResourceType.content;
      workflow_shortname = "";
      schema_shortname = "poll";
      await loadPollSchema();
    }
  }

  async function loadPollSchema() {
    if (pollSchema) return;

    loadingPollSchema = true;
    try {
      const response = await getSpaceSchema("management", "managed");
      if (response?.status === "success" && response?.records) {
        const pollSchemaRecord = response.records.find(
          (record) => record.shortname === "poll",
        );

        if (pollSchemaRecord) {
          pollSchema = {
            shortname: "poll",
            title: pollSchemaRecord.attributes?.displayname?.en || "Poll",
            schema: pollSchemaRecord.attributes?.payload?.body,
            description: pollSchemaRecord.attributes?.description?.en || "",
          };
          pollFormData = {};
        } else {
          errorToastMessage("Poll schema not found in management space");
        }
      } else {
        errorToastMessage("Failed to load poll schema");
      }
    } catch (error) {
      errorToastMessage("Failed to load poll schema");
      console.error("Error loading poll schema:", error);
    } finally {
      loadingPollSchema = false;
    }
  }

  async function loadTemplatesForSpace() {
    loadingSchemas = true;
    try {
      const response = await getTemplates();

      if (response?.status === "success" && response?.records) {
        availableTemplates = response.records.map((record) => ({
          shortname: record.shortname,
          title: record.attributes?.payload?.body?.title || record.shortname,
          schema: record.attributes?.payload?.body?.content,
          description: record.attributes?.description?.en || "",
        }));
      } else {
        availableTemplates = [];
      }
    } catch (error) {
      errorToastMessage("Failed to load templates");
      console.error("Error loading templates:", error);
      availableTemplates = [];
    } finally {
      loadingSchemas = false;
    }
  }

  async function loadSchemasForSpace() {
    if (!selectedSpace) return;

    loadingSchemas = true;
    try {
      const response = await getSpaceSchema(selectedSpace, "managed");
      if (response?.status === "success" && response?.records) {
        availableSchemas = response.records.map((record) => ({
          shortname: record.shortname,
          title: record.attributes?.displayname?.en || record.shortname,
          schema: record.attributes?.payload?.body,
          description: record.attributes?.description?.en || "",
        }));
      } else {
        availableSchemas = [];
      }
    } catch (error) {
      errorToastMessage("Failed to load schemas");
      console.error("Error loading schemas:", error);
      availableSchemas = [];
    } finally {
      loadingSchemas = false;
    }
  }

  async function handleSpaceChange(event) {
    selectedSpace = event.target.value;
    if (selectedSpace) {
      await initializeSubpathHierarchy(selectedSpace);
      if (entryType === "json") {
        await loadSchemasForSpace();
      }
      if (entryType === "template") {
        await loadTemplatesForSpace();
      }
    }
  }

  function handleSchemaChange(event) {
    const schemaShortname = event.target.value;
    selectedSchema = availableSchemas.find(
      (s) => s.shortname === schemaShortname,
    );
    jsonFormData = {};
  }

  function handleTemplateChange(event) {
    const templateShortname = event.target.value;
    selectedTemplate = availableTemplates.find(
      (t) => t.shortname === templateShortname,
    );
    templateFormData = {};
  }

  onMount(async () => {
    await loadSpaces();
  });

  async function loadSpaces() {
    loadingSpaces = true;
    try {
      const response = await getSpaces(false, "managed", ["management"]);

      spaces = response?.records.map((space) => ({
        value: space?.shortname,
        name: space?.attributes?.displayname?.en || space?.shortname,
      }));

      if (selectedSpace) {
        await initializeSubpathHierarchy(selectedSpace);
      }
    } catch (error) {
      errorToastMessage($_("create_entry.error.load_spaces_failed"));
      console.error("Error loading spaces:", error);
    } finally {
      loadingSpaces = false;
    }
  }

  async function initializeSubpathHierarchy(spaceName) {
    subpathHierarchy = [];
    currentPath = "";
    await loadSubpathLevel(spaceName, "", 0);
  }

  async function loadSubpathLevel(spaceName, parentPath, level) {
    if (!spaceName) return;

    loadingSubpaths = true;
    try {
      const response = await getSpaceFolders(
        spaceName,
        parentPath || "/",
        "managed",
      );

      const folders = response.records.filter(
        (item) => item.resource_type === "folder",
      );
      const hasNonFolderContent = response.records.some(
        (item) => item.resource_type !== "folder",
      );
      if (parentPath === "") {
        itemResourceType =
          response?.records[0]?.attributes?.payload?.body
            .content_resource_types[0];
      }

      const levelData = {
        level,
        path: parentPath,
        folders: folders.map((folder) => ({
          value: folder.shortname,
          name: folder.attributes?.displayname?.en || folder.shortname,
          fullPath: parentPath
            ? `${parentPath}/${folder.shortname}`
            : folder.shortname,
        })),
        resource_type: itemResourceType,
        workflow_shortname:
          response.records[0]?.attributes?.payload?.body
            ?.workflow_shortnames[0] || "",
        schema_shortname:
          response.records[0]?.attributes?.payload?.schema_shortname ||
          response.records[0]?.attributes?.payload?.body
            ?.content_schema_shortnames[0] ||
          "",
        canCreateEntry:
          level > 0 || hasNonFolderContent || folders.length === 0,
        selectedFolder: "",
      };

      subpathHierarchy = [...subpathHierarchy.slice(0, level), levelData];

      updateCanCreateEntry();
    } catch (error) {
      errorToastMessage($_("create_entry.error.load_subpaths_failed"));
      console.error("Error loading subpaths:", error);
    } finally {
      loadingSubpaths = false;
    }
  }

  function updateCanCreateEntry() {
    const lastLevel = subpathHierarchy[subpathHierarchy.length - 1];

    resource_type = lastLevel.resource_type;
    workflow_shortname = subpathHierarchy[0].workflow_shortname;
    schema_shortname = lastLevel.schema_shortname;
    currentPath = lastLevel.path;
  }

  async function handleSubpathChange(level, folderValue) {
    const levelData = subpathHierarchy[level];
    if (!levelData) return;

    levelData.selectedFolder = folderValue;

    if (folderValue) {
      const selectedFolder = levelData.folders.find(
        (f) => f.value === folderValue,
      );
      if (selectedFolder) {
        const newPath = selectedFolder.fullPath;
        await loadSubpathLevel(selectedSpace, `/${newPath}`, level + 1);
      }
    } else {
      subpathHierarchy = subpathHierarchy.slice(0, level + 1);
      updateCanCreateEntry();
    }
  }

  function handleLabelClick() {
    isEditing = true;
  }

  function handleInputBlur() {
    isEditing = false;
  }

  let tags = $state([]);
  let newTag = $state("");

  function addTag() {
    if (newTag.trim() !== "") {
      tags = [...tags, newTag.trim()];
      newTag = "";
    }
  }

  function removeTag(index) {
    tags = tags.filter((_, i) => i !== index);
  }

  let attachments = $state([]);

  function handleFileChange(event) {
    const input = event.target;
    if (input.files) {
      attachments = [...attachments, ...Array.from(input.files)];
    }
  }

  function removeAttachment(index) {
    attachments = attachments.filter((_, i) => i !== index);
  }

  function getPreviewUrl(file) {
    if (
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type === "application/pdf"
    ) {
      return URL.createObjectURL(file);
    }
    return null;
  }

  function isContentEmpty(content, type = "html") {
    if (content === null || content === undefined) {
      return true;
    }

    if (typeof content === "string") {
      if (type === "html") {
        const textContent = content
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return textContent === "";
      } else {
        return content.trim() === "";
      }
    }

    if (typeof content === "object") {
      if (Array.isArray(content)) {
        return content.length === 0;
      }
      const keys = Object.keys(content);
      if (keys.length === 0) return true;

      return keys.every((key) => {
        const value = content[key];
        if (value === null || value === undefined || value === "") return true;
        if (typeof value === "string") return value.trim() === "";
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        return false;
      });
    }

    return false;
  }

  function isJsonFormDataEmpty(formData) {
    if (!formData || Object.keys(formData).length === 0) {
      return true;
    }

    return Object.values(formData).every((value) => {
      if (value === null || value === undefined || value === "") return true;
      if (typeof value === "string") return value.trim() === "";
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === "object") return Object.keys(value).length === 0;
      return false;
    });
  }

  function validateRequiredFields(formData, schema) {
    if (!schema || !schema.required || !Array.isArray(schema.required)) {
      return { isValid: true, missingFields: [] };
    }

    const requiredFields = schema.required.filter(
      (field) => field && field.trim() !== "",
    );

    if (requiredFields.length === 0) {
      return { isValid: true, missingFields: [] };
    }

    const missingFields = [];

    for (const fieldName of requiredFields) {
      const value = formData[fieldName];

      if (value === null || value === undefined || value === "") {
        missingFields.push(fieldName);
      } else if (typeof value === "string" && value.trim() === "") {
        missingFields.push(fieldName);
      } else if (Array.isArray(value) && value.length === 0) {
        missingFields.push(fieldName);
      } else if (typeof value === "object" && Object.keys(value).length === 0) {
        missingFields.push(fieldName);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  async function handlePublish(isPublish) {
    if (entryType === "poll") {
      if (!pollSchema || !pollSchema.schema) {
        errorToastMessage("Poll schema not loaded");
        return;
      }

      const validationResult = validateRequiredFields(
        pollFormData,
        pollSchema.schema,
      );

      if (!validationResult.isValid) {
        const fieldNames = validationResult.missingFields
          .map((field) => pollSchema.schema.properties[field]?.title || field)
          .join(", ");

        errorToastMessage(
          $_("create_entry.error.required_fields_missing", {
            values: { fields: fieldNames },
          }),
        );
        return;
      }

      if (isJsonFormDataEmpty(pollFormData)) {
        const hasRequiredFields = pollSchema?.schema?.required?.some(
          (field) => field && field.trim() !== "",
        );
        if (hasRequiredFields) {
          errorToastMessage($_("create_entry.error.content_required"));
          return;
        }
        bodyContent = {};
      } else {
        bodyContent = pollFormData;
      }

      isLoading = true;
      entity = {
        displayname: title,
        body: bodyContent,
        tags: tags,
        is_active: isPublish,
        ...(isAdmin && shortname ? { shortname } : {}),
      };

      const attributes: any = {
        displayname: { en: entity.displayname || "" },
        description: { en: "", ar: "", ku: "" },
        is_active: entity.is_active !== false,
        tags: entity.tags || [],
        relationships: [],
        payload: {
          content_type: "json",
          body: entity.body,
        },
      };

      const response = await createEntity(
        "poll",
        "polls",
        ResourceType.content,
        attributes,
        entity.shortname || "auto",
      );

      const msg = isPublish
        ? $_("create_entry.success.published")
        : $_("create_entry.success.saved");

      if (response) {
        successToastMessage(msg);
        setTimeout(() => {
          window.history.back();
        }, 500);
      } else {
        errorToastMessage(
          isPublish
            ? $_("create_entry.error.publish_failed")
            : $_("create_entry.error.save_failed"),
        );
        isLoading = false;
      }
      return;
    }

    if (!selectedSpace) {
      errorToastMessage($_("create_entry.error.select_space"));
      return;
    }

    if (!canCreateEntry) {
      errorToastMessage($_("create_entry.error.cannot_create"));
      return;
    }

    if (entryType === "json") {
      if (selectedSchema && selectedSchema.schema) {
        validationResult = validateRequiredFields(
          jsonFormData,
          selectedSchema.schema,
        );

        if (!validationResult.isValid) {
          const fieldNames = validationResult.missingFields
            .map(
              (field) =>
                selectedSchema.schema.properties[field]?.title || field,
            )
            .join(", ");

          errorToastMessage(
            $_("create_entry.error.required_fields_missing", {
              values: { fields: fieldNames },
            }),
          );
          return;
        }
      }

      if (isJsonFormDataEmpty(jsonFormData)) {
        const hasRequiredFields = selectedSchema?.schema?.required?.some(
          (field) => field && field.trim() !== "",
        );
        if (!hasRequiredFields) {
          bodyContent = {};
        } else {
          isEmpty = true;
        }
      } else {
        bodyContent = jsonFormData;
      }
    } else if (entryType === "template") {
      if (!selectedTemplate) {
        errorToastMessage($_("create_entry.error.select_template"));
        isLoading = false;
        return;
      }

      // Validate required fields
      const fields = parseTemplateFields(selectedTemplate.schema);
      const requiredFields = fields.filter((f) => f.required);
      const missingFields = requiredFields.filter((f) => {
        const value = templateFormData[f.name];
        if (value == null) return true;
        if (typeof value === "string") return !value.trim();
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        return false;
      });

      if (missingFields.length > 0) {
        errorToastMessage(
          $_("create_entry.error.required_fields_missing", {
            values: { fields: missingFields.map((f) => f.label).join(", ") },
          }),
        );
        isLoading = false;
        return;
      }

      // Save as JSON structure: { template: ..., data: {...} }
      bodyContent = {
        template: selectedTemplate.shortname,
        data: { ...templateFormData },
      };
      contentType = "json";
      schema_shortname = "templates";
    } else {
      const content = getContent();
      if (isContentEmpty(content, selectedEditorType)) {
        isEmpty = true;
      }
      bodyContent = isEmpty ? undefined : content;
      contentType = selectedEditorType;
    }

    if (isEmpty && entryType !== "json") {
      errorToastMessage($_("create_entry.error.content_required"));
      return;
    }

    isLoading = true;

    // For template entries, ensure templates folder and schema exist before creating
    if (entryType === "template") {
      try {
        // Ensure templates folder exists in the selected space (check first, create if missing)
        const folderExists = await ensureTemplatesFolder(selectedSpace);
        if (!folderExists) {
          errorToastMessage("Failed to create templates folder in the selected space");
          isLoading = false;
          return;
        }
      } catch (error) {
        console.error("Failed to ensure templates folder:", error);
        errorToastMessage("Failed to ensure templates folder exists");
        isLoading = false;
        return;
      }

      try {
        // Ensure templates schema exists in the current space (not applications)
        await ensureTemplatesSchemaInSpace(selectedSpace, "managed");
      } catch (error) {
        console.error("Failed to create templates schema:", error);
        // Continue anyway - the schema might already exist
      }
    }

    // Resolve the subpath once — $params.subpath may be undefined when the
    // page is accessed via /entries/create (no [subpath] route segment).
    // Falls back to currentPath which was set via loadPrefilledData().
    const resolvedSubpath = (($params.subpath ?? currentPath) || "/").replace(
      /^\//,
      "",
    );

    entity = {
      displayname: title,
      body: bodyContent,
      tags: tags,
      is_active: isPublish,
      ...(shortname ? { shortname } : {}),
    };

    const attributes: any = {
      displayname: { en: entity.displayname || "" },
      description: { en: "", ar: "", ku: "" },
      is_active: entity.is_active !== false,
      tags: entity.tags || [],
      relationships: [],
      payload: {
        content_type: contentType || "json",
        body: entity.body,
      },
    };
    if (workflow_shortname) attributes.workflow_shortname = workflow_shortname;
    if (schema_shortname)
      attributes.payload.schema_shortname = schema_shortname;

    const response = await createEntity(
      selectedSpace,
      resolvedSubpath,
      resource_type || ResourceType.content,
      attributes,
      entity.shortname || "auto",
    );

    const msg = isPublish
      ? $_("create_entry.success.published")
      : $_("create_entry.success.saved");

    if (response) {
      successToastMessage(msg);
      for (const attachment of attachments) {
        const r = await attachAttachmentsToEntity(
          response,
          selectedSpace,
          resolvedSubpath,
          attachment,
        );
        if (r === false) {
          errorToastMessage(
            $_("create_entry.error.attachment_failed", {
              values: { name: attachment.name },
            }),
          );
        }
      }
      setTimeout(() => {
        window.history.back();
      }, 500);
    } else {
      errorToastMessage(
        isPublish
          ? $_("create_entry.error.publish_failed")
          : $_("create_entry.error.save_failed"),
      );
      isLoading = false;
    }
  }

  let htmlEditor = $state("");

  function getContent() {
    if (selectedEditorType === "html") {
      return htmlEditor;
    } else {
      return markdownContent;
    }
  }

  function generateContentFromTemplate() {
    if (!selectedTemplate || !selectedTemplate.schema) {
      return "";
    }

    let content = selectedTemplate.schema;

    // Replace placeholders with values or empty string
    Object.keys(templateFormData).forEach((key) => {
      const placeholderPattern = new RegExp(
        `\\{\\{${key}(?::[^}]+)?\\}\\}`,
        "g",
      );
      let value = templateFormData[key];
      
      // Handle list/array type - join non-empty items
      if (Array.isArray(value)) {
        value = value.filter(item => item && item.trim()).join(", ");
      }
      
      content = content.replace(placeholderPattern, value || "");
    });

    // Remove any remaining placeholders that don't have values
    content = content.replace(/\{\{[^}]+\}\}/g, "");

    return content;
  }

  function parseTemplateFields(templateContent) {
    if (!templateContent) return [];

    const placeholderRegex = /\{\{([^:}]+)(?::([^}]+))?\}\}/g;
    const fields = [];
    const seen = new Set();
    let match;

    while ((match = placeholderRegex.exec(templateContent)) !== null) {
      const fieldName = match[1].trim();
      const fieldType = match[2]?.trim() || "string";

      if (!seen.has(fieldName)) {
        seen.add(fieldName);

        let inputType = "text";
        let placeholder = `Enter ${fieldName.replace(/_/g, " ")}`;

        switch (fieldType.toLowerCase()) {
          case "int":
          case "integer":
            inputType = "number";
            placeholder = `Enter whole number for ${fieldName}`;
            break;
          case "float":
          case "double":
            inputType = "number";
            placeholder = `Enter decimal number for ${fieldName}`;
            break;
          case "number":
            inputType = "number";
            break;
          case "email":
            inputType = "email";
            break;
          case "url":
            inputType = "url";
            break;
          case "date":
            inputType = "date";
            break;
          case "time":
            inputType = "time";
            break;
          case "password":
            inputType = "password";
            break;
          case "bool":
          case "boolean":
            inputType = "checkbox";
            placeholder = "";
            break;
          case "list":
          case "array":
            inputType = "textarea";
            placeholder = `Enter comma-separated values for ${fieldName}`;
            break;
          case "object":
            inputType = "textarea";
            placeholder = `Enter JSON object for ${fieldName}`;
            break;
          case "list_object":
            inputType = "textarea";
            placeholder = `Enter JSON array of objects for ${fieldName}`;
            break;
          case "textarea":
          case "text":
          case "string":
          default:
            inputType =
              fieldType.toLowerCase() === "textarea" ? "textarea" : "text";
            break;
        }

        fields.push({
          name: fieldName,
          label: fieldName
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          type: inputType,
          originalType: fieldType,
          placeholder,
          required: true,
        });
      }
    }

    return fields;
  }

  async function loadPrefilledData() {
    const prefilledSpace = $params.space_name || $params.spaceName;
    const prefilledSubpath = $params.subpath;

    if (prefilledSpace) {
      selectedSpace = prefilledSpace;
      // Normalise: strip leading slash if present (e.g. "/schema" → "schema")
      const normalizedSubpath = prefilledSubpath
        ? prefilledSubpath.replace(/^\//, "")
        : "";
      currentPath = normalizedSubpath;

      try {
        await loadSubpathLevel(
          prefilledSpace,
          normalizedSubpath ? `/${normalizedSubpath}` : "/",
          0,
        );
        // updateCanCreateEntry sets metadata (resource_type, schema, workflow)
        // but also overwrites selectedSubpath — restore the correct value after
        updateCanCreateEntry();
        currentPath = normalizedSubpath;
      } catch (e) {
        currentPath = normalizedSubpath;
      }
    }
  }

  onMount(async () => {
    await loadSpaces();
    await loadPrefilledData();
  });
</script>

<div class="page-container" class:rtl={$isRTL}>
  <div class="content-wrapper">
    <div class="header">
      <button
        aria-label={$_("create_entry.navigation.back_to_entries")}
        class="back-button"
        onclick={() => {
          if (selectedSpace) {
            const resolvedSubpath = (
              ($params.subpath ?? currentPath) ||
              "/"
            ).replace(/^\//, "");

            if (isAdmin) {
              $goto("/dashboard/admin/[space_name]/[subpath]", {
                space_name: selectedSpace,
                subpath: resolvedSubpath,
              });
            } else {
              $goto("/catalogs/[space_name]/[subpath]", {
                space_name: selectedSpace,
                subpath: resolvedSubpath,
              });
            }
          } else {
            $goto("/entries");
          }
        }}
      >
        <ArrowLeftOutline class="icon back-icon" />
        <span>{$_("create_entry.navigation.back_to_entries")}</span>
      </button>
    </div>

    <div class="action-section">
      <div class="action-content">
        <div class="action-info">
          <div class="action-icon">
            <FileCheckSolid class="icon" />
          </div>
          <div class="action-text">
            <h3>{$_("create_entry.action.title")}</h3>
            <p>{$_("create_entry.action.description")}</p>
          </div>
        </div>
        <div class="action-buttons">
          <button
            aria-label={$_("create_entry.buttons.save_draft")}
            class="draft-button"
            onclick={(event) => {
              event.preventDefault();
              handlePublish(false);
            }}
            disabled={isLoading || !canCreateEntry}
          >
            <FloppyDiskSolid class="icon button-icon" />
            <span
              >{isLoading
                ? $_("create_entry.buttons.saving")
                : $_("create_entry.buttons.save_draft")}</span
            >
          </button>
          <button
            aria-label={$_("create_entry.buttons.publish_now")}
            class="publish-button"
            onclick={(event) => {
              event.preventDefault();
              handlePublish(true);
            }}
            disabled={isLoading || !canCreateEntry}
          >
            <PaperPlaneSolid class="icon button-icon" />
            <span
              >{isLoading
                ? $_("create_entry.buttons.publishing")
                : $_("create_entry.buttons.publish_now")}</span
            >
          </button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <FileCheckSolid class="section-icon" />
        <h2>{$_("create_entry.entry_type.title")}</h2>
      </div>
      <div class="section-content">
        <div class="entry-type-selector">
          <label class="entry-type-option">
            <input
              type="radio"
              bind:group={entryType}
              value="content"
              onchange={handleEntryTypeChange}
            />
            <span class="entry-type-label">
              <strong>{$_("create_entry.entry_type.content_title")}</strong>
              <small>{$_("create_entry.entry_type.content_description")}</small>
            </span>
          </label>
          <label class="entry-type-option">
            <input
              type="radio"
              bind:group={entryType}
              value="template"
              onchange={handleEntryTypeChange}
            />
            <span class="entry-type-label">
              <strong>{$_("create_entry.entry_type.template_title")}</strong>
              <small>{$_("create_entry.entry_type.template_description")}</small
              >
            </span>
          </label>
          <label class="entry-type-option">
            <input
              type="radio"
              bind:group={entryType}
              value="poll"
              onchange={handleEntryTypeChange}
            />
            <span class="entry-type-label">
              <strong>{$_("create_entry.entry_type.poll_title")}</strong>
              <small>{$_("create_entry.entry_type.poll_description")}</small>
            </span>
          </label>
          <label class="entry-type-option">
            <input
              type="radio"
              bind:group={entryType}
              value="json"
              onchange={handleEntryTypeChange}
            />
            <span class="entry-type-label">
              <strong>{$_("create_entry.entry_type.json_title")}</strong>
              <small>{$_("create_entry.entry_type.json_description")}</small>
            </span>
          </label>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <TextUnderlineOutline class="section-icon" />
        <h2>{$_("create_entry.title.section_title")}</h2>
      </div>
      <div class="section-content">
        {#if isEditing}
          <input
            type="text"
            bind:value={title}
            onblur={handleInputBlur}
            class="title-input"
            placeholder={$_("create_entry.title.placeholder")}
            id="title-input"
            aria-label={$_("create_entry.title.placeholder")}
          />
        {:else}
          <div
            class="title-display"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === "Enter") handleLabelClick();
            }}
            role="button"
            aria-label={$_("create_entry.title.edit_aria")}
            onclick={handleLabelClick}
          >
            {#if title}
              {title}
            {:else}
              <span class="title-placeholder"
                >{$_("create_entry.title.click_to_add")}</span
              >
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <TagOutline class="section-icon" />
        <h2>{$_("create_entry.shortname.section_title")}</h2>
      </div>
      <div class="section-content">
        <div class="shortname-input-group">
          <input
            type="text"
            bind:value={shortname}
            class="shortname-input shortname-input-field"
            placeholder={$_("create_entry.shortname.placeholder")}
            id="shortname-input"
            aria-label={$_("create_entry.shortname.placeholder")}
          />
          <button
            type="button"
            class="shortname-auto-btn"
            onclick={() => (shortname = "auto")}
            title="Use auto-generated shortname"
          >
            Auto
          </button>
        </div>
        <div class="shortname-help">
          <small>{$_("create_entry.shortname.help_text")}</small>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <TagOutline class="section-icon" />
        <h2>{$_("create_entry.tags.section_title")}</h2>
      </div>
      <div class="section-content">
        <div class="tag-input-container">
          <input
            type="text"
            id="tag-input"
            bind:value={newTag}
            placeholder={$_("create_entry.tags.placeholder")}
            class="tag-input"
            onkeydown={(e) => {
              if (e.key === "Enter") addTag();
            }}
          />
          <button
            aria-label={$_("create_entry.tags.add_button")}
            class="add-tag-button"
            onclick={addTag}
            disabled={!newTag.trim()}
          >
            <PlusOutline class="icon button-icon" />
            <span>{$_("create_entry.tags.add_button")}</span>
          </button>
        </div>

        {#if tags.length > 0}
          <div class="tags-container">
            {#each tags as tag, index}
              <div class="tag-item">
                <TagOutline class="tag-icon" />
                <span class="tag-text">{tag}</span>
                <button
                  class="tag-remove"
                  onclick={() => removeTag(index)}
                  aria-label={$_("create_entry.tags.remove_aria")}
                >
                  <CloseCircleOutline class="icon" />
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <TagOutline class="empty-icon" />
            <p>{$_("create_entry.tags.empty_message")}</p>
          </div>
        {/if}
      </div>
    </div>

    {#if entryType === "content"}
      <div class="section">
        <div class="section-header">
          <FileCheckSolid class="section-icon" />
          <h2>{$_("create_entry.content.section_title")}</h2>
          <div class="editor-selector">
            <div class="editor-selector-label">
              {$_("create_entry.content.editor_type")}
            </div>
            <div class="editor-toggle">
              <button
                class="editor-toggle-btn"
                class:active={selectedEditorType === "html"}
                onclick={() => (selectedEditorType = "html")}
              >
                <span class="editor-icon">🎨</span>
                <span>{$_("create_entry.content.html_editor")}</span>
              </button>
              <button
                class="editor-toggle-btn"
                class:active={selectedEditorType === "markdown"}
                onclick={() => (selectedEditorType = "markdown")}
              >
                <span class="editor-icon">📝</span>
                <span>{$_("create_entry.content.markdown_editor")}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="section-content">
          <div class="editor-container">
            {#if selectedEditorType === "html"}
              <HtmlEditor
                bind:content={htmlEditor}
                uid="main-editor"
                {attachments}
                {resource_type}
                subpath={$params.subpath}
                space_name={selectedSpace}
                parent_shortname={shortname}
              />
            {:else}
              <MarkdownEditor
                bind:content={markdownContent}
                bind:this={markdownEditorRef}
              />
            {/if}
          </div>
        </div>
      </div>
    {:else if entryType === "json"}
      <!-- Schema Selection Section -->
      <div class="section">
        <div class="section-header">
          <FileCheckSolid class="section-icon" />
          <h2>{$_("create_entry.schema.selection_title")}</h2>
        </div>
        <div class="section-content">
          {#if loadingSchemas}
            <div class="loading-state">
              <p>{$_("create_entry.schema.loading")}</p>
            </div>
          {:else if availableSchemas.length > 0}
            <div class="schema-selector">
              <label for="schema-select" class="selector-label"
                >{$_("create_entry.schema.select_label")}</label
              >
              <select
                id="schema-select"
                onchange={handleSchemaChange}
                class="destination-select"
              >
                <option value=""
                  >{$_("create_entry.schema.choose_option")}</option
                >
                {#each availableSchemas as schema}
                  <option value={schema.shortname}>{schema.title}</option>
                {/each}
              </select>
              {#if selectedSchema}
                <div class="schema-info">
                  <h4>{selectedSchema.title}</h4>
                  {#if selectedSchema.description}
                    <p class="schema-description">
                      {selectedSchema.description}
                    </p>
                  {/if}
                </div>
              {/if}
            </div>
          {:else}
            <div class="empty-state">
              <FileCheckSolid class="empty-icon" />
              <p>{$_("create_entry.schema.no_schemas")}</p>
            </div>
          {/if}
        </div>
      </div>

      {#if selectedSchema && selectedSchema.schema}
        <div class="section">
          <div class="section-header">
            <FileCheckSolid class="section-icon" />
            <h2>{$_("create_entry.schema.entry_data_title")}</h2>
          </div>
          <div class="section-content">
            <DynamicSchemaBasedForms
              bind:content={jsonFormData}
              schema={selectedSchema.schema}
            />
          </div>
        </div>
      {/if}
    {:else if entryType === "template"}
      <div class="section">
        <div class="section-header">
          <FileCheckSolid class="section-icon" />
          <h2>{$_("create_entry.template.selection_title")}</h2>
        </div>
        <div class="section-content">
          {#if loadingSchemas}
            <div class="loading-state">
              <p>{$_("create_entry.template.loading")}</p>
            </div>
          {:else if availableTemplates.length > 0}
            <div class="template-selector">
              <label for="template-select" class="selector-label"
                >{$_("create_entry.template.select_label")}</label
              >
              <select
                id="template-select"
                onchange={handleTemplateChange}
                class="destination-select"
              >
                <option value=""
                  >{$_("create_entry.template.choose_option")}</option
                >
                {#each availableTemplates as template}
                  <option value={template.shortname}>{template.title}</option>
                {/each}
              </select>
              {#if selectedTemplate}
                <div class="template-info">
                  <h4>{selectedTemplate.title}</h4>
                  {#if selectedTemplate.description}
                    <p class="template-description">
                      {selectedTemplate.description}
                    </p>
                  {/if}
                </div>
              {/if}
            </div>

            {#if selectedTemplate && selectedTemplate.schema}
              <!-- Template Data Form Card -->
              <div class="template-data-card">
                <div class="template-data-card-header">
                  <h3 class="template-data-title">
                    {$_("create_entry.template.fill_data_title")}
                  </h3>
                </div>
                <div class="template-data-card-body">
                  <div class="template-form">
                    {#each parseTemplateFields(selectedTemplate.schema) as field}
                      <div class="form-field">
                        <label for="template-{field.name}" class="field-label">
                          {field.label}
                          {#if field.required}
                            <span class="required-indicator">*</span>
                          {/if}
                          <span class="field-type">({field.originalType})</span>
                        </label>
                        {#if field.originalType === "list"}
                          <!-- List Input with Add/Delete -->
                          <div class="list-input-container">
                            {#if !templateFormData[field.name]}
                              {templateFormData[field.name] = [''], ''}
                            {/if}
                            {#each templateFormData[field.name] as item, index (index)}
                              <div class="list-input-row">
                                <input
                                  type="text"
                                  bind:value={templateFormData[field.name][index]}
                                  class="field-input list-input"
                                  placeholder={`Item ${index + 1}`}
                                />
                                <button
                                  type="button"
                                  class="list-btn list-btn-remove"
                                  onclick={() => {
                                    templateFormData[field.name] = templateFormData[field.name].filter((_, i) => i !== index);
                                  }}
                                  title="Remove item"
                                >
                                  ✕
                                </button>
                              </div>
                            {/each}
                            <button
                              type="button"
                              class="list-btn list-btn-add"
                              onclick={() => {
                                templateFormData[field.name] = [...templateFormData[field.name], ''];
                              }}
                            >
                              + Add Item
                            </button>
                          </div>
                        {:else if field.type === "textarea"}
                          <textarea
                            id="template-{field.name}"
                            bind:value={templateFormData[field.name]}
                            class="field-input field-textarea"
                            placeholder={field.placeholder}
                            required={field.required}
                            rows={field.originalType === "object" || field.originalType === "list_object"
                              ? 5
                              : 3}
                          ></textarea>
                          {#if field.originalType === "object"}
                            <small class="field-hint"
                              >Enter valid JSON object</small
                            >
                          {:else if field.originalType === "list_object"}
                            <small class="field-hint"
                              >Enter valid JSON array of objects</small
                            >
                          {/if}
                        {:else if field.type === "checkbox"}
                          <div class="checkbox-wrapper">
                            <input
                              id="template-{field.name}"
                              type="checkbox"
                              bind:checked={templateFormData[field.name]}
                              class="field-checkbox"
                            />
                            <span class="checkbox-label">Yes</span>
                          </div>
                        {:else}
                          <input
                            id="template-{field.name}"
                            type={field.type}
                            bind:value={templateFormData[field.name]}
                            class="field-input field-text"
                            placeholder={field.placeholder}
                            required={field.required}
                          />
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>

              <!-- Template Preview -->
              <div class="template-preview-section">
                <h3 class="template-preview-title">
                  {$_("create_entry.template.preview_title")}
                </h3>
                <div class="template-preview markdown-preview">
                  {@html marked(generateContentFromTemplate())}
                </div>
              </div>
            {/if}
          {:else}
            <div class="empty-state">
              <FileCheckSolid class="empty-icon" />
              <p>{$_("create_entry.template.no_templates")}</p>
            </div>
          {/if}
        </div>
      </div>
    {:else if entryType === "poll"}
      <!-- Poll Entry Data Section -->
      <div class="section">
        <div class="section-header">
          <FileCheckSolid class="section-icon" />
          <h2>{$_("create_entry.poll.entry_data_title")}</h2>
        </div>
        <div class="section-content">
          {#if loadingPollSchema}
            <div class="loading-state">
              <p>{$_("create_entry.schema.loading")}</p>
            </div>
          {:else if pollSchema && pollSchema.schema}
            <DynamicSchemaBasedForms
              bind:content={pollFormData}
              schema={pollSchema.schema}
            />
          {:else}
            <div class="empty-state">
              <FileCheckSolid class="empty-icon" />
              <p>Failed to load poll schema</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Only show attachments section for non-poll entries -->
    {#if entryType !== "poll"}
      <!-- Attachments Section -->
      <div class="section">
        <div class="section-header">
          <PaperClipOutline class="section-icon" />
          <h2>
            {$_("create_entry.attachments.section_title", {
              values: { count: attachments.length },
            })}
          </h2>
          <input
            type="file"
            id="fileInput"
            multiple
            onchange={handleFileChange}
            style="display: none;"
          />
          <button
            aria-label={$_("create_entry.attachments.add_files")}
            class="add-files-button"
            onclick={() => document.getElementById("fileInput").click()}
          >
            <UploadOutline class="icon button-icon" />
            <span>{$_("create_entry.attachments.add_files")}</span>
          </button>
        </div>
        <div class="section-content">
          {#if attachments.length > 0}
            <div class="attachments-grid">
              {#each attachments as attachment, index}
                <div class="attachment-card">
                  <div class="attachment-preview">
                    {#if getPreviewUrl(attachment)}
                      {#if attachment.type.startsWith("image/")}
                        <img
                          src={getPreviewUrl(attachment) || "/placeholder.svg"}
                          alt={attachment.name || "no-image"}
                          class="attachment-image"
                        />
                      {:else if attachment.type.startsWith("video/")}
                        <video
                          src={getPreviewUrl(attachment)}
                          class="attachment-video"
                        >
                          <track
                            kind="captions"
                            src=""
                            srclang="en"
                            label="English"
                          />
                        </video>
                        <div class="video-overlay">
                          <PlayOutline class="play-icon" />
                        </div>
                      {:else if attachment.type === "application/pdf"}
                        <div class="file-preview">
                          <FilePdfOutline class="file-icon pdf" />
                        </div>
                      {/if}
                    {:else}
                      <div class="file-preview">
                        <FileImportSolid class="file-icon" />
                      </div>
                    {/if}
                  </div>
                  <div class="attachment-info">
                    <p class="attachment-name">{attachment.name}</p>
                    <p class="attachment-size">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    aria-label={$_("create_entry.attachments.remove_file", {
                      values: { name: attachment.name },
                    })}
                    class="remove-attachment"
                    onclick={() => removeAttachment(index)}
                  >
                    <TrashBinSolid class="icon" />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-attachments">
              <CloudArrowUpOutline class="empty-icon" />
              <h3>{$_("create_entry.attachments.empty_title")}</h3>
              <p>{$_("create_entry.attachments.empty_description")}</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .rtl {
    direction: rtl;
  }

  .rtl .selector-label {
    text-align: right;
  }

  .rtl .destination-select {
    text-align: right;
  }

  .rtl .tag-input {
    text-align: right;
  }

  .rtl .tag-remove {
    margin-left: 0;
    margin-right: 0.25rem;
  }

  .selector-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  :root {
    --primary-color: #2563eb;
    --primary-light: #3b82f6;
    --primary-dark: #1d4ed8;
    --secondary-color: #64748b;
    --success-color: #10b981;
    --danger-color: #ef4444;
    --warning-color: #f59e0b;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-300: #cbd5e1;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-600: #475569;
    --gray-700: #334155;
    --gray-800: #1e293b;
    --gray-900: #0f172a;
    --white: #ffffff;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
  }

  * {
    box-sizing: border-box;
  }

  .page-container {
    min-height: 100vh;
    background: linear-gradient(
      135deg,
      var(--gray-50) 0%,
      var(--gray-100) 100%
    );
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    color: var(--gray-800);
    line-height: 1.6;
  }

  .content-wrapper {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--white);
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    color: var(--gray-600);
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .back-button:hover {
    background: var(--gray-50);
    border-color: var(--gray-300);
    color: var(--gray-800);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .action-section {
    background: var(--white);
    border-radius: var(--radius-xl);
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--gray-200);
  }

  .action-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }

  .action-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .action-icon {
    width: 3rem;
    height: 3rem;
    background: var(--primary-color);
    color: var(--white);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .action-text h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--gray-800);
  }

  .action-text p {
    margin: 0;
    color: var(--gray-600);
    font-size: 0.875rem;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
  }

  .draft-button,
  .publish-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-lg);
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
  }

  .draft-button {
    background: var(--gray-100);
    color: var(--gray-700);
    border: 1px solid var(--gray-200);
  }

  .draft-button:hover:not(:disabled) {
    background: var(--gray-200);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .publish-button {
    background: var(--primary-color);
    color: var(--white);
  }

  .publish-button:hover:not(:disabled) {
    background: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .draft-button:disabled,
  .publish-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .section {
    background: var(--white);
    border-radius: var(--radius-xl);
    margin-bottom: 2rem;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--gray-200);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    background: var(--gray-50);
    border-bottom: 1px solid var(--gray-200);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--gray-800);
    flex: 1;
  }

  .section-content {
    padding: 2rem;
  }

  .title-input,
  .shortname-input {
    width: 100%;
    padding: 1rem 1.5rem;
    border: 2px solid var(--gray-200);
    border-radius: var(--radius-lg);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--gray-800);
    transition: all 0.2s ease;
    outline: none;
  }

  .shortname-input {
    font-size: 1rem;
    font-weight: 500;
  }

  .shortname-input-group {
    display: flex;
    align-items: stretch;
    border: 2px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .shortname-input-group:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .shortname-input-field {
    flex: 1;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--gray-800);
    background: transparent;
    outline: none;
    min-width: 0;
  }

  .shortname-auto-btn {
    flex-shrink: 0;
    padding: 0 1.25rem;
    background: var(--gray-100);
    border: none;
    border-left: 2px solid var(--gray-200);
    color: var(--primary-color);
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
    white-space: nowrap;
  }

  .shortname-auto-btn:hover {
    background: var(--primary-color);
    color: #fff;
    border-left-color: var(--primary-color);
  }

  .title-input:focus,
  .shortname-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .title-display {
    padding: 1rem 1.5rem;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--gray-800);
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 4rem;
    display: flex;
    align-items: center;
    background: var(--gray-50);
  }

  .title-display:hover {
    border-color: var(--primary-color);
    background: var(--white);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .shortname-help {
    margin-top: 0.5rem;
    color: var(--gray-500);
  }

  .title-placeholder {
    color: var(--gray-400);
  }

  .tag-input-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .tag-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    font-size: 0.875rem;
    transition: all 0.2s ease;
    outline: none;
  }

  .tag-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .add-tag-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: var(--white);
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .add-tag-button:hover:not(:disabled) {
    background: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .add-tag-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .tag-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--gray-100);
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    color: var(--gray-700);
    transition: all 0.2s ease;
    position: relative;
  }

  .tag-item:hover {
    background: var(--gray-200);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .tag-text {
    font-weight: 500;
  }

  .tag-remove {
    background: var(--danger-color);
    color: var(--white);
    border: none;
    border-radius: 50%;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 0.25rem;
  }

  .tag-remove:hover {
    background: #dc2626;
    transform: scale(1.1);
  }

  .empty-state {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1rem;
    color: var(--gray-500);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
    margin-top: 12px;
  }

  .editor-container {
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    height: 500px;
  }

  .add-files-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: var(--white);
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .add-files-button:hover {
    background: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .attachments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.5rem;
  }

  .attachment-card {
    background: var(--white);
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.2s ease;
    position: relative;
  }

  .attachment-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .attachment-preview {
    width: 100%;
    height: 150px;
    position: relative;
    overflow: hidden;
    background: var(--gray-50);
  }

  .attachment-image,
  .attachment-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .file-preview {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gray-50);
  }

  .attachment-info {
    padding: 1rem;
    border-top: 1px solid var(--gray-200);
  }

  .attachment-name {
    margin: 0 0 0.25rem 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--gray-800);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-size {
    margin: 0;
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .remove-attachment {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--danger-color);
    color: var(--white);
    border: none;
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .attachment-card:hover .remove-attachment {
    opacity: 1;
  }

  .remove-attachment:hover {
    background: #dc2626;
    transform: scale(1.1);
  }

  .empty-attachments {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--gray-50);
    border: 2px dashed var(--gray-200);
    border-radius: var(--radius-lg);
    color: var(--gray-500);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-attachments h3 {
    margin: 1rem 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--gray-600);
  }

  .empty-attachments p {
    margin: 0;
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .content-wrapper {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .action-content {
      flex-direction: column;
      gap: 1.5rem;
    }

    .action-buttons {
      justify-content: center;
    }

    .section-content {
      padding: 1.5rem;
    }

    .tag-input-container {
      flex-direction: column;
      gap: 0.75rem;
    }

    .attachments-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
    }
  }

  .editor-selector {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
  }

  .editor-selector-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--gray-600);
  }

  .editor-toggle {
    display: flex;
    background: var(--gray-100);
    border-radius: var(--radius-lg);
    padding: 0.25rem;
    border: 1px solid var(--gray-200);
  }

  .editor-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--gray-600);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .editor-toggle-btn:hover {
    color: var(--gray-800);
  }

  .editor-toggle-btn.active {
    background: var(--white);
    color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }

  .editor-icon {
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    .editor-selector {
      flex-direction: column;
      gap: 0.5rem;
      margin-left: 0;
      margin-top: 1rem;
    }

    .editor-toggle-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
    }

    .editor-icon {
      font-size: 0.875rem;
    }
  }

  /* Added styles for entry type selection */
  .entry-type-selector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .entry-type-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border: 2px solid var(--gray-200);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .entry-type-option:hover {
    border-color: var(--primary-color);
    background: var(--gray-50);
  }

  .entry-type-option input[type="radio"] {
    margin-top: 0.125rem;
  }

  .entry-type-option input[type="radio"]:checked + .entry-type-label {
    color: var(--primary-color);
  }

  .entry-type-option:has(:global(input[type="radio"]:checked)) {
    border-color: var(--primary-color);
    background: rgba(37, 99, 235, 0.05);
  }

  .entry-type-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entry-type-label strong {
    font-weight: 600;
    color: var(--gray-800);
  }

  .entry-type-label small {
    color: var(--gray-600);
    font-size: 0.875rem;
  }

  .schema-selector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .schema-info {
    padding: 1rem;
    background: var(--gray-50);
    border-radius: var(--radius-lg);
    border: 1px solid var(--gray-200);
  }

  .schema-info h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--gray-800);
  }

  .schema-description {
    margin: 0;
    color: var(--gray-600);
    font-size: 0.875rem;
  }

  .loading-state {
    text-align: center;
    padding: 2rem;
    color: var(--gray-500);
  }

  @media (max-width: 768px) {
    .entry-type-selector {
      gap: 0.75rem;
    }

    .entry-type-option {
      padding: 0.75rem;
    }
  }

  .template-selector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .template-info {
    padding: 1rem;
    background-color: var(--color-surface-secondary);
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
  }

  .template-info h4 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .template-description {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .template-preview {
    background-color: var(--color-surface-secondary);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .template-content {
    margin: 0;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .template-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .required-indicator {
    color: var(--color-error);
    margin-left: 0.25rem;
  }

  .field-input {
    padding: 0.75rem;
    border: 2px solid #d1d5db;
    border-radius: 0.5rem;
    background-color: white;
    color: #374151;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .field-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    background-color: white;
  }

  .field-input:hover {
    border-color: #9ca3af;
  }

  .field-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  .field-text {
    height: 42px;
  }

  .field-checkbox {
    transform: scale(1.3);
    cursor: pointer;
    width: 20px;
    height: 20px;
    accent-color: #3b82f6;
  }

  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .checkbox-label {
    font-size: 0.875rem;
    color: #374151;
  }

  .list-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .list-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .list-input {
    flex: 1;
  }

  .list-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .list-btn-remove {
    background: #fee2e2;
    color: #dc2626;
    width: 36px;
    height: 36px;
    padding: 0;
  }

  .list-btn-remove:hover {
    background: #fecaca;
  }

  .list-btn-add {
    background: #eff6ff;
    color: #2563eb;
    border: 2px dashed #bfdbfe;
    margin-top: 0.25rem;
    align-self: flex-start;
  }

  .list-btn-add:hover {
    background: #dbeafe;
    border-color: #93c5fd;
  }

  .field-hint {
    display: block;
    margin-top: 0.375rem;
    color: #6b7280;
    font-size: 0.75rem;
    font-style: italic;
  }

  .template-data-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .template-data-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 1rem 0;
  }

  .template-data-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-top: 1.5rem;
    overflow: hidden;
  }

  .template-data-card-header {
    background: #f9fafb;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .template-data-card-header .template-data-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .template-data-card-body {
    padding: 1.25rem;
  }

  .template-preview-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .template-preview-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 1rem 0;
  }

  .template-preview.markdown-preview {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1rem;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    line-height: 1.6;
    color: #374151;
  }

  .template-preview.markdown-preview :global(h1) {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem 0;
    color: #1f2937;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .template-preview.markdown-preview :global(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: #1f2937;
  }

  .template-preview.markdown-preview :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: #1f2937;
  }

  .template-preview.markdown-preview :global(p) {
    margin: 0.75rem 0;
  }

  .template-preview.markdown-preview :global(ul),
  .template-preview.markdown-preview :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .template-preview.markdown-preview :global(ul) {
    list-style-type: disc;
  }

  .template-preview.markdown-preview :global(ol) {
    list-style-type: decimal;
  }

  .template-preview.markdown-preview :global(li) {
    margin: 0.25rem 0;
  }

  .template-preview.markdown-preview :global(blockquote) {
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-left: 4px solid #d1d5db;
    color: #6b7280;
  }

  .template-preview.markdown-preview :global(code) {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
  }

  .template-preview.markdown-preview :global(pre) {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .template-preview.markdown-preview :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  .template-preview.markdown-preview :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  .template-preview.markdown-preview :global(th),
  .template-preview.markdown-preview :global(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    text-align: left;
  }

  .template-preview.markdown-preview :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  .content-preview {
    background-color: var(--color-surface-secondary);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .generated-content {
    background: white;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    line-height: 1.6;
    color: #374151;
  }

  .generated-content :global(h1) {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem 0;
    color: #1f2937;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .generated-content :global(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: #1f2937;
  }

  .generated-content :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: #1f2937;
  }

  .generated-content :global(p) {
    margin: 0.75rem 0;
  }

  .generated-content :global(ul),
  .generated-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .generated-content :global(li) {
    margin: 0.25rem 0;
  }

  .generated-content :global(blockquote) {
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-left: 4px solid #d1d5db;
    color: #6b7280;
  }

  .generated-content :global(code) {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
  }

  .generated-content :global(pre) {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .generated-content :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  .generated-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  .generated-content :global(th),
  .generated-content :global(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    text-align: left;
  }

  .generated-content :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  .generated-content :global(strong) {
    font-weight: 600;
  }

  .generated-content :global(em) {
    font-style: italic;
  }

  .generated-content :global(del) {
    text-decoration: line-through;
  }
</style>
