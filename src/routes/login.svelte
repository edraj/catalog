<script lang="ts">
  import { signin } from "@/stores/user";
  import { _, locale } from "@/i18n";
  import { goto } from "@roxi/routify";
  $goto;
  const isRTL = $locale === "ar" || $locale === "ku";

  let username: string;
  let password: string;
  let isError: boolean;
  let showPassword: boolean = $state(false);
  let isLoading: boolean = $state(false);
  async function handleSubmit(event: Event) {
    event.preventDefault();
    isError = false;
    try {
      await signin(username, password);
      $goto("/dashboard");
    } catch (error) {
      isError = true;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<div
  class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4"
  dir={isRTL ? "rtl" : "ltr"}
>
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">
        {$_("WelcomeBack")}
      </h1>
      <p class="text-slate-600">
        {$_("PleaseSignInToContinue")}
      </p>
    </div>

    <div
      class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-0 p-8"
    >
      <div class="text-center mb-6">
        <h2 class="text-2xl font-semibold text-slate-800 mb-2">
          {$_("SignIn")}
        </h2>
        <p class="text-slate-600">
          {$_("EnterYourCredentials")}
        </p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-6">
        <div class="space-y-2">
          <label
            for="username"
            class="block text-sm font-medium text-slate-700 {isRTL
              ? 'text-right'
              : 'text-left'}"
          >
            {$_("Username")}
          </label>
          <div class="relative">
            <div
              class="absolute inset-y-0 {isRTL
                ? 'right-0 pe-3 mx-4'
                : 'left-0 ps-3'} flex items-center pointer-events-none"
            >
              <svg
                class="h-4 w-4 text-slate-400"
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
            </div>
            <input
              id="username"
              type="text"
              name="username"
              bind:value={username}
              placeholder={$_("EnterYourUsername")}
              class="w-full {isRTL
                ? 'mr-4 text-right'
                : 'ps-10 pe-4 text-left'} py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-colors bg-white/50 {isError
                ? 'border-red-300 focus:ring-red-400 focus:border-red-400'
                : ''}"
              style="padding-right: 40px;"
              required
            />
          </div>
        </div>

        <div class="space-y-2">
          <label
            for="password"
            class="block text-sm font-medium text-slate-700 {isRTL
              ? 'text-right'
              : 'text-left'}"
          >
            {$_("Password")}
          </label>
          <div class="relative">
            <div
              class="absolute inset-y-0 {isRTL
                ? 'right-0 pe-3 mx-4'
                : 'left-0 ps-3'} flex items-center pointer-events-none"
            >
              <svg
                class="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 01-8 0v4h8z"
                ></path>
              </svg>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              bind:value={password}
              placeholder={$_("EnterYourPassword")}
              class="w-full {isRTL
                ? 'pe-10 ps-12 text-right'
                : 'ps-10 pe-12 text-left'} py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-colors bg-white/50 {isError
                ? 'border-red-300 focus:ring-red-400 focus:border-red-400'
                : ''}"
              style="padding-right: 40px;"
              required
            />
            <button
              type="button"
              onclick={togglePasswordVisibility}
              class="absolute inset-y-0 {isRTL
                ? 'left-0 ps-3 mx-4'
                : 'right-0 pe-3'} flex items-center hover:text-slate-600 transition-colors"
            >
              {#if showPassword}
                <svg
                  class="h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  ></path>
                </svg>
              {:else}
                <svg
                  class="h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  ></path>
                </svg>
              {/if}
              <span class="sr-only"
                >{showPassword ? $_("HidePassword") : $_("ShowPassword")}</span
              >
            </button>
          </div>
        </div>

        <!-- Error Message -->
        {#if isError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p
              class="text-red-800 text-sm {isRTL ? 'text-right' : 'text-left'}"
            >
              {$_("InvalidCredentials")}
            </p>
          </div>
        {/if}

        <!-- Login Button -->
        <button
          type="submit"
          disabled={isLoading}
          class="w-full login-btn hover:bg-gray-800 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 flex items-center justify-center"
        >
          {#if isLoading}
            <div class="flex items-center">
              <div
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-white {isRTL
                  ? 'ms-2'
                  : 'me-2'}"
              ></div>
              {$_("SigningIn")}
            </div>
          {:else}
            {$_("SignIn")}
          {/if}
        </button>
      </form>
    </div>

    <!-- Additional Info -->
    <div class="mt-8 text-center">
      <p class="text-xs text-slate-500">
        {$_("TermsAndConditions")}
      </p>
    </div>
  </div>
</div>

<style>
  .login-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px rgba(59, 130, 246, 0.25);
  }

  .login-btn:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
  }

  .login-btn:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  /* RTL-specific styles */
  [dir="rtl"] input::placeholder {
    text-align: right;
  }

  [dir="ltr"] input::placeholder {
    text-align: left;
  }
</style>
