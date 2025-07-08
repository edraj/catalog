<script lang="ts">
  import { onMount } from "svelte";
  import {
    getAvatar,
    getEntityAttachmentsCount,
    getProfile,
    getEntities,
    updateProfile,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import Avatar from "@/routes/components/Avatar.svelte";
  import { formatDate, renderStateString } from "@/lib/helpers";
  import { goto } from "@roxi/routify";
  import { Diamonds } from "svelte-loading-spinners";
  $goto;
  import { _ } from "@/i18n";

  // let profileSection: string = $state("ME");

  const ProfileSection = {
    ME: "ME",
    IDEAS: "IDEAS",
  };
  let profileSection: string = $state(ProfileSection.ME);

  let isLoading = $state(true);
  let user = $state(null);
  let avatar = $state(null);
  let entities = $state([]);
  let displayname = $state("");
  let description = $state("");

  onMount(async () => {
    isLoading = true;
    user = await getProfile();
    displayname = user.attributes.displayname.en ?? "";
    description = user.attributes?.description?.en ?? "";

    avatar = await getAvatar(user.shortname);

    const _entities = await getEntities({
      limit: 15,
      offset: 0,
      shortname: user.shortname,
      search: `@owner_shortname:${user.shortname}`,
    });
    if (_entities === null) {
      errorToastMessage("Failed to fetch entities!", true);
      entities = [];
    } else {
      for (const item of _entities) {
        const counts = await getEntityAttachmentsCount(item.shortname);

        entities.push({
          shortname: item.shortname,
          owner: item.attributes.owner_shortname,
          tags: item.attributes.tags,
          state: item.attributes.state,
          is_active: item.attributes.is_active,
          created_at: formatDate(item.attributes.created_at),
          updated_at: formatDate(item.attributes.updated_at),
          ...item.attributes.payload.body,
          ...counts[0].attributes,
        });
      }
    }
    isLoading = false;
  });

  async function handleSubmit(event) {
    event.preventDefault();

    const response = await updateProfile({
      shortname: user.shortname,
      displayname,
      description,
    });
    if (response) {
      successToastMessage("Profile updated successfully");
    } else {
      errorToastMessage("Error updating profile");
    }
  }

  function handleME() {
    profileSection = ProfileSection.ME;
  }
  function handleEntities() {
    profileSection = ProfileSection.IDEAS;
  }

  function gotoEntityDetails(entity: any) {
    $goto(`/dashboard/{shortname}`, {
      shortname: entity.shortname,
    });
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <div class="mb-8">
      <nav class="flex space-x-8 border-b border-gray-200">
        <button
          class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {profileSection ===
          'ME'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          onclick={handleME}
        >
          {$_("MyProfile")}
        </button>
        <button
          class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {profileSection ===
          'IDEAS'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          onclick={handleEntities}
        >
          {$_("MyEntities")} ({entities.length})
        </button>
      </nav>
    </div>

    {#if isLoading}
      <div class="flex justify-center py-16">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else if profileSection === "ME"}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1">
          <div
            class="bg-white d-flex flex-col align-items-center rounded-xl border border-gray-200 p-6 text-center"
          >
            <div class="mb-6">
              <Avatar src={avatar} size="120" />
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">
              {displayname || user.shortname}
            </h2>
            <p class="text-gray-600 text-sm">@{user.shortname}</p>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-6">
            {$_("ProfilePreferences")}
          </h3>
          <form onsubmit={handleSubmit} class="space-y-6">
            <div>
              <label
                for="displayname"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("DisplayName")}
              </label>
              <input
                id="displayname"
                type="text"
                required
                bind:value={displayname}
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                placeholder={$_("DisplayNamePlaceholder")}
              />
            </div>

            <div>
              <label
                for="description"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("Description")}
              </label>
              <textarea
                id="description"
                required
                bind:value={description}
                rows="4"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 resize-none"
                placeholder={$_("DescriptionPlaceholder")}
              ></textarea>
            </div>

            <button
              type="submit"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {$_("SaveChanges")}
            </button>
          </form>
        </div>

        {#if user}
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-6">
              {$_("AccountSettings")}
            </h3>
            <div class="space-y-6">
              <div
                class="flex justify-between items-start py-3 border-b border-gray-100"
              >
                <div>
                  <h4 class="font-medium text-gray-900">
                    {$_("EmailAddress")}
                  </h4>
                  <p class="text-gray-600 text-sm mt-1">
                    {user.attributes?.email ?? "Not provided"}
                  </p>
                </div>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {user.attributes?.email ? $_("Verified") : $_("NotSet")}
                </span>
              </div>

              <div
                class="flex justify-between items-start py-3 border-b border-gray-100"
              >
                <div>
                  <h4 class="font-medium text-gray-900">
                    {$_("MobileNumber")}
                  </h4>
                  <p class="text-gray-600 text-sm mt-1">
                    {user.attributes?.msisdn ?? "Not provided"}
                  </p>
                </div>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {user.attributes?.msisdn ? $_("Verified") : $_("NotSet")}
                </span>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex">
                  <svg
                    class="w-5 h-5 text-blue-600 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div class="ms-3">
                    <h4 class="text-sm font-medium text-blue-800">
                      {$_("ContactAdmin")}
                    </h4>
                    <p class="text-sm text-blue-700 mt-1">
                      {$_("ContactAdmin2")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else if entities.length === 0}
      <div class="text-center py-16">
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
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          {$_("NoEntities")}
        </h3>
        <p class="text-gray-600">
          {$_("CreateNewEntityMsg")}
        </p>
      </div>
    {:else}
      <div class="grid gap-6">
        {#each entities as entity}
          <div
            class="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer transition-all duration-200"
            role="button"
            tabindex="0"
            onclick={() => gotoEntityDetails(entity)}
            onkeydown={(e) => {
              if (e.key === "Enter") gotoEntityDetails(entity);
            }}
          >
            <div class="p-6">
              <div
                class="flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-xl font-semibold text-gray-900 mb-2 line-clamp-2"
                  >
                    {entity.title}
                  </h3>
                  <div
                    class="flex flex-wrap items-center gap-4 text-sm text-gray-600"
                  >
                    <span class="flex items-center gap-1">
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
                      {$_("Updated")}
                      {entity.updated_at}
                    </span>
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {renderStateString(entity)}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-6">
                  <div class="flex items-center gap-4">
                    <span class="flex items-center gap-2 text-red-600">
                      <svg
                        class="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        />
                      </svg>
                      <span class="font-medium">{entity.reaction ?? 0}</span>
                    </span>
                    <span class="flex items-center gap-2 text-blue-600">
                      <svg
                        class="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                        />
                      </svg>
                      <span class="font-medium">{entity.comment ?? 0}</span>
                    </span>
                  </div>

                  <svg
                    class="w-5 h-5 text-gray-400 ltr:rotate-0 rtl:rotate-180 transform transition-transform duration-200"
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
        {/each}
      </div>
    {/if}
  </div>
</div>
