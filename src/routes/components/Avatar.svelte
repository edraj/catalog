<script>
    export let src = "";
    export let alt = "Avatar";
    export let size = "200px";
</script>

<img class="avatar" {src} {alt} height={size} width={size} />

<style>
    .avatar {
        border-radius: 50%;
        object-fit: cover;
    }
</style>