<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import SurveyForm from "@/components/forms/SurveyForm.svelte";
  import { createEntity } from "@/lib/dmart_services/dmart_services";
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
        "json",
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
  <div class="page-container">
    <div class="page-header">
      <button class="back-button" onclick={handleCancel} aria-label="Go back">
        <svg
          class="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
      </button>
      <div class="title-container">
        <h1 class="page-title">{$_("create_survey.title")}</h1>
        <p class="page-description">
          Build a survey to collect feedback from the community
        </p>
      </div>
    </div>

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
    </div>

    <!-- Move Actions Outside -->
    <div class="form-actions">
      <button
        type="button"
        class="cancel-btn"
        onclick={handleCancel}
        disabled={isLoading}
      >
        {$_("create_survey.cancel")}
      </button>

      <div class="right-actions">
        <button
          type="button"
          class="btn btn-outline"
          disabled={isLoading}
          onclick={() => console.log("Preview not implemented yet")}
        >
          <svg
            class="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            ></path><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            ></path></svg
          >
          Preview
        </button>
        <button
          type="button"
          class="btn btn-outline"
          disabled={isLoading}
          onclick={() => console.log("Save Draft not implemented yet")}
        >
          <svg
            class="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            ></path></svg
          >
          Save Draft
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={isLoading}
        >
          {#if isLoading}
            <svg class="spinner mr-2" viewBox="0 0 24 24">
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
    background-color: #f9fafb; /* Lighter, solid background to match Figma */
    padding: 2rem 0;
  }

  .page-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .back-button {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    margin-top: -0.25rem; /* Align icon with title text roughly */
  }

  .title-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .page-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 8px;
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
    /* We remove the monolithic box-shadow, the SurveyForm component will handle its own cards */
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
  }

  .right-actions {
    display: flex;
    gap: 0.75rem;
  }

  .cancel-btn {
    background: none;
    border: none;
    color: #6b7280;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.5rem;
  }

  .cancel-btn:hover:not(:disabled) {
    color: #374151;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #5a67d8; /* Matching the purple-blue from Figma roughly */
    color: white;
    border: none;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #4c51bf;
  }

  .btn-outline {
    background-color: white;
    color: #374151;
    border: 1px solid #e5e7eb;
  }

  .btn-outline:hover:not(:disabled) {
    background-color: #f9fafb;
    border-color: #d1d5db;
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
  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }
    .right-actions {
      flex-direction: column;
    }
    .cancel-btn {
      order: 2;
    }
  }
</style>
