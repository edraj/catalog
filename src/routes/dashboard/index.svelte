<script lang="ts">
    import {
        Button,
        Container,
        Row,
        Col,
        Card,
        CardBody
    } from "sveltestrap";
    import {
        getEntityAttachmentsCount,
        getEntities,
    } from "@/lib/dmart_services";
    import {onMount} from "svelte";
    import {errorToastMessage} from "@/lib/toasts_messages";
    import {goto} from "@roxi/routify";
    import { Diamonds } from 'svelte-loading-spinners';
    import {formatDate, renderStateIcon, renderStateString, truncateString} from "@/lib/helpers";
    $goto

    let isLoading: boolean = $state(true);
    let entities: any[] = $state([]);

    async function fetchEntities() {
        isLoading = true;
        const _entities = await getEntities({
            search: "-@state:pending @is_active:true",
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

<Container class="mt-5">
    {#if isLoading}
        <div class="py-5 d-flex justify-content-center">
            <Diamonds color="black" size="200" unit="px" />
        </div>
    {:else}
        <div class="d-flex justify-content-end">
            <Button color="success"
                    onclick={()=>$goto("/dashboard/create_entity")}>Create Entity</Button>
        </div>
        {#if entities.length === 0}
            <h1 class="text-center mt-5">No entities found.</h1>
        {/if}
        {#each entities as entity}
            <Card class="my-4" style="cursor: pointer" on:click={()=>gotoEntityDetails(entity)}>
                <CardBody>
                    <Row>
                        <Col class="mt-3" sm="1">
                            <h5 class="text-center">{entity.reaction ?? 0}</h5>
                        </Col>
                        <Col sm="11">
                            <h1>{entity.title}</h1>
                            <h6 class="text-secondary fw-bold">{entity.updated_at}</h6>
                            <p class="text-secondary">{@html truncateString(entity.content)}</p>


                            <div class="my-4" style="font-size: 1.25rem">
                                <i class={renderStateIcon(entity)}
                                   data-toggle="tooltip" data-placement="top" title={renderStateString(entity)}></i>

                                <i class="bi bi-chat-left-text-fill mx-2"></i>{entity.comment ?? 0}
                            </div>


                            <div class="d-flex justify-content-between">
                                <div>
                                    {#each entity.tags as tag}
                                        <span class="badge bg-secondary me-1" style="font-size: 1rem">{tag}</span>
                                    {/each}
                                </div>
                                <p style="font-size: 1.5rem">{entity.owner}</p>
                            </div>
                        </Col>
                    </Row>
                </CardBody>
            </Card>
        {/each}
    {/if}

</Container>
