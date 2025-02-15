<script>
    import {onMount} from "svelte";
    import {getProfile} from "@/lib/dmart_services";
    import { goto } from '@roxi/routify';
    $goto

    onMount(async()=>{
        const profile = await getProfile();
        if(profile.attributes.roles.includes("super_admin")){
            $goto("/dashboard/admin");
        }
        console.log(profile)
    })
</script>

<slot />