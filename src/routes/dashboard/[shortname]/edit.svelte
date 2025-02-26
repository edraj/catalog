<script lang="ts">
    import {Button, Container, Card, CardBody, CardTitle, Alert, Row, Col} from "sveltestrap";
    import {goto, params} from "@roxi/routify";
    import HtmlEditor from "@/routes/components/HtmlEditor.svelte";

    import { Input } from "sveltestrap";
    import {attachAttachmentsToEntity, deleteEntity, getEntity, updateEntity} from "@/lib/dmart_services";
    import {errorToastMessage, successToastMessage} from "@/lib/toasts_messages";
    import {onMount} from "svelte";
    import Dmart, {RequestType, ResourceType} from "@edraj/tsdmart";
    import {formatDate} from "@/lib/helpers";
    import Attachments from "@/routes/components/Attachments.svelte";
    import {user} from "@/stores/user";
    $goto

    let entity = $state(null);
    let isLoading = $state(false);
    let content = $state("");

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
            tags =  [...tags, newTag.trim()];
            newTag = "";
        }
    }
    function removeTag(index: number) {
        tags = tags.filter((_, i) => i !== index);
    }


    let attachments = $state<File[]>([]);
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
        if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf") {
            return URL.createObjectURL(file);
        }
        return null;
    }

    async function handleSave(event) {
        const _entity: Entity = {
            title: title,
            content: getContent(),
            tags: tags,
            is_active: entity.is_active,
        };
        const response = await updateEntity(entity.shortname, _entity);
        if(response){
            successToastMessage("Saved successfully");
            for (const attachment of attachments) {

                const r = await attachAttachmentsToEntity(response, attachment);

                if(r === false){
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
                        is_active: !entity.is_active
                    }
                }
            ]
        });

        if(response.status === "success"){
            window.location.reload();
        } else {
            errorToastMessage(response.error.message);
        }
    }

    let htmlEditor: any = $state(null);
    function getContent() {
        return htmlEditor.getHtml(true);
    }

    onMount(async ()=>{
        entity = await getEntity($params.shortname)
        title = entity.payload.body.title;
        tags = entity.tags;
    })

    $effect(() => {
        if (entity && htmlEditor) {
            htmlEditor.setHtml(entity.payload.body.content);
        }
    });

    async function handleDelete(){
        if (confirm(`Are you sure want to delete this entity`) === false) {
            return;
        }

        const response = await deleteEntity(entity.shortname);
        if(response){
            successToastMessage(`Entity deleted successfully.`);
            $goto("/dashboard");
        } else {
            errorToastMessage(`Failed to delete entity!`);
        }
    }
</script>


<Container class="mt-5">
    <Button class="mb-5" onclick={()=>history.back()}>{isLoading ? "...." : "Back"}</Button>

    {#if entity}

        <div class="alert alert-secondary d-flex justify-content-between align-items-center mb-5">
            <p style="margin: 0!important;">
                {entity.is_active ? `Last update: ${formatDate(entity.updated_at)}` : "This is draft"}
            </p>
            <div>
                <Button color="primary" onclick={handleSave}>{isLoading ? "...." : "Save"}</Button>
                |
                <Button color={entity.is_active ? "danger" : "success"}
                        onclick={handlePublish}>
                    {isLoading ? "......." : (entity.is_active ? "Unpublish" : "Publish")}
                </Button>

                <button class="btn btn-danger" onclick={handleDelete} aria-label="Delete attachment">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </div>
        </div>

        {#if isEditing}
            <Input type="text" bind:value={title} onblur={handleInputBlur} />
        {:else}
            <div class="editable-label" onclick={handleLabelClick}>
                {#if title} {title}
                {:else} Title
                {/if}
            </div>
        {/if}

        <div class="mb-3">
            <Input type="text" bind:value={newTag} placeholder="Add tag" />
            <div class="d-flex justify-content-end mt-1">
                <Button color="primary" onclick={addTag}>Add Tag</Button>
            </div>
        </div>

        <div class="mb-3">
            {#each tags as tag, index}
                <span class="badge rounded-pill tag-badge bg-secondary">
                    <span class="tag-text">{tag}</span>
                    <i class="bi bi-trash tag-trash" onclick={() => removeTag(index)}></i>
                </span>
            {/each}
        </div>

        <HtmlEditor bind:editor={htmlEditor} {content} />

        <Card class="mt-5">
        <CardBody>
            <CardTitle>Attachments</CardTitle>

            <Attachments
                    resource_type={ResourceType.ticket}
                    space_name={"catalog"}
                    subpath={"posts"}
                    parent_shortname={entity.shortname}
                    attachments={Object.values(entity.attachments)}
                    isOwner={entity.owner_shortname === $user.shortname}
            />

            <input type="file" id="fileInput" multiple onchange={handleFileChange} style="display: none;" />
            <Button color="primary" onclick={() => document.getElementById('fileInput').click()}>
                <i class="bi bi-plus"></i> Add Attachment
            </Button>
            <div class="attachments mt-3">
                {#each attachments as attachment, index}
                    <div class="attachment">
                        {#if getPreviewUrl(attachment)}
                            {#if attachment.type.startsWith("image/")}
                                <img src={getPreviewUrl(attachment)} alt={attachment.name} class="attachment-preview" />
                            {:else if attachment.type.startsWith("video/")}
                                <video src={getPreviewUrl(attachment)} controls class="attachment-preview"></video>
                            {:else if attachment.type === "application/pdf"}
                                <embed src={getPreviewUrl(attachment)} type="application/pdf" class="attachment-preview" />
                            {/if}
                        {:else}
                            <span>{attachment.name}</span>
                        {/if}
                        <i class="bi bi-trash attachment-trash" onclick={() => removeAttachment(index)}></i>
                    </div>
                {/each}
            </div>
        </CardBody>
    </Card>
    {/if}
</Container>


<style>
    .editable-label {
        font-size: 2rem;
        cursor: pointer;
        border: 1px solid transparent;
        padding: 5px;
    }
    .editable-label:hover {
        border: 1px solid #ccc;
    }

    .tag-badge {
        font-size: 1rem;
        position: relative;
        margin-right: 5px;
        display: inline-block;
        width: auto;
    }
    .tag-text {
        display: inline;
    }
    .tag-trash {
        display: none;
        cursor: pointer;
    }
    .tag-badge:hover .tag-text {
        display: none;
    }
    .tag-badge:hover .tag-trash {
        display: inline;
    }

    .attachment {
        position: relative;
        display: inline-block;
        margin-right: 10px;
        margin-bottom: 10px;
    }
    .attachment-preview {
        max-width: 100px;
        max-height: 100px;
        display: block;
    }
    .attachment-trash {
        position: absolute;
        top: 0;
        right: 0;
        cursor: pointer;
    }
</style>