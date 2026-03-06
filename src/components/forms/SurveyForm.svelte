<script lang="ts">
  import { _, locale } from "@/i18n";

  let {
    survey = $bindable({}),
  }: {
    survey: any;
  } = $props();

  if (!survey || Object.keys(survey).length === 0) {
    survey = {
      title: "",
      description: "",
      questions: [],
    };
  }

  const answerTypes = [
    { value: "input", name: $_("survey_form.answer_type_input") },
    { value: "text", name: $_("survey_form.answer_type_text") },
    { value: "single", name: $_("survey_form.answer_type_single") },
    { value: "multi", name: $_("survey_form.answer_type_multi") },
    { value: "select", name: $_("survey_form.answer_type_select") },
  ];

  function addQuestion() {
    const newQuestion = {
      id: crypto.randomUUID(),
      question: "",
      type: "input",
      options: [],
      required: false,
    };

    if (!survey.questions) {
      survey.questions = [];
    }
    survey.questions.push(newQuestion);
    survey = { ...survey };
  }

  function removeQuestion(index: number) {
    survey.questions.splice(index, 1);
    survey = { ...survey };
  }

  function addOption(questionIndex: number) {
    const question = survey.questions[questionIndex];
    if (!question.options) {
      question.options = [];
    }
    question.options.push({
      id: crypto.randomUUID(),
      text: "",
    });
    survey = { ...survey };
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    survey.questions[questionIndex].options.splice(optionIndex, 1);
    survey = { ...survey };
  }

  function generateValue(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFA-Za-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);
  }

  function updateOptionText(
    questionIndex: number,
    optionIndex: number,
    text: string,
  ) {
    const option = survey.questions[questionIndex].options[optionIndex];
    option.text = text;
    option.label = text;
    option.value = generateValue(text);
    survey = { ...survey };
  }

  function onAnswerTypeChange(questionIndex: number, newType: string) {
    const question = survey.questions[questionIndex];
    question.type = newType;

    if (["single", "multi", "select"].includes(newType) && !question.options) {
      question.options = [];
    }

    survey = { ...survey };
  }

  function toggleAccordion(event: Event) {
    const button = event.currentTarget as HTMLElement;
    const content = button.nextElementSibling as HTMLElement;
    const isExpanded = button.getAttribute("aria-expanded") === "true";

    button.setAttribute("aria-expanded", (!isExpanded).toString());
    content.style.display = isExpanded ? "none" : "block";

    const chevron = button.querySelector(".chevron") as HTMLElement;
    if (chevron) {
      chevron.style.transform = isExpanded ? "rotate(0deg)" : "rotate(180deg)";
    }
  }
</script>

