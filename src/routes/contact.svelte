<script>
  import { goto } from "@roxi/routify";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import {
    EnvelopeSolid,
    UserSolid,
    CheckCircleSolid,
    ArrowLeftOutline,
    MessagesSolid,
    MailBoxOutline,
  } from "flowbite-svelte-icons";
  import { contactUs } from "@/stores/user";

  const isRTL = $locale === "ar" || $locale === "ku";

  let name = "";
  let email = "";
  let subject = "";
  let message = "";
  let isSubmitting = false;
  let showSuccess = false;
  let showError = false;
  let errors = {};

  function validateForm() {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = $_("NameRequired");
    }

    if (!message.trim()) {
      newErrors.message = $_("MessageRequired");
    } else if (message.trim().length < 10) {
      newErrors.message = $_("MessageTooShort");
    } else if (message.trim().length > 1000) {
      newErrors.message = $_("MessageTooLong");
    }

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    isSubmitting = true;
    showError = false;

    try {
      await contactUs(name, email, message, subject);

      name = "";
      email = "";
      subject = "";
      message = "";
      errors = {};
      showSuccess = true;

      setTimeout(() => {
        showSuccess = false;
      }, 5000);
    } catch (error) {
      showError = true;
      setTimeout(() => {
        showError = false;
      }, 5000);
    } finally {
      isSubmitting = false;
    }
  }

  function goBack() {
    $goto("/");
  }
</script>

<div class="contact-container">
  <div class="contact-content">
    <div class="contact-header">
      <button
        onclick={() => history.back()}
        class="flex items-center cursor-pointer bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 px-4 py-2 rounded-lg font-medium"
      >
        <ArrowLeftOutline
          class="w-5 h-5 me-2 ltr:rotate-0 rtl:rotate-180 transform transition-transform duration-200"
        />
        {$_("Back")}
      </button>

      <div class="header-content">
        <div class="icon-wrapper">
          <MessagesSolid class="header-icon text-white w-6 h-6" />
        </div>
        <h1 class="contact-title">{$_("ContactUs")}</h1>
        <h2 class="contact-subtitle">{$_("ContactUsTitle")}</h2>
        <p class="contact-description">{$_("ContactUsDescription")}</p>
      </div>
    </div>

    {#if showSuccess}
      <div class="success-message" class:rtl={isRTL}>
        <CheckCircleSolid class="success-icon" />
        <div class="success-content">
          <h3 class="success-title">{$_("MessageSent")}</h3>
          <p class="success-description">{$_("MessageSentDescription")}</p>
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
          <p class="error-text">{$_("MessageError")}</p>
        </div>
      </div>
    {/if}

    <div class="form-container">
      <form onsubmit={handleSubmit} class="contact-form">
        <div class="form-group">
          <label for="name" class="form-label" class:rtl={isRTL}>
            <UserSolid class="label-icon" />
            {$_("YourName")}
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            placeholder={$_("YourNamePlaceholder")}
            class="form-input"
            class:error={errors.name}
            class:rtl={isRTL}
            disabled={isSubmitting}
          />
          {#if errors.name}
            <p class="error-text-small" class:rtl={isRTL}>{errors.name}</p>
          {/if}
        </div>
        <div class="form-group">
          <label for="subject" class="form-label" class:rtl={isRTL}>
            <UserSolid class="label-icon" />
            {$_("YourSubject")}
          </label>
          <input
            id="subject"
            type="text"
            bind:value={subject}
            placeholder={$_("YourSubjectPlaceholder")}
            class="form-input"
            class:error={errors.subject}
            class:rtl={isRTL}
            disabled={isSubmitting}
          />
          {#if errors.subject}
            <p class="error-text-small" class:rtl={isRTL}>{errors.subject}</p>
          {/if}
        </div>
        <div class="form-group">
          <label for="email" class="form-label" class:rtl={isRTL}>
            <MailBoxOutline class="label-icon" />
            {$_("YourEmail")}
          </label>
          <input
            id="email"
            type="text"
            bind:value={email}
            placeholder={$_("YourEmailPlaceholder")}
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
          <label for="message" class="form-label" class:rtl={isRTL}>
            <EnvelopeSolid class="label-icon" />
            {$_("YourMessage")}
          </label>
          <textarea
            id="message"
            bind:value={message}
            placeholder={$_("YourMessagePlaceholder")}
            rows="6"
            class="form-textarea"
            class:error={errors.message}
            class:rtl={isRTL}
            disabled={isSubmitting}
          ></textarea>
          <div class="character-count" class:rtl={isRTL}>
            <span class:over-limit={message.length > 1000}>
              {message.length}/1000
            </span>
          </div>
          {#if errors.message}
            <p class="error-text-small" class:rtl={isRTL}>{errors.message}</p>
          {/if}
        </div>

        <button
          type="submit"
          class="submit-button"
          class:loading={isSubmitting}
          class:rtl={isRTL}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <div class="loading-spinner"></div>
            {$_("SendingMessage")}
          {:else}
            <EnvelopeSolid class="button-icon" />
            {$_("SendMessage")}
          {/if}
        </button>
      </form>
    </div>

    <div class="additional-info">
      <div class="info-card">
        <MessagesSolid class="info-icon" />
        <div class="info-content">
          <h3 class="info-title">{$_("Welcome")}</h3>
          <p class="info-description">
            {isRTL
              ? "نحن نقدر ملاحظاتك ونسعى لتحسين تجربتك معنا باستمرار."
              : "We value your feedback and strive to continuously improve your experience with us."}
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .contact-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
    padding: 2rem 1rem;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .contact-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .contact-header {
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

  .contact-title {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .contact-subtitle {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1rem;
  }

  .contact-description {
    font-size: 1.125rem;
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
    margin-bottom: 2rem;
  }

  .contact-form {
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
    min-height: 120px;
  }

  .character-count {
    font-size: 0.75rem;
    color: #6b7280;
    text-align: right;
  }

  .character-count.rtl {
    text-align: left;
  }

  .over-limit {
    color: #dc2626;
    font-weight: 600;
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

  .additional-info {
    margin-top: 2rem;
  }

  .info-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: 1px solid #f3f4f6;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .info-title {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .info-description {
    color: #6b7280;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .contact-container {
      padding: 1rem;
    }

    .contact-title {
      font-size: 2rem;
    }

    .contact-subtitle {
      font-size: 1.25rem;
    }

    .form-container {
      padding: 1.5rem;
    }

    .info-card {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
