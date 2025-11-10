<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import {
    EyeSlashSolid,
    EyeSolid,
    LockSolid,
    UserSolid,
  } from "flowbite-svelte-icons";
  import { loginBy, signin, roles } from "@/stores/user";

  $goto;
  let identifier = "";
  let password = "";
  let showPassword = false;
  let isSubmitting = false;
  let showError = false;
  let errors: { identifier?: string; password?: string } = {};
  let isError: boolean;
  const isRTL = $locale === "ar" || $locale === "ku";

  function isEmail(input: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    isError = false;
    showError = false;
    errors = {};
    isSubmitting = true;

    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      if (!trimmedIdentifier) errors.identifier = $_("ThisFieldIsRequired");
      if (!password) errors.password = $_("ThisFieldIsRequired");
      isSubmitting = false;
      return;
    }

    try {
      if (isEmail(trimmedIdentifier)) {
        await loginBy(trimmedIdentifier, password);
      } else {
        await signin(trimmedIdentifier, password);
      }

      let userRoles: string[] = [];
      roles.subscribe((value) => {
        userRoles = value;
      })();

      if (userRoles.includes("seller")) {
        $goto("/sellers");
      } else {
        $goto("/entries");
      }
    } catch (error) {
      isError = true;
      showError = true;
    } finally {
      isSubmitting = false;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function goToRegister() {
    $goto("/register");
  }

  function goBack() {
    $goto("/");
  }
</script>

<div class="login-container">
  <div class="login-content">
    <div class="login-header">
      <div class="header-content">
        <div class="icon-wrapper">
          <UserSolid class="header-icon text-white w-6 h-6" />
        </div>
        <h1 class="login-title">{$_("WelcomeBack")}</h1>
        <p class="login-description">{$_("PleaseSignInToContinue")}</p>
      </div>
    </div>

    {#if showError}
      <div class="error-message" class:rtl={isRTL}>
        <svg
          class="shrink-0 inline w-4 h-4 me-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
          />
        </svg>
        <div class="error-content">
          <p class="error-text">{$_("InvalidCredentials")}</p>
        </div>
      </div>
    {/if}

    <div class="form-container">
      <form onsubmit={handleSubmit} class="login-form">
        <div class="form-group">
          <label for="identifier" class="form-label" class:rtl={isRTL}>
            <UserSolid class="label-icon" />
            {$_("Username")} / {$_("Email")}
          </label>
          <input
            id="identifier"
            type="text"
            bind:value={identifier}
            placeholder={$_("Username") + " " + $_("or") + " " + $_("Email")}
            class="form-input"
            class:error={errors.identifier}
            class:rtl={isRTL}
            disabled={isSubmitting}
          />
          {#if errors.identifier}
            <p class="error-text-small" class:rtl={isRTL}>
              {errors.identifier}
            </p>
          {/if}
        </div>

        <div class="form-group">
          <label for="password" class="form-label" class:rtl={isRTL}>
            <LockSolid class="label-icon" />
            {$_("Password")}
          </label>
          <div class="password-input-wrapper" class:rtl={isRTL}>
            <label for="password" class="visually-hidden"></label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              bind:value={password}
              placeholder={$_("Password")}
              class="form-input password-input"
              class:error={errors.password}
              class:rtl={isRTL}
              disabled={isSubmitting}
            />
            <button
              aria-label={`Toggle password visibility`}
              type="button"
              class="password-toggle"
              onclick={togglePasswordVisibility}
              class:rtl={isRTL}
            >
              {#if showPassword}
                <EyeSlashSolid class="toggle-icon" />
              {:else}
                <EyeSolid class="toggle-icon" />
              {/if}
            </button>
          </div>
          {#if errors.password}
            <p class="error-text-small" class:rtl={isRTL}>{errors.password}</p>
          {/if}
        </div>

        <button
          type="submit"
          class="submit-button"
          class:loading={isSubmitting}
          class:rtl={isRTL}
          disabled={isSubmitting}
          aria-label={`Sign in`}
        >
          {#if isSubmitting}
            <div class="loading-spinner"></div>
            {$_("SigningIn")}
          {:else}
            <UserSolid class="button-icon" />
            {$_("SignIn")}
          {/if}
        </button>
      </form>

      <div class="register-link" class:rtl={isRTL}>
        <span class="register-text">{$_("DontHaveAccount")}</span>
        <button
          aria-label={`Go to register`}
          class="link-button"
          onclick={goToRegister}
        >
          {$_("Register")}
        </button>
      </div>

      <div class="terms-text" class:rtl={isRTL}>
        <p>{$_("TermsAndConditions")}</p>
      </div>
    </div>
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
    padding: 2rem 1rem;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
  }

  .login-content {
    max-width: 450px;
    margin: 0 auto;
  }

  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  .header-content {
    margin-bottom: 2rem;
  }

  .icon-wrapper {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem auto;
  }

  .login-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .login-description {
    font-size: 1rem;
    color: #6b7280;
    line-height: 1.6;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.75rem;
    margin-bottom: 2rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .error-message.rtl {
    flex-direction: row-reverse;
  }

  .error-text {
    color: #374151;
    font-size: 0.875rem;
  }

  .form-container {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #f3f4f6;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .form-label.rtl {
    flex-direction: row-reverse;
  }

  .form-input {
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: all 0.2s ease;
    background: white;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input.error {
    border-color: #dc2626;
  }

  .form-input.rtl {
    text-align: right;
  }

  .password-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-input {
    padding-right: 3rem;
    width: 100%;
  }

  .password-input.rtl {
    padding-right: 1rem;
    padding-left: 3rem;
  }

  .password-toggle {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: color 0.2s ease;
  }

  .password-toggle:hover {
    color: #374151;
  }

  .password-toggle.rtl {
    right: auto;
    left: 0.75rem;
  }

  .error-text-small {
    font-size: 0.75rem;
    color: #dc2626;
    margin-top: 0.25rem;
  }

  .error-text-small.rtl {
    text-align: right;
  }

  .submit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  .submit-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .submit-button.rtl {
    flex-direction: row-reverse;
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .register-link {
    text-align: center;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .register-text {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .link-button {
    background: none;
    border: none;
    color: #3b82f6;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    font-size: 0.875rem;
    margin-left: 0.25rem;
  }

  .register-link.rtl .link-button {
    margin-left: 0;
    margin-right: 0.25rem;
  }

  .link-button:hover {
    color: #2563eb;
  }

  .terms-text {
    text-align: center;
    margin-top: 1rem;
    font-size: 0.75rem;
    color: #9ca3af;
    line-height: 1.4;
  }

  .terms-text.rtl {
    text-align: center;
  }

  @media (max-width: 640px) {
    .login-container {
      padding: 1rem;
    }

    .login-title {
      font-size: 1.75rem;
    }

    .form-container {
      padding: 1.5rem;
    }
  }
</style>
