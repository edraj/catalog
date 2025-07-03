<script lang="ts">
  import { Button, Card, Alert, Input } from "flowbite-svelte";
  import { goto, params } from "@roxi/routify";
  import HtmlEditor from "@/routes/components/HtmlEditor.svelte";
  import {
    attachAttachmentsToEntity,
    deleteEntity,
    getEntity,
    updateEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { onMount } from "svelte";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import { formatDate } from "@/lib/helpers";
  import Attachments from "@/routes/components/Attachments.svelte";
  import { user } from "@/stores/user";
  import { setContext, getContext } from "svelte";
  import { PlusOutline, TrashBinSolid } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";

  let entity = $state(null);
  let isLoading = false;
  let content = "";

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

  async function handleSave(event) {
    const _entity = {
      title: title,
      content: getContent(),
      tags: tags,
      is_active: entity.is_active,
    };
    const response = await updateEntity(entity.shortname, _entity);
    if (response) {
      successToastMessage("Saved successfully");
      for (const attachment of attachments) {
        const r = await attachAttachmentsToEntity(response, attachment);
        if (r === false) {
          errorToastMessage(`Failed to attach ${attachment.name} to entity!`);
        }
      }
    } else {
      errorToastMessage("Failed to save");
    }
  }

  async function handlePublish(event) {
    event.preventDefault();

    const response = await Dmart.request({
      space_name: "catalog",
      request_type: RequestType.update,
      records: [
        {
          resource_type: ResourceType.ticket,
          shortname: $params.shortname,
          subpath: "posts",
          attributes: {
            is_active: !entity.is_active,
          },
        },
      ],
    });

    if (response.status === "success") {
      window.location.reload();
    } else {
      errorToastMessage(response.error.message);
    }
  }

  let htmlEditor: any = $state(null);
  function getContent() {
    return htmlEditor.getHtml(true);
  }

  onMount(async () => {
    entity = await getEntity($params.shortname);
    console.log({ entity });
    title = entity.payload.body.title;
    tags = entity.tags;
  });

  function updateHtmlEditor() {
    if (entity && htmlEditor) {
      htmlEditor.setHtml(entity.payload.body.content);
    }
  }

  async function handleDelete() {
    if (confirm(`Are you sure want to delete this entity`) === false) {
      return;
    }

    const response = await deleteEntity(entity.shortname);
    if (response) {
      successToastMessage(`Entity deleted successfully.`);
      $goto("/dashboard");
    } else {
      errorToastMessage(`Failed to delete entity!`);
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <Button onclick={() => history.back()} class="mb-8" color="alternative">
    {isLoading ? $_("Loading") : $_("Back")}
  </Button>

  {#if entity}
    <div
      class="bg-gray-100 border border-gray-200 rounded-lg p-4 mb-8 flex justify-between items-center"
    >
      <p class="text-gray-700 m-0">
        {entity.is_active
          ? `Last update: ${formatDate(entity.updated_at)}`
          : "This is draft"}
      </p>
      <div class="space-x-2">
        <Button color="primary" onclick={handleSave}>
          {isLoading ? "...." : "Save"}
        </Button>
        <Button
          color={entity.is_active ? "red" : "green"}
          onclick={handlePublish}
        >
          {isLoading ? "......." : entity.is_active ? "Unpublish" : "Publish"}
        </Button>
        <Button color="red" onclick={handleDelete}>
          <TrashBinSolid class="w-4 h-4" />
        </Button>
      </div>
    </div>

    {#if isEditing}
      <Input
        type="text"
        bind:value={title}
        onblur={handleInputBlur}
        class="mb-4"
      />
    {:else}
      <div
        class="editable-label mb-4"
        role="button"
        tabindex="0"
        onclick={handleLabelClick}
        onkeydown={(e) => e.key === "Enter" && handleLabelClick()}
        aria-label="Edit title"
      >
        {#if title}
          {title}
        {:else}
          {$_("Title")}
        {/if}
      </div>
    {/if}

    <div class="mb-6">
      <Input
        type="text"
        bind:value={newTag}
        placeholder={$_("AddTag")}
        class="mb-2"
      />
      <div class="flex justify-end">
        <Button color="primary" onclick={addTag}>{$_("AddTag")}</Button>
      </div>
    </div>

    <div class="mb-6">
      {#each tags as tag, index}
        <span
          class="inline-block bg-gray-200 text-gray-800 px-3 py-1 rounded-full me-2 mb-2 tag-badge"
          role="button"
          tabindex="0"
          onclick={() => removeTag(index)}
          onkeydown={(e) => e.key === "Enter" && removeTag(index)}
          aria-label="Remove tag"
        >
          <span class="tag-text">{tag}</span>
          <TrashBinSolid
            class="w-4 h-4 tag-trash cursor-pointer ms-2"
            aria-hidden="true"
          />
        </span>
      {/each}
    </div>

    <HtmlEditor bind:editor={htmlEditor} {content} />

    <Card class="mt-8">
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">{$_("Attachments")}</h3>

        <Attachments
          resource_type={ResourceType.ticket}
          space_name={"catalog"}
          subpath={"posts"}
          parent_shortname={entity.shortname}
          attachments={Object.values(entity.attachments.media ?? [])}
          isOwner={entity.owner_shortname === $user.shortname}
        />

        <input
          type="file"
          id="fileInput"
          multiple
          onchange={handleFileChange}
          style="display: none;"
        />
        <Button
          color="primary"
          onclick={() => document.getElementById("fileInput").click()}
          class="mb-4"
        >
          <PlusOutline
            class=" tag-trash cursor-pointer ms-2"
            aria-hidden="true"
          />
          {$_("AddAttachment")}
        </Button>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          {#each attachments as attachment, index}
            <div class="attachment relative">
              {#if getPreviewUrl(attachment)}
                {#if attachment.type.startsWith("image/")}
                  <img
                    src={getPreviewUrl(attachment) || "/placeholder.svg"}
                    alt={attachment.name}
                    class="attachment-preview w-full h-24 object-cover rounded"
                  />
                {:else if attachment.type.startsWith("video/")}
                  <video
                    src={getPreviewUrl(attachment)}
                    controls
                    class="attachment-preview w-full h-24 rounded"
                  >
                    <track
                      kind="captions"
                      src=""
                      srclang="en"
                      label="English"
                    />
                  </video>
                {:else if attachment.type === "application/pdf"}
                  <embed
                    src={getPreviewUrl(attachment)}
                    type="application/pdf"
                    class="attachment-preview w-full h-24 rounded"
                  />
                {/if}
              {:else}
                <div
                  class="w-full h-24 bg-gray-100 rounded flex items-center justify-center"
                >
                  <span class="text-sm text-gray-600">{attachment.name}</span>
                </div>
              {/if}
              <Button
                size="xs"
                color="red"
                class="absolute top-1 right-1"
                onclick={() => removeAttachment(index)}
              >
                <TrashBinSolid class="w-4 h-4" />
              </Button>
            </div>
          {/each}
        </div>
      </div>
    </Card>
  {/if}
</div>

<style>
  .editable-label {
    font-size: 2rem;
    cursor: pointer;
    border: 1px solid transparent;
    padding: 5px;
    border-radius: 0.375rem;
  }
  .editable-label:hover {
    border: 1px solid #d1d5db;
  }

  .tag-badge {
    position: relative;
  }
  .tag-text {
    display: inline;
  }
  .tag-trash {
    display: none;
  }
  .tag-badge:hover .tag-text {
    display: none;
  }
  .tag-badge:hover .tag-trash {
    display: inline;
  }
</style>
