<script>
  export let src = "";
  export let alt = "Avatar";
  export let size = "200px";
</script>

<img
  class="avatar"
  src={src ?? "https://avatar.iran.liara.run/public/37"}
  {alt}
  height={size}
  width={size}
/>

<style>
  .avatar {
    border-radius: 50%;
    object-fit: cover;
  }
</style>
