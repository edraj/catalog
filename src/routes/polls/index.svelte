<script lang="ts">
  import { onMount } from "svelte";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { getPolls, userVote } from "@/lib/dmart_services/dmart_services";
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
    ChartOutline,
  } from "flowbite-svelte-icons";
  import { user } from "@/stores/user";
  import { Diamonds } from "svelte-loading-spinners";
  // Create Poll imports
  import CreatePollModal from "./CreatePollModal.svelte";

  let polls = $state([]);
  let loading = $state(true);
  let searchTerm = $state("");
  let filterStatus = $state("all");
  let selectedPoll = $state(null);
  let showVoteModal = $state(false);
  let selectedCandidate = $state("");
  let votingInProgress = $state(false);
  let showResults = $state(false);

  let showCreateModal = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
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
      const response = await getPolls("applications", "managed");

      if (response?.status === "success" && response?.records) {
        const processedPolls = response.records.map((poll) => {
          const body = poll.attributes?.payload?.body || {};
          const candidates = body.candidates || [];
          const attachments = poll.attachments?.json || [];

          const candidatesWithResults = candidates.map((candidate) => {
            const candidateAttachment = attachments.find(
              (att) => att.shortname === candidate.key,
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
            0,
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
          candidate.name.toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && poll.isActive) ||
        (filterStatus === "ended" && !poll.isActive);

      return matchesSearch && matchesStatus;
    }),
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
        (c) => c.key === selectedCandidate,
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
            (voter) => voter !== userValue.shortname,
          );

          await userVote(
            selectedPoll.shortname,
            otherCandidate.key,
            filteredVoters,
            true,
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
        hasExistingAttachment,
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

  function formatTimeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals = {
      y: 31536000,
      mo: 2592000,
      w: 604800,
      d: 86400,
      h: 3600,
      m: 60,
    };
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        if (unit === "d" || unit === "w" || unit === "mo" || unit === "y") {
          return `${interval}${unit} ago`;
        }
        return `${interval}${unit} ago`; // like 5m ago, 2h ago
      }
    }
    return "Just now";
  }
</script>

