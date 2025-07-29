<script lang="ts">
  import { params } from "@roxi/routify";
  import { goto } from "@roxi/routify";
  import { onMount } from "svelte";
  import HtmlEditor from "@/components/HtmlEditor.svelte";
  import Attachments from "@/components/Attachments.svelte";
  import {
    attachAttachmentsToEntity,
    getEntity,
    updateEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { ResourceType } from "@edraj/tsdmart";
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
    StarOutline,
  } from "flowbite-svelte-icons";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";

  $goto;
  let entity = $state(null);
  let isLoading = $state(false);
  let isLoadingPage = $state(true);
  let content = $state("");
  let title = $state("");
  let isEditing = $state(false);
  let tags = $state([]);
  let newTag = $state("");
  let attachments = $state([]);
  let htmlEditor: any = $state(null);
  let editorReady = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function handleLabelClick() {
    isEditing = true;
  }

  function handleInputBlur() {
    isEditing = false;
  }

  function addTag() {
    if (newTag.trim() !== "") {
      tags = [...tags, newTag.trim()];
      newTag = "";
    }
  }

  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

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

  async function handleUpdate(isPublish) {
    isLoading = true;

    const entityData = {
      title: title,
      content: getContent(),
      tags: tags,
      is_active: isPublish,
    };

    const response = await updateEntity(
      $params.shortname,
      $params.space_name,
      $params.subpath,
      $params.resource_type,
      entityData,
      entity.workflow_shortname,
      entity.attributes?.payload?.schema_shortname
    );
    const msg = isPublish
      ? $_("entry_edit.published")
      : $_("entry_edit.updated");

    if (response) {
      successToastMessage($_("entry_edit.success"));
      for (const attachment of attachments) {
        const r = await attachAttachmentsToEntity(
          response,
          $params.space_name,
          $params.subpath,
          attachment
        );
        if (r === false) {
          errorToastMessage(
            $_("entry_edit.attachment_error") + { name: attachment.name }
          );
        }
      }
      setTimeout(() => {
        $goto("/entries/");
      }, 500);
    } else {
      errorToastMessage($_("entry_edit.error"));
      isLoading = false;
    }
  }

  function getContent() {
    return htmlEditor?.getHtml(true) || content;
  }

  onMount(async () => {
    isLoadingPage = true;
    entity = await getEntity(
      $params.shortname,
      $params.space_name,
      $params.subpath,
      $params.resource_type,
      "managed"
    );
    if (entity) {
      title = entity.payload?.body?.title || "";
      content = entity.payload?.body?.content || "";
      tags = entity.tags || [];
      setTimeout(() => {
        editorReady = true;
      }, 100);
    }
    isLoadingPage = false;
  });

  function getStatusInfo(entity: any) {
    if (!entity.is_active) {
      return {
        text: $_("entry_edit.status.draft"),
        class: "status-draft",
        description: $_("entry_edit.status.draft_description"),
      };
    } else if (entity.state === "pending") {
      return {
        text: $_("entry_edit.status.pending"),
        class: "status-pending",
        description: $_("entry_edit.status.pending_description"),
      };
    } else if (entity.state === "approved") {
      return {
        text: $_("entry_edit.status.published"),
        class: "status-published",
        description: $_("entry_edit.status.published_description"),
      };
    } else if (entity.state === "rejected") {
      return {
        text: $_("entry_edit.status.rejected"),
        class: "status-rejected",
        description: $_("entry_edit.status.rejected_description"),
      };
    } else {
      return {
        text: $_("entry_edit.status.active"),
        class: "status-active",
        description: $_("entry_edit.status.active_description"),
      };
    }
  }

  function getExistingAttachments() {
    if (!entity?.attachments) return [];

    const allAttachments = [];
    Object.keys(entity.attachments).forEach((key) => {
      if (Array.isArray(entity.attachments[key])) {
        entity.attachments[key].forEach((attachment) => {
          if (attachment.resource_type === ResourceType.media) {
            allAttachments.push(attachment);
          }
        });
      }
    });

    return allAttachments;
  }
</script>