<div class="survey-form-wrapper">
  <!-- Card 1: Survey Details -->
  <div class="form-card">
    <div class="card-header">
      <div class="header-title-group">
        <div class="icon-wrapper border-blue">
          <svg
            class="w-5 h-5 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h2 class="card-title">
          {$_("survey_form.survey_details", { default: "Survey Details" })}
        </h2>
      </div>
    </div>

    <div class="card-body">
      <div class="form-group">
        <label for="survey-title"
          >{$_("survey_form.survey_title", { default: "Survey Title" })}</label
        >
        <input
          id="survey-title"
          type="text"
          class="form-input"
          placeholder="e.g., Team Satisfaction Survey Q1 2026"
          bind:value={survey.title}
        />
      </div>

      <div class="form-group">
        <label for="survey-description"
          >{$_("survey_form.survey_description", {
            default: "Description",
          })}</label
        >
        <textarea
          id="survey-description"
          class="form-input"
          placeholder="Describe the purpose of this survey..."
          bind:value={survey.description}
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="survey-space"
          >{$_("survey_form.space", { default: "Space" })}</label
        >
        <div class="select-wrapper">
          <select id="survey-space" class="form-input select-input" disabled>
            <option value=""
              >{$_("survey_form.select_space", {
                default: "Select a space...",
              })}</option
            >
          </select>
          <svg
            class="select-chevron"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path></svg
          >
        </div>
      </div>
    </div>
  </div>

  <!-- Card 2: Questions -->
  <div class="form-card">
    <div class="card-header items-center justify-between">
      <div class="header-title-group">
        <div class="icon-wrapper border-purple">
          <svg
            class="w-5 h-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            ></path>
          </svg>
        </div>
        <div>
          <h2 class="card-title">
            {$_("survey_form.questions", { default: "Questions" })}
          </h2>
          <p class="card-subtitle">
            {survey.questions?.length || 0}
            {$_("survey_form.question_count", { default: "question(s)" })}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="btn-add-question"
        onclick={() => addQuestion()}
      >
        <svg
          class="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          ></path></svg
        >
        {$_("survey_form.add_question_button", { default: "Add Question" })}
      </button>
    </div>

    <div class="card-body">
      {#if survey.questions && survey.questions.length > 0}
        <div class="questions-list">
          {#each survey.questions as question, questionIndex}
            <div class="question-item">
              <div class="question-top-row">
                <div class="drag-handle">
                  <svg
                    width="16"
                    height="20"
                    viewBox="0 0 16 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="6" cy="4" r="1.5" fill="#D1D5DB" />
                    <circle cx="6" cy="10" r="1.5" fill="#D1D5DB" />
                    <circle cx="6" cy="16" r="1.5" fill="#D1D5DB" />
                    <circle cx="10" cy="4" r="1.5" fill="#D1D5DB" />
                    <circle cx="10" cy="10" r="1.5" fill="#D1D5DB" />
                    <circle cx="10" cy="16" r="1.5" fill="#D1D5DB" />
                  </svg>
                </div>
                <span class="question-number">{questionIndex + 1}</span>
                <input
                  type="text"
                  class="question-input"
                  placeholder="Enter your question..."
                  bind:value={question.question}
                />
                <button
                  type="button"
                  class="btn-delete"
                  onclick={() => removeQuestion(questionIndex)}
                  aria-label="Delete question"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    ></path></svg
                  >
                </button>
              </div>

              <!-- Question Options/Controls -->
              <div class="question-bottom-row">
                <div class="type-selector-wrapper">
                  <div class="select-wrapper">
                    <select
                      class="form-input select-input type-select"
                      bind:value={question.type}
                      onchange={(e) =>
                        onAnswerTypeChange(
                          questionIndex,
                          (e.target as HTMLSelectElement).value,
                        )}
                    >
                      {#each answerTypes as type}
                        <option value={type.value}>{type.name}</option>
                      {/each}
                    </select>
                    <svg
                      class="select-chevron"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      ></path></svg
                    >
                  </div>
                </div>

                <label class="required-toggle">
                  <span class="toggle-label">Required</span>
                  <div
                    class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in"
                  >
                    <input
                      type="checkbox"
                      name="toggle"
                      id="toggle-{questionIndex}"
                      class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                      bind:checked={question.required}
                    />
                    <label
                      for="toggle-{questionIndex}"
                      class="toggle-label-bg block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"
                    ></label>
                  </div>
                </label>
              </div>

              <!-- Options for single/multi/select -->
              {#if ["single", "multi", "select"].includes(question.type)}
                <div class="options-container">
                  {#if question.options && question.options.length > 0}
                    {#each question.options as option, optionIndex}
                      <div class="option-row">
                        <div class="option-indicator circle"></div>
                        <input
                          type="text"
                          class="option-input"
                          placeholder="Option text..."
                          value={option.text || option.label || ""}
                          oninput={(e) =>
                            updateOptionText(
                              questionIndex,
                              optionIndex,
                              (e.target as HTMLInputElement).value,
                            )}
                        />
                        <button
                          type="button"
                          class="btn-delete-option"
                          aria-label="Delete option"
                          onclick={() =>
                            removeOption(questionIndex, optionIndex)}
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path></svg
                          >
                        </button>
                      </div>
                    {/each}
                  {/if}
                  <button
                    type="button"
                    class="btn-add-option"
                    onclick={() => addOption(questionIndex)}
                  >
                    + Add option
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-questions">
          <p class="text-gray-500 italic py-8 text-center">
            No questions added yet. Click "Add Question" to start.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .survey-form-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-card {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .card-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrapper {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f8fafc;
  }

  .icon-wrapper.border-blue {
    border: 1px solid #e0e7ff;
    background-color: #f0fdf4;
  }
  .icon-wrapper.border-purple {
    border: 1px solid #f3e8ff;
    background-color: #fdf4ff;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .card-subtitle {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0;
  }

  .btn-add-question {
    background-color: #eff6ff;
    color: #3b82f6;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s;
  }

  .btn-add-question:hover {
    background-color: #dbeafe;
  }

  .card-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Form Elements */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: #f9fafb;
    border: 1px solid transparent;
    border-radius: 12px;
    font-size: 0.875rem;
    color: #1f2937;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .form-input::placeholder {
    color: #9ca3af;
  }

  .form-input:focus {
    outline: none;
    border-color: #d1d5db;
    background-color: #ffffff;
    box-shadow: 0 0 0 3px rgba(243, 244, 246, 1);
  }

  .form-group textarea.form-input {
    resize: vertical;
    min-height: 80px;
  }

  .select-wrapper {
    position: relative;
    width: 100%;
  }

  .select-input {
    appearance: none;
    padding-right: 2.5rem;
    cursor: pointer;
  }

  .select-input:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .select-chevron {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: #9ca3af;
    pointer-events: none;
  }

  /* Questions List */
  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .question-item {
    border: 1px solid #f3f4f6;
    border-radius: 12px;
    padding: 1rem;
    background-color: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
  }

  .question-top-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    color: #d1d5db;
  }

  .question-number {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    min-width: 1rem;
    text-align: center;
  }

  .question-input {
    flex-grow: 1;
    padding: 0.625rem 1rem;
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.875rem;
  }

  .question-input:focus {
    outline: none;
    border-color: #9ca3af;
  }

  .btn-delete {
    background: none;
    border: none;
    color: #d1d5db;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 6px;
    transition:
      color 0.2s,
      background-color 0.2s;
  }

  .btn-delete:hover {
    color: #ef4444;
    background-color: #fef2f2;
  }

  .question-bottom-row {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 1rem;
    padding-left: 2.75rem; /* Indent to align with input */
  }

  .type-selector-wrapper {
    width: 200px;
  }

  .type-select {
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    border: 1px solid #e5e7eb;
    background-color: white;
  }

  /* Toggle Switch */
  .required-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto; /* Push to right side of its container if needed, or leave left */
    cursor: pointer;
  }

  .toggle-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #6b7280;
  }

  .toggle-checkbox:checked {
    right: 0;
    border-color: #3b82f6; /* Blue border for checked state if desired, or let bg show */
  }

  .toggle-checkbox:checked + .toggle-label-bg {
    background-color: #3b82f6;
  }

  .toggle-checkbox {
    right: 0;
    z-index: 1;
    border-color: #e5e7eb;
    transition: all 0.3s;
  }

  .toggle-label-bg {
    transition: all 0.3s;
  }

  /* Options Container for Multiple Choice */
  .options-container {
    padding-left: 2.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .option-indicator {
    width: 1rem;
    height: 1rem;
    border: 2px solid #d1d5db;
  }

  .option-indicator.circle {
    border-radius: 50%;
  }

  .option-input {
    flex-grow: 1;
    max-width: 400px;
    padding: 0.5rem;
    border: 1px solid transparent;
    border-bottom-color: #e5e7eb;
    background: transparent;
    font-size: 0.875rem;
  }

  .option-input:focus {
    outline: none;
    border-bottom-color: #9ca3af;
  }

  .btn-delete-option {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.25rem;
  }

  .btn-delete-option:hover {
    color: #ef4444;
  }

  .btn-add-option {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    padding: 0.5rem 0;
    align-self: flex-start;
  }

  .btn-add-option:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .question-bottom-row {
      flex-direction: column;
      align-items: stretch;
      padding-left: 0;
    }

    .type-selector-wrapper {
      width: 100%;
    }

    .options-container {
      padding-left: 0;
    }
  }
</style>
