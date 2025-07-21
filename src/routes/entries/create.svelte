<script lang="ts">
  import { Button, Card, Input, Select } from "flowbite-svelte";
  import { goto, params } from "@roxi/routify";
  import HtmlEditor from "@/routes/components/HtmlEditor.svelte";
  import {
    attachAttachmentsToEntity,
    createEntity,
    getSpaces,
    getSpaceContents,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import {
    ArrowLeftOutline,
    CloseCircleOutline,
    CloudArrowUpOutline,
    FileCheckSolid,
    FileImportSolid,
    FilePdfOutline,
    FloppyDiskSolid,
    PaperClipOutline,
    PaperPlaneSolid,
    PlayOutline,
    PlusOutline,
    TagOutline,
    TextUnderlineOutline,
    TrashBinSolid,
    UploadOutline,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";
  import { dir } from "@/i18n";
  import { onMount } from "svelte";

  $goto;

  let isLoading = $state(false);
  let content = "";
  let isRTL = $dir === "rtl";

  let title = $state("");
  let isEditing = $state(false);

  let selectedSpace = $state("catalog");
  let selectedSubpath = $state("posts");
  let spaces = $state([]);
  let subpathHierarchy = $state([]);
  let currentPath = $state("");
  let loadingSpaces = $state(false);
  let loadingSubpaths = $state(false);
  let canCreateEntry = $state(true);

  onMount(async () => {
    await loadSpaces();
  });

  async function loadSpaces() {
    loadingSpaces = true;
    try {
      const response = await getSpaces(false, "managed");

      spaces = response?.records.map((space) => ({
        value: space?.shortname,
        name: space?.attributes?.displayname?.en || space?.shortname,
      }));

      if (selectedSpace) {
        await initializeSubpathHierarchy(selectedSpace);
      }
    } catch (error) {
      errorToastMessage("Failed to load spaces!");
      console.error("Error loading spaces:", error);
    } finally {
      loadingSpaces = false;
    }
  }

  async function initializeSubpathHierarchy(spaceName: string) {
    subpathHierarchy = [];
    currentPath = "";
    selectedSubpath = "";
    await loadSubpathLevel(spaceName, "", 0);
  }

  async function loadSubpathLevel(
    spaceName: string,
    parentPath: string,
    level: number
  ) {
    if (!spaceName) return;

    loadingSubpaths = true;
    try {
      const response = await getSpaceContents(
        spaceName,
        parentPath || "/",
        "managed"
      );
      console.log(
        `Loaded subpath for ${spaceName} at level ${level}:`,
        response
      );

      const folders = response.records.filter(
        (item) => item.resource_type === "folder"
      );
      const hasNonFolderContent = response.records.some(
        (item) => item.resource_type !== "folder"
      );

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
        canCreateEntry: hasNonFolderContent || folders.length === 0,
        selectedFolder: "",
      };

      subpathHierarchy = [...subpathHierarchy.slice(0, level), levelData];

      updateCanCreateEntry();
    } catch (error) {
      errorToastMessage("Failed to load subpaths!");
      console.error("Error loading subpaths:", error);
    } finally {
      loadingSubpaths = false;
    }
  }

  function updateCanCreateEntry() {
    if (subpathHierarchy.length === 0) {
      canCreateEntry = true;
      return;
    }

    const lastLevel = subpathHierarchy[subpathHierarchy.length - 1];
    canCreateEntry = lastLevel.canCreateEntry;

    currentPath = lastLevel.path;
    selectedSubpath = currentPath;
  }

  async function handleSubpathChange(level: number, folderValue: string) {
    const levelData = subpathHierarchy[level];
    if (!levelData) return;

    levelData.selectedFolder = folderValue;

    if (folderValue) {
      const selectedFolder = levelData.folders.find(
        (f) => f.value === folderValue
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

  async function handleSpaceChange(event) {
    selectedSpace = event.target.value;
    await initializeSubpathHierarchy(selectedSpace);
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

  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  let attachments = $state([]);

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      attachments = [...attachments, ...Array.from(input.files)];
    }
  }

  function removeAttachment(index: number) {
    attachments = attachments.filter((_, i) => i !== index);
  }

  function getPreviewUrl(file: File) {
    if (
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type === "application/pdf"
    ) {
      return URL.createObjectURL(file);
    }
    return null;
  }

  async function handlePublish(isPublish) {
    if (!selectedSpace) {
      errorToastMessage("Please select a space!");
      return;
    }

    if (!canCreateEntry) {
      errorToastMessage(
        "Cannot create entries in this location. Please select a path that doesn't contain only folders."
      );
      return;
    }

    isLoading = true;

    const entity = {
      title: title,
      content: getContent(),
      tags: tags,
      is_active: isPublish,
    };

    const response = await createEntity(
      entity,
      selectedSpace,
      selectedSubpath || "posts"
    );
    const msg = isPublish ? "published" : "saved";

    if (response) {
      successToastMessage(`Entry ${msg} successfully.`);
      for (const attachment of attachments) {
        const r = await attachAttachmentsToEntity(response, attachment);
        if (r === false) {
          errorToastMessage(`Failed to attach ${attachment.name} to entry!`);
        }
      }
      setTimeout(() => {
        $goto("/entries");
      }, 500);
    } else {
      errorToastMessage(`Failed to ${msg} entry!`);
      isLoading = false;
    }
  }

  let htmlEditor: any = $state(null);

  function getContent() {
    return htmlEditor.getHtml(true);
  }

  onMount(async () => {
    await loadSpaces();

    const prefilledSpace = $params.space_name;
    const prefilledSubpath = $params.subpath;

    if (prefilledSpace) {
      selectedSpace = prefilledSpace;
      await initializeSubpathHierarchy(prefilledSpace);

      if (prefilledSubpath && prefilledSubpath !== "/") {
        const pathParts = prefilledSubpath
          .split("/")
          .filter((part) => part.length > 0);
        let currentPath = "";

        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          currentPath += (i === 0 ? "" : "/") + part;

          if (subpathHierarchy[i]) {
            const folder = subpathHierarchy[i].folders.find(
              (f) => f.value === part
            );
            if (folder) {
              subpathHierarchy[i].selectedFolder = part;
              if (i < pathParts.length - 1) {
                await loadSubpathLevel(selectedSpace, `/${currentPath}`, i + 1);
                canCreateEntry = true;
              }
            }
          }
        }

        selectedSubpath = prefilledSubpath;
        currentPath = prefilledSubpath;
        canCreateEntry = true;
      }
    }
  });
</script>

<div class="page-container">
  <div class="content-wrapper">
    <div class="header">
      <button class="back-button" onclick={() => $goto("/entries")}>
        <ArrowLeftOutline class="icon" />
        <span>Back to My Entries</span>
      </button>
    </div>

    <div class="action-section">
      <div class="action-content">
        <div class="action-info">
          <div class="action-icon">
            <FileCheckSolid class="icon" />
          </div>
          <div class="action-text">
            <h3>Ready to Share Your Ideas?</h3>
            <p>Save as draft or publish your entry for everyone to see</p>
          </div>
        </div>
        <div class="action-buttons">
          <button
            class="draft-button"
            onclick={() => handlePublish(false)}
            disabled={isLoading || !canCreateEntry}
          >
            <FloppyDiskSolid class="icon" />
            <span>{isLoading ? "Saving..." : "Save Draft"}</span>
          </button>
          <button
            class="publish-button"
            onclick={() => handlePublish(true)}
            disabled={isLoading || !canCreateEntry}
          >
            <PaperPlaneSolid class="icon" />
            <span>{isLoading ? "Publishing..." : "Publish Now"}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Space and Subpath Selection Section -->
    <div class="section">
      <div class="section-header">
        <TagOutline class="section-icon" />
        <h2>Destination</h2>
      </div>
      <div class="section-content">
        <div class="destination-selectors">
          <div class="selector-group">
            <label for="space-select" class="selector-label">Space</label>
            <select
              id="space-select"
              bind:value={selectedSpace}
              onchange={handleSpaceChange}
              class="destination-select"
              disabled={loadingSpaces}
            >
              {#if loadingSpaces}
                <option value="">Loading spaces...</option>
              {:else}
                {#each spaces as space}
                  <option value={space.value}>{space.name}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>

        <!-- Hierarchical Subpath Navigation -->
        {#if subpathHierarchy.length > 0}
          <div class="subpath-hierarchy">
            <label class="selector-label">Path Navigation</label>
            <div class="hierarchy-levels">
              {#each subpathHierarchy as levelData, index}
                <div class="hierarchy-level">
                  <div class="level-info">
                    <span class="level-label">
                      {index === 0 ? "Root" : `Level ${index}`}
                      {#if levelData.path}
                        <span class="level-path">({levelData.path})</span>
                      {/if}
                    </span>
                  </div>

                  {#if levelData.folders.length > 0}
                    <select
                      bind:value={levelData.selectedFolder}
                      onchange={(e) =>
                        handleSubpathChange(
                          index,
                          (e.target as HTMLSelectElement).value
                        )}
                      class="destination-select level-select"
                      disabled={loadingSubpaths}
                    >
                      <option value="">-- Select folder or stay here --</option>
                      {#each levelData.folders as folder}
                        <option value={folder.value}>{folder.name}</option>
                      {/each}
                    </select>
                  {:else}
                    <div class="no-folders">
                      <span class="no-folders-text"
                        >No subfolders available</span
                      >
                    </div>
                  {/if}

                  <div class="level-status">
                    {#if levelData.canCreateEntry}
                      <span class="can-create">✓ Can create entries here</span>
                    {:else}
                      <span class="cannot-create"
                        >⚠ Contains only folders - navigate deeper</span
                      >
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Destination Preview -->
        {#if selectedSpace}
          <div class="destination-preview">
            <div class="preview-header">
              <strong>Publishing to:</strong>
              {#if !canCreateEntry}
                <span class="warning-badge">Cannot create entries here</span>
              {/if}
            </div>
            <div class="preview-path">
              {selectedSpace}{currentPath ? `/${currentPath}` : "/"}
            </div>
            {#if !canCreateEntry}
              <div class="preview-warning">
                This location contains only folders. Please navigate to a deeper
                level or select a different path.
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <TextUnderlineOutline class="section-icon" />
        <h2>Entry Title</h2>
      </div>
      <div class="section-content">
        {#if isEditing}
          <input
            type="text"
            bind:value={title}
            onblur={handleInputBlur}
            class="title-input"
            placeholder="Enter your entry title..."
          />
        {:else}
          <div
            class="title-display"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === "Enter") handleLabelClick();
            }}
            role="button"
            aria-label="Edit title"
            onclick={handleLabelClick}
          >
            {#if title}
              {title}
            {:else}
              <span class="title-placeholder"
                >Click to add a compelling title...</span
              >
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <TagOutline class="section-icon" />
        <h2>Tags</h2>
      </div>
      <div class="section-content">
        <div class="tag-input-container">
          <input
            type="text"
            bind:value={newTag}
            placeholder="Add a tag..."
            class="tag-input"
            onkeydown={(e) => {
              if (e.key === "Enter") addTag();
            }}
          />
          <button
            class="add-tag-button"
            onclick={addTag}
            disabled={!newTag.trim()}
          >
            <PlusOutline class="icon" />
            <span>Add</span>
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
                  aria-label="Remove tag"
                >
                  <CloseCircleOutline class="icon" />
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <TagOutline class="empty-icon" />
            <p>No tags added yet. Tags help others discover your content!</p>
          </div>
        {/if}
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <FileCheckSolid class="section-icon" />
        <h2>Content</h2>
      </div>
      <div class="section-content">
        <div class="editor-container">
          <HtmlEditor bind:editor={htmlEditor} {content} />
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <PaperClipOutline class="section-icon" />
        <h2>Attachments ({attachments.length})</h2>
        <input
          type="file"
          id="fileInput"
          multiple
          onchange={handleFileChange}
          style="display: none;"
        />
        <button
          class="add-files-button"
          onclick={() => document.getElementById("fileInput").click()}
        >
          <UploadOutline class="icon" />
          <span>Add Files</span>
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
                        alt={attachment.name}
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
            <h3>No attachments yet</h3>
            <p>Drag and drop files here or click "Add Files" to upload</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .destination-selectors {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .selector-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .selector-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .destination-select {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .destination-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .destination-select:disabled {
    background-color: #f9fafb;
    color: #6b7280;
    cursor: not-allowed;
  }

  .subpath-hierarchy {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .hierarchy-levels {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .hierarchy-level {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: white;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
  }

  .level-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .level-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .level-path {
    color: #6b7280;
    font-weight: 400;
    font-size: 0.75rem;
  }

  .level-select {
    margin-top: 0.5rem;
  }

  .no-folders {
    padding: 0.75rem;
    background-color: #f3f4f6;
    border-radius: 0.375rem;
    border: 1px dashed #d1d5db;
    text-align: center;
  }

  .no-folders-text {
    color: #6b7280;
    font-size: 0.875rem;
    font-style: italic;
  }

  .level-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .can-create {
    color: #059669;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .cannot-create {
    color: #dc2626;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .destination-preview {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f3f4f6;
    border-radius: 0.5rem;
    border-left: 4px solid #3b82f6;
  }

  .destination-preview.warning {
    border-left-color: #dc2626;
    background-color: #fef2f2;
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .preview-path {
    font-family: monospace;
    font-size: 0.875rem;
    color: #374151;
    background-color: #ffffff;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #d1d5db;
  }

  .preview-warning {
    margin-top: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .warning-badge {
    background-color: #dc2626;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .destination-selectors {
      flex-direction: column;
    }

    .hierarchy-levels {
      gap: 0.75rem;
    }

    .hierarchy-level {
      padding: 0.5rem;
    }
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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
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

  .title-input {
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

  .title-input:focus {
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

  .title-placeholder {
    color: var(--gray-400);
  }

  .tag-input-container {
    display: flex;
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
    padding: 3rem 1rem;
    color: var(--gray-500);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
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
  .destination-selectors {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .selector-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .selector-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .destination-select {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .destination-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .destination-select:disabled {
    background-color: #f9fafb;
    color: #6b7280;
    cursor: not-allowed;
  }

  .destination-preview {
    padding: 0.75rem;
    background-color: #f3f4f6;
    border-radius: 0.5rem;
    border-left: 4px solid #3b82f6;
  }

  .destination-preview p {
    margin: 0;
    font-size: 0.875rem;
    color: #374151;
  }

  @media (max-width: 640px) {
    .destination-selectors {
      flex-direction: column;
    }
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
</style>
