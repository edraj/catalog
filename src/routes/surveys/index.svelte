<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import {
    getSurveys,
    submitSurveyResponse,
    hasUserRespondedToSurvey,
    getUserSurveyResponses,
  } from "@/lib/dmart_services";
  import { _, locale } from "@/i18n";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";

  $goto;

  let surveys = $state([]);
  let isLoading = $state(true);
  let error = $state("");
  let responses = $state({});
  let submittingResponses = $state({});
  let userResponses = $state({});
  let selectedSurvey = $state(null);
  let showSurveyModal = $state(false);

  onMount(async () => {
    await loadSurveys();
  });

  async function loadSurveys() {
    try {
      isLoading = true;
      error = "";

      const result = await getSurveys("surveys", "managed", 100, 0, false);

      if (result && result.records) {
        surveys = result.records.map((record) => ({
          shortname: record.shortname,
          title: record.attributes?.displayname?.en || "Untitled Survey",
          description: record.attributes?.description?.en || "",
          questions: record.attributes?.payload?.body?.questions || [],
          owner_shortname: record?.attributes?.owner_shortname,
        }));

        for (const survey of surveys) {
          const hasResponded = await hasUserRespondedToSurvey(survey.shortname);
          userResponses[survey.shortname] = hasResponded;
        }
        userResponses = { ...userResponses };
      }
    } catch (err) {
      console.error("Error loading surveys:", err);
      error = $_("surveys.failed_to_load");
    } finally {
      isLoading = false;
    }
  }

  function initializeResponse(surveyShortname: string, questions: any[]) {
    if (!responses[surveyShortname]) {
      responses[surveyShortname] = {};
      questions.forEach((question) => {
        if (question.type === "multi") {
          responses[surveyShortname][question.id] = [];
        } else {
          responses[surveyShortname][question.id] = "";
        }
      });
      responses = { ...responses };
    }
  }

  function handleSingleChoice(
    surveyShortname: string,
    questionId: string,
    value: string
  ) {
    if (!responses[surveyShortname]) {
      responses[surveyShortname] = {};
    }
    responses[surveyShortname][questionId] = value;
    responses = { ...responses };
  }

  function handleMultiChoice(
    surveyShortname: string,
    questionId: string,
    optionValue: string,
    checked: boolean
  ) {
    if (!responses[surveyShortname]) {
      responses[surveyShortname] = {};
    }
    if (!responses[surveyShortname][questionId]) {
      responses[surveyShortname][questionId] = [];
    }

    const currentValues = responses[surveyShortname][questionId];
    if (checked) {
      if (!currentValues.includes(optionValue)) {
        currentValues.push(optionValue);
      }
    } else {
      const index = currentValues.indexOf(optionValue);
      if (index > -1) {
        currentValues.splice(index, 1);
      }
    }
    responses = { ...responses };
  }

  function handleTextInput(
    surveyShortname: string,
    questionId: string,
    value: string
  ) {
    if (!responses[surveyShortname]) {
      responses[surveyShortname] = {};
    }
    responses[surveyShortname][questionId] = value;
    responses = { ...responses };
  }

  async function submitResponse(survey: any) {
    const surveyResponses = responses[survey.shortname];
    if (!surveyResponses) {
      errorToastMessage($_("surveys.answer_one_question"));
      return;
    }

    for (const question of survey.questions) {
      if (
        question.required &&
        (!surveyResponses[question.id] ||
          (Array.isArray(surveyResponses[question.id]) &&
            surveyResponses[question.id].length === 0) ||
          surveyResponses[question.id].toString().trim() === "")
      ) {
        errorToastMessage(
          $_("surveys.answer_required") + `: ${question.question}`
        );
        return;
      }
    }

    try {
      submittingResponses[survey.shortname] = true;
      submittingResponses = { ...submittingResponses };

      const result = await submitSurveyResponse(
        survey.shortname,
        surveyResponses
      );

      if (result) {
        const wasFirstTime = !userResponses[survey.shortname];

        if (wasFirstTime) {
          successToastMessage($_("surveys.response_success"));
        } else {
          successToastMessage($_("surveys.response_updated"));
        }

        userResponses[survey.shortname] = true;
        userResponses = { ...userResponses };
      } else {
        throw new Error("Failed to submit response");
      }
    } catch (err) {
      console.error("Error submitting response:", err);
      errorToastMessage($_("surveys.response_error"));
    } finally {
      submittingResponses[survey.shortname] = false;
      submittingResponses = { ...submittingResponses };
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  async function openSurveyModal(survey: any) {
    selectedSurvey = survey;

    initializeResponse(survey.shortname, survey.questions);

    if (userResponses[survey.shortname]) {
      try {
        const existingResponses = await getUserSurveyResponses(
          survey.shortname
        );
        if (existingResponses) {
          responses[survey.shortname] = { ...existingResponses };
          responses = { ...responses };
        }
      } catch (error) {
        console.error("Error loading existing responses:", error);
      }
    }

    showSurveyModal = true;
  }

  function closeSurveyModal() {
    showSurveyModal = false;
    selectedSurvey = null;
  }
</script>

<svelte:head>
  <title>Surveys</title>
</svelte:head>

<div class="surveys-page">
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">{$_("surveys.title")}</h1>
      <p class="page-description">
        {$_("surveys.description")}
      </p>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          onclick={() => $goto("/surveys/manage")}
        >
          {$_("surveys.manage_button")}
        </button>
        <button
          class="btn btn-primary"
          onclick={() => $goto("/surveys/create")}
        >
          {$_("surveys.create_button")}
        </button>
      </div>
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
        <button class="btn btn-sm btn-secondary" onclick={loadSurveys}>
          {$_("surveys.retry")}
        </button>
      </div>
    {/if}

    {#if isLoading}
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>{$_("surveys.loading")}</p>
      </div>
    {:else if surveys.length === 0}
      <div class="empty-state">
        <svg
          class="empty-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        <h3>{$_("surveys.no_surveys_available")}</h3>
        <p>{$_("surveys.no_surveys_moment")}</p>
        <button
          class="btn btn-primary"
          onclick={() => $goto("/surveys/create")}
        >
          {$_("surveys.create_first")}
        </button>
      </div>
    {:else}
      <div class="surveys-list">
        {#each surveys as survey (survey.shortname)}
          <div
            class="survey-item"
            role="button"
            tabindex="0"
            onclick={() => openSurveyModal(survey)}
            onkeydown={(e) => e.key === "Enter" && openSurveyModal(survey)}
          >
            <div class="survey-info">
              <h3 class="survey-title">{survey.title}</h3>
              {#if survey.description}
                <p class="survey-description">{survey.description}</p>
              {/if}
              <div class="survey-meta">
                <span class="survey-author">By: {survey.owner_shortname}</span>
                <span class="survey-questions"
                  >{survey.questions.length} questions</span
                >
                {#if userResponses[survey.shortname]}
                  <span class="response-status"
                    >✓ {$_("surveys.already_responded")}</span
                  >
                {/if}
              </div>
            </div>
            <div class="survey-actions">
              <svg
                class="chevron-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Survey Modal -->
{#if showSurveyModal && selectedSurvey}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={closeSurveyModal}
    onkeydown={(e) => e.key === "Escape" && closeSurveyModal()}
  >
    <div
      class="modal-content"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="modal-title-section">
          <h2 class="modal-title">{selectedSurvey.title}</h2>
          {#if userResponses[selectedSurvey.shortname]}
            <span class="response-status-badge">{$_("surveys.responded")}</span>
          {/if}
        </div>
        <button
          class="modal-close"
          onclick={closeSurveyModal}
          aria-label={$_("surveys.close_modal")}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {#if selectedSurvey.description}
        <p class="modal-description">{selectedSurvey.description}</p>
      {/if}

      <div class="modal-body">
        <div class="survey-content">
          {#each selectedSurvey.questions as question, index (question.id)}
            <div class="question-container">
              <div class="question-header">
                <h4 class="question-text">
                  {index + 1}. {question.question}
                  {#if question.required}
                    <span class="required-indicator">*</span>
                  {/if}
                </h4>
              </div>

              <div class="answer-container">
                {#if question.type === "input"}
                  <input
                    type="text"
                    class="form-input"
                    placeholder={$_("surveys.type_your_answer")}
                    value={responses[selectedSurvey.shortname]?.[question.id] ||
                      ""}
                    disabled={userResponses[selectedSurvey.shortname]}
                    oninput={(e) =>
                      handleTextInput(
                        selectedSurvey.shortname,
                        question.id,
                        (e.target as HTMLInputElement).value
                      )}
                  />
                {:else if question.type === "text"}
                  <textarea
                    class="form-textarea"
                    placeholder={$_("surveys.type_your_answer")}
                    rows="4"
                    value={responses[selectedSurvey.shortname]?.[question.id] ||
                      ""}
                    disabled={userResponses[selectedSurvey.shortname]}
                    oninput={(e) =>
                      handleTextInput(
                        selectedSurvey.shortname,
                        question.id,
                        (e.target as HTMLInputElement).value
                      )}
                  ></textarea>
                {:else if question.type === "single"}
                  <div class="radio-group">
                    {#each question.options as option (option.id)}
                      <label class="radio-option">
                        <input
                          type="radio"
                          name="question-{selectedSurvey.shortname}-{question.id}"
                          value={option.value}
                          checked={responses[selectedSurvey.shortname]?.[
                            question.id
                          ] === option.value}
                          disabled={userResponses[selectedSurvey.shortname]}
                          onchange={() =>
                            handleSingleChoice(
                              selectedSurvey.shortname,
                              question.id,
                              option.label
                            )}
                        />
                        <span class="radio-label">{option.label}</span>
                      </label>
                    {/each}
                  </div>
                {:else if question.type === "multi"}
                  <div class="checkbox-group">
                    {#each question.options as option (option.id)}
                      <label class="checkbox-option">
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={responses[selectedSurvey.shortname]?.[
                            question.id
                          ]?.includes(option.label) || false}
                          disabled={userResponses[selectedSurvey.shortname]}
                          onchange={(e) =>
                            handleMultiChoice(
                              selectedSurvey.shortname,
                              question.id,
                              option.label,
                              (e.target as HTMLInputElement).checked
                            )}
                        />
                        <span class="checkbox-label">{option.label}</span>
                      </label>
                    {/each}
                  </div>
                {:else if question.type === "select"}
                  <select
                    class="form-select"
                    value={responses[selectedSurvey.shortname]?.[question.id] ||
                      ""}
                    disabled={userResponses[selectedSurvey.shortname]}
                    onchange={(e) =>
                      handleSingleChoice(
                        selectedSurvey.shortname,
                        question.id,
                        (e.target as HTMLInputElement).value
                      )}
                  >
                    <option value="">{$_("surveys.choose_an_option")}</option>
                    {#each question.options as option (option.id)}
                      <option value={option.label}>{option.label}</option>
                    {/each}
                  </select>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="modal-footer">
        {#if userResponses[selectedSurvey.shortname]}
          <div class="response-submitted">
            ✓ {$_("surveys.response_submitted")}
          </div>
          <button class="btn btn-secondary" onclick={closeSurveyModal}>
            {$_("common.close")}
          </button>
        {:else}
          <button class="btn btn-secondary" onclick={closeSurveyModal}>
            {$_("common.cancel")}
          </button>
          <button
            class="btn btn-primary"
            onclick={() => submitResponse(selectedSurvey)}
            disabled={submittingResponses[selectedSurvey.shortname]}
          >
            {#if submittingResponses[selectedSurvey.shortname]}
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
              {$_("surveys.submitting")}
            {:else}
              {$_("surveys.submit_response")}
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .surveys-page {
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
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

  .alert-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
    color: #6b7280;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    color: #6b7280;
  }

  .empty-icon {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1rem;
    color: #9ca3af;
  }

  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    margin: 0 0 2rem 0;
    max-width: 400px;
  }

  .surveys-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .survey-item {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .survey-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.15);
  }

  .survey-info {
    flex: 1;
  }

  .survey-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .survey-description {
    color: #6b7280;
    margin: 0 0 0.75rem 0;
    line-height: 1.5;
    font-size: 0.875rem;
  }

  .survey-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
    flex-wrap: wrap;
  }

  .survey-questions {
    color: #3b82f6;
    font-weight: 500;
  }

  .chevron-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #9ca3af;
    transition: color 0.2s ease;
  }

  .survey-item:hover .chevron-icon {
    color: #3b82f6;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .modal-title-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .response-status-badge {
    background: #10b981;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .modal-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: #6b7280;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-close svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-description {
    margin: 20px 0 20px 0;
    padding: 0 1.5rem;
    color: #6b7280;
    line-height: 1.6;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    align-items: center;
  }

  .response-submitted {
    color: #059669;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .survey-content {
    padding: 0;
  }

  .question-container {
    margin-bottom: 2rem;
  }

  .question-container:last-child {
    margin-bottom: 0;
  }

  .question-header {
    margin-bottom: 1rem;
  }

  .question-text {
    font-size: 1rem;
    font-weight: 500;
    color: #111827;
    margin: 0;
    line-height: 1.5;
  }

  .required-indicator {
    color: #dc2626;
    margin-left: 0.25rem;
  }

  .answer-container {
    margin-top: 0.75rem;
  }

  .form-input,
  .form-textarea,
  .form-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    background: white;
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .radio-group,
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .radio-option,
  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background-color 0.2s ease;
  }

  .radio-option:hover,
  .checkbox-option:hover {
    background-color: #f9fafb;
  }

  .radio-label,
  .checkbox-label {
    color: #374151;
    font-size: 0.875rem;
    line-height: 1.5;
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
    justify-content: center;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
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

  /* Response Status Styles */
  .response-status {
    color: #059669;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .survey-content.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .btn-secondary {
    background-color: #6b7280;
    color: white;
  }

  .btn-secondary:hover {
    background-color: #4b5563;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
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

    .survey-item {
      flex-direction: column;
      align-items: stretch;
      text-align: left;
    }

    .survey-meta {
      flex-direction: column;
      gap: 0.5rem;
    }

    .modal-content {
      margin: 0.5rem;
      max-height: 95vh;
    }

    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1rem;
    }

    .modal-footer {
      flex-direction: column;
      gap: 0.75rem;
    }

    .radio-group,
    .checkbox-group {
      gap: 0.5rem;
    }
  }
</style>
