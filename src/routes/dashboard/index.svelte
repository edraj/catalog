<script lang="ts">
  import { getEntityAttachmentsCount, getEntities } from "@/lib/dmart_services";
  import { onMount } from "svelte";
  import { errorToastMessage } from "@/lib/toasts_messages";
  import { goto } from "@roxi/routify";
  import { Diamonds } from "svelte-loading-spinners";
  import { formatDate, renderStateString, truncateString } from "@/lib/helpers";
  $goto;
  import { _ } from "@/i18n";

  let isLoading: boolean = $state(true);
  let entities: any[] = $state([]);

  async function fetchEntities() {
    isLoading = true;
    const _entities = await getEntities({
      search: "",
      limit: 10,
      offset: 0,
      shortname: "",
    });
    if (_entities === null) {
      errorToastMessage("Failed to fetch entities!", true);
      entities = [];
    } else {
      entities = await Promise.all(
        _entities.map(async (item) => {
          const counts = await getEntityAttachmentsCount(item.shortname);
          return {
            is_active: item.attributes.is_active,
            shortname: item.shortname,
            owner: item.attributes.owner_shortname,
            tags: item.attributes.tags,
            state: item.attributes.state,
            created_at: formatDate(item.attributes.created_at),
            updated_at: formatDate(item.attributes.updated_at),
            ...item.attributes.payload.body,
            ...counts[0].attributes,
          };
        })
      );
    }
    isLoading = false;
  }

  onMount(async () => {
    await fetchEntities();
  });

  function gotoEntityDetails(entity: any) {
    $goto("/dashboard/[shortname]", {
      shortname: entity.shortname,
    });
  }

  function getStateIcon(entity: any) {
    if (entity.is_active === false) {
      return { icon: "❌", color: "text-red-600", bg: "bg-red-50" };
    } else if (entity.state === "pending") {
      return { icon: "⏳", color: "text-blue-600", bg: "bg-blue-50" };
    } else if (entity.state === "in_progress") {
      return { icon: "🔄", color: "text-amber-600", bg: "bg-amber-50" };
    } else if (entity.state === "approved") {
      return { icon: "✅", color: "text-green-600", bg: "bg-green-50" };
    } else if (entity.state === "rejected") {
      return { icon: "❌", color: "text-red-600", bg: "bg-red-50" };
    } else {
      return { icon: "❓", color: "text-gray-600", bg: "bg-gray-50" };
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="py-16 flex justify-center">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else}
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">
            {$_("Entities")}
          </h1>
          <p class="text-gray-600">
            {$_("ManageEntities")} ({entities.length}
            {$_("Total")})
          </p>
        </div>
        <button
          onclick={() => $goto("/dashboard/create_entity")}
          class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            ></path>
          </svg>
          {$_("CreateNewEntity")}
        </button>
      </div>

      {#if entities.length === 0}
        <div
          class="text-center py-16 bg-white rounded-xl border border-gray-200"
        >
          <div
            class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
          >
            <svg
              class="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h2 class="text-2xl font-semibold text-gray-900 mb-2">
            {$_("NoEntities")}
          </h2>
          <p class="text-gray-500 mb-6">
            {$_("CreateNewEntityMsg")}
          </p>
          <button
            onclick={() => $goto("/dashboard/create_entity")}
            class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200"
          >
            {$_("CreateNewEntityBtn")}
          </button>
        </div>
      {:else}
        <div class="space-y-4">
          {#each entities as entity}
            <div
              class="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer transition-all duration-200"
              role="button"
              tabindex="0"
              onclick={() => gotoEntityDetails(entity)}
              onkeydown={(e) => {
                if (e.key === "Enter") gotoEntityDetails(entity);
              }}
            >
              <div class="p-6">
                <div class="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div class="flex-1 min-w-0">
                    <div
                      class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4"
                    >
                      <div class="flex-1 min-w-0">
                        <h2
                          class="text-xl font-semibold text-gray-900 group-hover:text-blue-700 transition-colors duration-200 mb-2 line-clamp-2"
                        >
                          {entity.title}
                        </h2>
                        <div
                          class="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3"
                        >
                          <span class="flex items-center gap-1.5">
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              ></path>
                            </svg>
                            {entity.owner}
                          </span>
                          <span class="flex items-center gap-1.5">
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              ></path>
                            </svg>
                            {entity.updated_at}
                          </span>
                        </div>
                      </div>
                    </div>

                    {#if entity.content}
                      <div class="text-gray-600 mb-4 line-clamp-2">
                        {@html truncateString(entity.content)}
                      </div>
                    {/if}

                    {#if entity.tags && entity.tags.length > 0}
                      <div class="flex flex-wrap gap-2 mb-4">
                        {#each entity.tags.slice(0, 4) as tag}
                          <span
                            class="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
                          >
                            #{tag}
                          </span>
                        {/each}
                        {#if entity.tags.length > 4}
                          <span
                            class="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium"
                          >
                            +{entity.tags.length - 4} more
                          </span>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <div
                    class="flex lg:flex-col items-center lg:items-end gap-4 lg:gap-3"
                  >
                    <div class="block">
                      <div class="mb-8">
                        {#if getStateIcon(entity)}
                          <span
                            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium {getStateIcon(
                              entity
                            ).color} {getStateIcon(entity).bg}"
                          >
                            <span class="text-base"
                              >{getStateIcon(entity).icon}</span
                            >
                            {renderStateString(entity)}
                          </span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-6 lg:gap-4">
                        <div class="text-center">
                          <div
                            class="flex items-center gap-1.5 text-red-600 mb-1"
                          >
                            <span class="font-semibold text-lg me-2"
                              >{entity.reaction ?? 0}</span
                            >
                            <svg
                              class="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                              />
                            </svg>
                          </div>
                          <span class="text-xs text-gray-500 font-medium">
                            {$_("Reactions")}
                          </span>
                        </div>

                        <div class="text-center">
                          <div
                            class="flex items-center gap-1.5 text-blue-600 mb-1"
                          >
                            <span class="font-semibold text-lg me-2"
                              >{entity.comment ?? 0}</span
                            >
                            <svg
                              class="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                              />
                            </svg>
                          </div>
                          <span class="text-xs text-gray-500 font-medium">
                            {$_("Comments")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex-shrink-0">
                      <svg
                        class="w-6 h-6 ltr:rotate-0 rtl:rotate-180 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        ></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
