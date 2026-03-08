<script>
    import { onMount } from "svelte";
    import { goto } from "@roxi/routify";

    $goto;

    onMount(() => {
        $goto("/dashboard/admin");
    });
</script>
