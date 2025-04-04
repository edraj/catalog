<script lang="ts">
    import {params} from "@roxi/routify"
    import {
        checkCurrentUserReactedIdea,
        createComment,
        createReaction,
        deleteReactionComment,
        getAvatar,
        getCatalogWorkflow,
        getEntityAttachmentsCount,
        getEntity,
        progressEntity
    } from "@/lib/dmart_services";
    import {formatDate} from "@/lib/helpers";
    import {
        Button,
        Card,
        CardBody,
        Col,
        Container,
        Input,
        InputGroup,
        InputGroupText,
        Row
    } from "sveltestrap";
    import Attachments from "@/routes/components/Attachments.svelte";
    import Dmart, {RequestType, ResourceType} from "@edraj/tsdmart";
    import {user} from "@/stores/user";
    import {errorToastMessage, successToastMessage} from "@/lib/toasts_messages";
    import {goto} from "@roxi/routify";
    $goto
    import {onMount} from "svelte";
    import Avatar from "@/routes/components/Avatar.svelte";
    import {Diamonds} from "svelte-loading-spinners";

    let entity = $state(null);
    let isLoading = $state(false);
    let isLoadingPage: boolean = $state(true);
    let isOwner = $state(false);
    let userReactionEntry = $state(null);

    let workflows: any = $state({});
    let workflowSteps = $state([]);

    let counts: any = $state({});
    let isAdmin = JSON.parse(localStorage.getItem("roles") ?? '[]').includes("super_admin");
    onMount(async ()=>{
        isLoadingPage = true;
        await refreshIdea();
        isOwner = $user.shortname === entity.owner_shortname
        await refreshCounts();
        workflows = await getCatalogWorkflow();
        if (Object.keys(workflows).length){
            await refreshIdeaState();
        } else if (workflows === null) {
            errorToastMessage("Failed to fetch workflow!", true);
        }
        isLoadingPage = false;
    })

    function handleEdit(entity) {
        $goto(`/dashboard/{shortname}/edit`, {
            shortname: entity.shortname
        });
    }

    async function handlePublish(isActive) {
        const response = await Dmart.request({
            space_name: "catalog",
            request_type: RequestType.update,
            records: [
                {
                    resource_type: ResourceType.ticket,
                    shortname: $params.shortname,
                    subpath: "posts",
                    attributes: {
                        is_active: !isActive
                    }
                }
            ]
        });

        if(response.status === "success"){
            window.location.reload();
        } else {
            errorToastMessage(response.error.message);
        }
    }

    let comment = $state("");
    async function handleAddComment(){
        if(comment) {
           const response =  await createComment($params.shortname, comment)
              if(response){
                successToastMessage("Comment added successfully");
                comment = "";
                await refreshIdea();
              } else {
                errorToastMessage("Failed to add comment!");
              }
        }
    }

    async function deleteComment(shortname: string){
        const response = deleteReactionComment(
            ResourceType.comment,
            `posts/${entity.shortname}`,
            shortname
        )

        if(response){
            await refreshIdea();
            successToastMessage("Comment deleted successfully");
        } else {
            errorToastMessage("Failed to delete the comment!");
        }
    }

    async function handleReaction(){
        let response = null;
        if(userReactionEntry === null){
            response = await createReaction($params.shortname)
        } else {
            response = await deleteReactionComment(
                ResourceType.reaction,
                `posts/${entity.shortname}`,
                userReactionEntry
            )
        }
        if(response){
            await refreshCounts();
        } else {
            errorToastMessage("Failed to react!");
        }
    }

    async function refreshIdea(){
        entity = await getEntity($params.shortname)
        await refreshCounts();
    }

    async function refreshCounts() {
        const _counts = await getEntityAttachmentsCount(entity.shortname)

        userReactionEntry = await checkCurrentUserReactedIdea($user.shortname, entity.shortname)
        counts = _counts[0].attributes
    }

    async function refreshIdeaState(){
        const _workflow = workflows.states.filter((state: any) => state.state === entity.state);
        if(_workflow.length === 0) {
            errorToastMessage("Entity is in invalid state!", true);
        } else if(_workflow.length > 1) {
            errorToastMessage("Entity has a corrupted workflow!", true);
        } else {
            workflowSteps = _workflow[0].next.map((state: any) => {
                return {
                    ...state,
                    title: (workflows.states.filter((_state: any) => state.state === _state.state)??[{name:"N/A"}])[0].name
                }
            });
        }
    }

    async function handleProgressTicket(state: string){
        const response = await progressEntity($params.shortname, state);
        if(response){
            successToastMessage("Ticket progressed successfully");
            await refreshIdea();
            await refreshIdeaState();
        } else {
            errorToastMessage("Failed to progress ticket!");
        }
    }

