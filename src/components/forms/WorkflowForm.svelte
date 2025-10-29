<script lang="ts">
  let {
    content = $bindable({}),
  }: {
    content: any;
  } = $props();

  content = {
    name: content.name || "",
    states: content.states || [],
    illustration: content.illustration || "",
    initial_state: content.initial_state || [],
  };

  let openAccordions: Set<number> = $state(new Set());

  function toggleAccordion(index: number) {
    if (openAccordions.has(index)) {
      openAccordions.delete(index);
    } else {
      openAccordions.add(index);
    }
    openAccordions = new Set(openAccordions);
  }

  function addState() {
    if (content.states === undefined) {
      content.states = [];
    }
    content.states = [
      ...content.states,
      {
        name: "",
        state: "",
        next: [],
        resolutions: [],
      },
    ];
  }

  function removeState(event: Event, index: number) {
    event.stopPropagation();
    content.states = content.states.filter((_: any, i: number) => i !== index);
  }

  function addNextTransition(stateIndex: number) {
    content.states[stateIndex].next = [
      ...content.states[stateIndex].next,
      { roles: [], state: "", action: "" },
    ];
  }

  function removeNextTransition(stateIndex: number, transitionIndex: number) {
    content.states[stateIndex].next = content.states[stateIndex].next.filter(
      (_: any, i: number) => i !== transitionIndex
    );
  }

  function addResolution(stateIndex: number) {
    content.states[stateIndex].resolutions = [
      ...content.states[stateIndex].resolutions,
      { ar: "", en: "", ku: "", key: "" },
    ];
  }

  function removeResolution(stateIndex: number, resolutionIndex: number) {
    content.states[stateIndex].resolutions = content.states[
      stateIndex
    ].resolutions.filter((_: any, i: number) => i !== resolutionIndex);
  }

  function addInitialState() {
    if (content.initial_state === undefined) {
      content.initial_state = [];
    }
    content.initial_state = [...content.initial_state, { name: "", roles: [] }];
  }

  function removeInitialState(index: number) {
    content.initial_state = content.initial_state.filter(
      (_: any, i: number) => i !== index
    );
  }

  function addRole(item: any) {
    if (item.roles === undefined) {
      item.roles = [];
    }
    item.roles = [...(item.roles || []), ""];
  }

  function removeRole(item: any, roleIndex: number) {
    item.roles = item.roles.filter((_: any, i: number) => i !== roleIndex);
  }
</script>

