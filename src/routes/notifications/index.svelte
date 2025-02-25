<script lang="ts">
    import {Container} from "sveltestrap";
    import {fetchMyNotifications, getAvatar, getProjectIdea, markNotification} from "@/lib/dmart_services";
    import {user} from "@/stores/user";
    import {onMount} from "svelte";
    import {Card, CardBody, Col, Row} from "sveltestrap";
    import {formatDate} from "@/lib/helpers";
    import Avatar from "@/routes/components/Avatar.svelte";
    import {SyncLoader} from "svelte-loading-spinners";
    import {newNotificationType} from "@/stores/newNotificationType";
    import {ResourceType} from "@edraj/tsdmart";
    import {goto} from "@roxi/routify";
    $goto


    let notifications = $state([]);
    let isNotificationsLoading = $state(false)

    onMount(async ()=>{
        $newNotificationType = '';
        await loadNotifications()
    })

    async function loadNotifications(){
        isNotificationsLoading = true;
        let _notifications = await fetchMyNotifications($user.shortname)

        const __notifications = await Promise.all(_notifications.map(async notification => {
            const {action_by, entry_shortname, parent_shortname, entry_subpath, resource_type, is_read} = notification.attributes.payload.body;

            const resourceTypeString = (function () {
                switch (resource_type){
                    case "ticket":
                        return "new updates";
                    case "reaction":
                        return "reacted";
                    case "comment":
                        return "New comment"
                }
            })();

            let idea = await getProjectIdea(resource_type===ResourceType.ticket ? entry_shortname : parent_shortname)

            let _notification: any = {
                parent_shortname,
                shortname: notification.shortname,
                created_at: formatDate(notification.attributes.created_at),
                action_by,
                entry_shortname,
                entry_subpath,
                resource_type,
                resourceTypeString: resourceTypeString,
                is_read
            }

            if(idea){
                _notification.title = idea.payload.body.title
                if(_notification.resource_type === ResourceType.comment){
                    const r = (idea.attachments.comment ?? []).filter(c => {
                        return c.shortname === notification.attributes.payload.body.entry_shortname
                    })
                    if(r.length){
                        _notification.body = r[0].attributes.payload.body.body
                    }
                }

            }

            return _notification
        }))
        if(notifications.length === 0){
            notifications = __notifications
        } else {
            const newNotifications = __notifications.filter(__notification => {
                return !notifications.some(notification => __notification.shortname === notification.shortname);
            });

            const removedNotifications = notifications.filter(notification => {
                return !__notifications.some(__notification => __notification.shortname === notification.shortname);
            });

            notifications = notifications.filter(notification => {
                return !removedNotifications.some(removedNotification => removedNotification.shortname === notification.shortname);
            });

            notifications = [...notifications, ...newNotifications];
        }

        isNotificationsLoading = false;
    }

    async function handleNotificationClick(notification){
        await markNotification($user.shortname, notification.shortname)
        $goto("/dashboard/{shortname}", {shortname: notification.parent_shortname});
    }

    $effect(()=>{
        if($newNotificationType) {
            loadNotifications().then((_)=>{
                $newNotificationType = '';
            });
        }
    })
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
        <Card class="my-4 {notification.is_read === 'yes' ? '' : 'border-primary'}" style="cursor: pointer"
              onclick={(e)=>handleNotificationClick(notification)}>
            <CardBody>
                <Row>
                    <Col sm="2" class="d-flex justify-content-center align-items-center">
                        {#await getAvatar(notification.action_by) then avatar}
                            <Avatar src={avatar} size="72"/>
                        {/await}
                    </Col>
                    <Col sm="10">
                        <h1>{notification.action_by}</h1>
                        <h2>{notification.title}</h2>
                        {#if notification.resource_type === ResourceType.reaction}
                            <h3>Has {notification.resourceTypeString} to your post</h3>
                        {:else if notification.resource_type === ResourceType.ticket}
                            <h3>Has {notification.resourceTypeString} for your idea</h3>
                        {:else if notification.resource_type === ResourceType.comment}
                            <h3><span class="fw-bold">{notification.resourceTypeString}</span>: {notification.body}</h3>
                        {/if}
                        <h6 class="text-secondary fw-bold">{notification.created_at}</h6>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    {/each}
</Container>