<script>
    import {InputGroup, Input, InputGroupText, Modal, ModalBody, ModalFooter, Button} from "sveltestrap";
    import {getEntityAttachmentsCount, getEntities} from "@/lib/dmart_services";
    import {formatDate, renderStateString} from "@/lib/helpers";
    import {goto} from "@roxi/routify";
    $goto
    import {Card, CardBody, Col, Row} from "sveltestrap/src/index";
    import {SyncLoader} from "svelte-loading-spinners";

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

            {#if entities.length === 0 && !isProjectBeingFetched}
                No entities found
            {:else}
                <ul>
                    {#each entities as entity}
                        <Card class="my-4" style="cursor: pointer"
                              onclick={(e)=>handleProjectClick(entity.shortname)}>
                            <CardBody>
                                <Row>
                                    <Col sm="4">
                                        <h1>{entity.title}</h1>
                                        <h6 class="text-secondary fw-bold">{entity.updated_at}</h6>
                                    </Col>
                                    <Col sm="4" class="d-flex justify-content-center align-items-center">
                                        <span class="mx-2"><i class="bi bi-heart-fill text-danger"></i> {entity.reaction ?? 0}</span>
                                        <span class="mx-2"><i class="bi bi-chat-left-text-fill text-primary"></i> {entity.comment ?? 0}</span>
                                    </Col>
                                    <Col sm="4" class="d-flex justify-content-center align-items-center">
                                        {renderStateString(entity)}
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