<div class="polls-container min-h-screen bg-white" class:rtl={$isRTL}>
  <!-- Header -->
  <div class="polls-header flex justify-between items-center mb-10 pt-10 px-8 max-w-7xl mx-auto">
    <div class="header-text">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">{$_("polls.title") || "Community Polls"}</h1>
      <p class="text-gray-500 text-sm">{$_("polls.description") || "Vote on topics that matter, see what the team thinks"}</p>
    </div>
    <button class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full font-medium flex items-center gap-2 transition-colors shadow-sm text-sm" onclick={() => showCreateModal = true}>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
      Create Poll
    </button>
  </div>

  <div class="max-w-7xl mx-auto border-t border-gray-100 mb-8 pt-8 px-8">
    <!-- Stats Row -->
    <div class="polls-stats flex gap-4 mb-10">
      <div class="stat-pill flex items-center gap-2 px-5 py-2 bg-white border border-gray-100 rounded-full text-sm shadow-sm ring-1 ring-black ring-opacity-5">
        <ChartOutline class="w-4 h-4 text-indigo-500" />
        <span class="text-gray-500">{$_("route_labels.label_total")}</span> <span class="font-bold text-gray-900 ml-1">{polls.length}</span>
      </div>
      <div class="stat-pill flex items-center gap-2 px-5 py-2 bg-white border border-gray-100 rounded-full text-sm shadow-sm ring-1 ring-black ring-opacity-5">
        <ClockOutline class="w-4 h-4 text-green-500" />
        <span class="text-gray-500">{$_("route_labels.label_active")}</span> <span class="font-bold text-gray-900 ml-1">{polls.filter(p => p.isActive).length}</span>
      </div>
      <div class="stat-pill flex items-center gap-2 px-5 py-2 bg-white border border-gray-100 rounded-full text-sm shadow-sm ring-1 ring-black ring-opacity-5">
        <CheckCircleOutline class="w-4 h-4 text-gray-400" />
        <span class="text-gray-500">{$_("route_labels.label_ended")}</span> <span class="font-bold text-gray-900 ml-1">{polls.filter(p => !p.isActive).length}</span>
      </div>
    </div>

    <!-- Controls Row -->
    <div class="polls-controls flex flex-col sm:flex-row gap-6 mb-8 items-center">
      <div class="search-wrapper relative w-full sm:max-w-md">
        <SearchOutline class="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          bind:value={searchTerm} 
          placeholder="Search polls..." 
          class="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
        />
      </div>

      <div class="filter-pills flex items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm h-10">
        <button 
          class="px-6 h-full rounded-full text-sm font-medium transition-colors {filterStatus === 'all' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}"
          onclick={() => filterStatus = 'all'}
        >
          All Polls
        </button>
        <button 
          class="px-6 h-full rounded-full text-sm font-medium transition-colors {filterStatus === 'active' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}"
          onclick={() => filterStatus = 'active'}
        >
          Active
        </button>
        <button 
          class="px-6 h-full rounded-full text-sm font-medium transition-colors {filterStatus === 'ended' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}"
          onclick={() => filterStatus = 'ended'}
        >
          Ended
        </button>
      </div>
    </div>

    <!-- Polls Grid -->
    <div class="polls-content min-h-[400px]">
      {#if loading}
        <div class="flex justify-center items-center h-64">
          <Diamonds color="#4f46e5" size="60" unit="px" />
        </div>
      {:else if filteredPolls.length === 0}
        <div class="empty-state flex flex-col items-center justify-center py-16 text-gray-500">
          <h3 class="text-xl font-medium text-gray-900 mb-1">{$_("polls.no_polls") || "No polls found"}</h3>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {#each filteredPolls as poll}
            <div class="bg-white rounded-[1.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative ring-1 ring-black ring-opacity-5">
              
              <!-- Card Top -->
              <div class="flex justify-between items-start mb-6">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs border border-gray-200">
                    {poll.createdBy.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-gray-800 tracking-tight">{poll.createdBy}</h4>
                    <p class="text-[11px] text-gray-400 font-medium">{formatTimeAgo(poll.createdAt)}</p>
                  </div>
                </div>
                <div class="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase {poll.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}">
                  {poll.isActive ? 'Active' : 'Ended'}
                </div>
              </div>

              <!-- Content -->
              <h3 class="text-xl font-bold text-gray-900 mb-3 tracking-tight">{poll.title}</h3>
              <p class="text-[13px] text-gray-500 mb-8 line-clamp-2 leading-relaxed">
                {poll.description}
              </p>

              <!-- Leading Option (if any candidate has votes or is a valid array) -->
              <div class="mb-8">
                {#if poll.candidates.length > 0}
                   {@const sorted = [...poll.candidates].sort((a,b) => b.votes - a.votes)}
                   {@const leading = sorted[0]}
                   <div class="flex justify-between items-center text-xs mb-2.5">
                     <span class="text-gray-500 font-medium">Leading: <span class="text-gray-700">{leading.name}</span></span>
                     <span class="font-bold text-indigo-600">{leading.percentage}%</span>
                   </div>
                   <div class="w-full h-[6px] bg-gray-100 rounded-full overflow-hidden">
                     <div class="h-full bg-indigo-500 rounded-full transition-all duration-500" style="width: {leading.percentage}%"></div>
                   </div>
                {/if}
              </div>

              <!-- Footer Stats and Actions -->
              <div class="flex items-center justify-between pt-5 border-t border-gray-100 mt-auto">
                <div class="flex items-center gap-4 text-[11px] font-medium text-gray-400">
                  <span class="flex items-center gap-1.5"><UserOutline class="w-3.5 h-3.5"/> {poll.totalVotes} votes</span>
                  <span>{poll.candidates.length} options</span>
                  <span>{poll.tags.length > 0 ? poll.tags.join(', ') : 'Team & Culture'}</span>
                </div>
                
                <div class="flex items-center gap-3">
                  <button class="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-semibold transition-colors" onclick={() => openResultsModal(poll)}>
                    <EyeOutline class="w-[14px] h-[14px]"/> Results
                  </button>
                  
                  {#if poll.hasVoted}
                    <button class="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-100 text-xs font-semibold transition-colors cursor-default">
                      <CheckCircleOutline class="w-[14px] h-[14px]"/> Voted
                    </button>
                  {:else if poll.isActive}
                    <button class="flex items-center gap-1.5 px-5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 text-xs font-semibold transition-colors" onclick={() => openVoteModal(poll)}>
                      Vote
                    </button>
                  {/if}
                </div>
              </div>

            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Vote/Results Modal -->
{#if showVoteModal && selectedPoll}
  <div class="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onclick={closeModal} onkeydown={(e) => e.key === "Escape" && closeModal()} class:rtl={$isRTL} role="dialog" aria-modal="true" tabindex="0">
    <div class="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
      <div class="flex items-center justify-between p-6 border-b border-gray-100">
        <h2 class="text-xl font-bold text-gray-900 tracking-tight">{selectedPoll.title}</h2>
        <button class="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" onclick={closeModal}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div class="p-8 overflow-y-auto">
        {#if showResults}
          <div class="space-y-6">
            {#each selectedPoll.candidates as candidate}
              <div>
                <div class="flex justify-between items-end mb-2">
                  <span class="text-[13px] text-gray-800 font-semibold">{candidate.name}</span>
                  <span class="text-xs font-bold text-indigo-600">{candidate.percentage}%</span>
                </div>
                <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div class="h-full bg-indigo-500 rounded-full" style="width: {candidate.percentage}%"></div>
                </div>
                <div class="text-[11px] text-gray-400 font-medium">{candidate.votes} votes</div>
              </div>
            {/each}
          </div>
        {:else if selectedPoll.isActive && !selectedPoll.hasVoted}
          <div class="space-y-3">
            {#each selectedPoll.candidates as candidate}
              <button class="w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left {selectedCandidate === candidate.key ? 'border-indigo-600 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-200'}" onclick={() => selectCandidate(candidate.key)}>
                <div class="flex-shrink-0">
                  {#if selectedCandidate === candidate.key}
                    <div class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                       <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                  {:else}
                    <div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                  {/if}
                </div>
                <span class="text-sm font-semibold text-gray-800">{candidate.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="text-center pb-6 border-b border-gray-100 mb-6">
            {#if selectedPoll.hasVoted}
               <div class="inline-flex items-center justify-center gap-2 bg-green-50 text-green-700 px-5 py-2.5 rounded-full font-semibold text-sm">
                 <CheckCircleOutline class="w-4 h-4" /> You voted for: <span class="text-green-800">{selectedPoll.userVote}</span>
               </div>
            {:else}
               <div class="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-600 px-5 py-2.5 rounded-full font-semibold text-sm">
                 <ClockOutline class="w-4 h-4" /> Poll ended
               </div>
            {/if}
          </div>
          
          <div class="space-y-6">
            {#each selectedPoll.candidates as candidate}
              <div>
                <div class="flex justify-between items-end mb-2">
                  <span class="text-[13px] text-gray-800 font-semibold">{candidate.name}</span>
                  <span class="text-xs font-bold text-indigo-600">{candidate.percentage}%</span>
                </div>
                <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div class="h-full bg-indigo-500 rounded-full" style="width: {candidate.percentage}%"></div>
                </div>
                <div class="text-[11px] text-gray-400 font-medium">{candidate.votes} votes</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/80">
        <button class="px-6 py-2.5 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors" onclick={closeModal}>
          Cancel
        </button>
        {#if !showResults && selectedPoll.isActive && !selectedPoll.hasVoted}
          <button class="px-8 py-2.5 rounded-full text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-indigo-200" onclick={submitVote} disabled={!selectedCandidate || votingInProgress}>
            {#if votingInProgress}
               <div class="w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin"></div>
            {/if}
            Vote
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showCreateModal}
  <CreatePollModal onClose={() => showCreateModal = false} />
{/if}
