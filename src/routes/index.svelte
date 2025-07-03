<script lang="ts">
  import { user } from "@/stores/user";
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold">Welcome {$user.localized_displayname}</h1>
</div>
