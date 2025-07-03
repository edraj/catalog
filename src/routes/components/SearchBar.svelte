<script>
    import { getEntityAttachmentsCount, getEntities } from "@/lib/dmart_services";
    import { formatDate, renderStateString } from "@/lib/helpers";
    import { goto } from "@roxi/routify";
    import { _ } from '@/i18n';
    import { SyncLoader } from "svelte-loading-spinners";
    $goto
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

    function gotoEntityDetails(entity){
        $goto(`/dashboard/{shortname}`, {
            shortname: entity.shortname
        });
        
        modalOpen = false;
    }
</script>

<button 
    onclick={openModal} 
    class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
    aria-label="Search"
>
    <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
</button>

{#if modalOpen}
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">

        <div class="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[80vh] flex flex-col">
            <div class="p-6 border-b border-gray-100">
                <div class="flex items-center gap-3">
                    <div class="flex-1 relative">
                        <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <input 
                            type="text"
                            placeholder={$_('SearchEntities')}
                            bind:value={searchString} 
                            onkeyup={handleSearchChange}
                            class="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                        />
                    </div>
                    <button 
                        onclick={toggleModal}
                        class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                        aria-label="Close"
                    >
                        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6" role="region" aria-label="Search Results">
                {#if searchString.length === 0}
                    <div class="text-center py-12">
                        <svg class="mx-auto w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <p class="text-gray-500 text-lg">{$_('Searchplaceholder')}</p>
                        <p class="text-gray-400 text-sm mt-1">{$_('Searchplaceholder2')}</p>
                    </div>
                {:else}
                    {#if isProjectBeingFetched}
                        <div class="flex justify-center py-12">
                            <SyncLoader color="#3b82f6" size="40" unit="px"/>
                        </div>
                    {/if}

                    {#if entities.length === 0 && !isProjectBeingFetched}
                        <div class="text-center py-12">
                            <svg class="mx-auto w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.291-1.007-5.691-2.709M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                            <p class="text-gray-500 text-lg">{$_('NoResults')}</p>
                            <p class="text-gray-400 text-sm mt-1">{$_('NoResults2')}</p>
                        </div>
                    {:else}
                        <div class="space-y-3">
                            {#each entities as entity}
                                <div 
                                    class="group p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-all duration-200"
                                    role="button" tabindex="0" onkeydown={() => gotoEntityDetails(entity)} onclick={() => gotoEntityDetails(entity)}
                                >
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div class="flex-1 min-w-0">
                                            <h3 class="font-semibold text-gray-900 group-hover:text-blue-700 truncate text-lg">
                                                {entity.title}
                                            </h3>
                                            <p class="text-sm text-gray-500 mt-1">{entity.updated_at}</p>
                                        </div>
                                        
                                        <div class="flex items-center gap-6 text-sm">
                                            <div class="flex items-center gap-4">
                                                <span class="flex items-center gap-1.5 text-red-600">
                                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                                    </svg>
                                                    {entity.reaction ?? 0}
                                                </span>
                                                <span class="flex items-center gap-1.5 text-blue-600">
                                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                                                    </svg>
                                                    {entity.comment ?? 0}
                                                </span>
                                            </div>
                                            
                                            <div class="hidden sm:block">
                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {renderStateString(entity)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    </div>
{/if}
