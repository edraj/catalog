<script lang="ts">
  import { preventDefault, run } from "svelte/legacy";

  import { onMount } from "svelte";
  import {
    getAvatar,
    getProfile,
    getSpaceSchema,
    setAvatar,
    updatePassword,
    updateProfile,
  } from "@/lib/dmart_services/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import Avatar from "@/components/Avatar.svelte";
  import {
    formatDate,
    formatNumberInText,
    renderStateString,
  } from "@/lib/helpers";
  import { goto } from "@roxi/routify";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { loginBy } from "@/stores/user";
  import { writable } from "svelte/store";
  import DynamicSchemaBasedForms from "@/components/forms/DynamicSchemaBasedForms.svelte";

  $goto;
  let isLoading = writable(true);
  let isUploadingAvatar = writable(false);
  let user = writable(null);
  let avatar = writable(null);

  let displayname = writable("");
  let description = writable("");
  let email = writable("");
  let msisdn = writable("");
  let fileInput = writable(null);

  let userSchema = writable(null);
  let profileData = writable({});
  let loadingSchema = writable(false);

  let oldPassword = writable("");
  let newPassword = writable("");
  let confirmPassword = writable("");
  let isChangingPassword = writable(false);
  let showChangePassword = writable(false);

  onMount(async () => {
    isLoading.set(true);

    user.set(await getProfile());
    const currentUser = $user;

    displayname.set(currentUser?.attributes?.displayname?.[$locale] ?? "");
    if (!displayname && $locale === "en") {
      displayname.set(currentUser.attributes.email);
    }
    description.set(currentUser.attributes?.description?.[$locale] ?? "");
    email.set(currentUser.attributes?.email ?? "");
    msisdn.set(currentUser.attributes?.msisdn ?? "");

    avatar.set(await getAvatar(currentUser.shortname));

    await loadUserSchema();

    isLoading.set(false);
  });

  async function loadUserSchema() {
    loadingSchema.set(true);
    try {
      const response = await getSpaceSchema("management", "managed");

      if (response?.status === "success" && response?.records) {
        const userSchemaRecord = response.records.find(
          (record) => record.shortname === "user",
        );

        if (userSchemaRecord && userSchemaRecord.attributes?.payload?.body) {
          userSchema.set(userSchemaRecord.attributes.payload.body);

          const currentUser = $user;
          const existingProfileData =
            currentUser?.attributes?.payload?.body || {};
          profileData.set(existingProfileData);
        }
      }
    } catch (error) {
      console.error("Error loading user schema:", error);
      errorToastMessage("Failed to load profile schema");
    } finally {
      loadingSchema.set(false);
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();

    if ($newPassword !== $confirmPassword) {
      errorToastMessage("New passwords do not match");
      return;
    }

    if ($newPassword.length < 8) {
      errorToastMessage("New password must be at least 8 characters long");
      return;
    }

    if ($oldPassword === $newPassword) {
      errorToastMessage(
        "New password must be different from the current password",
      );
      return;
    }

    isChangingPassword.set(true);

    try {
      await loginBy($user.attributes.email, $oldPassword);

      const response = await updatePassword({
        shortname: $user.shortname,
        password: $newPassword,
      });

      if (response) {
        successToastMessage("Password changed successfully");
        oldPassword.set("");
        newPassword.set("");
        confirmPassword.set("");
        showChangePassword.set(false);
      } else {
        errorToastMessage("Failed to change password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      errorToastMessage("An error occurred while changing your password");
    } finally {
      isChangingPassword.set(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!$displayname.trim()) {
      errorToastMessage(
        `Display name is required for ${$locale === "ar" ? "Arabic" : $locale === "en" ? "English" : $locale.toUpperCase()}`,
      );
      return;
    }

    if (!$description.trim()) {
      errorToastMessage(
        `Description is required for ${$locale === "ar" ? "Arabic" : $locale === "en" ? "English" : $locale.toUpperCase()}`,
      );
      return;
    }

    const updatedDisplayname = { ...$user.attributes.displayname };
    const updatedDescription = { ...$user.attributes.description };

    updatedDisplayname[$locale] = $displayname.trim();
    updatedDescription[$locale] = $description.trim();

    // Include profile data in the update
    const response = await updateProfile({
      shortname: $user.shortname,
      displayname: updatedDisplayname,
      description: updatedDescription,
      email: $email,
      msisdn: $msisdn,
      payload: {
        content_type: "json",
        body: $profileData,
      },
    });

    if (response) {
      successToastMessage("Profile updated successfully");
      $user.attributes.displayname = updatedDisplayname;
      $user.attributes.description = updatedDescription;
      // Update user with new profile data
      if (!$user.attributes.payload) {
        $user.attributes.payload = {};
      }
      $user.attributes.payload.body = $profileData;
    } else {
      errorToastMessage("Error updating profile");
    }
  }

  function gotoEntityDetails(entity: any) {
    $goto("/entries/[shortname]", {
      shortname: entity.shortname,
      space_name: entity.space_name,
      subpath: entity.subpath,
    });
  }

  function triggerFileInput() {
    $fileInput?.click();
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

    isUploadingAvatar.set(true);

    try {
      const success = await setAvatar($user.shortname, file);

      if (success) {
        avatar.set(await getAvatar($user.shortname));
        successToastMessage("Profile picture updated successfully");
      } else {
        errorToastMessage("Failed to update profile picture");
      }
    } catch (error) {
      console.error("Error updating avatar:", error);
      errorToastMessage(
        "An error occurred while updating your profile picture",
      );
    } finally {
      isUploadingAvatar.set(false);
      target.value = "";
    }
  }

  run(() => {
    if ($user && $locale) {
      displayname.set($user?.attributes?.displayname?.[$locale] ?? "");

      if (!displayname && $locale === "en") {
        displayname.set($user.attributes.email);
      }

      description.set($user.attributes?.description?.[$locale] ?? "");
    }
  });
</script>

<div class="profile-page">
  <div class="container">
      {#if $isLoading}
      <div class="loading-container">
        <div class="loading-content">
          <Diamonds color="#2563eb" size="60" unit="px" />
          <p class="loading-text">Loading your profile...</p>
        </div>
      </div>
    {:else}
      <div class="max-w-3xl mx-auto space-y-6">
        <!-- Top Profile Card -->
        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between"
        >
          <div class="flex items-center gap-6">
            <div class="relative group">
              <div
                class="w-20 h-20 rounded-full overflow-hidden border border-gray-100 shadow-sm relative"
              >
                <Avatar src={$avatar} size="80" />
                <div
                  class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onclick={triggerFileInput}
                  onkeydown={(e) => e.key === "Enter" && triggerFileInput()}
                  role="button"
                  tabindex="0"
                >
                  {#if $isUploadingAvatar}
                    <Diamonds color="#ffffff" size="20" unit="px" />
                  {:else}
                    <svg
                      class="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  {/if}
                </div>
              </div>
              <input
                bind:this={$fileInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={handleAvatarChange}
                disabled={$isUploadingAvatar}
              />
            </div>

            <div>
              <h2 class="text-xl font-bold text-gray-900">
                {$displayname || $user.shortname}
              </h2>
              <p class="text-sm text-gray-500 font-medium">
                @{$user.shortname}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-6">

            <div class="text-center pt-1">
              <p
                class="text-xs text-gray-400 font-medium tracking-wider uppercase mb-1"
              >
                Status
              </p>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active
              </span>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="space-y-6">
          <!-- Profile Info -->
          <div
            class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <div class="flex items-center gap-2 mb-6">
              <svg
                class="w-5 h-5 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <h3 class="text-lg font-semibold text-gray-900">Profile Info</h3>
            </div>

            <form
              id="profile-form"
              onsubmit={preventDefault(handleSubmit)}
              class="space-y-6"
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label
                    for="displayname"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Display Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="displayname"
                    type="text"
                    required
                    bind:value={$displayname}
                    class="w-full px-4 py-3 bg-gray-50/50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder={$_("DisplayNamePlaceholder")}
                    dir={$locale === "ar" || $locale === "ku" ? "rtl" : "ltr"}
                  />
                </div>

                <div class="space-y-2">
                  <label
                    for="email"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <!-- Figma design uses an icon inside the input. I will use a simple wrapper. -->
                  <div class="relative">
                    <div
                      class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    >
                      <svg
                        class="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      bind:value={$email}
                      class="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      placeholder={$_("EmailPlaceholder")}
                    />
                  </div>
                </div>

                <div class="space-y-2 md:col-span-2">
                  <label
                    for="msisdn"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Mobile
                  </label>
                  <div class="relative">
                    <div
                      class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    >
                      <svg
                        class="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <input
                      id="msisdn"
                      type="tel"
                      bind:value={$msisdn}
                      class="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      placeholder={$_("MobileNumberPlaceholder")}
                    />
                  </div>
                </div>

                <div class="space-y-2 md:col-span-2">
                  <label
                    for="description"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Bio <span class="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    bind:value={$description}
                    rows="4"
                    class="w-full px-4 py-3 bg-gray-50/50 border border-transparent rounded-2xl text-sm resize-y focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder={$_("route_labels.placeholder_tell_us_about_yourself")}
                    dir={$locale === "ar" || $locale === "ku" ? "rtl" : "ltr"}
                  ></textarea>
                </div>
              </div>
            </form>
          </div>

          <!-- Dynamic Profile Fields -->
          {#if $userSchema}
            <div
              class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div class="flex items-center gap-2 mb-6">
                <svg
                  class="w-5 h-5 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <h3 class="text-lg font-semibold text-gray-900">
                  Additional Details
                </h3>
              </div>

              <div class="space-y-6">
                {#if $loadingSchema}
                  <div class="flex justify-center py-8">
                    <Diamonds color="#4f46e5" size="40" unit="px" />
                  </div>
                {:else}
                  <DynamicSchemaBasedForms
                    bind:content={$profileData}
                    schema={$userSchema}
                  />
                {/if}
              </div>
            </div>
          {/if}

          <!-- Account Settings -->
          {#if $user}
            <div
              class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div class="flex items-center gap-2 mb-6">
                <svg
                  class="w-5 h-5 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <h3 class="text-lg font-semibold text-gray-900">Account</h3>
              </div>

              <div class="space-y-6">
                <!-- Status Row -->
                <div
                  class="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100"
                >
                  <div class="flex items-center gap-3">
                    <svg
                      class="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    <div>
                      <h4 class="text-sm font-semibold text-gray-900">
                        Account Status
                      </h4>
                      <p class="text-xs text-gray-500 mt-0.5">
                        Active and verified
                      </p>
                    </div>
                  </div>
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    ></span>
                    Active
                  </span>
                </div>

                <!-- Password Row -->
                <div
                  class="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100"
                >
                  <div class="flex items-center gap-3">
                    <svg
                      class="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <div>
                      <h4 class="text-sm font-semibold text-gray-900">
                        Password
                      </h4>
                      <p class="text-xs text-gray-500 mt-0.5">Protected</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    onclick={() => showChangePassword.set(!$showChangePassword)}
                  >
                    {$showChangePassword ? "Cancel" : "Change"}
                  </button>
                </div>

                {#if $showChangePassword}
                  <form
                    onsubmit={preventDefault(handlePasswordChange)}
                    class="p-5 bg-gray-50/50 border border-gray-100 rounded-xl space-y-4 shadow-inner"
                  >
                    <div>
                      <label
                        for="oldPassword"
                        class="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {$_("CurrentPassword")}
                      </label>
                      <input
                        id="oldPassword"
                        type="password"
                        required
                        bind:value={$oldPassword}
                        class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        disabled={$isChangingPassword}
                      />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          for="newPassword"
                          class="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {$_("NewPassword")}
                        </label>
                        <input
                          id="newPassword"
                          type="password"
                          required
                          minlength="8"
                          bind:value={$newPassword}
                          class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          disabled={$isChangingPassword}
                        />
                      </div>

                      <div>
                        <label
                          for="confirmPassword"
                          class="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {$_("ConfirmNewPassword")}
                        </label>
                        <input
                          id="confirmPassword"
                          type="password"
                          required
                          bind:value={$confirmPassword}
                          class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          disabled={$isChangingPassword}
                        />
                      </div>
                    </div>

                    <div class="pt-2 flex gap-3">
                      <button
                        type="submit"
                        disabled={$isChangingPassword}
                        class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {#if $isChangingPassword}
                          <Diamonds color="#ffffff" size="16" unit="px" />
                          {$_("ChangingPassword")}
                        {:else}
                          {$_("ChangePassword")}
                        {/if}
                      </button>
                      <button
                        type="button"
                        onclick={() => {
                          showChangePassword.set(false);
                          oldPassword.set("");
                          newPassword.set("");
                          confirmPassword.set("");
                        }}
                        class="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
                        disabled={$isChangingPassword}
                      >
                        {$_("Cancel")}
                      </button>
                    </div>
                  </form>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Submit Action -->
          <div class="pt-4">
            <button
              type="submit"
              form="profile-form"
              class="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-base font-semibold flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .profile-page {
    min-height: 100vh;
    background-color: #f8fafc;
    padding: 2rem 1rem;
  }

  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  /* Loading State */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .loading-text {
    color: #6b7280;
    font-size: 1rem;
    font-weight: 500;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 8rem 0;
  }

  .empty-content {
    max-width: 28rem;
    margin: 0 auto;
  }

  .empty-icon {
    width: 8rem;
    height: 8rem;
    margin: 0 auto 2rem;
    background-color: #eff6ff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-svg {
    width: 4rem;
    height: 4rem;
    color: #2563eb;
  }

  .empty-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 1rem;
  }

  .empty-description {
    font-size: 1.25rem;
    color: #6b7280;
    margin-bottom: 2rem;
  }

  .create-entity-btn {
    background-color: #2563eb;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-entity-btn:hover {
    background-color: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.2);
  }

  /* Utilities */
  .hidden {
    display: none !important;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
