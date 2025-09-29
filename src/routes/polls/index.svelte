<script lang="ts">
  import { onMount } from "svelte";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { getPolls, userVote } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import {
    CheckCircleOutline,
    ClockOutline,
    EyeOutline,
    SearchOutline,
    UserOutline,
    VolumeDownOutline,
  } from "flowbite-svelte-icons";
  import { user } from "@/stores/user";
  import { Diamonds } from "svelte-loading-spinners";

  let polls = $state([]);
  let loading = $state(true);
  let searchTerm = $state("");
  let filterStatus = $state("all");
  let selectedPoll = $state(null);
  let showVoteModal = $state(false);
  let selectedCandidate = $state("");
  let votingInProgress = $state(false);
  let showResults = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let userValue = null;
  user.subscribe((value) => {
    userValue = value;
  });

  onMount(async () => {
    await loadPolls();
  });

  async function loadPolls() {
    loading = true;
    try {
      const response = await getPolls("poll", "managed");

      if (response?.status === "success" && response?.records) {
        const processedPolls = response.records.map((poll) => {
          const body = poll.attributes?.payload?.body || {};
          const candidates = body.candidates || [];
          const attachments = poll.attachments?.json || [];

          const candidatesWithResults = candidates.map((candidate) => {
            const candidateAttachment = attachments.find(
              (att) => att.shortname === candidate.key
            );

            let voters = [];
            let voteCount = 0;

            if (candidateAttachment?.attributes?.payload?.body?.voters) {
              voters = candidateAttachment.attributes.payload.body.voters || [];
              voteCount = Array.isArray(voters) ? voters.length : 0;
            }

            return {
              key: candidate.key,
              name: candidate.value,
              votes: voteCount,
              voters: voters,
              percentage: 0,
              attachment: candidateAttachment,
            };
          });

          const totalVotes = candidatesWithResults.reduce(
            (sum, candidate) => sum + candidate.votes,
            0
          );

          candidatesWithResults.forEach((candidate) => {
            candidate.percentage =
              totalVotes > 0
                ? Math.round((candidate.votes / totalVotes) * 100)
                : 0;
          });

          let hasVoted = false;
          let userVote = null;

          if (userValue) {
            for (const candidate of candidatesWithResults) {
              if (candidate.voters.includes(userValue.shortname)) {
                hasVoted = true;
                userVote = candidate.name;
                break;
              }
            }
          }

          const isActive = poll.attributes?.is_active !== false;

          return {
            ...poll,
            title:
              poll.attributes?.displayname?.en ||
              poll.attributes?.displayname ||
              poll.shortname ||
              "Untitled Poll",
            description:
              poll.attributes?.description?.en ||
              poll.attributes?.description ||
              "",
            candidates: candidatesWithResults,
            isActive,
            hasVoted,
            userVote,
            totalVotes,
            createdBy: poll.attributes?.owner_shortname || "Unknown",
            createdAt: poll.attributes?.created_at
              ? new Date(poll.attributes.created_at)
              : null,
            tags: poll.attributes?.tags || [],
          };
        });

        polls = processedPolls;
      }
    } catch (error) {
      console.error("Error loading polls:", error);
      errorToastMessage("Failed to load polls");
    } finally {
      loading = false;
    }
  }

  const filteredPolls = $derived(
    polls.filter((poll) => {
      const matchesSearch =
        !searchTerm ||
        poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poll.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poll.candidates.some((candidate) =>
          candidate.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && poll.isActive) ||
        (filterStatus === "ended" && !poll.isActive);

      return matchesSearch && matchesStatus;
    })
  );

  function openVoteModal(poll) {
    selectedPoll = poll;
    selectedCandidate = "";
    showVoteModal = true;
    showResults = false;
  }

  function openResultsModal(poll) {
    selectedPoll = poll;
    showResults = true;
    showVoteModal = true;
  }

  function closeModal() {
    showVoteModal = false;
    showResults = false;
    selectedPoll = null;
    selectedCandidate = "";
  }

  function selectCandidate(candidateKey) {
    selectedCandidate = candidateKey;
  }

  async function submitVote() {
    if (!selectedPoll || !userValue || !selectedCandidate) {
      errorToastMessage($_("polls.select_option"));
      return;
    }

    votingInProgress = true;
    try {
      const candidateObj = selectedPoll.candidates.find(
        (c) => c.key === selectedCandidate
      );

      if (!candidateObj) {
        errorToastMessage("Invalid candidate selection");
        return;
      }

      if (candidateObj.voters.includes(userValue.shortname)) {
        errorToastMessage($_("polls.already_voted"));
        votingInProgress = false;
        return;
      }

      for (const otherCandidate of selectedPoll.candidates) {
        if (
          otherCandidate.key !== selectedCandidate &&
          otherCandidate.voters.includes(userValue.shortname)
        ) {
          const filteredVoters = otherCandidate.voters.filter(
            (voter) => voter !== userValue.shortname
          );

          await userVote(
            selectedPoll.shortname,
            otherCandidate.key,
            filteredVoters,
            true
          );
        }
      }

      let updatedVoters = [...candidateObj.voters];
      if (!updatedVoters.includes(userValue.shortname)) {
        updatedVoters.push(userValue.shortname);
      }

      const hasExistingAttachment = candidateObj.attachment != null;

      const response = await userVote(
        selectedPoll.shortname,
        selectedCandidate,
        updatedVoters,
        hasExistingAttachment
      );

      if (response) {
        successToastMessage($_("polls.vote_success"));
        closeModal();
        await loadPolls();
      } else {
        errorToastMessage($_("polls.vote_error"));
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      errorToastMessage($_("polls.vote_error"));
    } finally {
      votingInProgress = false;
    }
  }

  function formatDate(date) {
    if (!date) return "";
    return date.toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="polls-container" class:rtl={$isRTL}>
  <div class="polls-header">
    <div class="header-content">
      <div class="header-text">
        <h1>{$_("polls.title")}</h1>
        <p>{$_("polls.description")}</p>
      </div>
      <svg
        class="header-icon w-12 h-12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    </div>
  </div>

  <div class="polls-controls">
    <div class="search-container">
      <svg
        class="search-icon w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        bind:value={searchTerm}
        placeholder={$_("polls.search_placeholder")}
        class="search-input"
      />
    </div>

    <div class="filter-tabs">
      <button
        class="filter-tab"
        class:active={filterStatus === "all"}
        onclick={() => (filterStatus = "all")}
      >
        {$_("polls.filter_all")}
      </button>
      <button
        class="filter-tab"
        class:active={filterStatus === "active"}
        onclick={() => (filterStatus = "active")}
      >
        {$_("polls.filter_active")}
      </button>
      <button
        class="filter-tab"
        class:active={filterStatus === "ended"}
        onclick={() => (filterStatus = "ended")}
      >
        {$_("polls.filter_ended")}
      </button>
    </div>
  </div>

  <div class="polls-content">
    {#if loading}
      <div class="loading-container">
        <div class="loading-content">
          <Diamonds color="#4f46e5" size="60" unit="px" />
        </div>
      </div>
    {:else if filteredPolls.length === 0}
      <div class="empty-state">
        <svg
          class="empty-icon w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        <h3>{$_("polls.no_polls")}</h3>
        <p>{$_("polls.no_polls_description")}</p>
      </div>
    {:else}
      <div class="polls-grid">
        {#each filteredPolls as poll}
          <div class="poll-card" class:ended={!poll.isActive}>
            <div class="poll-header">
              <h3 class="poll-title">{poll.title}</h3>
              <div class="poll-meta">
                <span class="poll-author">
                  <svg
                    class="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {$_("polls.created_by", {
                    values: { author: poll.createdBy },
                  })}
                </span>
                {#if poll.tags.length > 0}
                  <span class="poll-tags">
                    {poll.tags.join(", ")}
                  </span>
                {/if}
              </div>
            </div>

            {#if poll.description}
              <p class="poll-description">{poll.description}</p>
            {/if}

            <div class="poll-candidates-preview">
              {#each poll.candidates.slice(0, 3) as candidate}
                <div class="candidate-preview">
                  <span class="candidate-name">{candidate.name}</span>
                  {#if poll.hasVoted || !poll.isActive}
                    <div class="candidate-results">
                      <div class="result-bar">
                        <div
                          class="result-fill"
                          style="width: {candidate.percentage}%"
                        ></div>
                      </div>
                      <span class="result-percentage"
                        >{candidate.percentage}%</span
                      >
                    </div>
                  {/if}
                </div>
              {/each}
              {#if poll.candidates.length > 3}
                <div class="more-candidates">
                  +{poll.candidates.length - 3} more candidates
                </div>
              {/if}
            </div>

            <div class="poll-stats">
              <span class="vote-count">
                <svg
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                {$_("polls.votes_count", {
                  values: { count: poll.totalVotes },
                })}
              </span>
              <span class="poll-timing">
                <svg
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {formatDate(poll.createdAt)}
              </span>
            </div>

            <div class="poll-actions">
              {#if poll.hasVoted}
                <div class="voted-info">
                  <span class="voted-badge">
                    <CheckCircleOutline />
                    {$_("polls.voted")}
                  </span>
                </div>
              {:else if !poll.isActive}
                <span class="ended-badge">
                  {$_("polls.filter_ended")}
                </span>
              {:else}
                <button class="vote-button" onclick={() => openVoteModal(poll)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    role="img"
                    aria-labelledby="voteTitle voteDesc"
                    class="icon-vote"
                  >
                    <title id="voteTitle">Vote</title>
                    <desc id="voteDesc">Ballot box with a checked ballot</desc>

                    <!-- box -->
                    <rect
                      x="3"
                      y="7"
                      width="18"
                      height="14"
                      rx="2"
                      ry="2"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                    />
                    <!-- slot -->
                    <rect
                      x="7"
                      y="3"
                      width="10"
                      height="3"
                      rx="0.8"
                      ry="0.8"
                      fill="currentColor"
                    />
                    <!-- ballot -->
                    <rect
                      x="6.2"
                      y="1.8"
                      width="11.6"
                      height="6.8"
                      rx="0.8"
                      ry="0.8"
                      transform="rotate(12 12 5.2)"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.4"
                    />
                    <!-- check -->
                    <path
                      d="M9.5 11.5l2 2.2 4-4.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.6"
                    />
                  </svg>
                  {$_("polls.vote_button")}
                </button>
              {/if}

              <button
                class="results-button"
                onclick={() => openResultsModal(poll)}
              >
                <EyeOutline />
                {$_("polls.view_results")}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Vote/Results Modal -->
{#if showVoteModal && selectedPoll}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{selectedPoll.title}</h2>
        <button class="close-button" onclick={closeModal}>×</button>
      </div>

      <div class="modal-body">
        {#if selectedPoll.description}
          <p class="modal-description">{selectedPoll.description}</p>
        {/if}

        <div class="modal-meta">
          <span
            >{$_("polls.total_votes", {
              values: { count: selectedPoll.totalVotes },
            })}</span
          >
          <span>{$_("polls.single_choice")}</span>
        </div>

        {#if showResults}
          <div class="results-section">
            <h3>{$_("polls.results_title")}</h3>
            {#each selectedPoll.candidates as candidate}
              <div class="result-candidate">
                <div class="result-header">
                  <span class="candidate-name">{candidate.name}</span>
                  <span class="result-stats">
                    {candidate.votes} ({$_("polls.percentage", {
                      values: { percent: candidate.percentage },
                    })})
                  </span>
                </div>
                <div class="result-bar">
                  <div
                    class="result-fill"
                    style="width: {candidate.percentage}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {:else if selectedPoll.isActive && !selectedPoll.hasVoted}
          <div class="voting-section">
            <h3>{$_("polls.select_option")}</h3>
            {#each selectedPoll.candidates as candidate}
              <button
                class="vote-candidate"
                class:selected={selectedCandidate === candidate.key}
                onclick={() => selectCandidate(candidate.key)}
              >
                <div class="candidate-check">
                  {#if selectedCandidate === candidate.key}
                    <CheckCircleOutline />
                  {:else}
                    <div class="empty-check"></div>
                  {/if}
                </div>
                <span class="candidate-name">{candidate.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="info-section">
            {#if selectedPoll.hasVoted}
              <div class="info-message voted">
                <CheckCircleOutline />
                <div>
                  <span>{$_("polls.already_voted")}</span>
                  <br />
                  <small
                    >{$_("polls.vote_for", {
                      values: { option: selectedPoll.userVote },
                    })}</small
                  >
                </div>
              </div>
            {:else if !selectedPoll.isActive}
              <div class="info-message ended">
                <ClockOutline />
                <span>{$_("polls.poll_ended")}</span>
              </div>
            {/if}

            <div class="results-section">
              <h3>{$_("polls.results_title")}</h3>
              {#each selectedPoll.candidates as candidate}
                <div class="result-candidate">
                  <div class="result-header">
                    <span class="candidate-name">{candidate.name}</span>
                    <span class="result-stats">
                      {candidate.votes} ({$_("polls.percentage", {
                        values: { percent: candidate.percentage },
                      })})
                    </span>
                  </div>
                  <div class="result-bar">
                    <div
                      class="result-fill"
                      style="width: {candidate.percentage}%"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="cancel-button" onclick={closeModal}>
          {$_("polls.cancel")}
        </button>
        {#if !showResults && selectedPoll.isActive && !selectedPoll.hasVoted}
          <button
            class="confirm-vote-button"
            onclick={submitVote}
            disabled={!selectedCandidate || votingInProgress}
          >
            {#if votingInProgress}
              <div class="button-spinner"></div>
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                role="img"
                aria-labelledby="voteTitle voteDesc"
                class="icon-vote"
              >
                <title id="voteTitle">Vote</title>
                <desc id="voteDesc">Ballot box with a checked ballot</desc>

                <!-- box -->
                <rect
                  x="3"
                  y="7"
                  width="18"
                  height="14"
                  rx="2"
                  ry="2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                />
                <!-- slot -->
                <rect
                  x="7"
                  y="3"
                  width="10"
                  height="3"
                  rx="0.8"
                  ry="0.8"
                  fill="currentColor"
                />
                <!-- ballot -->
                <rect
                  x="6.2"
                  y="1.8"
                  width="11.6"
                  height="6.8"
                  rx="0.8"
                  ry="0.8"
                  transform="rotate(12 12 5.2)"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
                <!-- check -->
                <path
                  d="M9.5 11.5l2 2.2 4-4.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.6"
                />
              </svg>
            {/if}
            {$_("polls.confirm_vote")}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Keep the same styles from before -->
<style>
  /* Same styles as previous version */
  .rtl {
    direction: rtl;
  }

  .polls-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .polls-header {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border-radius: 1rem;
    padding: 2rem;
    color: white;
    margin-bottom: 2rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .header-text h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
  }

  .header-text p {
    margin: 0;
    opacity: 0.9;
    font-size: 1.1rem;
  }

  .header-icon {
    opacity: 0.8;
    flex-shrink: 0;
  }

  .polls-controls {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-container {
    position: relative;
    flex: 1;
    max-width: 400px;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    pointer-events: none;
  }

  .rtl .search-icon {
    left: auto;
    right: 1rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    background: white;
  }

  .rtl .search-input {
    padding: 0.75rem 2.5rem 0.75rem 1rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .filter-tabs {
    display: flex;
    background: white;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .filter-tab {
    padding: 0.75rem 1.5rem;
    border: none;
    background: white;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-right: 1px solid #e5e7eb;
  }

  .filter-tab:last-child {
    border-right: none;
  }

  .filter-tab:hover {
    background: #f9fafb;
    color: #374151;
  }

  .filter-tab.active {
    background: #3b82f6;
    color: white;
  }

  .polls-content {
    min-height: 400px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: #6b7280;
  }

  .loading-icon {
    margin-bottom: 1rem;
  }

  .spin {
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: #6b7280;
    text-align: center;
  }

  .empty-icon {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 1rem 0 0.5rem 0;
    color: #374151;
    font-size: 1.25rem;
  }

  .polls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .poll-card {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .poll-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  .poll-card.ended {
    opacity: 0.8;
    background: #f9fafb;
  }

  .poll-header {
    margin-bottom: 1rem;
  }

  .poll-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
  }

  .poll-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: #6b7280;
    align-items: center;
    flex-wrap: wrap;
  }

  .poll-author,
  .poll-tags {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .poll-description {
    color: #6b7280;
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0 0 1rem 0;
  }

  .poll-candidates-preview {
    margin-bottom: 1rem;
  }

  .candidate-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
    gap: 1rem;
  }

  .candidate-preview:last-child {
    border-bottom: none;
  }

  .candidate-name {
    font-size: 0.875rem;
    color: #374151;
    flex: 1;
    font-weight: 500;
  }

  .candidate-results {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 80px;
  }

  .result-bar {
    width: 50px;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }

  .result-fill {
    height: 100%;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    transition: width 0.3s ease;
  }

  .result-percentage {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
  }

  .more-candidates {
    padding: 0.5rem 0;
    font-size: 0.75rem;
    color: #6b7280;
    font-style: italic;
  }

  .poll-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    font-size: 0.75rem;
    color: #6b7280;
    flex-wrap: wrap;
  }

  .vote-count,
  .poll-timing {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .poll-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
  }

  .voted-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .vote-button {
    display: flex;
    align-items: center;

    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .vote-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .results-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .results-button:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .voted-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: #dcfce7;
    color: #166534;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.75rem;
  }

  .user-choice {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
  }

  .ended-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
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
    border-radius: 1rem;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-body {
    padding: 2rem;
  }

  .modal-description {
    color: #6b7280;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .modal-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    flex-wrap: wrap;
  }

  .voting-section h3,
  .results-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }

  .vote-candidate {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .vote-candidate:hover {
    border-color: #3b82f6;
    background: #f8faff;
  }

  .vote-candidate.selected {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .candidate-check {
    color: #3b82f6;
  }

  .empty-check {
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-radius: 50%;
  }

  .vote-candidate.selected .empty-check {
    border-color: #3b82f6;
  }

  .result-candidate {
    margin-bottom: 1rem;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  .result-stats {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .result-bar {
    width: 100%;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .info-section {
    text-align: center;
  }

  .info-message {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    margin-bottom: 2rem;
  }

  .info-message.voted {
    background: #dcfce7;
    color: #166534;
  }

  .info-message.ended {
    background: #fef3c7;
    color: #92400e;
  }

  .modal-footer {
    display: flex;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e5e7eb;
    justify-content: flex-end;
  }

  .cancel-button {
    padding: 0.75rem 1.5rem;
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button:hover {
    background: #e5e7eb;
  }

  .confirm-vote-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .confirm-vote-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .confirm-vote-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }
  @media (max-width: 768px) {
    .vote-button {
      width: 30%;
    }
    .polls-container {
      padding: 1rem;
    }

    .polls-header {
      padding: 1.5rem;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
    }

    .header-text h1 {
      font-size: 1.5rem;
    }

    .polls-controls {
      flex-direction: column;
      gap: 1rem;
    }

    .search-container {
      max-width: none;
    }

    .polls-grid {
      grid-template-columns: 1fr;
    }

    .poll-actions {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .voted-info {
      align-items: center;
    }

    .modal-content {
      margin: 1rem;
      max-height: calc(100vh - 2rem);
    }

    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1rem;
    }

    .modal-footer {
      flex-direction: column-reverse;
    }
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: 5rem 0;
  }

  .loading-content {
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    color: #64748b;
    font-weight: 500;
  }
</style>
