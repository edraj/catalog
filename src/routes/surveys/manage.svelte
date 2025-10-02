<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import {
    getUserSurveys,
    getSurveys,
    getEntity,
    getUserSurveyResponses,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { _, locale } from "@/i18n";
  import { user } from "@/stores/user";

  $goto;

  let mySurveys = $state([]);
  let respondedSurveys = $state([]);
  let activeTab = $state("my-surveys");
  let isLoading = $state(true);
  let error = $state("");
  let selectedSurvey = $state(null);
  let surveyAnalytics = $state(null);
  let isModalOpen = $state(false);

  onMount(async () => {
    await loadSurveys();
  });

  async function loadSurveys() {
    try {
      isLoading = true;
      error = "";

      mySurveys = await getUserSurveys();

      for (let survey of mySurveys) {
        const surveyDetail = await getEntity(
          survey.shortname,
          "surveys",
          "surveys",
          ResourceType.content,
          "managed",
          true,
          true
        );

        if (
          surveyDetail &&
          surveyDetail.attachments &&
          surveyDetail.attachments.json
        ) {
          survey.responses = surveyDetail.attachments.json || [];
          survey.responseCount = survey.responses.length;
        } else {
          survey.responses = [];
          survey.responseCount = 0;
        }
      }

      const allSurveys = await getSurveys("surveys", "managed", 100, 0, false);
      respondedSurveys = [];

      if (allSurveys && allSurveys.records) {
        for (let record of allSurveys.records) {
          if (record.attributes?.owner_shortname === $user?.shortname) {
            continue;
          }

          const surveyDetail = await getEntity(
            record.shortname,
            "surveys",
            "surveys",
            ResourceType.content,
            "managed",
            true,
            true
          );

          if (
            surveyDetail &&
            surveyDetail.attachments &&
            surveyDetail.attachments.json
          ) {
            const userResponse = surveyDetail.attachments.json.find(
              (attachment: any) =>
                attachment.attributes?.owner_shortname === $user?.shortname
            );

            if (userResponse) {
              const survey = {
                shortname: record.shortname,
                title:
                  record.attributes?.displayname?.en ||
                  $_("surveys.untitled_survey"),
                description: record.attributes?.description?.en || "",
                questions: record.attributes?.payload?.body?.questions || [],
                owner_shortname: record.attributes?.owner_shortname,
                created_at: record.attributes?.created_at,
                userResponse: userResponse.attributes?.payload?.body || {},
                submittedAt: userResponse.attributes?.created_at,
              };

              respondedSurveys.push(survey);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading surveys:", err);
      error = "Failed to load surveys. Please try again.";
    } finally {
      isLoading = false;
    }
  }

  function openSurveyModal(survey: any, type = "manage") {
    selectedSurvey = { ...survey, modalType: type };
    isModalOpen = true;
    if (type === "manage" && survey.shortname) {
      loadSurveyAnalytics(survey.shortname);
    }
  }

  function closeSurveyModal() {
    selectedSurvey = null;
    surveyAnalytics = null;
    isModalOpen = false;
  }

  async function loadSurveyAnalytics(surveyShortname: string) {
    try {
      const survey = mySurveys.find((s) => s.shortname === surveyShortname);
      if (survey && survey.responses) {
        surveyAnalytics = {
          totalResponses: survey.responses.length,
          responseData: survey.responses.map((response) => ({
            shortname: response.shortname,
            respondent: response.attributes?.owner_shortname,
            submittedAt: response.attributes?.created_at,
            responses: response.attributes?.payload?.body || {},
          })),
        };
      }
    } catch (error) {
      console.error("Error loading survey analytics:", error);
    }
  }

  function exportSurveyData(survey: any) {
    if (!surveyAnalytics?.responseData) return;

    const exportData = {
      survey: {
        title: survey.attributes?.displayname?.en || survey.title,
        description: survey.attributes?.description?.en || survey.description,
        questions: survey.attributes?.payload?.body?.questions || [],
        createdAt: survey.attributes?.created_at,
      },
      analytics: {
        totalResponses: surveyAnalytics.totalResponses,
        responses: surveyAnalytics.responseData,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${survey.shortname}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function navigateToSurvey(shortname: string) {
    $goto(`/surveys/${shortname}`);
  }

  function formatDate(dateString: string) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function formatDateTime(dateString: string) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  }
</script>

<svelte:head>
  <title>{$_("survey_manage.title")}</title>
</svelte:head>

<div class="manage-page">
  <div class="page-header">
    <div class="header-content">
      <div class="header-left">
        <button class="btn btn-ghost" onclick={() => $goto("/surveys")}>
          <svg
            class="icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {$_("survey_manage.back_to_surveys")}
        </button>
        <h1 class="page-title">{$_("survey_manage.title")}</h1>
        <p class="page-description">{$_("survey_manage.description")}</p>
      </div>
      <div class="header-actions">
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
          {$_("common.retry")}
        </button>
      </div>
    {/if}

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab-button {activeTab === 'my-surveys' ? 'active' : ''}"
        onclick={() => (activeTab = "my-surveys")}
      >
        {$_("survey_manage.your_surveys")}
      </button>
      <button
        class="tab-button {activeTab === 'responded' ? 'active' : ''}"
        onclick={() => (activeTab = "responded")}
      >
        {$_("survey_manage.surveys_replied_on")}
      </button>
    </div>

    {#if isLoading}
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>{$_("survey_manage.loading")}</p>
      </div>
    {:else}
      <!-- My Surveys Tab -->
      {#if activeTab === "my-surveys"}
        <div class="surveys-list">
          {#if mySurveys.length === 0}
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
              <h3>{$_("survey_manage.no_surveys")}</h3>
              <p>{$_("survey_manage.no_surveys_description")}</p>
              <button
                class="btn btn-primary"
                onclick={() => $goto("/surveys/create")}
              >
                {$_("survey_manage.create_first")}
              </button>
            </div>
          {:else}
            {#each mySurveys as survey}
              <div
                class="survey-item"
                role="button"
                tabindex="0"
                onclick={() => openSurveyModal(survey, "manage")}
                onkeydown={(e) =>
                  e.key === "Enter" && openSurveyModal(survey, "manage")}
              >
                <div class="survey-content">
                  <h3 class="survey-title">
                    {survey.attributes?.displayname?.en ||
                      $_("surveys.untitled_survey")}
                  </h3>
                  <p class="survey-description">
                    {survey.attributes?.description?.en || ""}
                  </p>
                  <div class="survey-meta">
                    <span class="survey-date"
                      >{$_("survey_manage.created")}: {formatDate(
                        survey.attributes?.created_at
                      )}</span
                    >
                    <span class="survey-questions"
                      >{survey.attributes?.payload?.body?.questions?.length ||
                        0}
                      {$_("survey_manage.questions")}</span
                    >
                    <span class="survey-responses"
                      >{survey.responseCount || 0} responses</span
                    >
                  </div>
                </div>
                <div class="survey-chevron">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 18L15 12L9 6"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}

      <!-- Responded Surveys Tab -->
      {#if activeTab === "responded"}
        <div class="surveys-list">
          {#if respondedSurveys.length === 0}
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
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3>{$_("survey_manage.no_responses")}</h3>
              <p>{$_("survey_manage.no_responses_description")}</p>
            </div>
          {:else}
            {#each respondedSurveys as survey}
              <div
                class="survey-item"
                role="button"
                tabindex="0"
                onclick={() => openSurveyModal(survey, "view-response")}
                onkeydown={(e) =>
                  e.key === "Enter" && openSurveyModal(survey, "view-response")}
              >
                <div class="survey-content">
                  <h3 class="survey-title">{survey.title}</h3>
                  <p class="survey-description">{survey.description}</p>
                  <div class="survey-meta">
                    <span class="survey-author"
                      >By: {survey.owner_shortname}</span
                    >
                    <span class="survey-date"
                      >Responded on: {formatDate(survey.submittedAt)}</span
                    >
                    <span class="survey-questions"
                      >{survey.questions.length} questions</span
                    >
                  </div>
                </div>
                <div class="survey-chevron">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 18L15 12L9 6"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Modal Overlay -->
{#if isModalOpen && selectedSurvey}
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
        <h2>
          {#if selectedSurvey.modalType === "manage"}
            {selectedSurvey.attributes?.displayname?.en ||
              $_("surveys.untitled_survey")}
          {:else if selectedSurvey.modalType === "view-response"}
            {selectedSurvey.survey.title}
          {/if}
        </h2>
        <button
          class="modal-close"
          onclick={closeSurveyModal}
          aria-label="Close modal"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        {#if selectedSurvey.modalType === "manage"}
          <!-- Survey Management View -->
          <div class="survey-details">
            <p class="survey-description">
              {selectedSurvey.attributes?.description?.en || ""}
            </p>

            <div class="management-actions">
              {#if surveyAnalytics && surveyAnalytics.totalResponses > 0}
                <button
                  class="btn btn-secondary"
                  onclick={() => exportSurveyData(selectedSurvey)}
                >
                  {$_("survey_manage.export")}
                </button>
              {/if}
            </div>

            <!-- Questions List -->
            <div class="details-section">
              <h4>{$_("survey_manage.survey_questions")}</h4>
              <div class="questions-list">
                {#each selectedSurvey.attributes?.payload?.body?.questions || [] as question, index}
                  <div class="question-preview">
                    <span class="question-number">{index + 1}.</span>
                    <span class="question-text">{question.question}</span>
                    <span class="question-type">({question.type})</span>
                    {#if question.required}
                      <span class="required-indicator">*</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            {#if surveyAnalytics}
              <div class="analytics-section">
                <h3>{$_("survey_manage.analytics")}</h3>
                <div class="analytics-grid">
                  <div class="stat-card">
                    <div class="stat-number">
                      {surveyAnalytics.totalResponses}
                    </div>
                    <div class="stat-label">
                      {$_("survey_manage.total_responses")}
                    </div>
                  </div>
                </div>

                {#if surveyAnalytics.responseData && surveyAnalytics.responseData.length > 0}
                  <div class="responses-list">
                    <h4>{$_("survey_manage.recent_responses")}</h4>
                    {#each surveyAnalytics.responseData.slice(0, 5) as response}
                      <div class="response-item">
                        <div class="response-header">
                          <span class="respondent">{response.respondent}</span>
                          <span class="response-date"
                            >{formatDateTime(response.submittedAt)}</span
                          >
                        </div>
                        <div class="response-summary">
                          {#each Object.entries(response.responses) as [questionId, answer]}
                            <div class="answer-item">
                              {#if Array.isArray(answer)}
                                <span>{answer.join(", ")}</span>
                              {:else}
                                <span>{answer}</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="no-responses">
                    <svg
                      class="no-responses-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                    <p>{$_("survey_manage.no_responses")}</p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {:else if selectedSurvey.modalType === "view-response"}
          <!-- User Response View -->
          <div class="response-view">
            <div class="response-meta">
              <p>
                <strong>Survey by:</strong>
                {selectedSurvey.owner_shortname}
              </p>
              <p>
                <strong>Submitted on:</strong>
                {formatDateTime(selectedSurvey.submittedAt)}
              </p>
            </div>

            <div class="questions-answers">
              {#each selectedSurvey.questions as question, index}
                <div class="question-block">
                  <div class="question-header">
                    <span class="question-number">{index + 1}</span>
                    <h4 class="question-title">{question.question}</h4>
                  </div>

                  <div class="user-answer">
                    <strong>Your answer:</strong>
                    {#if selectedSurvey.userResponse[question.id]}
                      <span class="answer-text">
                        {#if question.type === "single" || question.type === "select"}
                          {selectedSurvey.userResponse[question.id]}
                        {:else if question.type === "multiple"}
                          {Array.isArray(
                            selectedSurvey.userResponse[question.id]
                          )
                            ? selectedSurvey.userResponse[question.id].join(
                                ", "
                              )
                            : selectedSurvey.userResponse[question.id]}
                        {:else}
                          {selectedSurvey.userResponse[question.id]}
                        {/if}
                      </span>
                    {:else}
                      <span class="no-answer">No answer provided</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={closeSurveyModal}>
          {$_("common.close")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .manage-page {
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
    align-items: flex-start;
    gap: 2rem;
  }

  .header-left {
    flex: 1;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 1rem 0 0.5rem 0;
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

  .icon {
    width: 1rem;
    height: 1rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-ghost {
    background: transparent;
    color: #6b7280;
  }

  .btn-ghost:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-outline {
    background: transparent;
    color: #3b82f6;
    border: 1px solid #3b82f6;
  }

  .btn-outline:hover {
    background: #3b82f6;
    color: white;
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
  }

  .btn-secondary:hover {
    background: #4b5563;
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
    padding: 4rem;
    text-align: center;
    color: #6b7280;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    text-align: center;
  }

  .empty-icon {
    width: 4rem;
    height: 4rem;
    color: #9ca3af;
    margin-bottom: 1rem;
  }

  /* Tabs */
  .tabs {
    display: flex;
    border-bottom: 2px solid #e5e7eb;
    margin-bottom: 2rem;
  }

  .tab-button {
    padding: 1rem 2rem;
    border: none;
    background: transparent;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .tab-button:hover {
    color: #374151;
  }

  .tab-button.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  /* Surveys List */
  .surveys-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .survey-item {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .survey-item:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .survey-content {
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
    margin: 0 0 1rem 0;
    line-height: 1.6;
  }

  .survey-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
    flex-wrap: wrap;
  }

  .survey-responses {
    color: #3b82f6;
    font-weight: 500;
  }

  .survey-author {
    color: #6b7280;
  }

  .survey-chevron {
    color: #9ca3af;
    margin-left: 1rem;
  }

  /* Modal */
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
    border-radius: 12px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
  }

  .modal-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .management-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .details-section {
    margin-bottom: 2rem;
  }

  .details-section h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .question-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .question-number {
    font-weight: 600;
    color: #3b82f6;
  }

  .question-text {
    flex: 1;
    color: #374151;
  }

  .question-type {
    color: #6b7280;
    font-size: 0.75rem;
    background: #e5e7eb;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .required-indicator {
    color: #dc2626;
    font-weight: 600;
  }

  .analytics-section {
    margin-top: 2rem;
  }

  .analytics-section h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: #f9fafb;
    padding: 1.5rem;
    border-radius: 8px;
    text-align: center;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: 700;
    color: #3b82f6;
  }

  .stat-label {
    color: #6b7280;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .responses-list {
    margin-top: 1rem;
  }

  .responses-list h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .answer-item {
    margin-bottom: 0.25rem;
  }

  .answer-item:last-child {
    margin-bottom: 0;
  }

  .response-item {
    background: #f9fafb;
    padding: 1rem;
    border-radius: 6px;
    border-left: 3px solid #3b82f6;
    margin-bottom: 0.75rem;
  }

  .response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .respondent {
    font-weight: 500;
    color: #111827;
  }

  .response-date {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .response-summary {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .no-responses {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    text-align: center;
    color: #9ca3af;
  }

  .no-responses-icon {
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
  }

  /* Response View */
  .response-view {
    max-height: 60vh;
    overflow-y: auto;
  }

  .response-meta {
    background: #f9fafb;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .questions-answers {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .question-block {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .question-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .question-number {
    background: #3b82f6;
    color: white;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .question-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .question-description {
    color: #6b7280;
    margin: 0 0 1rem 0;
    font-style: italic;
  }

  .user-answer {
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 6px;
    border-left: 4px solid #10b981;
  }

  .answer-text {
    color: #111827;
    font-weight: 500;
  }

  .no-answer {
    color: #6b7280;
    font-style: italic;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .survey-item {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .survey-chevron {
      align-self: center;
      margin-left: 0;
    }

    .page-content {
      padding: 1rem;
    }

    .modal-content {
      margin: 0.5rem;
      max-height: 95vh;
    }

    .tabs {
      flex-direction: column;
    }

    .tab-button {
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      border-left: 3px solid transparent;
    }

    .tab-button.active {
      border-left-color: #3b82f6;
      border-bottom-color: #e5e7eb;
    }
  }
</style>