<div class="card main-card">
  <h1 class="title">Workflow Form</h1>

  <div class="form-group">
    <label for="workflowName" class="label">Workflow Name</label>
    <input
      id="workflowName"
      class="input"
      bind:value={content.name}
      placeholder="Enter workflow name"
      required
    />
  </div>

  <div class="form-group">
    <label for="illustration" class="label">Illustration</label>
    <input
      id="illustration"
      class="input"
      bind:value={content.illustration}
      placeholder="Enter illustration name or path"
    />
  </div>

  <div class="card section-card">
    <h3 class="section-title">Initial States</h3>
    <div class="space-y">
      {#each content.initial_state as initialState, index}
        <div class="card inner-card">
          <div class="card-header">
            <h4 class="card-title">Initial State {index + 1}</h4>
            <button
              class="btn btn-danger btn-sm"
              onclick={() => removeInitialState(index)}
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Remove
            </button>
          </div>

          <div class="space-y">
            <div class="form-group">
              <label for={`initialState${index}Name`} class="label">Name</label>
              <input
                id={`initialState${index}Name`}
                class="input"
                bind:value={initialState.name}
                placeholder="Initial state name"
              />
            </div>

            <div class="form-group">
              <label class="label">Roles</label>
              {#each initialState.roles as role, roleIndex}
                <div class="input-group">
                  <input
                    class="input"
                    bind:value={initialState.roles[roleIndex]}
                    placeholder="Role name"
                  />
                  <button
                    class="btn btn-danger btn-icon"
                    onclick={() => removeRole(initialState, roleIndex)}
                  >
                    <svg
                      class="icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              {/each}
              <button
                class="btn btn-secondary btn-sm"
                onclick={() => addRole(initialState)}
              >
                <svg
                  class="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Add Role
              </button>
            </div>
          </div>
        </div>
      {/each}

      <button onclick={addInitialState} class="btn btn-secondary">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M12 5v14M5 12h14"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Add Initial State
      </button>
    </div>
  </div>

  <div class="card section-card">
    <h3 class="section-title">States</h3>
    <div class="space-y">
      {#each content.states as state, stateIndex}
        <div class="accordion">
          <div
            class="accordion-header"
            onclick={() => toggleAccordion(stateIndex)}
          >
            <span class="accordion-title"
              >{state.name || `State ${stateIndex + 1}`}</span
            >
            <div class="accordion-actions">
              <button
                class="btn btn-danger btn-icon"
                onclick={(e) => removeState(e, stateIndex)}
              >
                <svg
                  class="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <svg
                class="icon chevron {openAccordions.has(stateIndex)
                  ? 'open'
                  : ''}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M19 9l-7 7-7-7"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          {#if openAccordions.has(stateIndex)}
            <div class="accordion-content">
              <div class="grid-2">
                <div class="form-group">
                  <label for={`state${stateIndex}Name`} class="label"
                    >Name</label
                  >
                  <input
                    id={`state${stateIndex}Name`}
                    class="input"
                    bind:value={state.name}
                    placeholder="Human-readable state name"
                  />
                </div>
                <div class="form-group">
                  <label for={`state${stateIndex}Id`} class="label"
                    >State ID</label
                  >
                  <input
                    id={`state${stateIndex}Id`}
                    class="input"
                    bind:value={state.state}
                    placeholder="Internal state identifier"
                  />
                </div>
              </div>

              <!-- Next Transitions -->
              <div class="subsection">
                <label class="subsection-title">Next Transitions</label>
                <div class="space-y">
                  {#each state.next as transition, transitionIndex}
                    <div class="card transition-card">
                      <div class="card-header">
                        <h5 class="card-subtitle">
                          Transition {transitionIndex + 1}
                        </h5>
                        <button
                          class="btn btn-danger btn-icon"
                          onclick={() =>
                            removeNextTransition(stateIndex, transitionIndex)}
                        >
                          <svg
                            class="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </button>
                      </div>

                      <div class="grid-2">
                        <div class="form-group">
                          <label class="label">Next State</label>
                          <input
                            class="input"
                            bind:value={transition.state}
                            placeholder="Next state identifier"
                          />
                        </div>
                        <div class="form-group">
                          <label class="label">Action</label>
                          <input
                            class="input"
                            bind:value={transition.action}
                            placeholder="Action name"
                          />
                        </div>
                      </div>

                      <div class="form-group">
                        <label class="label">Roles</label>
                        {#each transition.roles as role, roleIndex}
                          <div class="input-group">
                            <input
                              class="input"
                              bind:value={transition.roles[roleIndex]}
                              placeholder="Role name"
                            />
                            <button
                              class="btn btn-danger btn-icon"
                              onclick={() => removeRole(transition, roleIndex)}
                            >
                              <svg
                                class="icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                              >
                                <path
                                  d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        {/each}
                        <button
                          class="btn btn-secondary btn-sm"
                          onclick={() => addRole(transition)}
                        >
                          <svg
                            class="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M12 5v14M5 12h14"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                          Add Role
                        </button>
                      </div>
                    </div>
                  {/each}
                  <button
                    class="btn btn-secondary"
                    onclick={() => addNextTransition(stateIndex)}
                  >
                    <svg
                      class="icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M12 5v14M5 12h14"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Add Transition
                  </button>
                </div>
              </div>

              <!-- Resolutions -->
              <div class="subsection">
                <label class="subsection-title">Resolutions</label>
                <div class="space-y">
                  {#each state.resolutions as resolution, resolutionIndex}
                    <div class="card transition-card">
                      <div class="card-header">
                        <h5 class="card-subtitle">
                          Resolution {resolutionIndex + 1}
                        </h5>
                        <button
                          class="btn btn-danger btn-icon"
                          onclick={() =>
                            removeResolution(stateIndex, resolutionIndex)}
                        >
                          <svg
                            class="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </button>
                      </div>

                      <div class="grid-2">
                        <div class="form-group">
                          <label class="label">Key</label>
                          <input
                            class="input"
                            bind:value={resolution.key}
                            placeholder="Resolution key"
                          />
                        </div>
                        <div class="form-group">
                          <label class="label">English</label>
                          <input
                            class="input"
                            bind:value={resolution.en}
                            placeholder="English translation"
                          />
                        </div>
                        <div class="form-group">
                          <label class="label">Arabic</label>
                          <input
                            class="input"
                            bind:value={resolution.ar}
                            placeholder="Arabic translation"
                          />
                        </div>
                        <div class="form-group">
                          <label class="label">Kurdish</label>
                          <input
                            class="input"
                            bind:value={resolution.ku}
                            placeholder="Kurdish translation"
                          />
                        </div>
                      </div>
                    </div>
                  {/each}
                  <button
                    class="btn btn-secondary"
                    onclick={() => addResolution(stateIndex)}
                  >
                    <svg
                      class="icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M12 5v14M5 12h14"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Add Resolution
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}

      <button onclick={addState} class="btn btn-secondary">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M12 5v14M5 12h14"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Add State
      </button>
    </div>
  </div>
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
  }

  .main-card {
    margin: 16px 16px;
  }

  .section-card {
    margin-top: 16px;
  }

  .inner-card {
    padding: 16px;
  }

  .transition-card {
    padding: 12px;
  }

  .title {
    font-size: 24px;
    font-weight: bold;
    margin: 0 0 16px 0;
    color: #111827;
  }

  .section-title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: #111827;
  }

  .subsection-title {
    font-size: 18px;
    font-weight: 500;
    margin: 16px 0 8px 0;
    color: #374151;
    display: block;
  }

  .card-title {
    font-size: 18px;
    font-weight: 500;
    margin: 0;
    color: #111827;
  }

  .card-subtitle {
    font-size: 14px;
    font-weight: 500;
    margin: 0;
    color: #374151;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .input::placeholder {
    color: #9ca3af;
  }

  .input-group {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }

  .input-group .input {
    flex: 1;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover {
    opacity: 0.9;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 13px;
  }

  .btn-icon {
    padding: 6px;
  }

  .btn-secondary {
    background: white;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .btn-secondary:hover {
    background: #eff6ff;
  }

  .btn-danger {
    background: white;
    border-color: #ef4444;
    color: #ef4444;
  }

  .btn-danger:hover {
    background: #fef2f2;
  }

  .icon {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }

  .space-y > * + * {
    margin-top: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .subsection {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
  }

  .accordion {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f9fafb;
    cursor: pointer;
    transition: background 0.2s;
  }

  .accordion-header:hover {
    background: #f3f4f6;
  }

  .accordion-title {
    font-weight: 500;
    color: #111827;
  }

  .accordion-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .accordion-content {
    padding: 16px;
    border-top: 1px solid #e5e7eb;
  }

  .chevron {
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  @media (max-width: 768px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
