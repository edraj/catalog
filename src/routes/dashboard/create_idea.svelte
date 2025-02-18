<script lang="ts">
    import {Button, Container, Card, CardBody, CardTitle, Alert, Row, Col} from "sveltestrap";
    import {goto} from "@roxi/routify";
    import HtmlEditor from "@/routes/components/HtmlEditor.svelte";
    import { Input } from "sveltestrap";
    import {attachAttachmentsToIdeas, createProjectIdea} from "@/lib/dmart_services";
    import {errorToastMessage, successToastMessage} from "@/lib/toasts_messages";
    $goto

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

    async function handlePublish(isPublish) {
        isLoading = true;

        const idea: ProjectIdea = {
            title: title,
            content: getContent(),
            tags: tags,
            is_active: isPublish,
        };
        const response = await createProjectIdea(idea);
        const msg = isPublish ? "published" : "saved";
        if(response){
            successToastMessage(`Idea ${msg} successfully.`);
            for (const attachment of attachments) {

                const r = await attachAttachmentsToIdeas(response, attachment);

                if(r === false){
                    errorToastMessage(`Failed to attach ${attachment.name} to idea!`);
                }
            }
           setTimeout(() => {
               $goto(`/dashboard/{shortname}`, {
                   shortname: response
               });
           }, 500);
        } else {
            errorToastMessage(`Failed to ${msg} idea!`);
            isLoading = false;
        }
    }

    let htmlEditor: any = $state(null);
    function getContent() {
        return htmlEditor.getHtml(true);
    }
</script>


<Container>
    <Button class="mb-5" onclick={()=>history.back()}>{isLoading ? "...." : "Back"}</Button>

    <div class="alert alert-secondary d-flex justify-content-between align-items-center mb-5">
        <p style="margin: 0!important;">This is draft</p>
        <div>
            <Button color="primary" onclick={()=>handlePublish(false)}>{isLoading ? "...." : "Save"}</Button>
            |
            <Button color="success" onclick={()=>handlePublish(true)}>{isLoading ? "......." : "Publish"}</Button>
        </div>
    </div>

    {#if isEditing}
        <Input type="text" bind:value={title} on:blur={handleInputBlur} />
    {:else}
        <div class="editable-label" on:click={handleLabelClick}>
            {#if title} {title}
            {:else} Title
            {/if}
        </div>
    {/if}

    <div class="mb-3">
        <Input type="text" bind:value={newTag} placeholder="Add tag" />
        <div class="d-flex justify-content-end mt-1">
            <Button color="primary" on:click={addTag}>Add Tag</Button>
        </div>
    </div>

    <div class="mb-3">
        {#each tags as tag, index}
            <span class="badge rounded-pill tag-badge bg-secondary">
                <span class="tag-text">{tag}</span>
                <i class="bi bi-trash tag-trash" on:click={() => removeTag(index)}></i>
            </span>
        {/each}
    </div>

    <HtmlEditor bind:editor={htmlEditor} {content} />

    <Card class="mt-5">
        <CardBody>
            <CardTitle>Attachments</CardTitle>
            <input type="file" id="fileInput" multiple on:change={handleFileChange} style="display: none;" />
            <Button color="primary" on:click={() => document.getElementById('fileInput').click()}>
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
                        <i class="bi bi-trash attachment-trash" on:click={() => removeAttachment(index)}></i>
                    </div>
                {/each}
            </div>
        </CardBody>
    </Card>
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