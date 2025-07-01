<script lang="ts">
    import { Sidebar, SidebarGroup, SidebarItem, SidebarWrapper } from 'flowbite-svelte';
    import { ChartPieSolid, GridSolid, MailBoxSolid, UserSolid } from 'flowbite-svelte-icons';
    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();

    let spanClass = 'pl-2 self-center text-sm text-gray-900 whitespace-nowrap dark:text-white';
</script>

<div class="flex h-screen bg-gray-50">
    <SidebarWrapper class="w-64 h-full">
        <Sidebar class="w-full h-full">
            <SidebarGroup>
                <SidebarItem label="Users" href="/dashboard/admin/users">
                    {#snippet icon()}
                                    
                            <UserSolid class="w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                        
                                    {/snippet}
                </SidebarItem>
                <SidebarItem label="Posts" href="/dashboard/admin/posts">
                    {#snippet icon()}
                                    
                            <MailBoxSolid class="w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                        
                                    {/snippet}
                </SidebarItem>
            </SidebarGroup>
        </Sidebar>
    </SidebarWrapper>
    
    <div class="flex-1 overflow-auto p-4">
        {@render children?.()}
    </div>
</div>
