<script lang="ts">
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
      switch ($newNotificationType) {
          case 'create_comment':
              return 'text-blue-600';
          case 'create_reaction':
              return 'text-red-600';
          case 'progress':
              return 'text-amber-600';
          default:
              return 'text-gray-600';
      }
  }

  $effect(()=>{
      renderNotificationIconColor()
  })
</script>

<header class="sticky top-0 z-40 w-full border-b border-gray-200 bg-white backdrop-blur supports-[backdrop-filter]:bg-white/60">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
          <div class="flex items-center">
              <a href="/" class="flex items-center space-x-2">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                      <svg class="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                  </div>
                  <span class="font-bold text-xl text-gray-900 sm:inline-block">Catalog</span>
              </a>
          </div>

          <div class="flex items-center space-x-4">
              <SearchBar />
              
              <a 
                href="/dashboard" 
                class="flex items-center mx-2 justify-center w-10 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                aria-label="Dashboard"
              >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <rect width="5" height="5" fill="white"></rect> <path d="M15.024 22C16.2771 22 17.3524 21.9342 18.2508 21.7345C19.1607 21.5323 19.9494 21.1798 20.5646 20.5646C21.1798 19.9494 21.5323 19.1607 21.7345 18.2508C21.9342 17.3524 22 16.2771 22 15.024V12C22 10.8954 21.1046 10 20 10H12C10.8954 10 10 10.8954 10 12V20C10 21.1046 10.8954 22 12 22H15.024Z" fill="#323232"></path> <path d="M2 15.024C2 16.2771 2.06584 17.3524 2.26552 18.2508C2.46772 19.1607 2.82021 19.9494 3.43543 20.5646C4.05065 21.1798 4.83933 21.5323 5.74915 21.7345C5.83628 21.7538 5.92385 21.772 6.01178 21.789C7.09629 21.9985 8 21.0806 8 19.976L8 12C8 10.8954 7.10457 10 6 10H4C2.89543 10 2 10.8954 2 12V15.024Z" fill="#323232"></path> <path d="M8.97597 2C7.72284 2 6.64759 2.06584 5.74912 2.26552C4.8393 2.46772 4.05062 2.82021 3.4354 3.43543C2.82018 4.05065 2.46769 4.83933 2.26549 5.74915C2.24889 5.82386 2.23327 5.89881 2.2186 5.97398C2.00422 7.07267 2.9389 8 4.0583 8H19.976C21.0806 8 21.9985 7.09629 21.789 6.01178C21.772 5.92385 21.7538 5.83628 21.7345 5.74915C21.5322 4.83933 21.1798 4.05065 20.5645 3.43543C19.9493 2.82021 19.1606 2.46772 18.2508 2.26552C17.3523 2.06584 16.2771 2 15.024 2H8.97597Z" fill="#323232"></path> </g></svg>
              </a>
              <a 
                  href="/notifications" 
                  class="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                  aria-label="Notifications"
              >
                  <svg class="w-5 h-5 {renderNotificationIconColor()}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                  </svg>
                  {#if $newNotificationType}
                      <span class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white"></span>
                  {/if}
              </a>
              
              <a 
                  href="/me" 
                  class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                  aria-label="Profile"
              >
                  <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
              </a>
          </div>
      </div>
  </div>
</header>
