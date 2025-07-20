<script lang="ts">
  import { Button, Card, Input, TextPlaceholder } from "flowbite-svelte";
  import { goto, params } from "@roxi/routify";
  import HtmlEditor from "@/routes/components/HtmlEditor.svelte";
  import {
    attachAttachmentsToEntity,
    createEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import {
    ArrowLeftOutline,
    CloseCircleOutline,
    CloudArrowUpOutline,
    EditOutline,
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
  $goto;
  let isLoading = $state(false);
  let content = "";
  let isRTL = $dir === "rtl";

  let title = $state("");
  let isEditing = $state(false);
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
    isLoading = true;

    const entity = {
      title: title,
      content: getContent(),
      tags: tags,
      is_active: isPublish,
    };
    const response = await createEntity(
      entity,
      $params.space_name,
      $params.subpath
    );
    const msg = isPublish ? "published" : "saved";
    if (response) {
      successToastMessage(`Entity ${msg} successfully.`);
      for (const attachment of attachments) {
        const r = await attachAttachmentsToEntity(response, attachment);
        if (r === false) {
          errorToastMessage(`Failed to attach ${attachment.name} to entity!`);
        }
      }
      setTimeout(() => {
        $goto("/dashboard");
      }, 500);
    } else {
      errorToastMessage(`Failed to ${msg} entity!`);
      isLoading = false;
    }
  }

  let htmlEditor: any = $state(null);
  function getContent() {
    return htmlEditor.getHtml(true);
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="container mx-auto px-8 py-8">
    <div class="flex items-center justify-between mb-8">
      <Button
        onclick={() => history.back()}
        color="primary"
        class="flex items-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-sm transition-all duration-200"
      >
        <ArrowLeftOutline
          class="w-4 h-4 ltr:rotate-0 rtl:rotate-180 transform transition-transform duration-200"
        />
        {isLoading ? $_("Loading") : $_("Back")}
      </Button>

      <div class="flex items-center gap-2 text-sm text-slate-500">
        <div class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
        {$_("DraftMode")}
      </div>
    </div>

    <div class="!w-full max-w-6xl mx-auto mb-8">
      <Card
        class={`max-w-full w-full mb-8 border-0 shadow-lg  bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-indigo-50`}
      >
        <div
          class="flex flex-col sm:flex-row justify-between items-center gap-4 p-6"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center"
            >
              <FileCheckSolid
                class={`w-5 h-5 ${isRTL ? "text-white" : "text-amber-600"} `}
              />
            </div>
            <div>
              <p
                class={`${isRTL ? "text-white" : "text-slate-500"} font-medium m-0`}
              >
                {$_("ReadyToPublish")}
              </p>
              <p
                class={`text-sm m-0 ${isRTL ? "text-white" : "text-slate-500"}`}
              >
                {$_("SaveDraftOrPublish")}
              </p>
            </div>
          </div>
          <div class="flex gap-3">
            <Button
              onclick={() => handlePublish(false)}
              class="dark:bg-gray-800 flex items-center gap-2 hover:bg-slate-50 transition-all duration-200"
              disabled={isLoading}
            >
              <FloppyDiskSolid class="w-4 h-4 text-slate-600" />
              {isLoading ? $_("Saving") : $_("SaveDraft")}
            </Button>
            <Button
              color="green"
              onclick={() => handlePublish(true)}
              class="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isLoading}
            >
              <PaperPlaneSolid class="w-4 h-4 text-white" />
              {isLoading ? $_("Publishing") : $_("PublishNow")}
            </Button>
          </div>
        </div>
      </Card>

      <Card class="dark:bg-white max-w-full w-full mb-8 border-0 shadow-lg">
        <div class="p-8">
          <label
            class="flex items-center text-sm font-semibold text-slate-700 mb-4"
          >
            <div class="flex items-center text-lg">
              <TextUnderlineOutline class="w-5 h-5 text-purple-500 me-2" />
              {$_("Title")}
            </div>
          </label>
          {#if isEditing}
            <Input
              type="text"
              bind:value={title}
              onblur={handleInputBlur}
              class="text-2xl font-bold border-2 border-blue-200 focus:border-blue-400 rounded-lg p-4 transition-all duration-200"
              placeholder={$_("TitlePlaceholder")}
            />
          {:else}
            <div
              class="editable-title"
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
                <span class="text-slate-400">{$_("ClickToAddTitle")}</span>
              {/if}
            </div>
          {/if}
        </div>
      </Card>

      <Card class="dark:bg-white max-w-full w-full mb-8 border-0 shadow-lg">
        <div class="p-8">
          <label
            class="flex items-center text-sm font-semibold text-slate-700 mb-4"
          >
            <div class="flex items-center text-lg">
              <TagOutline class="w-5 h-5 text-purple-500 me-2" />
              {$_("Tags")}
            </div>
          </label>

          <div class="flex gap-3 mb-4 dark:bg-red">
            <Input
              type="text"
              bind:value={newTag}
              placeholder={$_("AddTag")}
              class="flex-1 border-slate-200 focus:border-purple-400 rounded-lg transition-all duration-200"
              onkeydown={(e) => {
                if (e.key === "Enter") addTag();
              }}
            />
            <Button
              onclick={addTag}
              class="dark:bg-gray-700 flex items-center gap-2 transition-all duration-200"
              disabled={!newTag.trim()}
            >
              <PlusOutline class="w-4 h-4 " />
              {$_("Add")}
            </Button>
          </div>

          {#if tags.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each tags as tag, index}
                <span class="tag-badge group">
                  <span class="tag-content">
                    <TagOutline class="w-3 h-3 me-1" />
                    {tag}
                  </span>
                  <button
                    type="button"
                    class="tag-remove"
                    aria-label="Remove tag"
                    onclick={() => removeTag(index)}
                  >
                    <CloseCircleOutline class="w-3 h-3" />
                  </button>
                </span>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-slate-400">
              <TagOutline class="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p class="text-sm">
                {$_("NoTagsAdded")}
              </p>
            </div>
          {/if}
        </div>
      </Card>

      <Card class=" dark:bg-white max-w-full w-full mb-8 border-0 shadow-lg">
        <div class="p-8 border-t-2 border-slate-200">
          <label
            class="flex items-center text-sm font-semibold text-slate-700 mb-4"
          >
            <div class="flex items-center text-lg">
              <FileCheckSolid class="w-4 h-4 text-green-500 me-2" />
              {$_("Content")}
            </div>
          </label>
          <div class="border-none verflow-hidden h-[500px]">
            <HtmlEditor bind:editor={htmlEditor} {content} />
          </div>
        </div>
      </Card>

      <Card class="dark:bg-white max-w-full w-full border-0 shadow-lg">
        <div class="p-8">
          <div class="flex items-center justify-between mb-6">
            <label
              class="flex items-center text-sm font-semibold text-slate-700"
            >
              <div class="flex items-center text-lg">
                <PaperClipOutline class="w-4 h-4 text-orange-500 me-2" />
                {$_("Attachments")} ({attachments.length})
              </div>
            </label>
            <input
              type="file"
              id="fileInput"
              multiple
              onchange={handleFileChange}
              style="display: none;"
            />
            <Button
              onclick={() => document.getElementById("fileInput").click()}
              class="dark:bg-gray-800 flex items-center gap-2 transition-all duration-200"
            >
              <UploadOutline class="w-4 h-4" />
              {$_("AddFiles")}
            </Button>
          </div>

          {#if attachments.length > 0}
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
            >
              {#each attachments as attachment, index}
                <div class="attachment-card group">
                  <div class="attachment-preview">
                    {#if getPreviewUrl(attachment)}
                      {#if attachment.type.startsWith("image/")}
                        <img
                          src={getPreviewUrl(attachment) || "/placeholder.svg"}
                          alt={attachment.name}
                          class="w-full h-full object-cover"
                        />
                      {:else if attachment.type.startsWith("video/")}
                        <video
                          src={getPreviewUrl(attachment)}
                          class="w-full h-full object-cover"
                        >
                          <track
                            kind="captions"
                            src=""
                            srclang="en"
                            label="English"
                          />
                        </video>
                        <div class="attachment-overlay">
                          <PlayOutline class="w-8 h-8 text-white" />
                        </div>
                      {:else if attachment.type === "application/pdf"}
                        <div class="attachment-file">
                          <FilePdfOutline class="w-8 h-8 text-red-500" />
                        </div>
                      {/if}
                    {:else}
                      <div class="attachment-file">
                        <FileImportSolid class="w-8 h-8 text-slate-400" />
                      </div>
                    {/if}
                  </div>
                  <div class="attachment-info">
                    <p class="attachment-name">{attachment.name}</p>
                    <p class="attachment-size">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    size="xs"
                    color="red"
                    class="attachment-remove opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onclick={() => removeAttachment(index)}
                  >
                    <TrashBinSolid class="w-3 h-3" />
                  </Button>
                </div>
              {/each}
            </div>
          {:else}
            <div
              class="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50"
            >
              <CloudArrowUpOutline
                class="w-16 h-16 mx-auto mb-4 text-slate-300"
              />
              <p class="text-slate-500 mb-2">
                {$_("NoAttachments")}
              </p>
              <p class="text-sm text-slate-400">
                {$_("DragAndDropOrClick")}
              </p>
            </div>
          {/if}
        </div>
      </Card>
    </div>
  </div>
</div>

<style>
  .card {
    max-width: none !important;
    width: 100% !important;
  }
  .editable-title {
    font-size: 2rem;
    font-weight: 700;
    cursor: pointer;
    border: 2px solid transparent;
    padding: 1rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    transition: all 0.3s ease;
    position: relative;
    min-height: 4rem;
    display: flex;
    align-items: center;
    color: #334155;
  }

  .editable-title:hover {
    border-color: #3b82f6;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }

  .edit-icon {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .editable-title:hover .edit-icon {
    opacity: 1;
  }

  .tag-badge {
    display: inline-flex;
    align-items: center;
    background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
    color: #7c3aed;
    padding: 0.5rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid #d8b4fe;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .tag-badge:hover {
    background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
  }

  .tag-content {
    display: flex;
    align-items: center;
    transition: opacity 0.3s ease;
  }

  .tag-remove {
    position: absolute;
    right: 0.5rem;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 50%;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.3s ease;
  }

  .tag-badge:hover .tag-remove {
    opacity: 1;
    transform: scale(1);
  }

  .tag-badge:hover .tag-content {
    opacity: 0.7;
    padding-right: 1.5rem;
  }

  .attachment-card {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 0.75rem;
    overflow: hidden;
    transition: all 0.3s ease;
    position: relative;
  }

  .attachment-card:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
  }

  .attachment-preview {
    width: 100%;
    height: 8rem;
    position: relative;
    overflow: hidden;
    background: #f8fafc;
  }

  .attachment-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.5);
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .attachment-file {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .attachment-info {
    padding: 0.75rem;
    border-top: 1px solid #e2e8f0;
  }

  .attachment-name {
    font-size: 0.75rem;
    font-weight: 500;
    color: #334155;
    margin: 0 0 0.25rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-size {
    font-size: 0.625rem;
    color: #64748b;
    margin: 0;
  }

  .attachment-remove {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(220, 38, 38, 0.9) !important;
    backdrop-filter: blur(4px);
    border: none !important;
  }
</style>
