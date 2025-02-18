<script lang="ts">
    import {
        Table,
        Button,
        Container,
        Row,
        Col,
        Pagination,
        PaginationItem,
        PaginationLink,
        CardBody, Card, Modal, ModalHeader, ModalBody, Form, FormGroup, Label, Input, ModalFooter
    } from "sveltestrap";
    import { writable } from "svelte/store";
    import {
        createProjectIdea,
        deleteProjectIdea,
        getCatalogWorkflow,
        getProjectIdeas,
        progressProjectIdea
    } from "@/lib/dmart_services";
    import {onMount} from "svelte";
    import {errorToastMessage, successToastMessage} from "@/lib/toasts_messages";
    import {Steps} from "svelte-steps";
    import {formatDate} from "@/lib/helpers";


    let projectIdeas: ProjectIdea[] = $state([]);
    let workflow: any = $state({});
    let selectedProjectIdea: ProjectIdea;
    let workflowSteps = $state([]);
    let workflowStepsSelected = $state([]);

    async function fetchProjectIdeas() {
        const _projectIdeas = await getProjectIdeas();
        if (_projectIdeas === null){
            errorToastMessage("Failed to fetch project ideas.", true);
            projectIdeas = [];
        } else {
            projectIdeas = _projectIdeas.map((item)=>{
                return {
                    shortname: item.shortname,
                    state: item.attributes.state,
                    created_at: formatDate(item.attributes.created_at),
                    updated_at: formatDate(item.attributes.updated_at),
                    ...item.attributes.payload.body
                }
            });
        }
    }

    onMount(async () => {
        const _workflow: any = await getCatalogWorkflow();
        if (_workflow){
            workflow = _workflow;
        } else {
            errorToastMessage("Failed to fetch workflow.!", true);
        }
        workflowSteps = [
            {text: "Pending", state: ["pending"]},
            {text: "In Progress", state: ["in_progress"]},
            {text: "Result", state: ["approved", "disapproved"]},
        ]
        await fetchProjectIdeas();
    });

    let currentPage = writable(1);
    let itemsPerPage = 5;

    async function openProgresProjectIdeaModal(event, idea: ProjectIdea) {
        event.preventDefault()
        event.stopPropagation();

        workflowStepsSelected = workflow.states.filter(state => state.state === idea.state)[0].next;

        selectedProjectIdea = {...idea};
        modalOpenProgress = true;
    }

    async function deleteIdea(event, shortname: string) {
        event.preventDefault()
        event.stopPropagation();

        if(confirm("Are you sure you want to delete this idea?")){
            const r = await deleteProjectIdea(shortname);
            if(r){
                successToastMessage("Project idea deleted successfully.");
                await fetchProjectIdeas();
            } else {
                errorToastMessage("Failed to delete project idea.");
            }
        }
    }


    let paginatedIdeas = $derived( projectIdeas.slice(($currentPage - 1) * itemsPerPage, $currentPage * itemsPerPage));

    let modalOpen = $state(false);
    let modalOpenDetails = $state(false);
    let modalOpenProgress = $state(false);

    let newProjectIdea: ProjectIdea = $state({
        title: "",
        budget: "",
        long_description: "",
        short_description: ""
    });

    function handleAddProjectIdea() {
        newProjectIdea = {
            title: "",
            budget: "",
            long_description: "",
            short_description: ""
        };
        modalOpen = true;
    }

    async function createNewProjectIdea() {
        const r = await createProjectIdea(newProjectIdea);
        if(r){
            successToastMessage("Project idea created successfully.");
            await fetchProjectIdeas();
            modalOpen = false;
        } else {
            errorToastMessage("Failed to create project idea.");
        }
        modalOpen = false;
    }

    async function updateStateProjectIdea() {
        const r = await progressProjectIdea(selectedProjectIdea.shortname, selectedProjectIdea.state);
        if(r){
            successToastMessage("Project idea created successfully.");
            await fetchProjectIdeas();
            modalOpenProgress = false;
        } else {
            errorToastMessage("Failed to create project idea.");
        }
        modalOpenProgress = false;
    }

</script>

