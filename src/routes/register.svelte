<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { checkExisting, register, requestOtp } from "@/stores/user";

  import {
    UserSolid,
    EnvelopeSolid,
    EyeSolid,
    EyeSlashSolid,
    CheckCircleSolid,
    ArrowLeftOutline,
    LockSolid,
    PhoneSolid,
  } from "flowbite-svelte-icons";
  import { getEntity } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  $goto;
  let email = "";
  let phoneNumber = "";
  let password = "";
  let confirmPassword = "";
  let agreeToTerms = false;
  let showPassword = false;
  let showConfirmPassword = false;
  let isSubmitting = false;
  let showSuccess = false;
  let showError = false;
  let otpCode = "";
  let isOtpStep = false;
  let isVerifyingOtp = false;
  let otpRequestId = "";
  let canResendOtp = false;
  let resendCountdown = 60;
  let resendTimer: any;

  type Errors = {
    email?: string;
    phoneNumber?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
    otp?: string;
  };
  let errors: Errors = {};

  const isRTL = $locale === "ar" || $locale === "ku";

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (isOtpStep) {
      await handleOtpVerification();
      return;
    }

    errors = {
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      terms: "",
      otp: "",
    };

    let isValid = true;

    if (!email.trim()) {
      errors.email = $_("EmailRequired");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = $_("InvalidEmail");
      isValid = false;
    }

    if (!password) {
      errors.password = $_("PasswordRequired");
      isValid = false;
    } else if (password.length < 6) {
      errors.password = $_("PasswordTooShort");
      isValid = false;
    }

    if (!confirmPassword) {
      errors.confirmPassword = $_("ConfirmPasswordRequired");
      isValid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = $_("PasswordsDoNotMatch");
      isValid = false;
    }

    if (!agreeToTerms) {
      errors.terms = $_("MustAgreeToTerms");
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    isSubmitting = true;

    try {
      const existingUserCheck = await checkExisting("email", email);
      if (!existingUserCheck) {
        errors.email = $_("EmailAlreadyExists");
        isSubmitting = false;
        return;
      }
      await otpRequest();
    } catch (error: any) {
      if (error.message.includes("email")) {
        errors.email = error.message;
      } else if (
        error.message.includes("phone") ||
        error.message.includes("msisdn")
      ) {
        errors.phoneNumber = error.message;
      } else if (error.message.includes("password")) {
        errors.password = error.message;
      } else {
        console.error("Registration error:", error.message);
        showError = true;
      }
    } finally {
      isSubmitting = false;
    }
  }

  async function otpRequest() {
    try {
      const response = await requestOtp(email);

      otpRequestId = "mock-request-id-123456";
      isOtpStep = true;
      startResendTimer();
    } catch (error: any) {
      console.error("OTP request error:", error.message);
      otpRequestId = "mock-request-id-123456";
      isOtpStep = true;
      startResendTimer();
    }
  }

  async function handleOtpVerification() {
    errors.otp = "";

    if (!otpCode.trim()) {
      errors.otp = $_("OtpRequired");
      return;
    }

    if (otpCode.length !== 6) {
      errors.otp = $_("OtpInvalidLength");
      return;
    }

    isVerifyingOtp = true;
    try {
      const defaultRole = await getEntity(
        "web_config",
        "applications",
        "public",
        ResourceType.content,
        "public",
        true,
        false
      );
      console.log(defaultRole);

      const role =
        defaultRole.payload.body.items.find(
          (item) => item.key === "default_user_role"
        )?.value || "catalog_user_role";

      await register(email, otpCode, password, confirmPassword, role);
      $goto("/entries");
    } catch (error: any) {
      console.error("OTP verification error:", error.message);
      errors.otp = error.message || $_("OtpVerificationFailed");
    } finally {
      isVerifyingOtp = false;
    }
  }

  async function resendOtp() {
    if (!canResendOtp) return;

    try {
      await otpRequest();
      otpCode = "";
      errors.otp = "";
    } catch (error: any) {
      console.error("Resend OTP error:", error.message);
      showError = true;
    }
  }

  function startResendTimer() {
    canResendOtp = false;
    resendCountdown = 60;

    resendTimer = setInterval(() => {
      resendCountdown--;
      if (resendCountdown <= 0) {
        canResendOtp = true;
        clearInterval(resendTimer);
      }
    }, 1000);
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function toggleConfirmPasswordVisibility() {
    showConfirmPassword = !showConfirmPassword;
  }

  function goToLogin() {
    $goto("/login");
  }

  function goBack() {
    if (isOtpStep) {
      isOtpStep = false;
      otpCode = "";
      errors.otp = "";
      if (resendTimer) {
        clearInterval(resendTimer);
      }
    } else {
      $goto("/");
    }
  }
</script>

<div class="register-container">
  <div class="register-content">
    <div class="register-header">
      <div class="header-content">
        <div class="icon-wrapper">
          {#if isOtpStep}
            <LockSolid class="header-icon text-white" />
          {:else}
            <UserSolid class="header-icon text-white" />
          {/if}
        </div>
        <h1 class="register-title">
          {isOtpStep ? $_("VerifyPhoneNumber") : $_("CreateAccount")}
        </h1>
        <p class="register-description">
          {isOtpStep
            ? $_("EnterOtpSentTo") + " " + phoneNumber + " (Use: 123456)"
            : $_("CreateAccountDescription")}
        </p>
      </div>
    </div>

    {#if showSuccess}
      <div class="success-message" class:rtl={isRTL}>
        <CheckCircleSolid class="success-icon" />
        <div class="success-content">
          <h3 class="success-title">{$_("AccountCreated")}</h3>
          <p class="success-description">{$_("AccountCreatedDescription")}</p>
        </div>
      </div>
    {/if}

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
          <p class="error-text">{$_("RegistrationError")}</p>
        </div>
      </div>
    {/if}

    <div class="form-container">
      <form onsubmit={handleSubmit} class="register-form">
        {#if !isOtpStep}
          <div class="form-group">
            <label for="email" class="form-label" class:rtl={isRTL}>
              <EnvelopeSolid class="label-icon" />
              {$_("Email")}
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder={$_("EmailPlaceholder")}
              class="form-input"
              class:error={errors.email}
              class:rtl={isRTL}
              disabled={isSubmitting}
            />
            {#if errors.email}
              <p class="error-text-small" class:rtl={isRTL}>{errors.email}</p>
            {/if}
          </div>

          <div class="form-group">
            <label for="phoneNumber" class="form-label" class:rtl={isRTL}>
              <PhoneSolid class="label-icon" />
              {$_("PhoneNumber")}
            </label>
            <input
              id="phoneNumber"
              type="tel"
              bind:value={phoneNumber}
              placeholder={$_("PhoneNumberPlaceholder")}
              class="form-input"
              class:error={errors.phoneNumber}
              class:rtl={isRTL}
              disabled={isSubmitting}
            />
            {#if errors.phoneNumber}
              <p class="error-text-small" class:rtl={isRTL}>
                {errors.phoneNumber}
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
              <p class="error-text-small" class:rtl={isRTL}>
                {errors.password}
              </p>
            {/if}
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label" class:rtl={isRTL}>
              <LockSolid class="label-icon" />
              {$_("ConfirmPassword")}
            </label>
            <div class="password-input-wrapper" class:rtl={isRTL}>
              <label for="confirmPassword" class="visually-hidden"></label>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                bind:value={confirmPassword}
                placeholder={$_("ConfirmPasswordPlaceholder")}
                class="form-input password-input"
                class:error={errors.confirmPassword}
                class:rtl={isRTL}
                disabled={isSubmitting}
              />
              <button
                aria-label={`Toggle confirm password visibility`}
                type="button"
                class="password-toggle"
                onclick={toggleConfirmPasswordVisibility}
                class:rtl={isRTL}
              >
                {#if showConfirmPassword}
                  <EyeSlashSolid class="toggle-icon" />
                {:else}
                  <EyeSolid class="toggle-icon" />
                {/if}
              </button>
            </div>
            {#if errors.confirmPassword}
              <p class="error-text-small" class:rtl={isRTL}>
                {errors.confirmPassword}
              </p>
            {/if}
          </div>

          <div class="form-group">
            <label for="agreeToTerms" class="checkbox-label" class:rtl={isRTL}
            ></label>
            <input
              id="agreeToTerms"
              type="checkbox"
              bind:checked={agreeToTerms}
              class="checkbox-input"
              disabled={isSubmitting}
            />
            <span class="checkbox-text">{$_("AgreeToTerms")}</span>
            {#if errors.terms}
              <p class="error-text-small" class:rtl={isRTL}>{errors.terms}</p>
            {/if}
          </div>
        {:else}
          <div class="form-group">
            <label for="otpCode" class="form-label" class:rtl={isRTL}>
              <LockSolid class="label-icon" />
              {$_("VerificationCode")}
            </label>
            <input
              id="otpCode"
              type="text"
              bind:value={otpCode}
              placeholder={$_("EnterOtpCode")}
              class="form-input otp-input"
              class:error={errors.otp}
              class:rtl={isRTL}
              disabled={isVerifyingOtp}
              maxlength="6"
            />
            {#if errors.otp}
              <p class="error-text-small" class:rtl={isRTL}>{errors.otp}</p>
            {/if}
          </div>

          <div class="resend-otp-container" class:rtl={isRTL}>
            <p class="resend-text">{$_("DidNotReceiveOtp")}</p>
            <button
              aria-label={`Resend OTP`}
              type="button"
              class="resend-button"
              onclick={resendOtp}
              disabled={!canResendOtp}
              class:rtl={isRTL}
            >
              {#if canResendOtp}
                {$_("ResendOtp")}
              {:else}
                {$_("ResendIn")} {resendCountdown}s
              {/if}
            </button>
          </div>
        {/if}

        <button
          aria-label={`Submit form`}
          type="submit"
          class="submit-button"
          class:loading={isSubmitting || isVerifyingOtp}
          class:rtl={isRTL}
          disabled={isSubmitting || isVerifyingOtp}
        >
          {#if isSubmitting || isVerifyingOtp}
            <div class="loading-spinner"></div>
            {isOtpStep ? $_("VerifyingOtp") : $_("SigningUp")}
          {:else if isOtpStep}
            <LockSolid class="button-icon" />
            {$_("VerifyOtp")}
          {:else}
            <UserSolid class="button-icon" />
            {$_("SendOtp")}
          {/if}
        </button>
      </form>

      {#if isOtpStep}
        <div class="back-link items-center" class:rtl={isRTL}>
          <button
            aria-label={`Go back`}
            class="link-button d-flex align-center"
            onclick={goBack}
          >
            <ArrowLeftOutline class="back-icon mx-2" />
            {$_("BackToForm")}
          </button>
        </div>
      {:else}
        <div class="login-link" class:rtl={isRTL}>
          <span class="login-text">{$_("AlreadyHaveAccount")}</span>
          <button
            aria-label={`Go to login`}
            class="link-button"
            onclick={goToLogin}
          >
            {$_("SignIn")}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .register-container {
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

  .register-content {
    max-width: 500px;
    margin: 0 auto;
  }

  .register-header {
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

  .register-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .register-description {
    font-size: 1rem;
    color: #6b7280;
    line-height: 1.6;
  }

  .success-message,
  .error-message {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.75rem;
    margin-bottom: 2rem;
  }

  .success-message {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .error-message {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .success-title {
    font-weight: 600;
    color: #16a34a;
    margin-bottom: 0.25rem;
  }

  .success-description,
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

  .register-form {
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

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #374151;
  }

  .checkbox-input {
    width: 1rem;
    height: 1rem;
    accent-color: #3b82f6;
  }

  .error-text-small {
    font-size: 0.75rem;
    color: #dc2626;
    margin-top: 0.25rem;
  }

  .error-text-small.rtl {
    text-align: right;
  }

  .otp-hint {
    margin-top: 0.25rem;
  }

  .otp-hint.rtl {
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

  .login-link {
    text-align: center;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .login-text {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .link-button {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: #3b82f6;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    font-size: 0.875rem;
    margin-left: 0.25rem;
  }

  .login-link.rtl .link-button {
    margin-left: 0;
    margin-right: 0.25rem;
  }

  .link-button:hover {
    color: #2563eb;
  }

  .resend-otp-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .resend-text {
    color: #6b7280;
  }

  .resend-button {
    background: none;
    border: none;
    color: #3b82f6;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    font-size: 0.875rem;
  }

  .resend-button:disabled {
    color: #9ca3af;
    cursor: not-allowed;
    text-decoration: none;
  }

  .resend-button:hover:not(:disabled) {
    color: #2563eb;
  }

  .back-link {
    text-align: center;
    align-items: center;
    display: flex;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  @media (max-width: 640px) {
    .register-container {
      padding: 1rem;
    }

    .register-title {
      font-size: 1.75rem;
    }

    .form-container {
      padding: 1.5rem;
    }
  }
</style>
