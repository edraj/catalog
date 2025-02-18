<script lang="ts">
    import {
        Button,
        Container,
        Row,
        Col,
        Card,
        CardBody,
    } from "sveltestrap";
    import {writable} from "svelte/store";
    import {
        createProjectIdea,
        deleteProjectIdea,
        getCatalogWorkflow,
        getProjectIdeas,
        progressProjectIdea
    } from "@/lib/dmart_services";
    import {onMount} from "svelte";
    import {errorToastMessage, successToastMessage} from "@/lib/toasts_messages";
    import {goto} from "@roxi/routify";
    import {formatDate, truncateString} from "@/lib/helpers";
    $goto

    let projectIdeas: any[] = $state([]);

    async function fetchProjectIdeas() {
        const _projectIdeas = await getProjectIdeas();
        if (_projectIdeas === null) {
            errorToastMessage("Failed to fetch project ideas.", true);
            projectIdeas = [];
        } else {
            projectIdeas = _projectIdeas.map((item) => {
                return {
                    shortname: item.shortname,
                    owner: item.attributes.owner_shortname,
                    tags: item.attributes.tags,
                    state: item.attributes.state,
                    created_at: formatDate(item.attributes.created_at),
                    updated_at: formatDate(item.attributes.updated_at),
                    ...item.attributes.payload.body
                }
            });
        }
    }

    onMount(async () => {
        await fetchProjectIdeas();
    });

    function gotoIdeaDetails(projectIdea: any){
        $goto(`/dashboard/{shortname}`, {
            shortname: projectIdea.shortname
        });
    }
</script>

<Container class="mt-5">
    <div class="d-flex justify-content-end">
        <Button color="success"
                onclick={()=>$goto("/dashboard/create_idea")}>Create Idea</Button>
    </div>
    {#if projectIdeas.length === 0}
        <h1 class="text-center mt-5">No project ideas found.</h1>
    {/if}
    {#each projectIdeas as projectIdea}
        <Card class="my-4" style="cursor: pointer" on:click={()=>gotoIdeaDetails(projectIdea)}>
            <CardBody>
                <Row>
                    <Col class="mt-3" sm="1">
                        <h5>+250</h5>
                    </Col>
                    <Col sm="11">
                        <h1>{projectIdea.title}</h1>
                        <h6 class="text-secondary fw-bold">{projectIdea.updated_at}</h6>
                        <p class="text-secondary">{@html truncateString(projectIdea.content)}</p>


                        <div class="my-4" style="font-size: 1.25rem">
                            <i class="bi bi-chat-left-text-fill"></i> 250
                            <i class="bi bi-check-lg text-success"></i> active
                        </div>


                        <div class="d-flex justify-content-between">
                            <div>
                                {#each projectIdea.tags as tag}
                                    <span class="badge bg-secondary me-1" style="font-size: 1rem">{tag}</span>
                                {/each}
                            </div>
                            <p style="font-size: 1.5rem">{projectIdea.owner}</p>
                        </div>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    {/each}
</Container>
