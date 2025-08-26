<script lang="ts">
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import Media from "./Media.svelte";
  import { successToastMessage } from "@/lib/toasts_messages";
  import {
    TrashBinSolid,
    EyeOutline,
    DownloadOutline,
    CloseOutline,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";

  let {
    attachments = [],
    space_name,
    subpath,
    parent_shortname,
    isOwner = false,
  }: {
    attachments: Array<any>;
    resource_type: ResourceType;
    space_name: string;
    subpath: string;
    parent_shortname: string;
    isOwner: boolean;
  } = $props();

  let previewModal = $state(false);
  let currentPreview = $state(null);

  export function getFileExtension(filename: string) {
    let ext = /^.+\.([^.]+)$/.exec(filename);
    return ext == null ? "" : ext[1];
  }

  function isImageFile(filename: string) {
    const ext = getFileExtension(filename).toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext);
  }

  function isVideoFile(filename: string) {
    const ext = getFileExtension(filename).toLowerCase();
    return ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext);
  }

  function isPdfFile(filename: string) {
    const ext = getFileExtension(filename).toLowerCase();
    return ext === "pdf";
  }

  function isAudioFile(filename: string) {
    const ext = getFileExtension(filename).toLowerCase();
    return ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma"].includes(ext);
  }

  function getFileTypeIcon(filename: string) {
    const ext = getFileExtension(filename).toLowerCase();

    if (isImageFile(filename)) return "🖼️";
    if (isVideoFile(filename)) return "🎥";
    if (isAudioFile(filename)) return "🎵";
    if (["pdf"].includes(ext)) return "📄";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📊";
    if (["ppt", "pptx"].includes(ext)) return "📊";
    if (["zip", "rar", "7z"].includes(ext)) return "📦";
    if (["txt"].includes(ext)) return "📄";

    return "📎";
  }

  export function removeFileExtension(filename: string) {
    if (!filename) return "";
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  }

  function openPreview(attachment: any) {
    const filename = attachment?.attributes?.payload?.body;
    console.log(filename);

    if (
      isImageFile(filename) ||
      isVideoFile(filename) ||
      isPdfFile(filename) ||
      isAudioFile(filename)
    ) {
      let type = "file";
      if (isImageFile(filename)) type = "image";
      else if (isVideoFile(filename)) type = "video";
      else if (isPdfFile(filename)) type = "pdf";
      else if (isAudioFile(filename)) type = "audio";
      const shortname = removeFileExtension(attachment.shortname);
      currentPreview = {
        ...attachment,
        url: Dmart.get_attachment_url(
          attachment.resource_type,
          space_name,
          subpath,
          parent_shortname,
          shortname,
          getFileExtension(filename),
          "public"
        ),
        type,
        filename,
      };
      console.log(currentPreview);

      previewModal = true;
    }
  }

  function closePreview() {
    previewModal = false;
    currentPreview = null;
  }

  function downloadFile(attachment: any) {
    const filename = attachment.attributes?.payload?.body;
    const url = Dmart.get_attachment_url(
      attachment.resource_type,
      space_name,
      subpath,
      parent_shortname,
      attachment.shortname,
      getFileExtension(filename),
      "public"
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.shortname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleDelete(item: {
    shortname: string;
    subpath: string;
    resource_type: ResourceType;
  }) {
    if (
      confirm(`Are you sure want to delete ${item.shortname} attachment`) ===
      false
    ) {
      return;
    }

    const request_dict = {
      space_name,
      request_type: RequestType.delete,
      records: [
        {
          resource_type: item.resource_type,
          shortname: item.shortname,
          subpath: `${item.subpath}/${parent_shortname}`,
          attributes: {},
        },
      ],
    };
    const response = await Dmart.request(request_dict);
    if (response.status === "success") {
      attachments = attachments.filter(
        (e: { shortname: string }) => e.shortname !== item.shortname
      );
      successToastMessage(`Attachment deleted successfully.`);
    } else {
      successToastMessage(`Attachment deletion failed.`);
    }
  }
</script>

<div class="attachments-container">
  {#if attachments.length === 0}
    <div class="no-attachments">
      <div class="no-attachments-icon">📎</div>
      <p class="no-attachments-text">{$_("NoAttachments")}</p>
      <p class="no-attachments-subtitle">Files and media will appear here</p>
    </div>
  {:else}
    <div class="attachments-grid">
      {#each attachments as attachment}
        <div class="attachment-card">
          <!-- Card Header with Actions -->
          <div class="attachment-header">
            <div class="file-type-badge">
              <span class="file-icon"
                >{getFileTypeIcon(attachment.attributes?.payload?.body)}</span
              >
              <span class="file-ext"
                >{getFileExtension(attachment.attributes?.payload?.body) ||
                  "Unknown"}</span
              >
            </div>

            <div class="attachment-actions">
              {#if isImageFile(attachment.attributes?.payload?.body) || isVideoFile(attachment.attributes?.payload?.body) || isPdfFile(attachment.attributes?.payload?.body) || isAudioFile(attachment.attributes?.payload?.body)}
                <button
                  class="action-button preview-button"
                  onclick={() => openPreview(attachment)}
                  title="Preview"
                >
                  <EyeOutline class="w-4 h-4" />
                </button>
              {/if}

              <button
                class="action-button download-button"
                onclick={() => downloadFile(attachment)}
                title="Download"
              >
                <DownloadOutline class="w-4 h-4" />
              </button>

              {#if isOwner}
                <button
                  class="action-button delete-button"
                  onclick={() => handleDelete(attachment)}
                  title="Delete"
                >
                  <TrashBinSolid class="w-4 h-4" />
                </button>
              {/if}
            </div>
          </div>

          <!-- Media Preview -->
          <div class="attachment-preview">
            {#if attachment && [ResourceType.media, ResourceType.comment].includes(attachment.resource_type)}
              <div class="media-wrapper">
                <Media
                  resource_type={ResourceType[attachment.resource_type]}
                  attributes={attachment.attributes}
                  displayname={attachment.shortname}
                  url={Dmart.get_attachment_url(
                    attachment.resource_type,
                    space_name,
                    subpath,
                    parent_shortname,
                    attachment.shortname,
                    getFileExtension(attachment.attributes?.payload?.body),
                    "public"
                  )}
                />
                <div class="media-overlay">
                  <button
                    class="preview-overlay-button"
                    onclick={() => openPreview(attachment)}
                  >
                    <EyeOutline class="w-6 h-6" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>
            {:else}
              <div class="unsupported-file">
                <div class="unsupported-icon">
                  {getFileTypeIcon(attachment.attributes?.payload?.body)}
                </div>
                <span class="unsupported-text">{$_("Unsupportedformat")}</span>
              </div>
            {/if}
          </div>

          <!-- File Info -->
          <div class="attachment-info">
            <h4 class="attachment-name" title={attachment.shortname}>
              {attachment.shortname}
            </h4>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Preview Modal -->
{#if previewModal && currentPreview}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closePreview}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") closePreview();
    }}
    aria-label="Close preview modal"
  >
    <div
      class="modal-content"
      role="dialog"
      aria-modal="true"
      onclick={(e) => e.stopPropagation()}
      tabindex="0"
      onkeydown={(e) => {
        if (e.key === "Escape") closePreview();
      }}
    >
      <div class="modal-header">
        <h3 class="modal-title">{currentPreview.shortname}</h3>
        <button
          class="modal-close"
          onclick={closePreview}
          aria-label="Close modal"
        >
          <CloseOutline class="w-6 h-6" />
        </button>
      </div>

      <div class="modal-body">
        {#if currentPreview.type === "image"}
          <img
            src={currentPreview.url}
            alt={currentPreview.shortname}
            class="modal-image"
          />
        {:else if currentPreview.type === "video"}
          <video src={currentPreview.url} controls class="modal-video">
            <track
              kind="captions"
              label="English captions"
              src=""
              srclang="en"
              default
            />
            Your browser doesn't support video playback.
          </video>
        {:else if currentPreview.type === "audio"}
          <div class="audio-container">
            <div class="audio-icon">🎵</div>
            <h4 class="audio-title">{currentPreview.shortname}</h4>
            <audio src={currentPreview.url} controls class="modal-audio">
              Your browser doesn't support audio playback.
            </audio>
          </div>
        {:else if currentPreview.type === "pdf"}
          <iframe
            src={currentPreview.url}
            class="modal-pdf"
            title={currentPreview.shortname}
          >
            Your browser doesn't support PDF viewing.
            <a href="https://www.w3schools.com" target="_blank">Download PDF</a>
          </iframe>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="modal-button download"
          onclick={() => downloadFile(currentPreview)}
        >
          <DownloadOutline class="w-4 h-4" />
          Download
        </button>
        {#if isOwner}
          <button
            class="modal-button delete"
            onclick={() => handleDelete(currentPreview)}
          >
            <TrashBinSolid class="w-4 h-4" />
            Delete
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-pdf {
    width: 100vw;
    height: 80vh;
    min-height: 600px;
    border: none;
    border-radius: 8px;
    background: #f8f9fa;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    .modal-pdf {
      height: 70vh;
      min-height: 400px;
    }
  }

  @media (max-width: 480px) {
    .modal-pdf {
      height: 60vh;
      min-height: 300px;
    }
  }

  .modal-pdf[src=""]:before {
    content: "Loading PDF...";
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 16px;
    color: #6b7280;
  }
  .attachments-container {
    width: 100%;
  }
  .audio-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 16px;
    min-width: 400px;
  }

  .audio-icon {
    font-size: 4rem;
    opacity: 0.7;
  }

  .audio-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    text-align: center;
    margin: 0;
    word-break: break-word;
  }

  .modal-audio {
    width: 100%;
    max-width: 400px;
    height: 40px;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .modal-audio::-webkit-media-controls-panel {
    background-color: white;
    border-radius: 8px;
  }

  .no-attachments {
    text-align: center;
    padding: 3rem 1rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 16px;
    border: 2px dashed #cbd5e1;
  }

  .no-attachments-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .no-attachments-text {
    color: #64748b;
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .no-attachments-subtitle {
    color: #94a3b8;
    font-size: 0.875rem;
  }

  .attachments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
  }

  @media (min-width: 1200px) {
    .attachments-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 768px) {
    .attachments-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  .attachment-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: all 0.3s ease;
    border: 1px solid #e2e8f0;
  }

  .attachment-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .attachment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .file-type-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .file-icon {
    font-size: 1.25rem;
  }

  .file-ext {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .attachment-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preview-button:hover {
    background: #dbeafe;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .download-button:hover {
    background: #f0fdf4;
    border-color: #22c55e;
    color: #22c55e;
  }

  .delete-button:hover {
    background: #fef2f2;
    border-color: #ef4444;
    color: #ef4444;
  }

  .attachment-preview {
    position: relative;
    height: 200px;
    overflow: hidden;
    background: #f9fafb;
  }

  .media-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .media-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(2px);
  }

  .attachment-card:hover .media-overlay {
    opacity: 1;
  }

  .preview-overlay-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 8px;
    color: #374151;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .preview-overlay-button:hover {
    background: white;
    transform: scale(1.05);
  }

  .unsupported-file {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
  }

  .unsupported-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    opacity: 0.7;
  }

  .unsupported-text {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .attachment-info {
    padding: 1rem;
    background: white;
  }

  .attachment-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
    word-break: break-word;
    line-height: 1.4;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .modal-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    min-height: 400px;
  }

  .modal-image {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .modal-video {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .modal-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
  }

  .modal-button.download {
    background: #f0fdf4;
    border-color: #22c55e;
    color: #22c55e;
  }

  .modal-button.download:hover {
    background: #22c55e;
    color: white;
  }

  .modal-button.delete {
    background: #fef2f2;
    border-color: #ef4444;
    color: #ef4444;
  }

  .modal-button.delete:hover {
    background: #ef4444;
    color: white;
  }

  :global(.attachment-preview .media-wrapper) {
    width: 100%;
    height: 100%;
  }

  :global(.attachment-preview img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :global(.attachment-preview video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 640px) {
    .attachment-preview {
      height: 150px;
    }
    .audio-container {
      min-width: auto;
      width: 100%;
      padding: 1.5rem;
    }

    .modal-audio {
      max-width: 100%;
    }
    .modal-content {
      margin: 0;
      border-radius: 0;
      max-width: 100vw;
      max-height: 100vh;
    }

    .modal-body {
      padding: 1rem;
    }
  }
</style>
