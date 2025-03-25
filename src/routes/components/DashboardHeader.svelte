<script lang="ts">
    import {Nav, Navbar, NavbarBrand, NavItem, NavLink} from "sveltestrap";
    import SearchBar from "@/routes/components/SearchBar.svelte";
    import {onDestroy, onMount} from "svelte";
    import {website} from "@/config.js";
    import {newNotificationType} from "@/stores/newNotificationType";

    let ws = $state(null);

    onMount(() => {
        if (isWSOpen(ws)) {
            ws.send(JSON.stringify({type: "notification_unsubscribe"}));
        }
        if ("websocket" in website) {
            try {
                const authToken = localStorage.getItem("authToken") || "";
                ws = new WebSocket(`${website.websocket}?token=${authToken}`);
            } catch (e) {
                console.error({e});
            }
        }

        ws.onopen = () => {
            ws.send(
                JSON.stringify({
                    type: "notification_subscription",
                    space_name: "catalog",
                    subpath: "__ALL__",
                })
            );
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event?.data ?? "");
            if(data.type === "notification"){
                if (data?.message?.action_type === 'create') {
                    if(data?.message?.resource_type === 'reaction'){
                        $newNotificationType = 'create_reaction';
                    } else if(data?.message?.resource_type === 'comment') {
                        $newNotificationType = 'create_comment';
                    }
                } else if (data?.message?.action_type === 'progress_ticket') {
                    $newNotificationType = 'progress';
                }
            }
        };
    });

    onDestroy(() => {
        if (ws != null) ws.close();
    });

    function isWSOpen(ws: any) {
        return ws != null && ws.readyState === ws.OPEN;
    }
    function isWSClosed(ws: any) {
        return ws == null || ws.readyState !== ws.OPEN;
    }

    function renderNotificationIconColor(){
        const _icon = "bi bi-bell-fill";

        switch ($newNotificationType) {
            case 'create_comment':
                return _icon + ' text-primary';
            case 'create_reaction':
                return _icon + ' text-danger';
            case 'progress':
                return _icon + ' text-warning';
            default:
                return _icon;
        }
    }

    $effect(()=>{
        renderNotificationIconColor()
    })
</script>

<Navbar color="light" light expand="md">
    <NavbarBrand href="/">Catalog</NavbarBrand>
    <Nav class="ml-auto" navbar>
        <NavItem>
            <SearchBar />
        </NavItem>
        <NavItem>
            <NavLink href="/notifications">
                <i class={renderNotificationIconColor()}></i>
            </NavLink>
        </NavItem>
        <NavItem>
            <NavLink href="/me">
                <i class="bi bi-person-circle"></i>
            </NavLink>
        </NavItem>
    </Nav>
</Navbar>