<script lang="ts">
  import  {
    Dmart,
    RequestType,
    ResourceType,
  } from "@edraj/tsdmart";
  import Media from "./Media.svelte";
  import {successToastMessage} from "@/lib/toasts_messages";
  import { TrashBinSolid } from "flowbite-svelte-icons";

  let {
    attachments = [],
    space_name,
    subpath,
    parent_shortname,
    isOwner = false,
  } :{
    attachments: Array<any>,
    resource_type: ResourceType,
    space_name: string,
    subpath: string,
    parent_shortname: string
    isOwner: boolean
  } = $props();

  function getFileExtension(filename: string) {
    let ext: any = /^.+\.([^.]+)$/.exec(filename);
    ext = ext == null ? "" : ext[1]
    if(ext !== null && !ext.startsWith(".")) {
        ext = "." + ext;
    }
    return ext;
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
    if(response.status === "success"){
      attachments = attachments.filter((e: { shortname: string }) => e.shortname !== item.shortname);
      successToastMessage(`Attachment deleted successfully.`);
    } else {
        successToastMessage(`Attachment deletion failed.`);
    }
  }
</script>
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!--<div class="d-flex justify-content-between mx-2 flex-row">-->
<!--  <p style="font-size: 1rem">Attachments: {attachments.length}</p>-->
<!--</div>-->

<div class="d-flex justify-content-center flex-column px-5">
  {#each attachments as attachment}
    <hr />
    {#if isOwner}
      <div class="d-flex justify-content-end mb-3">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-danger" onclick={() => handleDelete(attachment)} aria-label="Delete attachment">
          <TrashBinSolid class="w-4 h-4" />
        </button>
      </div>
    {/if}
    <div
        class="d-flex col justify-content-center"
        style="overflow: auto;max-height: 80vh;max-width: 80vw;"
    >
      {#if attachment}
        {#if [ResourceType.media, ResourceType.comment].includes(attachment.resource_type)}
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
                getFileExtension(attachment.attributes?.payload?.body)
            )}
          />
        {/if}
      {/if}
    </div>
    <hr />
  {/each}
</div>
