<script>
    import {Container} from "sveltestrap";
    import {fetchMyNotifications, getAvatar} from "@/lib/dmart_services";
    import {user} from "@/stores/user";
    import {onMount} from "svelte";
    import {Card, CardBody, Col, Row} from "sveltestrap";
    import {formatDate} from "@/lib/helpers";
    import Avatar from "@/routes/components/Avatar.svelte";
    import {SyncLoader} from "svelte-loading-spinners";

    let notifications = $state([]);
    let isNotificationsLoading = $state(false)
    onMount(async ()=>{
        isNotificationsLoading = true;
        const _notifications = await fetchMyNotifications($user.shortname)
        notifications = _notifications.map(notification => {
            const {action_by, entry_shortname, entry_subpath, resource_type, is_read} = notification.attributes.payload.body;

            const resourceTypeString = (function () {
                switch (resource_type){
                    case "reaction":
                        return "REACTED";
                    case "comment":
                        return "COMMENTED"
                }
             })();

            return {
                shortname: notification.shortname,
                created_at: formatDate(notification.attributes.created_at),
                action_by,
                entry_shortname,
                entry_subpath,
                resource_type,
                resourceTypeString: resourceTypeString,
                is_read
            }
        })
        isNotificationsLoading = false;
    })

    async function handleNotificationClick(notification){

    }
</script>

<Container class="mt-5">
    <h1>Notifications</h1>
    {#if isNotificationsLoading}
        <div class="d-flex justify-content-center">
            <SyncLoader color="black" size="50" unit="px"/>
        </div>
    {/if}

    {#if !isNotificationsLoading && notifications.length === 0}
        <h4 class="text-center mt-5">No notification at the moment.</h4>
    {/if}

    {#each notifications as notification}
        <Card class="my-4" style="cursor: pointer"
              onclick={(e)=>handleNotificationClick(notification)}>
            <CardBody>
                <Row>
                    <Col sm="2" class="d-flex justify-content-center align-items-center">
                        {#await getAvatar(notification.action_by) then avatar}
                            <Avatar src={avatar} size="72"/>
                        {/await}
                    </Col>
                    <Col sm="10">
                        <h1>{notification.action_by} has {notification.resourceTypeString} to your post</h1>
                        <h6 class="text-secondary fw-bold">{notification.created_at}</h6>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    {/each}
</Container>