<Container class="mt-5">
    <Row class="justify-content-center">
        <Col md="12">
            <Card>
                <CardBody>
                    <div class="d-flex justify-content-end">
                        <Button color="success" on:click={handleAddProjectIdea}>Create</Button>
                    </div>
                    {#if projectIdeas.length > 0}
                        <Table striped>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>State</th>
                                    <th>Description</th>
                                    <th>Budget</th>
                                    <th>Created at</th>
                                    <th>Updated at</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each paginatedIdeas as idea, index}
                                    <tr style="cursor: pointer" onclick={() => {selectedProjectIdea = {...idea}; modalOpenDetails = true;}}>
                                        <td>{idea.title}</td>
                                        <td>{idea.state}</td>
                                        <td>{idea.short_description}</td>
                                        <td>{idea.budget}</td>
                                        <td>{idea.created_at}</td>
                                        <td>{idea.updated_at}</td>
                                        <td>
                                            <Button color="danger" on:click={(e) => deleteIdea(e, idea.shortname)}>Delete</Button>
                                            <Button color="warning" on:click={(e) => openProgresProjectIdeaModal(e, idea)}>Progress</Button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </Table>

                        <Pagination listClassName="justify-content-end">
                            <PaginationItem disabled={$currentPage === 1}>
                                <PaginationLink previous href="#" on:click={() => $currentPage = $currentPage - 1} />
                            </PaginationItem>
                            {#each Array(Math.ceil(projectIdeas.length / itemsPerPage)) as _, i}
                                <PaginationItem active={$currentPage === i + 1}>
                                    <PaginationLink href="#" on:click={() => $currentPage = i + 1}>
                                        {i + 1}
                                    </PaginationLink>
                                </PaginationItem>
                            {/each}
                            <PaginationItem disabled={$currentPage === Math.ceil(projectIdeas.length / itemsPerPage)}>
                                <PaginationLink next href="#" on:click={() => $currentPage = $currentPage + 1} />
                            </PaginationItem>
                        </Pagination>
                    {:else}
                        <p class="text-center">No ideas have been submitted yet.</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row>
</Container>

<Modal isOpen={modalOpen} toggle={() => modalOpen = false}>
    <div class="modal-header">
        <h5 class="modal-title">Create New Project Idea</h5>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <button type="button" onclick={() => (modalOpen = false)} class="btn-close" aria-label="Close">
        </button>
    </div>

    <ModalBody>
        <Form>
            <FormGroup>
                <Label for="title">Title</Label>
                <Input type="text" id="title" bind:value={newProjectIdea.title} />
            </FormGroup>
            <FormGroup>
                <Label for="budget">Budget</Label>
                <Input type="text" id="budget" bind:value={newProjectIdea.budget} />
            </FormGroup>
            <FormGroup>
                <Label for="short_description">Short Description</Label>
                <Input type="text" id="short_description" bind:value={newProjectIdea.short_description} />
            </FormGroup>
            <FormGroup>
                <Label for="long_description">Long Description</Label>
                <Input type="textarea" id="long_description" bind:value={newProjectIdea.long_description} />
            </FormGroup>
        </Form>
    </ModalBody>
    <ModalFooter>
        <Button color="primary" on:click={createNewProjectIdea}>Create</Button>
        <Button color="secondary" on:click={() => modalOpen = false}>Cancel</Button>
    </ModalFooter>
</Modal>

<Modal isOpen={modalOpenDetails} toggle={() => modalOpenDetails = false}>
    <div class="modal-header">
        <h5 class="modal-title">Project Idea Details</h5>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <button type="button" onclick={() => (modalOpenDetails = false)} class="btn-close" aria-label="Close">
        </button>
    </div>
    <ModalBody>
        {#if selectedProjectIdea}
            <Form>
                <FormGroup>
                    <Label class="fw-bold">Title: </Label> {selectedProjectIdea.title}
                </FormGroup>
                <FormGroup>
                    <Label class="fw-bold">Budget: </Label> {selectedProjectIdea.budget}
                </FormGroup>
                <FormGroup>
                    <Label class="fw-bold">Short Description: </Label> {selectedProjectIdea.short_description}
                </FormGroup>
                <FormGroup>
                    <Label class="fw-bold">Long Description: </Label> {selectedProjectIdea.long_description}
                </FormGroup>
                <FormGroup>
                    <Label class="fw-bold">Created At: </Label> {selectedProjectIdea.created_at}
                </FormGroup>
                <FormGroup>
                    <Label class="fw-bold">Updated At: </Label> {selectedProjectIdea.updated_at}
                </FormGroup>
            </Form>
        {/if}
    </ModalBody>
    <ModalFooter>
        <Button color="secondary" on:click={() => modalOpenDetails = false}>Close</Button>
    </ModalFooter>
</Modal>


<Modal size="lg"  isOpen={modalOpenProgress} toggle={() => modalOpenProgress = false}>
    <div class="modal-header">
        <h5 class="modal-title">Progress Project Idea</h5>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <button type="button" onclick={() => (modalOpenProgress = false)} class="btn-close" aria-label="Close">
        </button>
    </div>

    <ModalBody>
        <Form>
            <Steps steps={workflowSteps}
                   clickable={false}
                   current={workflowSteps.flatMap(step => step.state).indexOf(selectedProjectIdea.state)}
                   primary={selectedProjectIdea.state === "approved" ? "green" : (selectedProjectIdea.state === "disapproved" ? "red" : "blue") }
            />
            <FormGroup class="mt-5 px-4">
                <Label for="state">Next state</Label>
                <Input type="select" id="state" bind:value={selectedProjectIdea.state}>
                    {#each workflowStepsSelected as step}
                        <option value={step.action}>{step.state}</option>
                    {/each}
                </Input>
            </FormGroup>
        </Form>
    </ModalBody>
    <ModalFooter>
        <Button color="primary" on:click={updateStateProjectIdea}>Progress</Button>
        <Button color="secondary" on:click={() => modalOpenProgress = false}>Cancel</Button>
    </ModalFooter>
</Modal>