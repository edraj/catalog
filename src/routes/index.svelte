<script lang="ts">
    import { goto } from '@roxi/routify';
    import {signout, user} from "@/stores/user";
    import {onMount} from "svelte";
    import {getProfile} from "@/lib/dmart_services";
    $goto

    onMount(async () => {
       const p = await getProfile();
         if(p === null){
             signout();
             $goto("/login");
         }
    });
</script>
