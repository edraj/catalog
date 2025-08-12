<script lang="ts">
  import { onMount } from "svelte";
  import {
    getAvatar,
    setAvatar,
    getEntityAttachmentsCount,
    getProfile,
    getEntities,
    updateProfile,
    getMyEntities,
    updatePassword,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import Avatar from "@/components/Avatar.svelte";
  import { formatDate, renderStateString } from "@/lib/helpers";
  import { goto, params } from "@roxi/routify";
  import { Diamonds } from "svelte-loading-spinners";
  $goto;
  import { _ } from "@/i18n";
  import { loginBy } from "@/stores/user";

  // let profileSection: string = $state("ME");

  const ProfileSection = {
    ME: "ME",
    IDEAS: "IDEAS",
  };
  let profileSection: string = $state(ProfileSection.ME);

  let isLoading = $state(true);
  let isUploadingAvatar = $state(false);
  let user = $state(null);
  let avatar = $state(null);
  let entities = $state([]);
  let displayname = $state("");
  let description = $state("");
  let email = $state("");
  let msisdn = $state("");
  let fileInput: HTMLInputElement;

  let oldPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let isChangingPassword = $state(false);
  let showChangePassword = $state(false);

  onMount(async () => {
    isLoading = true;
    user = await getProfile();
    displayname = user?.attributes?.displayname?.en ?? user.attributes.email;
    description = user.attributes?.description?.en ?? "";
    email = user.attributes?.email ?? "";
    msisdn = user.attributes?.msisdn ?? "";

    avatar = await getAvatar(user.shortname);

    await fetchEntities();
    isLoading = false;
  });

  async function fetchEntities() {
    isLoading = true;
    try {
      const rawEntities = await getMyEntities();

      entities = rawEntities.map((entity) => ({
        shortname: entity.shortname,
        title:
          entity.attributes?.payload?.body?.title ||
          entity.attributes?.displayname?.en ||
          "Untitled",
        content: entity.attributes?.payload?.body?.content || "",
        tags: entity.attributes?.tags || [],
        state: entity.attributes?.state || "unknown",
        is_active: entity.attributes?.is_active || false,
        created_at: entity.attributes?.created_at
          ? formatDate(entity.attributes.created_at)
          : "",
        updated_at: entity.attributes?.updated_at
          ? formatDate(entity.attributes.updated_at)
          : "",
        raw_created_at: entity.attributes?.created_at || "",
        raw_updated_at: entity.attributes?.updated_at || "",
        space_name: entity.attributes?.space_name || "",
        subpath: entity?.subpath || "",
        owner_shortname: entity.attributes?.owner_shortname || "",
        comment: entity.attachments?.comment?.length ?? 0,
        reaction: entity.attachments?.reaction?.length ?? 0,
      }));
    } catch (error) {
      console.error("Error fetching entities:", error);
      errorToastMessage("An error occurred while fetching your entries");
      entities = [];
    } finally {
      isLoading = false;
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      errorToastMessage("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      errorToastMessage("New password must be at least 8 characters long");
      return;
    }

    if (oldPassword === newPassword) {
      errorToastMessage(
        "New password must be different from the current password"
      );
      return;
    }

    isChangingPassword = true;

    try {
      const loginResult = await loginBy(user.attributes.email, oldPassword);

      if (!loginResult) {
        errorToastMessage("Current password is incorrect");
        return;
      }
      const response = await updatePassword({
        shortname: user.shortname,
        password: newPassword,
      });

      if (response) {
        successToastMessage("Password changed successfully");
        oldPassword = "";
        newPassword = "";
        confirmPassword = "";
        showChangePassword = false;
      } else {
        errorToastMessage("Failed to change password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      errorToastMessage("An error occurred while changing your password");
    } finally {
      isChangingPassword = false;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const response = await updateProfile({
      shortname: user.shortname,
      displayname,
      description,
      // msisdn,
      email,
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
    $goto("/entries/[shortname]", {
      shortname: entity.shortname,
      space_name: entity.space_name,
      subpath: entity.subpath,
    });
  }

  function triggerFileInput() {
    fileInput?.click();
  }

  async function handleAvatarChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      errorToastMessage("Please select a valid image file");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      errorToastMessage("File size must be less than 5MB");
      return;
    }

    isUploadingAvatar = true;

    try {
      const success = await setAvatar(user.shortname, file);

      if (success) {
        avatar = await getAvatar(user.shortname);
        successToastMessage("Profile picture updated successfully");
      } else {
        errorToastMessage("Failed to update profile picture");
      }
    } catch (error) {
      console.error("Error updating avatar:", error);
      errorToastMessage(
        "An error occurred while updating your profile picture"
      );
    } finally {
      isUploadingAvatar = false;
      target.value = "";
    }
  }
</script>

<div class="min-h-screen bg-gray-50 px-8">
  <div class="container mx-auto px-12 py-8 max-w-6xl">
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
            class="flex flex-col items-center rounded-xl border border-gray-200 p-6 text-center"
          >
            <div class="mb-6 flex justify-center relative">
              <div class="relative group">
                <Avatar src={avatar} size="120" />

                <!-- Avatar Edit Overlay -->
                <div
                  class="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
                  onclick={triggerFileInput}
                >
                  {#if isUploadingAvatar}
                    <div class="text-white">
                      <Diamonds color="#ffffff" size="24" unit="px" />
                    </div>
                  {:else}
                    <div class="text-white text-center">
                      <svg
                        class="w-6 h-6 mx-auto mb-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        ></path>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        ></path>
                      </svg>
                      <span class="text-xs">Edit</span>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Hidden file input -->
              <input
                bind:this={fileInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
            </div>

            <!-- Edit Avatar Button (alternative placement) -->
            <button
              class="mb-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 flex items-center gap-2"
              onclick={triggerFileInput}
              disabled={isUploadingAvatar}
            >
              {#if isUploadingAvatar}
                <Diamonds color="#6b7280" size="16" unit="px" />
                Uploading...
              {:else}
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
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                </svg>
                {$_("ChangePhoto")}
              {/if}
            </button>

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
                for="email"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("EmailAddress")}
              </label>
              <input
                id="email"
                type="email"
                bind:value={email}
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label
                for="msisdn"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {$_("MobileNumber")}
              </label>
              <input
                id="msisdn"
                type="tel"
                bind:value={msisdn}
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                placeholder="Enter your mobile number"
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
                    {$_("AccountStatus")}
                  </h4>
                  <p class="text-gray-600 text-sm mt-1">
                    Your account is active and verified
                  </p>
                </div>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {$_("Active")}
                </span>
              </div>

              <div
                class="flex justify-between items-start py-3 border-b border-gray-100"
              >
                <div>
                  <h4 class="font-medium text-gray-900">Member Since</h4>
                  <p class="text-gray-600 text-sm mt-1">
                    {user.attributes?.created_at
                      ? formatDate(user.attributes.created_at)
                      : "Unknown"}
                  </p>
                </div>
              </div>
              <!-- Change Password Section -->
              <div class="pt-4">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="font-medium text-gray-900">Password</h4>
                  <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    onclick={() => (showChangePassword = !showChangePassword)}
                  >
                    {showChangePassword ? "Cancel" : "Change Password"}
                  </button>
                </div>

                {#if showChangePassword}
                  <form onsubmit={handlePasswordChange} class="space-y-4">
                    <div>
                      <label
                        for="oldPassword"
                        class="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Current Password
                      </label>
                      <input
                        id="oldPassword"
                        type="password"
                        required
                        bind:value={oldPassword}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        placeholder="Enter your current password"
                        disabled={isChangingPassword}
                      />
                    </div>

                    <div>
                      <label
                        for="newPassword"
                        class="block text-sm font-medium text-gray-700 mb-2"
                      >
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        required
                        minlength="8"
                        bind:value={newPassword}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        placeholder="Enter your new password"
                        disabled={isChangingPassword}
                      />
                      <p class="text-xs text-gray-500 mt-1">
                        Password must be at least 8 characters long
                      </p>
                    </div>

                    <div>
                      <label
                        for="confirmPassword"
                        class="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        required
                        bind:value={confirmPassword}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        placeholder="Confirm your new password"
                        disabled={isChangingPassword}
                      />
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        {#if isChangingPassword}
                          <Diamonds color="#ffffff" size="16" unit="px" />
                          Changing...
                        {:else}
                          Change Password
                        {/if}
                      </button>
                      <button
                        type="button"
                        onclick={() => {
                          showChangePassword = false;
                          oldPassword = "";
                          newPassword = "";
                          confirmPassword = "";
                        }}
                        class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                        disabled={isChangingPassword}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>{:else}
                  <p class="text-gray-600 text-sm">••••••••••••</p>
                {/if}
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
