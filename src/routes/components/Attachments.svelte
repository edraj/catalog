<script lang="ts">
  import  {
    Dmart,
    RequestType,
    ResourceType,
  } from "@edraj/tsdmart";
  import Media from "./Media.svelte";
  import {successToastMessage} from "@/lib/toasts_messages";
  import { TrashBinSolid } from "flowbite-svelte-icons";
  import { _ } from '@/i18n';
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

  export function getFileExtension(filename: string) {
    let ext = /^.+\.([^.]+)$/.exec(filename);
    return ext == null ? "" : ext[1];
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

<style>
  .attachments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
    width: 100%;
  }

  @media (min-width: 1200px) {
    .attachments-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 992px) and (max-width: 1199px) {
    .attachments-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .attachment-card {
    position: relative;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease-in-out;
  }

  .attachment-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .attachment-header {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    padding: 0.5rem;
  }

  .delete-button {
    background: rgba(220, 38, 38, 0.9);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    backdrop-filter: blur(4px);
  }

  .delete-button:hover {
    background: rgba(220, 38, 38, 1);
    transform: scale(1.1);
  }

  .attachment-content {
    position: relative;
    width: 100%;
    height: 250px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
  }

  .attachment-info {
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    background: white;
  }

  .attachment-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin: 0;
    word-break: break-all;
    line-height: 1.4;
  }

  .attachment-type {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  /* Responsive adjustments */
  @media (max-width: 991px) {
    .attachments-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    .attachment-content {
      height: 200px;
    }
  }

  @media (max-width: 640px) {
    .attachments-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  /* Global media content styling */
  :global(.attachment-content .media-wrapper) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :global(.attachment-content img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :global(.attachment-content video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>

<div class="attachments-container" style="width: 100%;">
  {#if attachments.length === 0}
    <div class="text-center py-8 text-gray-500">
      <p>{$_('NoAttachments')}</p>
    </div>
  {:else}
    <div class="attachments-grid">
      {#each attachments as attachment}
        <div class="attachment-card">
          {#if isOwner}
            <div class="attachment-header">
              <button 
                class="delete-button" 
                onclick={() => handleDelete(attachment)} 
                aria-label="Delete attachment"
                title="Delete attachment"
              >
                <TrashBinSolid class="w-4 h-4" />
              </button>
            </div>
          {/if}

          <div class="attachment-content">
            {#if attachment && [ResourceType.media, ResourceType.comment].includes(attachment.resource_type)}
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
            {:else}
              <div class="flex items-center justify-center h-full text-gray-400">
                <span>{$_('Unsupportedformat')}</span>
              </div>
            {/if}
          </div>

          <div class="attachment-info">
            <p class="attachment-name" title={attachment.shortname}>
              {attachment.shortname}
            </p>
            <p class="attachment-type">
              {getFileExtension(attachment.attributes?.payload?.body) || 'Unknown'}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>