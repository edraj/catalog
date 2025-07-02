<script>
    import DashboardHeader from "@/routes/components/DashboardHeader.svelte";

    import {signout, user} from "@/stores/user";
    import {onMount} from "svelte";
    import {getProfile} from "@/lib/dmart_services";
    import { goto } from '@roxi/routify';
    import Dmart from "@edraj/tsdmart";
    import {website} from "@/config";
    import axios from "axios";
    $goto

    Dmart.baseURL = website.backend;

    axios.interceptors.response.use((config) => {
        if(config.status === 401){
            $goto("/login");
        }
        return config;
    });


    onMount(async () => {
        const p = await getProfile();

        if(p === null || p?.error?.type === 'jwtauth'){
            await signout();
            $goto("/login");
        } else {
            $goto("/dashboard");
        }
    });
</script>


<DashboardHeader />

<slot />
