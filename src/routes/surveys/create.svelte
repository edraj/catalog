<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import SurveyForm from "@/components/forms/SurveyForm.svelte";
  import { createEntity } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { _, locale } from "@/i18n";

  $goto;

  let survey = $state({
    title: "",
    description: "",
    questions: [],
  });

  let isLoading = $state(false);
  let error = $state("");
  let success = $state("");

  async function handleSubmit() {
    if (!survey.title.trim()) {
      error = $_("create_survey.survey_title_required");
      return;
    }

    if (!survey.questions || survey.questions.length === 0) {
      error = $_("create_survey.one_question_required");
      return;
    }

    for (let i = 0; i < survey.questions.length; i++) {
      const question = survey.questions[i];
      if (!question.question.trim()) {
        error = $_("create_survey.question_text_required_number", {
          values: { number: i + 1 },
        });
        return;
      }

      if (["single", "multi", "select"].includes(question.type)) {
        if (!question.options || question.options.length === 0) {
          error = $_("create_survey.question_options_required", {
            values: { number: i + 1 },
          });
          return;
        }

        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j];
          if (!option.value.trim() || !option.label.trim()) {
            error = $_("create_survey.option_complete_required", {
              values: { number: i + 1, option: j + 1 },
            });
            return;
          }
        }
      }
    }

    isLoading = true;
    error = "";

    try {
      const shortname =
        survey.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 50) +
        "_" +
        Date.now();

      const surveyData = {
        displayname: survey.title,
        description: survey.description,
        body: {
          questions: survey.questions,
        },
        is_active: true,
      };

      const result = await createEntity(
        surveyData,
        "surveys",
        "/surveys",
        ResourceType.content,
        "",
        "",
        "json"
      );

      if (result) {
        success = $_("create_survey.success");
        setTimeout(() => {
          $goto("/surveys");
        }, 2000);
      } else {
        error = $_("create_survey.error");
      }
    } catch (err) {
      console.error("Error creating survey:", err);
      error = $_("create_survey.error_creating");
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    $goto("/surveys");
  }
</script>

<svelte:head>
  <title>Create Survey</title>
</svelte:head>

<div class="create-survey-page">
  <div class="page-header">
    <div class="header-content">
      <div class="breadcrumb">
        <a href="/surveys" class="breadcrumb-link"
          >{$_("create_survey.breadcrumb_surveys")}</a
        >
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current"
          >{$_("create_survey.breadcrumb_text")}</span
        >
      </div>
      <h1 class="page-title">{$_("create_survey.title")}</h1>
      <p class="page-description">
        {$_("create_survey.description")}
      </p>
    </div>
  </div>

  <div class="page-content">
    {#if error}
      <div class="alert alert-error">
        <svg class="alert-icon" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    {#if success}
      <div class="alert alert-success">
        <svg class="alert-icon" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{success}</span>
      </div>
    {/if}

    <div class="form-container">
      <SurveyForm bind:survey />

      <div class="form-actions">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleCancel}
          disabled={isLoading}
        >
          {$_("create_survey.cancel")}
        </button>

        <button
          type="button"
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={isLoading}
        >
          {#if isLoading}
            <svg class="spinner" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                fill="none"
                stroke-dasharray="32"
                stroke-dashoffset="32"
              >
                <animate
                  attributeName="stroke-dasharray"
                  dur="2s"
                  values="0 32;16 16;0 32;0 32"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-dashoffset"
                  dur="2s"
                  values="0;-16;-32;-32"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
            {$_("create_survey.creating")}
          {:else}
            {$_("create_survey.create_button")}
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .create-survey-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  }

  .page-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 2rem 0;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .breadcrumb-link {
    color: #3b82f6;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .breadcrumb-link:hover {
    color: #2563eb;
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: #9ca3af;
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .page-description {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  .page-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    font-weight: 500;
  }

  .alert-error {
    background-color: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .alert-success {
    background-color: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  .alert-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .form-container {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 2rem;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 120px;
    justify-content: center;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #4b5563;
    transform: translateY(-1px);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .header-content {
      padding: 0 1rem;
    }

    .page-content {
      padding: 1rem;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .page-description {
      font-size: 1rem;
    }

    .form-actions {
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn {
      width: 100%;
    }
  }
</style>
