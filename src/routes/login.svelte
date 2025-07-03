<script lang="ts">
  import { signin } from "@/stores/user";
  import { _ } from "@/i18n";
  import { goto } from "@roxi/routify";
  $goto;

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
            class="block text-sm font-medium text-slate-700"
          >
            {$_("Username")}
          </label>
          <div class="relative">
            <div
              class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
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
              placeholder="Enter your username"
              class="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-colors bg-white/50 {isError
                ? 'border-red-300 focus:ring-red-400 focus:border-red-400'
                : ''}"
              required
            />
          </div>
        </div>

        <div class="space-y-2">
          <label
            for="password"
            class="block text-sm font-medium text-slate-700"
          >
            {$_("Password")}
          </label>
          <div class="relative">
            <div
              class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                ></path>
              </svg>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              bind:value={password}
              placeholder="Enter your password"
              class="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-colors bg-white/50 {isError
                ? 'border-red-300 focus:ring-red-400 focus:border-red-400'
                : ''}"
              required
            />
            <button
              type="button"
              onclick={togglePasswordVisibility}
              class="absolute mx-4 inset-y-0 right-0 pr-3 flex items-center hover:text-slate-600 transition-colors"
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
                >{showPassword ? "Hide password" : "Show password"}</span
              >
            </button>
          </div>
        </div>

        <!-- Error Message -->
        {#if isError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-red-800 text-sm">
              {$_("InvalidCredentials")}
            </p>
          </div>
        {/if}

        <!-- Login Button -->
        <button
          type="submit"
          disabled={isLoading}
          class="w-full bg-slate-900 bg-primary hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 flex items-center justify-center"
        >
          {#if isLoading}
            <div class="flex items-center">
              <div
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
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
