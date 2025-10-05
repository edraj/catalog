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
  import { derived } from "svelte/store";

  $goto;

  let mySurveys = $state([]);
  let respondedSurveys = $state([]);
  let activeTab = $state("my-surveys");
  let isLoading = $state(true);
  let error = $state("");
  let selectedSurvey = $state(null);
  let surveyAnalytics = $state(null);
  let isModalOpen = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

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
    class:rtl={$isRTL}
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
            {selectedSurvey.title}
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
                <div class="analytics-grid">
                  <div class="stat-card">
                    <div class="stat-icon">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <div class="stat-content">
                      <div class="stat-number">
                        {surveyAnalytics.totalResponses}
                      </div>
                      <div class="stat-label">
                        {$_("survey_manage.total_responses")}
                      </div>
                    </div>
                    <div class="stat-trend positive">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {#if surveyAnalytics.responseData && surveyAnalytics.responseData.length > 0}
                  <div class="responses-container">
                    <div class="responses-header">
                      <h4>{$_("survey_manage.recent_responses")}</h4>
                      <span class="response-count"
                        >{surveyAnalytics.responseData.length}
                        {$_("survey_manage.responses")}</span
                      >
                    </div>

                    <div class="responses-list">
                      {#each surveyAnalytics.responseData.slice(0, 5) as response, idx}
                        <div class="response-card">
                          <div class="response-card-header">
                            <div class="respondent-info">
                              <div class="respondent-avatar">
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                              </div>
                              <div class="respondent-details">
                                <span class="respondent-name"
                                  >{response.respondent}</span
                                >
                                <span class="response-number"
                                  >Response #{idx + 1}</span
                                >
                              </div>
                            </div>
                            <div class="response-meta">
                              <span class="response-date">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                {formatDateTime(response.submittedAt)}
                              </span>
                            </div>
                          </div>

                          <div class="response-content">
                            {#each Object.entries(response.responses) as [questionId, answer]}
                              {@const question =
                                selectedSurvey.attributes?.payload?.body?.questions.find(
                                  (q) => q.id === questionId
                                )}
                              {#if question}
                                <div class="answer-group">
                                  <div class="answer-question">
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span>{question.question}</span>
                                  </div>
                                  <div class="answer-value">
                                    {#if Array.isArray(answer)}
                                      <div class="multi-answer-tags">
                                        {#each answer as item}
                                          <span class="mini-tag">{item}</span>
                                        {/each}
                                      </div>
                                    {:else}
                                      <span class="single-answer-text"
                                        >{answer}</span
                                      >
                                    {/if}
                                  </div>
                                </div>
                              {/if}
                            {/each}
                          </div>
                        </div>
                      {/each}
                    </div>

                    {#if surveyAnalytics.responseData.length > 5}
                      <div class="view-all-container">
                        <button class="view-all-btn">
                          {$_("survey_manage.view_all")} ({surveyAnalytics
                            .responseData.length - 5}
                          {$_("survey_manage.more")})
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="no-responses">
                    <div class="no-responses-illustration">
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
                    </div>
                    <h4>{$_("survey_manage.no_responses_yet")}</h4>
                    <p>{$_("survey_manage.no_responses_message")}</p>
                    <button class="share-survey-btn">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      {$_("survey_manage.share_survey")}
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
        {#if selectedSurvey.modalType === "view-response"}
          <div class="response-view">
            <div class="response-meta">
              <p>
                <strong>{$_("survey_manage.survey_by")}:</strong>
                {selectedSurvey.owner_shortname}
              </p>
              <p>
                <strong>{$_("survey_manage.submitted_on")} : </strong>
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
                    <strong>{$_("survey_manage.your_answer")} :</strong>
                    {#if selectedSurvey.userResponse[question.id]}
                      {#if question.type === "multi" && Array.isArray(selectedSurvey.userResponse[question.id])}
                        <div class="answer-text multiple-answer">
                          {#each selectedSurvey.userResponse[question.id] as answer}
                            <span class="answer-tag">{answer}</span>
                          {/each}
                        </div>
                      {:else if question.type === "single" || question.type === "select"}
                        <span class="answer-text single-answer">
                          {selectedSurvey.userResponse[question.id]}
                        </span>
                      {:else if question.type === "input"}
                        <span class="answer-text text-answer">
                          {selectedSurvey.userResponse[question.id]}
                        </span>
                      {:else}
                        <span class="answer-text">
                          {Array.isArray(
                            selectedSurvey.userResponse[question.id]
                          )
                            ? selectedSurvey.userResponse[question.id].join(
                                " . \n "
                              )
                            : selectedSurvey.userResponse[question.id]}
                        </span>
                      {/if}
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

  .rtl {
    direction: rtl;
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
    margin-top: 20px;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
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
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(to bottom, #ffffff, #f9fafb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.025em;
  }

  .modal-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
    transform: scale(1.05);
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  .modal-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    background: #f9fafb;
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
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .question-preview {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
    font-size: 0.875rem;
    border: 1px solid #e5e7eb;
    transition: all 0.2s ease;
  }

  .question-preview:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .question-number {
    font-weight: 700;
    color: #3b82f6;
    min-width: 1.5rem;
  }

  .question-text {
    flex: 1;
    color: #374151;
    font-weight: 500;
  }

  .question-type {
    color: #6b7280;
    font-size: 0.75rem;
    background: #e5e7eb;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .required-indicator {
    color: #dc2626;
    font-weight: 700;
    font-size: 1.25rem;
  }

  .analytics-section {
    margin-top: 2rem;
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
  }

  .stat-number {
    font-size: 2.5rem;
    font-weight: 800;
    color: white;
  }

  .stat-label {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.875rem;
    margin-top: 0.5rem;
    font-weight: 500;
  }

  .responses-list {
    margin-top: 1.5rem;
  }

  .response-date {
    font-size: 0.75rem;
    color: #9ca3af;
    font-weight: 500;
  }

  .no-responses {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 2rem;
    text-align: center;
    color: #9ca3af;
  }

  .no-responses-icon {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .response-view {
    max-height: 60vh;
    overflow-y: auto;
  }

  .response-meta {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    border: 1px solid #bae6fd;
  }

  .response-meta p {
    margin: 0.5rem 0;
    color: #0c4a6e;
    font-size: 0.95rem;
  }

  .response-meta strong {
    color: #075985;
    font-weight: 600;
  }

  .questions-answers {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .question-block {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
    background: white;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }

  .question-block:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .question-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  .question-number {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 700;
    flex-shrink: 0;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.4);
  }

  .question-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    line-height: 1.5;
    flex: 1;
  }

  .user-answer {
    padding: 1.5rem;
    background: white;
  }

  .user-answer strong {
    display: block;
    color: #6b7280;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .answer-text {
    color: #111827;
    font-weight: 500;
    font-size: 1rem;
    display: block;
    line-height: 1.6;
  }

  .answer-text.multiple-answer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .answer-tag {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
    transition: all 0.2s ease;
  }

  .answer-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(16, 185, 129, 0.4);
  }

  .answer-tag::before {
    content: "✓";
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }

  .answer-text.single-answer {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    color: #1e40af;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    display: inline-block;
    font-weight: 600;
    border-left: 4px solid #3b82f6;
    margin-top: 0.5rem;
  }

  /* Text Input Answer */
  .answer-text.text-answer {
    background: #f9fafb;
    color: #374151;
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #6b7280;
    font-style: italic;
    margin-top: 0.5rem;
    line-height: 1.6;
  }

  .no-answer {
    color: #9ca3af;
    font-style: italic;
    background: #f9fafb;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    display: inline-block;
    border-left: 4px solid #e5e7eb;
    margin-top: 0.5rem;
  }

  /* Button Styles */
  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .modal-content {
      max-width: 100%;
      max-height: 95vh;
      border-radius: 12px 12px 0 0;
    }

    .modal-header {
      padding: 1.5rem;
    }

    .modal-header h2 {
      font-size: 1.25rem;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .question-header {
      flex-direction: column;
      gap: 0.75rem;
    }

    .answer-tag {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }
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

  /* Analytics Section */
  .analytics-section {
    margin-top: 2rem;
    animation: fadeInUp 0.4s ease;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* Enhanced Stat Card */
  .stat-card {
    background: white;
    padding: 2rem;
    border-radius: 16px;
    border: 2px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .stat-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
  }

  .stat-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
    transform: translateY(-4px);
  }

  .stat-icon {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .stat-content {
    flex: 1;
  }

  .stat-number {
    font-size: 2.5rem;
    font-weight: 800;
    color: #111827;
    line-height: 1;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .stat-label {
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-trend {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-trend.positive {
    background: #d1fae5;
    color: #059669;
  }

  /* Responses Container */
  .responses-container {
    margin-top: 2rem;
  }

  .responses-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .responses-header h4 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .response-count {
    background: #f3f4f6;
    color: #6b7280;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .responses-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Enhanced Response Card */
  .response-card {
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .response-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.15);
    transform: translateX(4px);
  }

  .response-card-header {
    padding: 1.5rem;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e5e7eb;
  }

  .respondent-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .respondent-avatar {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }

  .respondent-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .respondent-name {
    font-weight: 700;
    color: #111827;
    font-size: 1rem;
  }

  .response-number {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
  }

  .response-meta {
    display: flex;
    align-items: space-between;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .response-date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
    background: white;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-weight: 500;
  }

  .response-date svg {
    flex-shrink: 0;
  }

  /* Response Content */
  .response-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .answer-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .answer-question {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .answer-question svg {
    flex-shrink: 0;
    color: #9ca3af;
  }

  .answer-value {
    padding-left: 1.5rem;
  }

  .single-answer-text {
    color: #111827;
    font-weight: 600;
    font-size: 0.95rem;
    display: inline-block;
    background: #f0f9ff;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border-left: 3px solid #3b82f6;
  }

  .multi-answer-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .mini-tag {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 0.4rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  }

  .mini-tag::before {
    content: "✓";
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
  }

  .view-all-container {
    margin-top: 1.5rem;
    text-align: center;
  }

  .view-all-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    color: #6b7280;
    border: 2px solid #e5e7eb;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-all-btn:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
  }

  .no-responses {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 2rem;
    text-align: center;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border-radius: 16px;
    border: 2px dashed #d1d5db;
  }

  .no-responses-illustration {
    position: relative;
    margin-bottom: 2rem;
  }

  .no-responses-icon {
    width: 80px;
    height: 80px;
    color: #9ca3af;
    opacity: 0.6;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .no-responses h4 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .no-responses p {
    color: #6b7280;
    font-size: 0.95rem;
    margin: 0 0 1.5rem 0;
    max-width: 400px;
  }

  .share-survey-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }

  .share-survey-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(59, 130, 246, 0.4);
  }

  @media (max-width: 768px) {
    .analytics-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .stat-card {
      flex-direction: column;
      text-align: center;
      gap: 1rem;
    }

    .stat-trend {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }

    .response-card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .respondent-info {
      width: 100%;
    }

    .response-meta {
      width: 100%;
      justify-content: space-between;
    }

    .response-card:hover {
      transform: translateY(-4px);
    }
  }
</style>
