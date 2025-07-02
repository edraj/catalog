<script>
    import { Button, Input, Modal, Card } from 'flowbite-svelte';
    import { getEntityAttachmentsCount, getEntities } from "@/lib/dmart_services";
    import { formatDate, renderStateString } from "@/lib/helpers";
    import { goto } from "@roxi/routify";
    $goto
    import { SyncLoader } from "svelte-loading-spinners";
  import { HeartSolid, SearchOutline, MessagesSolid    } from 'flowbite-svelte-icons';

    let isProjectBeingFetched = $state(false);
    let modalOpen = $state(false);
    let searchString = $state("");
    let entities = $state([]);

    function toggleModal() {
        modalOpen = !modalOpen;
    }
    function openModal() {
        if(modalOpen) return;
        modalOpen = true;
    }

    let timeout;
    async function handleSearchChange(event) {
        if (!searchString.trim()) {
            return;
        }
        try {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(async () => {
                isProjectBeingFetched = true;
                const results = await getEntities({limit: 15, offset: 0, shortname: "", search: searchString});

                if(results === null) {
                    return;
                }

                const _entities = [];
                for (const item of results) {
                    const counts = await getEntityAttachmentsCount(item.shortname)

                    _entities.push({
                        shortname: item.shortname,
                        owner: item.attributes.owner_shortname,
                        tags: item.attributes.tags,
                        state: item.attributes.state,
                        is_active: item.attributes.is_active,
                        updated_at: formatDate(item.attributes.updated_at),
                        ...item.attributes.payload.body,
                        ...counts[0].attributes
                    })
                }
                entities = _entities;

                isProjectBeingFetched = false;
            }, 500);

        } catch (e) {
            isProjectBeingFetched = false;
        }
    }

    function handleProjectClick(shortname) {
        searchString = "";
        $goto("/dashboard/{shortname}", {shortname: shortname});
        modalOpen = false;
    }
</script>

<div class="flex">
    <Button onclick={openModal} class="p-2 border-none shadow-none bg-transparent hover:bg-gray-100">
        <SearchOutline class="text-xl text-primary w-6 h-6" />
      </Button>
      
</div>

<Modal bind:open={modalOpen} size="lg" class="w-full">
    <div class="flex items-center justify-between p-4 border-b">
        <div class="flex w-full">
            <Input 
                placeholder="Search" 
                bind:value={searchString} 
                onkeyup={handleSearchChange}
                class="flex-1"
            />
            <Button class="ml-1" color="light">
                <SearchOutline class="text-md text-primary w-4 h-4" />
              </Button>
        </div>
       
    </div>
    
    <div class="p-4">
        {#if searchString.length === 0}
            <p class="text-gray-500">Type something to search...</p>
        {:else}
            {#if isProjectBeingFetched}
                <div class="flex justify-center">
                    <SyncLoader color="black" size="50" unit="px"/>
                </div>
            {/if}

            {#if entities.length === 0 && !isProjectBeingFetched}
                <p class="text-gray-500">No entities found</p>
            {:else}
                <div class="space-y-4">
                    {#each entities as entity}
                        <Card class="cursor-pointer hover:bg-gray-50" onclick={() => handleProjectClick(entity.shortname)}>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                                <div>
                                    <h3 class="text-lg font-semibold">{entity.title}</h3>
                                    <p class="text-sm text-gray-500 font-medium">{entity.updated_at}</p>
                                </div>
                                <div class="flex justify-center items-center space-x-4">
                                    <span class="flex items-center">
                                      <HeartSolid class="text-red-500 mr-1 w-4 h-4" /> 
                                      {entity.reaction ?? 0}
                                    </span>
                                    <span class="flex items-center">
                                      <MessagesSolid  class="text-blue-500 mr-1 w-4 h-4" /> 
                                      {entity.comment ?? 0}
                                    </span>
                                  </div>
                                <div class="flex justify-center items-center">
                                    {renderStateString(entity)}
                                </div>
                            </div>
                        </Card>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
    
    <Button
    color="gray"
    class="text-light hover:text-white hover:bg-gray-700"
    onclick={toggleModal}
  >
    Close
  </Button>
</Modal>