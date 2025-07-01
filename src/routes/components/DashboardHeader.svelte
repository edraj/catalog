<script lang="ts">
    import { Navbar, NavBrand, NavLi, NavUl } from 'flowbite-svelte';
    import SearchBar from "./SearchBar.svelte";
    import { onDestroy, onMount } from "svelte";
    import { website } from "@/config.js";
    import { newNotificationType } from "@/stores/newNotificationType";

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

<Navbar class="bg-white border-b border-gray-200 expand-md" >
    <NavBrand href="/">
      <span class="self-center whitespace-nowrap text-xl font-semibold text-gray-900">Catalog</span>
    </NavBrand>
    <NavUl class="ml-auto flex gap-2 items-center">
      <NavLi>
        <SearchBar />
      </NavLi>
      <NavLi>
        <a href="/notifications" class="block py-2 px-2 text-gray-900 hover:text-primary" aria-label="Notifications">
          <i class={`${renderNotificationIconColor()} text-xl`}></i>
        </a>
      </NavLi>
      <NavLi>
        <a href="/me" class="block py-2 px-2 text-gray-900 hover:text-primary" aria-label="Profile">
          <i class="bi bi-person-circle text-xl"></i>
        </a>
      </NavLi>
    </NavUl>
  </Navbar>