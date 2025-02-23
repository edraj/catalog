<script>
    import {InputGroup, Input, InputGroupText, Modal, ModalBody, ModalFooter, Button} from "sveltestrap";
    import {getIdeaAttachmentsCount, getProjectIdeas} from "@/lib/dmart_services";
    import {formatDate, renderStateString} from "@/lib/helpers";
    import {goto} from "@roxi/routify";
    $goto
    import {Card, CardBody, Col, Row} from "sveltestrap/src/index";
    import {SyncLoader} from "svelte-loading-spinners";

    let isProjectBeingFetched = $state(false);
    let modalOpen = $state(false);
    let searchString = $state("");
    let projects = $state([]);

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
                const _ideas = await getProjectIdeas({limit: 15, offset: 0, shortname: "", search: searchString});

                if(_ideas === null) {
                    return;
                }

                const _projects = [];
                for (const item of _ideas) {
                    const counts = await getIdeaAttachmentsCount(item.shortname)

                    _projects.push({
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
                projects = _projects;

                isProjectBeingFetched = false;
            }, 500);

        } catch (e) {
            isProjectBeingFetched = false;
        }
    }

    function handleProjectClick(shortname) {
        $goto("/dashboard/{shortname}", {shortname: shortname});
        modalOpen = false;
    }
</script>

<InputGroup>
    <InputGroupText onclick={openModal}>
        <i style="cursor: pointer" class="bi bi-search"/>
    </InputGroupText>
</InputGroup>


<Modal size={"lg"} isOpen={modalOpen} toggle={toggleModal}>
    <div class="modal-header">
        <InputGroup>
            <Input placeholder="Search" bind:value={searchString} onkeyup={handleSearchChange}/>
            <InputGroupText>
                <i class="bi bi-search"/>
            </InputGroupText>
        </InputGroup>
        <button type="button" onclick={toggleModal} class="btn-close"/>
    </div>
    <ModalBody>
        {#if searchString.length === 0}
            Type something to search...
        {:else}
            {#if isProjectBeingFetched}
                <div class="d-flex justify-content-center">
                    <SyncLoader color="black" size="50" unit="px"/>
                </div>
            {/if}

            {#if projects.length === 0 && !isProjectBeingFetched}
                No projects found
            {:else}
                <ul>
                    {#each projects as project}
                        <Card class="my-4" style="cursor: pointer"
                              onclick={(e)=>handleProjectClick(project.shortname)}>
                            <CardBody>
                                <Row>
                                    <Col sm="4">
                                        <h1>{project.title}</h1>
                                        <h6 class="text-secondary fw-bold">{project.updated_at}</h6>
                                    </Col>
                                    <Col sm="4" class="d-flex justify-content-center align-items-center">
                                        <span class="mx-2"><i class="bi bi-heart-fill text-danger"></i> {project.reaction ?? 0}</span>
                                        <span class="mx-2"><i class="bi bi-chat-left-text-fill text-primary"></i> {project.comment ?? 0}</span>
                                    </Col>
                                    <Col sm="4" class="d-flex justify-content-center align-items-center">
                                        {renderStateString(project)}
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>
                    {/each}
                </ul>
            {/if}
        {/if}
    </ModalBody>
    <ModalFooter>
        <Button color="secondary" on:click={toggleModal}>Close</Button>
    </ModalFooter>
</Modal>