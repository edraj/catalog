<script lang="ts">
    import { Card, Button, Input, Label } from 'flowbite-svelte';
    import { onMount } from "svelte";
    import { getAvatar, getEntityAttachmentsCount, getProfile, getEntities, updateProfile } from "@/lib/dmart_services";
    import { errorToastMessage, successToastMessage } from "@/lib/toasts_messages";
    import Avatar from "@/routes/components/Avatar.svelte";
    import { formatDate, renderStateString } from "@/lib/helpers";
    import { goto } from "@roxi/routify";
    import { Diamonds } from "svelte-loading-spinners";
    $goto

    let profileSection: string = $state("ME");

    let isLoading = $state(true);
    let user = $state(null);
    let avatar = $state(null);
    let entities = $state([]);
    let displayname = $state("");
    let description = $state("");

    onMount(async () => {
        isLoading = true;
        user = await getProfile();
        displayname = user.attributes.displayname.en ?? "";
        description = user.attributes?.description?.en ?? "";

        avatar = await getAvatar(user.shortname);

        const _entities = await getEntities({limit: 15, offset: 0, shortname: user.shortname, search: ""});
        if (_entities === null) {
            errorToastMessage("Failed to fetch entities!", true);
            entities = [];
        }
        else {
            for (const item of _entities) {
                const counts = await getEntityAttachmentsCount(item.shortname)

                entities.push({
                    shortname: item.shortname,
                    owner: item.attributes.owner_shortname,
                    tags: item.attributes.tags,
                    state: item.attributes.state,
                    is_active: item.attributes.is_active,
                    created_at: formatDate(item.attributes.created_at),
                    updated_at: formatDate(item.attributes.updated_at),
                    ...item.attributes.payload.body,
                    ...counts[0].attributes
                })
            }
        }
        isLoading = false;
    });

    async function handleSubmit(event) {
        event.preventDefault();

        const response = await updateProfile({shortname: user.shortname, displayname, description});
        if (response) {
            successToastMessage("Profile updated successfully");
        } else {
            errorToastMessage("Error updating profile");
        }
    }

    function handleME() {
        profileSection = "ME";
    }
    function handleEntities() {
        profileSection = "IDEAS";
    }
    function gotoEntityDetails(entity: any){
        $goto(`/dashboard/{shortname}`, {
            shortname: entity.shortname
        });
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="text-2xl mb-8 space-x-4">
        <button 
            class="cursor-pointer {profileSection === 'ME' ? 'font-bold text-primary' : 'text-gray-600 hover:text-gray-900'}" 
            onclick={handleME}
        >
            My profile
        </button>
        <span class="text-gray-400">|</span>
        <button 
            class="cursor-pointer {profileSection === 'IDEAS' ? 'font-bold text-primary' : 'text-gray-600 hover:text-gray-900'}" 
            onclick={handleEntities}
        >
            My entities
        </button>
    </div>

    {#if isLoading}
        <div class="py-12 flex justify-center">
            <Diamonds color="black" size="200" unit="px" />
        </div>
    {:else}
        {#if profileSection === "ME"}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div class="flex justify-center items-center">
                    <Avatar src={avatar}/>
                </div>
                <div class="md:col-span-3">
                    <Card>
                        <div class="p-6">
                            <h3 class="text-lg font-semibold mb-4">Preference</h3>
                            <form onsubmit={handleSubmit} class="space-y-4">
                                <div>
                                    <Label for="displayname" class="mb-2">Display name</Label>
                                    <Input id="displayname" type="text" required bind:value={displayname} />
                                </div>

                                <div>
                                    <Label for="description" class="mb-2">Description</Label>
                                    <Input id="description" type="textarea" required bind:value={description} />
                                </div>

                                <Button type="submit" color="primary" class="w-full">Save</Button>
                            </form>
                        </div>
                    </Card>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div></div>
                {#if user}
                    <div class="md:col-span-3">
                        <Card>
                            <div class="p-6">
                                <h3 class="text-lg font-semibold mb-4">Settings</h3>
                                <div class="space-y-4 text-lg">
                                    <div>
                                        <span class="font-semibold">Email</span>
                                        <br>
                                        <span class="text-gray-600">{user.attributes?.email ?? "N/A"}</span>
                                    </div>
                                    <div>
                                        <span class="font-semibold">Mobile number</span>
                                        <br>
                                        <span class="text-gray-600">{user.attributes?.msisdn ?? "N/A"}</span>
                                    </div>
                                    <p class="text-center mt-8 text-gray-500">To change these settings, contact administrator</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                {/if}
            </div>
        {:else}
            {#if entities.length === 0}
                <h1 class="text-center text-2xl text-gray-500 mt-12">No entities found.</h1>
            {:else}
                <div class="space-y-6">
                    {#each entities as entity}
                        <Card class="cursor-pointer hover:bg-gray-50" onclick={() => gotoEntityDetails(entity)}>
                            <div class="p-6">
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <h2 class="text-xl font-bold mb-2">{entity.title}</h2>
                                        <p class="text-gray-500 font-semibold">{entity.updated_at}</p>
                                    </div>
                                    <div class="flex justify-center items-center space-x-4">
                                        <span class="flex items-center">
                                            <i class="bi bi-heart-fill text-red-500 mr-1"></i> 
                                            {entity.reaction ?? 0}
                                        </span>
                                        <span class="flex items-center">
                                            <i class="bi bi-chat-left-text-fill text-blue-500 mr-1"></i> 
                                            {entity.comment ?? 0}
                                        </span>
                                    </div>
                                    <div class="flex justify-center items-center">
                                        <span class="text-gray-600">{renderStateString(entity)}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    {/each}
                </div>
            {/if}
        {/if}
    {/if}
</div>
