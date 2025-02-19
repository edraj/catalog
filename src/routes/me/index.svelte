<script lang="ts">
    import {Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row} from "sveltestrap";
    import {onMount} from "svelte";
    import {getAvatar, getIdeaAttachmentsCount, getProfile, getProjectIdeas, updateProfile} from "@/lib/dmart_services";
    import {Button} from "sveltestrap";
    import {errorToastMessage, successToastMessage} from "@/lib/toasts_messages";
    import Avatar from "@/routes/components/Avatar.svelte";
    import {formatDate, renderStateString, truncateString} from "@/lib/helpers";
    import {goto} from "@roxi/routify";
    $goto

    let profileSection : string  = $state("ME");

    let user = $state(null);
    let avatar = $state(null);
    let ideas = $state([]);
    let displayname = $state("");
    let description = $state("");

    onMount(async () => {
        user = await getProfile();
        displayname = user.attributes.displayname.en ?? "";
        description = user.attributes?.description?.en ?? "";

        avatar = await getAvatar(user.shortname);

        const _ideas = await getProjectIdeas(15, 0, user.shortname);
        if (_ideas === null) {
            errorToastMessage("Failed to fetch project ideas.", true);
            ideas = [];
        }
        else {
            for (const item of _ideas) {
                const counts = await getIdeaAttachmentsCount(item.shortname)

                ideas.push({
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
    function handleIdeas() {
        profileSection = "IDEAS";
    }
    function gotoIdeaDetails(projectIdea: any){
        $goto(`/dashboard/{shortname}`, {
            shortname: projectIdea.shortname
        });
    }

</script>


<Container class="mt-5">
    <div style="font-size: 2rem">
        <span style="cursor: pointer" class={profileSection === "ME" ? "fw-bold" : ""} onclick={handleME}>My profile</span>
        |
        <span style="cursor: pointer" class={profileSection === "IDEAS" ? "fw-bold" : ""} onclick={handleIdeas}>My ideas</span>
    </div>
    {#if user === null}
        <h1>Loading...</h1>
    {:else}
        {#if profileSection === "ME"}
            <Row>
                <Col class="d-flex justify-content-center align-items-center" sm="3">
                    <Avatar src={avatar}/>
                </Col>
                <Col sm="9">
                    <Card>
                        <CardHeader>Preference</CardHeader>
                        <CardBody>
                            <Form on:submit={handleSubmit}>
                                <Label>Display name</Label>
                                <Input type="text" required bind:value={displayname} />

                                <Label class="mt-3">Description</Label>
                                <Input type="textarea" required bind:value={description} />

                                <Button type="submit" color="dark" class="w-100 mt-3">Save</Button>
                            </Form>
                        </CardBody>
                    </Card>
                </Col>
            </Row>
            <Row>
                <Col sm="3">
                </Col>
                {#if user}
                    <Col sm="9">
                        <Card class="mt-5">
                            <CardHeader>Settings</CardHeader>
                            <CardBody style="font-size: 1.5rem">
                                <p><span class="fw-bold">Email </span><br>{user.attributes?.email ?? "N/A"}</p>
                                <p><span class="fw-bold">Mobile number </span><br>{user.attributes?.msisdn ?? "N/A"}</p>
                                <p class="text-center mt-5">To change these settings, contcat administrator</p>
                            </CardBody>
                        </Card>
                    </Col>
                {/if}
            </Row>
        {:else}
            {#if ideas.length === 0}
                <h1 class="text-center mt-5">No project ideas found.</h1>
            {:else}
                {#each ideas as projectIdea}
                    <Card class="my-4" style="cursor: pointer" on:click={()=>gotoIdeaDetails(projectIdea)}>
                        <CardBody>
                            <Row>
                                <Col sm="4">
                                    <h1>{projectIdea.title}</h1>
                                    <h6 class="text-secondary fw-bold">{projectIdea.updated_at}</h6>
                                </Col>
                                <Col sm="4" class="d-flex justify-content-center align-items-center">
                                    <span class="mx-2"><i class="bi bi-heart-fill text-danger"></i> {projectIdea.reaction ?? 0}</span>
                                    <span class="mx-2"><i class="bi bi-chat-left-text-fill text-primary"></i> {projectIdea.comment ?? 0}</span>
                                </Col>
                                <Col sm="4" class="d-flex justify-content-center align-items-center">
                                    {renderStateString(projectIdea)}
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                {/each}
            {/if}
        {/if}
    {/if}
</Container>