{#if isLoadingPage}
  <div class="loading-page">
    <div class="loading-content">
      <Diamonds size="60" color="#2563eb" unit="px" duration="1s" />
      <p>{$_("entry_edit.loading")}</p>
    </div>
  </div>
{:else if entity}
  <div class="page-container" class:rtl={$isRTL}>
    <div class="content-wrapper">
      <!-- Header -->
      <div class="header">
        <button
          class="back-button"
          onclick={() =>
            $goto(
              "/entries/[space_name]/[subpath]/[shortname]/[resource_type]",
              { shortname: $params.shortname }
            )}
        >
          <ArrowLeftOutline class="icon" />
          <span>{$_("entry_edit.back_to_entry")}</span>
        </button>

        <div class="status-badge">
          <StarOutline class="icon" />
          <span>{$_("entry_edit.editing_entry")}</span>
        </div>
      </div>

      <!-- Status Info -->
      <div class="status-section">
        {#if entity}
          {@const statusInfo = getStatusInfo(entity)}
          <div class="status-content">
            <div class="status-icon">
              <FileCheckSolid class="icon" />
            </div>
            <div class="status-info" class:text-right={$isRTL}>
              <div class="status-badge-container">
                <span class="status-badge {statusInfo.class}">
                  {statusInfo.text}
                </span>
              </div>
              <p class="status-description">{statusInfo.description}</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Section -->
      <div class="action-section">
        <div class="action-content">
          <div class="action-info">
            <div class="action-icon">
              <FileCheckSolid class="icon" />
            </div>
            <div class="action-text" class:text-right={$isRTL}>
              <h3>{$_("entry_edit.update_entry")}</h3>
              <p>{$_("entry_edit.update_description")}</p>
            </div>
          </div>
          <div class="action-buttons">
            <button
              class="draft-button"
              onclick={() => handleUpdate(false)}
              disabled={isLoading}
            >
              <FloppyDiskSolid class="icon" />
              <span
                >{isLoading
                  ? $_("entry_edit.saving")
                  : $_("entry_edit.save_changes")}</span
              >
            </button>
            <button
              class="publish-button"
              onclick={() => handleUpdate(true)}
              disabled={isLoading}
            >
              <PaperPlaneSolid class="icon" />
              <span
                >{isLoading
                  ? $_("entry_edit.publishing")
                  : $_("entry_edit.publish_changes")}</span
              >
            </button>
          </div>
        </div>
      </div>

      <!-- Title Section -->
      <div class="section">
        <div class="section-header">
          <TextUnderlineOutline class="section-icon" />
          <h2>{$_("entry_edit.entry_title")}</h2>
        </div>
        <div class="section-content">
          {#if isEditing}
            <input
              type="text"
              bind:value={title}
              onblur={handleInputBlur}
              class="title-input"
              class:text-right={$isRTL}
              placeholder={$_("entry_edit.title_placeholder")}
            />
          {:else}
            <div
              class="title-display"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter") handleLabelClick();
              }}
              role="button"
              aria-label={$_("entry_edit.edit_title")}
              onclick={handleLabelClick}
            >
              {#if title}
                {title}
              {:else}
                <span class="title-placeholder"
                  >{$_("entry_edit.title_click_to_add")}</span
                >
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Tags Section -->
      <div class="section">
        <div class="section-header">
          <TagOutline class="section-icon" />
          <h2>{$_("entry_edit.tags")}</h2>
        </div>
        <div class="section-content">
          <div class="tag-input-container">
            <input
              type="text"
              bind:value={newTag}
              placeholder={$_("entry_edit.add_tag_placeholder")}
              class="tag-input"
              class:text-right={$isRTL}
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
              <span>{$_("entry_edit.add")}</span>
            </button>
          </div>

          {#if tags.length > 0}
            <div class="tags-container" class:flex-row-reverse={$isRTL}>
              {#each tags as tag, index}
                <div class="tag-item">
                  <TagOutline class="tag-icon" />
                  <span class="tag-text">{tag}</span>
                  <button
                    class="tag-remove"
                    onclick={() => removeTag(index)}
                    aria-label={$_("entry_edit.remove_tag")}
                  >
                    <CloseCircleOutline class="icon" />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <TagOutline class="empty-icon" />
              <p>{$_("entry_edit.no_tags_message")}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Content Section -->
      <div class="section">
        <div class="section-header">
          <FileCheckSolid class="section-icon" />
          <h2>{$_("entry_edit.content")}</h2>
        </div>
        <div class="section-content">
          <div class="editor-container">
            {#if editorReady}
              <HtmlEditor bind:editor={htmlEditor} {content} />
            {:else}
              <div class="editor-loading">
                <Diamonds size="40" color="#2563eb" unit="px" duration="1s" />
                <p>{$_("entry_edit.loading_editor")}</p>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Existing Attachments Section -->
      {#if getExistingAttachments().length > 0}
        <div class="section">
          <div class="section-header">
            <PaperClipOutline class="section-icon" />
            <h2>
              {$_("entry_edit.current_attachments")} ({getExistingAttachments()
                .length})
            </h2>
          </div>
          <div class="section-content">
            <Attachments
              resource_type={ResourceType.media}
              space_name={$params.space_name}
              subpath={$params.subpath}
              parent_shortname={entity.shortname}
              attachments={getExistingAttachments()}
              isOwner={true}
            />
          </div>
        </div>
      {/if}

      <!-- New Attachments Section -->
      <div class="section">
        <div class="section-header">
          <PaperClipOutline class="section-icon" />
          <h2>{$_("entry_edit.add_new_attachments")} ({attachments.length})</h2>
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
            <span>{$_("entry_edit.add_files")}</span>
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
                  <div class="attachment-info" class:text-right={$isRTL}>
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
              <h3>{$_("entry_edit.no_new_attachments")}</h3>
              <p>{$_("entry_edit.add_files_description")}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="error-page">
    <div class="error-content">
      <div class="error-icon">
        <CloseCircleOutline class="icon" />
      </div>
      <h2>{$_("entry_edit.error.not_found_title")}</h2>
      <p>{$_("entry_edit.error.not_found_message")}</p>
      <button class="back-button" onclick={() => $goto("/entries")}>
        {$_("entry_edit.back_to_entries")}
      </button>
    </div>
  </div>
{/if}

<style>
  .rtl {
    direction: rtl;
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

  .loading-page,
  .error-page {
    min-height: 100vh;
    background: linear-gradient(
      135deg,
      var(--gray-50) 0%,
      var(--gray-100) 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  .loading-content,
  .error-content {
    text-align: center;
  }

  .loading-content p {
    margin-top: 1rem;
    color: var(--gray-600);
    font-size: 1.125rem;
  }

  .error-icon {
    width: 6rem;
    height: 6rem;
    background: var(--danger-color);
    color: var(--white);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .error-content h2 {
    margin: 0 0 0.75rem 0;
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--gray-900);
  }

  .error-content p {
    margin: 0 0 2rem 0;
    color: var(--gray-600);
    font-size: 1rem;
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

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: var(--white);
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-section {
    background: var(--white);
    border-radius: var(--radius-xl);
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--gray-200);
  }

  .status-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .status-icon {
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

  .status-info {
    flex: 1;
  }

  .status-badge-container {
    margin-bottom: 0.5rem;
  }

  .status-badge.status-draft {
    background: var(--gray-100);
    color: var(--gray-700);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-badge.status-pending {
    background: #fef3c7;
    color: #92400e;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-badge.status-published {
    background: #d1fae5;
    color: #065f46;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-badge.status-rejected {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-badge.status-active {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-description {
    margin: 0;
    color: var(--gray-600);
    font-size: 0.875rem;
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

  .section-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--primary-color);
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

  .tag-icon {
    width: 0.875rem;
    height: 0.875rem;
    color: var(--gray-500);
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

  .empty-icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    color: var(--gray-300);
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

  .editor-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 500px;
    background: var(--gray-50);
    border-radius: var(--radius-lg);
    color: var(--gray-600);
  }

  .editor-loading p {
    margin-top: 1rem;
    font-size: 0.875rem;
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

  .play-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--white);
  }

  .file-preview {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gray-50);
  }

  .file-icon {
    width: 3rem;
    height: 3rem;
    color: var(--gray-400);
  }

  .file-icon.pdf {
    color: #dc2626;
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

  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
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

    .status-content {
      flex-direction: column;
      text-align: center;
      gap: 1.5rem;
    }
  }
</style>
