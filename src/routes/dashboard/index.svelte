<script lang="ts">
    import { Button, Card } from 'flowbite-svelte';
    import {
        getEntityAttachmentsCount,
        getEntities,
    } from "@/lib/dmart_services";
    import { onMount } from "svelte";
    import { errorToastMessage } from "@/lib/toasts_messages";
    import { goto } from "@roxi/routify";
    import { Diamonds } from 'svelte-loading-spinners';
    import { formatDate, renderStateIcon, renderStateString, truncateString } from "@/lib/helpers";
    $goto

    let isLoading: boolean = $state(true);
    let entities: any[] = $state([]);

    async function fetchEntities() {
        isLoading = true;
        const _entities = await getEntities({
            search: "",
            limit: 10,
            offset: 0,
            shortname: ""
        });
        if (_entities === null) {
            errorToastMessage("Failed to fetch entities!", true);
            entities = [];
        } else {
            entities = await Promise.all(
                _entities.map(async(item) => {
                    const counts = await getEntityAttachmentsCount(item.shortname)
                    return {
                        is_active: item.attributes.is_active,
                        shortname: item.shortname,
                        owner: item.attributes.owner_shortname,
                        tags: item.attributes.tags,
                        state: item.attributes.state,
                        created_at: formatDate(item.attributes.created_at),
                        updated_at: formatDate(item.attributes.updated_at),
                        ...item.attributes.payload.body,
                        ...counts[0].attributes
                    }
                })
            );
        }
        isLoading = false;
    }

    onMount(async () => {
        await fetchEntities();
    });

    function gotoEntityDetails(entity: any){
        $goto(`/dashboard/{shortname}`, {
            shortname: entity.shortname
        });
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
    {#if isLoading}
        <div class="py-16 flex justify-center">
            <Diamonds color="black" size="200" unit="px" />
        </div>
    {:else}
        <div class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Entities</h1>
                <p class="text-gray-600">Manage and explore your entities</p>
            </div>
            <Button color="green" onclick={() => $goto("/dashboard/create_entity")} class="shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-3 text-base font-medium">
                <i class="bi bi-plus-circle mr-2"></i>
                Create Entity
            </Button>
        </div>
        
        {#if entities.length === 0}
            <div class="text-center py-16">
                <div class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <i class="bi bi-collection text-3xl text-gray-400"></i>
                </div>
                <h2 class="text-2xl font-semibold text-gray-900 mb-2">No entities found</h2>
                <p class="text-gray-500 mb-6">Get started by creating your first entity</p>
                <Button color="green" onclick={() => $goto("/dashboard/create_entity")} class="px-6 py-3">
                    Create Your First Entity
                </Button>
            </div>
        {/if}
        
        <div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {#each entities as entity}
                <Card class="group cursor-pointer bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 rounded-xl overflow-hidden h-full flex flex-col" onclick={() => gotoEntityDetails(entity)}>
                    <div class="p-6 flex flex-col h-full">
                        <div class="flex items-start gap-4 mb-4">
                            <div class="flex-shrink-0">
                                <div class="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200 group-hover:from-blue-100 group-hover:to-indigo-200 transition-colors duration-200">
                                    <div class="text-center">
                                        <div class="text-lg font-bold text-blue-700">{entity.reaction ?? 0}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex-grow min-w-0">
                                <h2 class="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors duration-200 line-clamp-2">{entity.title}</h2>
                                <div class="flex items-center text-xs text-gray-500">
                                    <i class="bi bi-clock mr-1"></i>
                                    <span class="font-medium">{entity.updated_at}</span>
                                </div>
                            </div>
                        </div>

                        <div class="text-gray-600 mb-4 leading-relaxed flex-grow">
                            <div class="line-clamp-4 text-sm">
                                {@html truncateString(entity.content)}
                            </div>
                        </div>

                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center space-x-4">
                                <div class="flex items-center text-gray-600" title={renderStateString(entity)}>
                                    <i class="{renderStateIcon(entity)} mr-1 text-sm"></i>
                                    <span class="text-xs font-medium">{renderStateString(entity)}</span>
                                </div>
                                <div class="flex items-center text-gray-600">
                                    <i class="bi bi-chat-left-text-fill mr-1 text-sm"></i>
                                    <span class="text-xs font-medium">{entity.comment ?? 0}</span>
                                </div>
                            </div>
                        </div>

                        {#if entity.tags && entity.tags.length > 0}
                            <div class="flex flex-wrap gap-1 mb-3">
                                {#each entity.tags.slice(0, 3) as tag}
                                    <span class="inline-flex items-center px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-full text-xs font-medium hover:from-gray-200 hover:to-gray-300 transition-colors duration-200">
                                        {tag}
                                    </span>
                                {/each}
                                {#if entity.tags.length > 3}
                                    <span class="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                                        +{entity.tags.length - 3}
                                    </span>
                                {/if}
                            </div>
                        {/if}

                        <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                            <p class="text-xs font-medium text-gray-700">by {entity.owner}</p>
                            <i class="bi bi-chevron-right text-gray-400 group-hover:text-gray-600 transition-colors duration-200"></i>
                        </div>
                    </div>
                </Card>
            {/each}
        </div>
    {/if}
</div>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    
    .line-clamp-3 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    
    .line-clamp-4 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