</script>


<Container class="my-5">
    <Button class="mb-5" onclick={()=>history.back()}>{isLoading ? "...." : "Back"}</Button>
    {#if isLoadingPage}
        <div class="py-5 d-flex justify-content-center">
            <Diamonds color="black" size="200" unit="px" />
        </div>
    {:else}
        {#if isOwner || isAdmin}
            <div class="alert alert-secondary d-flex justify-content-between align-items-center mb-5">
                {#if entity.is_open}
                    <p style="margin: 0!important;">
                        {entity.is_active ? `Last update: ${formatDate(entity.updated_at)}` : "This is draft"}
                    </p>
                    <div>
                    <Button color="primary" onclick={()=>handleEdit(entity)}>{isLoading ? "...." : "Edit"}</Button>
                    |
                    <Button color={entity.is_active ? "danger" : "success"} onclick={()=>handlePublish(entity.is_active)}>{isLoading ? "......." : (entity.is_active ? "Unpublish" : "Publish")}</Button>

                    {#if isAdmin}
                        |
                        {#each workflowSteps as workflowStep}
                            <Button class="mx-1" color="warning" onclick={()=>handleProgressTicket(workflowStep.action)}>{workflowStep.title}</Button>
                        {/each}
                    {/if}
                </div>
                {:else}
                    <p class="w-100 text-center " style="margin: 0!important;">This entity is closed</p>
                {/if}
            </div>
        {/if}
        <Row>
            <Col sm="12">
                <h1>{entity.payload.body.title}</h1>
                <h6 class="text-secondary fw-bold">{formatDate(entity.updated_at)}</h6>
                <p class="text-secondary">{entity.payload.body.long_description}</p>


                <div class="my-4" style="font-size: 1.25rem">
                    <i class="bi bi-chat-left-text-fill"></i> {counts.comment ?? 0}
                    <i class="bi {entity.is_active ? 'bi-check-lg text-success' : 'bi-x-lg text-danger' }"></i> {entity.is_active ? 'Active' : 'Inactive'}
                </div>

                <div>
                    {#each entity.tags as tag}
                        <span class="badge bg-secondary me-1" style="font-size: 1rem">{tag}</span>
                    {/each}
                </div>

                <p class="mt-3" style="font-size: 1.5rem">{entity.owner_shortname}</p>

                <div class="my-5">
                    {@html entity.payload.body.content}
                </div>

                <Attachments
                    resource_type={ResourceType.ticket}
                    space_name={"catalog"}
                    subpath={"posts"}
                    parent_shortname={entity.shortname}
                    attachments={Object.values(entity.attachments.media ?? [])}
                    isOwner={isOwner}
                />

                <Card>
                    <CardBody>
                        <div class="comment-section mt-3">
                            {#if (entity.attachments.comment ?? []).length === 0}
                                <p class="text-center">No comments yet.</p>
                            {:else}
                                {#each (entity.attachments.comment ?? []) as comment}
                                    <div class="d-flex justify-content-between my-2">
                                        <Row class="justify-content-between">
                                            <Col sm="1" class="px-3">
                                                {#await getAvatar(comment.attributes.owner_shortname) then avatar}
                                                    <Avatar src={avatar} size="32"/>
                                                {/await}
                                            </Col>
                                            <Col sm="10">
                                                <div style="font-size: 1.5rem">
                                                    <span>{comment.attributes.owner_shortname}</span>
                                                    •
                                                    <span>{formatDate(comment.attributes.created_at)}</span>
                                                </div>

                                                {comment.attributes.payload.body.body}
                                            </Col>
                                        </Row>
                                        {#if isOwner}
                                            <div style="cursor: pointer" onclick={()=>deleteComment(comment.shortname)}>
                                                <i class="bi bi-trash-fill text-danger"></i>
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody>
                        <Row>
                            <Col sm="1">
                                <Button color="light" onclick={handleReaction}>
                                    <i class="bi bi-heart-fill" style={userReactionEntry ? "color: red" : ""}></i> {counts.reaction ?? 0}
                                </Button>
                            </Col>
                            <Col sm="11">
                                <InputGroup>
                                    <Input placeholder="Add a comment" bind:value={comment}/>
                                    <InputGroupText onclick={handleAddComment}>
                                        <i class="bi bi-send"></i>
                                    </InputGroupText>
                                </InputGroup>
                            </Col>
                        </Row>
                    </CardBody>
                </Card>
            </Col>
        </Row>
    {/if}
</Container>

<style>
    .comment-section {
        max-height: 25vh;
        overflow-y: auto;
    }
</style>
