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
    text: string
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

<div class="survey-editor">
  <h2 class="survey-title">{$_("survey_form.survey_builder")}</h2>

  <div class="survey-content">
    <!-- Survey Metadata -->
    <div class="metadata-section">
      <div class="form-group">
        <label for="survey-title">{$_("survey_form.survey_title")}</label>
        <input
          id="survey-title"
          type="text"
          placeholder={$_("survey_form.survey_title_placeholder")}
          bind:value={survey.title}
        />
      </div>
      <div class="form-group">
        <label for="survey-description"
          >{$_("survey_form.survey_description")}</label
        >
        <textarea
          id="survey-description"
          placeholder={$_("survey_form.survey_description_placeholder")}
          bind:value={survey.description}
          rows="3"
        ></textarea>
      </div>
    </div>

    <!-- Questions -->
    <div class="questions-section">
      <div class="section-header">
        <h3>{$_("survey_form.questions")}</h3>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => addQuestion()}
        >
          {$_("survey_form.add_question_button")}
        </button>
      </div>

      {#if survey.questions && survey.questions.length > 0}
        <div class="accordion">
          {#each survey.questions as question, questionIndex}
            <div class="accordion-item">
              <button
                type="button"
                class="accordion-header"
                onclick={toggleAccordion}
                aria-expanded="false"
              >
                <div class="question-info">
                  <span class="question-text">
                    {question.question ||
                      $_("survey_form.new_question", {
                        values: { number: questionIndex + 1 },
                      })}
                  </span>
                  {#if question.type}
                    <span class="badge badge-type">{question.type}</span>
                  {/if}
                  {#if question.required}
                    <span class="badge badge-required"
                      >{$_("survey_form.required_question")}</span
                    >
                  {/if}
                </div>
                <svg
                  class="chevron"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path
                    d="M4.427 9.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 9H4.604a.25.25 0 00-.177.427z"
                  />
                </svg>
              </button>

              <div class="accordion-content" style="display: none;">
                <div class="question-form">
                  <div class="form-grid">
                    <div class="form-group">
                      <label for="question-text-{questionIndex}"
                        >{$_("survey_form.question_text_label")}</label
                      >
                      <input
                        id="question-text-{questionIndex}"
                        type="text"
                        placeholder={$_(
                          "survey_form.question_text_placeholder"
                        )}
                        bind:value={question.question}
                      />
                    </div>

                    <div class="form-group">
                      <label for="answer-type-{questionIndex}"
                        >{$_("survey_form.answer_type_label")}</label
                      >
                      <select
                        id="answer-type-{questionIndex}"
                        bind:value={question.type}
                        onchange={(e) =>
                          onAnswerTypeChange(
                            questionIndex,
                            (e.target as HTMLSelectElement).value
                          )}
                      >
                        {#each answerTypes as type}
                          <option value={type.value}>{type.name}</option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <!-- Options for single, multi, and select types -->
                  {#if ["single", "multi", "select"].includes(question.type)}
                    <div class="options-section">
                      <div class="options-header">
                        <h4>{$_("survey_form.answer_options_title")}</h4>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          onclick={() => addOption(questionIndex)}
                        >
                          {$_("survey_form.add_option_button")}
                        </button>
                      </div>

                      {#if question.options && question.options.length > 0}
                        <div class="options-list">
                          {#each question.options as option, optionIndex}
                            <div class="option-item">
                              <div class="option-form">
                                <div class="form-group">
                                  <label
                                    for="option-text-{questionIndex}-{optionIndex}"
                                    >{$_(
                                      "survey_form.answer_option_label"
                                    )}</label
                                  >
                                  <input
                                    id="option-text-{questionIndex}-{optionIndex}"
                                    type="text"
                                    placeholder={$_(
                                      "survey_form.answer_option_placeholder"
                                    )}
                                    value={option.text || option.label || ""}
                                    oninput={(e) =>
                                      updateOptionText(
                                        questionIndex,
                                        optionIndex,
                                        (e.target as HTMLInputElement).value
                                      )}
                                  />
                                  {#if option.value}
                                    <small class="value-preview"
                                      >{$_("survey_form.value_preview", {
                                        values: { value: option.value },
                                      })}</small
                                    >
                                  {/if}
                                </div>
                                <div class="option-actions">
                                  <button
                                    type="button"
                                    class="btn btn-danger btn-sm"
                                    onclick={() =>
                                      removeOption(questionIndex, optionIndex)}
                                  >
                                    {$_("survey_form.remove_option")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <div class="empty-options">
                          <p>
                            {$_("survey_form.no_options")}
                          </p>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <!-- Question Controls -->
                  <div class="question-controls">
                    <div class="checkbox-group">
                      <input
                        type="checkbox"
                        id="required-{questionIndex}"
                        bind:checked={question.required}
                      />
                      <label for="required-{questionIndex}"
                        >{$_("survey_form.required_question")}</label
                      >
                    </div>

                    <div class="question-actions">
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onclick={() => removeQuestion(questionIndex)}
                      >
                        {$_("survey_form.delete_question")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>{$_("survey_form.no_questions")}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .survey-editor {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(229, 231, 235, 0.8);
    max-width: 100%;
    overflow: hidden;
  }

  .survey-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
    padding: 1.5rem 2rem 0;
  }

  .survey-content {
    padding: 0 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Metadata Section */
  .metadata-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .metadata-section {
      grid-template-columns: 1fr;
    }
  }

  /* Form Elements */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin: 0;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
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

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Questions Section */
  .questions-section {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    border-bottom: 1px solid #f3f4f6;
  }

  .section-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  /* Buttons */
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
  }

  .btn-secondary:hover {
    background: #4b5563;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  /* Accordion */
  .accordion {
    border-top: 1px solid #f3f4f6;
  }

  .accordion-item {
    border-bottom: 1px solid #f3f4f6;
  }

  .accordion-header {
    width: 100%;
    padding: 1rem 1.5rem;
    background: white;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-size: inherit;
    text-align: left;
  }

  .accordion-header:hover {
    background: #f9fafb;
  }

  .question-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .question-text {
    font-weight: 500;
    color: #111827;
  }

  .badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-weight: 500;
  }

  .badge-type {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .badge-required {
    background-color: #fee2e2;
    color: #dc2626;
  }

  .chevron {
    transition: transform 0.2s ease;
    color: #6b7280;
  }

  .accordion-content {
    background: #fafafa;
    border-top: 1px solid #e5e7eb;
  }

  .question-form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Options Section */
  .options-section {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: white;
  }

  .options-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .options-header h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-item {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
    background: #fefefe;
  }

  .option-form {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 1rem;
    align-items: end;
  }

  @media (max-width: 768px) {
    .option-form {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }

  .option-actions {
    display: flex;
    justify-content: flex-end;
  }

  .empty-options {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
    font-style: italic;
  }

  /* Question Controls */
  .question-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .checkbox-group input[type="checkbox"] {
    margin: 0;
  }

  .checkbox-group label {
    margin: 0;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .question-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #6b7280;
  }

  .empty-state p {
    margin: 0;
    font-style: italic;
  }

  .option-form {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: end;
  }

  @media (max-width: 768px) {
    .option-form {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }

  .value-preview {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #6b7280;
    font-style: italic;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .survey-content {
      padding: 0 1rem 1rem;
    }

    .section-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .question-controls {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .question-info {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .options-header {
      flex-direction: column;
      gap: 0.75rem;
      align-items: stretch;
    }
  }
</style>
