<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { checkExisting, register, requestOtp } from "@/stores/user";
  import {
    ArrowLeftOutline,
    EnvelopeSolid,
    EyeSlashSolid,
    EyeSolid,
    LockSolid,
    PhoneSolid,
    UserSolid,
    CheckCircleSolid,
  } from "flowbite-svelte-icons";
  import { getEntity } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";

  $goto;

  let formData = $state({
    email: "",
    shortname: "auto",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    gender: "",
    age: "",
    address: "",
    confessorsText: "",
    confessors: [] as string[],
    profession: "",
    description: "",
  });

  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let isSubmitting = $state(false);
  let showSuccess = $state(false);
  let showError = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");
  let otpCode = $state("");
  let isOtpStep = $state(false);
  let isVerifyingOtp = $state(false);
  let otpRequestId = "";
  let canResendOtp = $state(false);
  let resendCountdown = $state(60);
  let resendTimer: any;

  let showAdditionalFields = $state(false);

  type Errors = {
    email?: string;
    phoneNumber?: string;
    password?: string;
    confirmPassword?: string;
    gender?: string;
    shortname?: string;
    age?: string;
    address?: string;
    confessors?: string;
    profession?: string;
    description?: string;
    otp?: string;
  };
  let errors: Errors = $state({});

  const isRTL = $locale === "ar" || $locale === "ku";

  function parseConfessors(text: string): string[] {
    if (!text.trim()) return [];

    return text
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  $effect(() => {
    formData.confessors = parseConfessors(formData.confessorsText);
  });

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
      gender: "",
      age: "",
      address: "",
      confessors: "",
      profession: "",
      description: "",
      otp: "",
    };

    let isValid = true;

    const trimmedEmail = formData.email.trim();
    const trimmedPhoneNumber = formData.phoneNumber.trim();

    if (!trimmedEmail) {
      errors.email = $_("EmailRequired");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = $_("InvalidEmail");
      isValid = false;
    }

    if (!formData.password) {
      errors.password = $_("PasswordRequired");
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = $_("PasswordTooShort");
      isValid = false;
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = $_("ConfirmPasswordRequired");
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = $_("PasswordsDoNotMatch");
      isValid = false;
    }

    if (!formData.gender) {
      errors.gender = $_("GenderRequired");
      isValid = false;
    }

    if (
      formData.age &&
      (isNaN(Number(formData.age)) ||
        Number(formData.age) < 1 ||
        Number(formData.age) > 150)
    ) {
      errors.age = $_("InvalidAge");
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    isSubmitting = true;

    try {
      const existingUserCheck = await checkExisting("email", trimmedEmail);
      if (!existingUserCheck) {
        errors.email = $_("EmailAlreadyExists");
        isSubmitting = false;
        return;
      }
      formData.email = trimmedEmail;
      formData.phoneNumber = trimmedPhoneNumber;
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
        console.error("Seller creation error:", error.message);
        showError = true;
        errorMessage =
          error.message ||
          $_("SellerCreationError") ||
          "Failed to create seller account";
      }
    } finally {
      isSubmitting = false;
    }
  }

  async function otpRequest() {
    try {
      const response = await requestOtp(formData.email);

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
      const sellerRole = "seller";

      const profileData = {
        gender: formData.gender,
        ...(formData.age && { age: Number(formData.age) }),
        ...(formData.address && { address: formData.address.trim() }),
        ...(formData.confessors.length > 0 && {
          confessors: formData.confessors,
        }),
        ...(formData.profession && { profession: formData.profession.trim() }),
        ...(formData.description && {
          description: formData.description.trim(),
        }),
      };

      await register(
        formData.email,
        formData.shortname,
        otpCode,
        formData.password,
        formData.confirmPassword,
        sellerRole,
        profileData
      );

      showSuccess = true;
      successMessage =
        $_("SellerCreatedSuccessfully") ||
        "Seller account created successfully!";

      formData = {
        email: "",
        shortname: "auto",
        phoneNumber: "",
        password: "",
        confirmPassword: "",
        gender: "",
        age: "",
        address: "",
        confessorsText: "",
        confessors: [],
        profession: "",
        description: "",
      };
      showAdditionalFields = false;
      isOtpStep = false;
      otpCode = "";

      setTimeout(() => {
        showSuccess = false;
      }, 5000);
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
      errorMessage =
        error.message || $_("OtpResendError") || "Failed to resend OTP";
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

  function toggleAdditionalFields() {
    showAdditionalFields = !showAdditionalFields;
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
      $goto("/dashboard/admin");
    }
  }
</script>

<div class="create-seller-container">
  <div class="create-seller-content">
    <div class="create-seller-header">
      <div class="header-content">
        <div class="icon-wrapper">
          {#if isOtpStep}
            <LockSolid class="header-icon text-white" />
          {:else}
            <UserSolid class="header-icon text-white" />
          {/if}
        </div>
        <h1 class="create-seller-title">
          {isOtpStep
            ? $_("VerifyPhoneNumber") || "Verify OTP"
            : $_("CreateSellerAccount") || "Create Seller Account"}
        </h1>
        <p class="create-seller-description">
          {isOtpStep
            ? $_("EnterOtpSentTo") +
              " " +
              formData.email +
              " " +
              ($_("OtpTestCode") || "")
            : $_("CreateSellerAccountDescription") ||
              "Create a new seller account with the required information"}
        </p>
      </div>
    </div>

    {#if showSuccess}
      <div class="success-message" class:rtl={isRTL}>
        <CheckCircleSolid class="success-icon" />
        <div class="success-content">
          <h3 class="success-title">{$_("Success") || "Success"}</h3>
          <p class="success-description">{successMessage}</p>
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
          <p class="error-text">{errorMessage}</p>
        </div>
      </div>
    {/if}

    <div class="form-container">
      <form onsubmit={handleSubmit} class="create-seller-form">
        {#if !isOtpStep}
          <!-- Required Fields Section -->
          <div class="form-section">
            <h3 class="section-title">
              <UserSolid class="section-icon" />
              {$_("RequiredInformation")}
            </h3>

            <div class="form-group">
              <label for="shortname" class="form-label" class:rtl={isRTL}>
                <EnvelopeSolid class="label-icon" />
                {$_("Shortname")}
              </label>
              <input
                id="shortname"
                type="text"
                bind:value={formData.shortname}
                placeholder={$_("ShortnamePlaceholder")}
                class="form-input"
                class:error={errors.shortname}
                class:rtl={isRTL}
                disabled={isSubmitting}
              />
              {#if errors.shortname}
                <p class="error-text-small" class:rtl={isRTL}>
                  {errors.shortname}
                </p>
              {/if}
            </div>
            <div class="form-group">
              <label for="email" class="form-label" class:rtl={isRTL}>
                <EnvelopeSolid class="label-icon" />
                {$_("Email")}
              </label>
              <input
                id="email"
                type="email"
                bind:value={formData.email}
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
                bind:value={formData.phoneNumber}
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
              <label for="gender" class="form-label" class:rtl={isRTL}>
                <svg class="label-icon" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clip-rule="evenodd"
                  />
                </svg>
                {$_("Gender")}
              </label>
              <select
                id="gender"
                bind:value={formData.gender}
                class="form-input"
                class:error={errors.gender}
                class:rtl={isRTL}
                disabled={isSubmitting}
              >
                <option value="">{$_("SelectGender")}</option>
                <option value="male">{$_("Male")}</option>
                <option value="female">{$_("Female")}</option>
              </select>
              {#if errors.gender}
                <p class="error-text-small" class:rtl={isRTL}>
                  {errors.gender}
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
                  bind:value={formData.password}
                  placeholder={$_("Password")}
                  class="form-input password-input"
                  class:error={errors.password}
                  class:rtl={isRTL}
                  disabled={isSubmitting}
                />
                <button
                  aria-label={$_("TogglePasswordVisibility")}
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
                  bind:value={formData.confirmPassword}
                  placeholder={$_("ConfirmPasswordPlaceholder")}
                  class="form-input password-input"
                  class:error={errors.confirmPassword}
                  class:rtl={isRTL}
                  disabled={isSubmitting}
                />
                <button
                  aria-label={$_("ToggleConfirmPasswordVisibility")}
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
          </div>

          <!-- Optional Fields Section -->
          <div class="form-section">
            <div class="expandable-section-header">
              <button
                type="button"
                class="expand-toggle"
                onclick={toggleAdditionalFields}
                class:rtl={isRTL}
              >
                <svg
                  class="expand-icon {showAdditionalFields ? 'expanded' : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                <span class="expand-text">
                  {showAdditionalFields
                    ? $_("HideAdditionalInformation")
                    : $_("AddAdditionalInformation")}
                </span>
                <span class="optional-badge">{$_("Optional")}</span>
              </button>
            </div>

            {#if showAdditionalFields}
              <div class="additional-fields">
                <p class="additional-fields-description">
                  {$_("CompleteProfileDescription")}
                </p>

                <div class="optional-fields-grid">
                  <div class="form-group full-width">
                    <label for="age" class="form-label" class:rtl={isRTL}>
                      <svg
                        class="label-icon"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          d="M10 2L3 7v11c0 1.1.9 2 2 2h3v-8h4v8h3c1.1 0 2-.9 2-2V7l-7-5z"
                        />
                      </svg>
                      {$_("Age")}
                    </label>
                    <input
                      id="age"
                      type="number"
                      bind:value={formData.age}
                      placeholder={$_("AgePlaceholder")}
                      class="form-input"
                      class:error={errors.age}
                      class:rtl={isRTL}
                      disabled={isSubmitting}
                      min="1"
                      max="150"
                    />
                    {#if errors.age}
                      <p class="error-text-small" class:rtl={isRTL}>
                        {errors.age}
                      </p>
                    {/if}
                  </div>

                  <div class="form-group full-width">
                    <label
                      for="profession"
                      class="form-label"
                      class:rtl={isRTL}
                    >
                      <svg
                        class="label-icon"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                          clip-rule="evenodd"
                        />
                        <path
                          d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"
                        />
                      </svg>
                      {$_("Profession")}
                    </label>
                    <input
                      id="profession"
                      type="text"
                      bind:value={formData.profession}
                      placeholder={$_("ProfessionPlaceholder")}
                      class="form-input"
                      class:error={errors.profession}
                      class:rtl={isRTL}
                      disabled={isSubmitting}
                    />
                    {#if errors.profession}
                      <p class="error-text-small" class:rtl={isRTL}>
                        {errors.profession}
                      </p>
                    {/if}
                  </div>

                  <div class="form-group full-width">
                    <label
                      for="description"
                      class="form-label"
                      class:rtl={isRTL}
                    >
                      <svg
                        class="label-icon"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      {$_("BioDescription")}
                    </label>
                    <textarea
                      id="description"
                      bind:value={formData.description}
                      placeholder={$_("BioDescriptionPlaceholder")}
                      class="form-textarea"
                      class:error={errors.description}
                      class:rtl={isRTL}
                      disabled={isSubmitting}
                      rows="4"
                    ></textarea>
                    {#if errors.description}
                      <p class="error-text-small" class:rtl={isRTL}>
                        {errors.description}
                      </p>
                    {/if}
                  </div>

                  <div class="form-group full-width">
                    <label for="address" class="form-label" class:rtl={isRTL}>
                      <svg
                        class="label-icon"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      {$_("Address")}
                    </label>
                    <textarea
                      id="address"
                      bind:value={formData.address}
                      placeholder={$_("AddressPlaceholder")}
                      class="form-textarea"
                      class:error={errors.address}
                      class:rtl={isRTL}
                      disabled={isSubmitting}
                      rows="3"
                    ></textarea>
                    {#if errors.address}
                      <p class="error-text-small" class:rtl={isRTL}>
                        {errors.address}
                      </p>
                    {/if}
                  </div>

                  <div class="form-group full-width">
                    <label
                      for="confessors"
                      class="form-label"
                      class:rtl={isRTL}
                    >
                      <svg
                        class="label-icon"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"
                        />
                        <path
                          d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
                        />
                      </svg>
                      {$_("Confessors")}
                      <span class="field-hint">
                        ({formData.confessors.length}
                        {formData.confessors.length === 1
                          ? $_("ConfessorSingular")
                          : $_("ConfessorPlural")})
                      </span>
                    </label>
                    <textarea
                      id="confessors"
                      bind:value={formData.confessorsText}
                      placeholder={$_("ConfessorsPlaceholder")}
                      class="form-textarea"
                      class:error={errors.confessors}
                      class:rtl={isRTL}
                      disabled={isSubmitting}
                      rows="4"
                    ></textarea>
                    {#if formData.confessors.length > 0}
                      <div class="confessors-preview">
                        <p class="preview-title">{$_("ConfessorsList")}:</p>
                        <div class="confessors-tags">
                          {#each formData.confessors as confessor, index}
                            <span class="confessor-tag">
                              {confessor}
                              <button
                                type="button"
                                class="remove-tag"
                                onclick={() => {
                                  const newConfessors =
                                    formData.confessors.filter(
                                      (_, i) => i !== index
                                    );
                                  formData.confessorsText =
                                    newConfessors.join(", ");
                                }}
                                disabled={isSubmitting}
                              >
                                ×
                              </button>
                            </span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    <p class="field-help-text">
                      {$_("ConfessorsHelpText")}
                    </p>
                    {#if errors.confessors}
                      <p class="error-text-small" class:rtl={isRTL}>
                        {errors.confessors}
                      </p>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <div class="button-group">
            <button
              aria-label={$_("CreateSeller") || "Create Seller"}
              type="submit"
              class="submit-button"
              class:loading={isSubmitting}
              class:rtl={isRTL}
              disabled={isSubmitting}
            >
              {#if isSubmitting}
                <div class="loading-spinner"></div>
                {$_("CreatingSeller") || "Creating Seller..."}
              {:else}
                <UserSolid class="button-icon" />
                {$_("SendOtp") || "Send OTP"}
              {/if}
            </button>

            <button
              aria-label={$_("Cancel") || "Cancel"}
              type="button"
              class="cancel-button"
              onclick={goBack}
              disabled={isSubmitting}
            >
              {$_("Cancel") || "Cancel"}
            </button>
          </div>
        {:else}
          <!-- OTP Verification -->
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
              aria-label={$_("ResendOtpButton")}
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

          <button
            aria-label={$_("SubmitForm")}
            type="submit"
            class="submit-button"
            class:loading={isVerifyingOtp}
            class:rtl={isRTL}
            disabled={isVerifyingOtp}
            style="width: 100%;"
          >
            {#if isVerifyingOtp}
              <div class="loading-spinner"></div>
              {$_("VerifyingOtp")}
            {:else}
              <LockSolid class="button-icon" />
              {$_("VerifyOtp")}
            {/if}
          </button>
        {/if}
      </form>

      {#if isOtpStep}
        <div class="back-link items-center" class:rtl={isRTL}>
          <button
            aria-label={$_("GoBack")}
            class="link-button d-flex align-center"
            onclick={goBack}
          >
            <ArrowLeftOutline class="back-icon mx-2" />
            {$_("BackToForm")}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .create-seller-container {
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

  .create-seller-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .create-seller-header {
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

  .create-seller-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .create-seller-description {
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

  .create-seller-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    color: #1f2937;
    font-size: 1.125rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #f3f4f6;
  }

  .expandable-section-header {
    margin-bottom: 1rem;
  }

  .expand-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
    color: #374151;
  }

  .expand-toggle:hover {
    background: #f1f5f9;
    border-color: #d1d5db;
  }

  .expand-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
    color: #6b7280;
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  .expand-text {
    flex: 1;
    text-align: left;
  }

  .expand-toggle.rtl .expand-text {
    text-align: right;
  }

  .optional-badge {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .additional-fields {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .additional-fields-description {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    text-align: center;
    font-style: italic;
  }

  .optional-fields-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 640px) {
    .optional-fields-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .optional-fields-grid .form-group.full-width {
    grid-column: 1 / -1;
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

  .label-icon {
    width: 1rem;
    height: 1rem;
    color: #6b7280;
  }

  .field-hint {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 400;
    margin-left: 0.25rem;
  }

  .form-input,
  .form-textarea {
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: all 0.2s ease;
    background: white;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input.error,
  .form-textarea.error {
    border-color: #dc2626;
  }

  .form-input.rtl,
  .form-textarea.rtl {
    text-align: right;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }

  /* Confessors-specific styles */
  .confessors-preview {
    margin-top: 0.75rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .preview-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .confessors-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .confessor-tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #dbeafe;
    color: #1e40af;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .remove-tag {
    background: none;
    border: none;
    color: #1e40af;
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
    margin-left: 0.25rem;
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .remove-tag:hover:not(:disabled) {
    background: rgba(30, 64, 175, 0.1);
  }

  .remove-tag:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .field-help-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.5rem;
    font-style: italic;
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

  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .submit-button {
    flex: 1;
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

  .cancel-button {
    flex: 0.5;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    color: #6b7280;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: 1px solid #d1d5db;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1rem;
  }

  .cancel-button:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .visually-hidden {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  .resend-otp-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    margin-bottom: 1rem;
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
    justify-content: center;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
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
  }

  .link-button:hover {
    color: #2563eb;
  }

  .otp-input {
    text-align: center;
    letter-spacing: 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .create-seller-container {
      padding: 1rem;
    }

    .create-seller-title {
      font-size: 1.75rem;
    }

    .form-container {
      padding: 1.5rem;
    }

    .additional-fields {
      padding: 1rem;
    }

    .optional-fields-grid {
      grid-template-columns: 1fr;
    }

    .button-group {
      flex-direction: column;
    }

    .cancel-button {
      flex: 1;
    }
  }
</style>
