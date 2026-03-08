<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "@/i18n";
  import {
    getReports,
    getReportDetails,
    replyToReport,
    updateReportStatus,
  } from "@/lib/dmart_services/dmart_services";
  import { getWorkflow } from "@/lib/dmart_services/workflows";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { Diamonds } from "svelte-loading-spinners";
  import { formatDate } from "@/lib/helpers";
  import { Modal } from "flowbite-svelte";
  import { InboxOutline } from "flowbite-svelte-icons";

  let reports = $state([]);
  let isLoading = $state(true);
  let selectedReport = $state(null);
  let showReplyModal = $state(false);
  let adminReply = $state("");
  let isSubmittingReply = $state(false);
  let selectedAction = $state("no_action");
  let workflow = $state(null);
  let statusFilters = $state([
    { value: "all", label: $_("reports.admin.filters.all") || "All Reports" },
  ]);
  let availableTransitions = $state([]);

  let selectedStatusFilter = $state("all");

  function formatRelativeTime(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  }

  onMount(async () => {
    await Promise.all([loadReports(), loadWorkflow()]);
  });

  async function loadWorkflow() {
    try {
      const response = await getWorkflow("report_workflow", "catalog");

      if (response && response?.payload?.body) {
        workflow = response.payload.body;
        const dynamicFilters = [];

        // Add initial states to filters
        if (workflow.initial_state) {
          workflow.initial_state.forEach((s) => {
            dynamicFilters.push({
              value: s.name,
              label: s.name.charAt(0).toUpperCase() + s.name.slice(1),
            });
          });
        }

        // Add other states to filters
        if (workflow.states) {
          workflow.states.forEach((s) => {
            if (!dynamicFilters.find((f) => f.value === s.state)) {
              dynamicFilters.push({
                value: s.state,
                label: s.name || s.state,
              });
            }
          });
        }

        statusFilters = [
          {
            value: "all",
            label: $_("reports.admin.filters.all") || "All Reports",
          },
          ...dynamicFilters,
        ];
      }
    } catch (error) {
      console.error("Error loading workflow:", error);
    }
  }

  function getRepliesFromAttachments(attachments) {
    if (!attachments) return [];
    let allAttachments = [];
    if (Array.isArray(attachments)) {
      allAttachments = attachments;
    } else {
      // Dmart often returns attachments as a dictionary
      Object.values(attachments).forEach((val) => {
        if (Array.isArray(val)) {
          allAttachments.push(...val);
        } else if (val && typeof val === "object") {
          allAttachments.push(val);
        }
      });
    }

    return allAttachments
      .filter((a) => a.resource_type === "comment")
      .map((a) => ({
        timestamp: a.attributes?.created_at || a.created_at,
        admin_shortname: a.attributes?.owner_shortname || a.owner_shortname,
        reply: a.attributes?.payload?.body?.body || a.payload?.body?.body || "No content",
      }));
  }

  async function loadReports() {
    try {
      isLoading = true;
      const response = await getReports(
        selectedStatusFilter === "all" ? undefined : selectedStatusFilter,
      );
      reports = response.records.map((report) => {
        const attributes = report.attributes || {};
        const reportData = attributes.payload?.body || {};

        const replies = getRepliesFromAttachments(report["attachments"]);

        return {
          ...report,
          reportData: {
            ...reportData,
            replies: replies,
            title: reportData.title || attributes.displayname?.en || "No Title",
            description:
              reportData.description ||
              attributes.description?.en ||
              "No Description",
            reported_entry: reportData.entry || reportData.reported_entry,
            reported_space: reportData.space_name || reportData.reported_space,
            reported_subpath: reportData.subpath || reportData.reported_subpath,
          },
        };
      });
    } catch (error) {
      console.error("Error loading reports:", error);
      errorToastMessage(
        $_("reports.admin.error.loading_failed") || "Failed to load reports",
      );
    } finally {
      isLoading = false;
    }
  }

  async function openReplyModal(report) {
    try {
      const detailedReport = await getReportDetails(report.shortname);
      const attributes = detailedReport?.attributes || report.attributes || {};
      const reportData = attributes.payload?.body || report.reportData || {};

      const replies = getRepliesFromAttachments(
        detailedReport?.["attachments"] || report["attachments"],
      );

      selectedReport = {
        ...report,
        reportData: {
          ...reportData,
          replies: replies,
          title: reportData.title || attributes.displayname?.en || "No Title",
          description:
            reportData.description ||
            attributes.description?.en ||
            "No Description",
          reported_entry: reportData.entry || reportData.reported_entry,
          reported_space: reportData.space_name || reportData.reported_space,
          reported_subpath: reportData.subpath || reportData.reported_subpath,
        },
      };
      showReplyModal = true;
      adminReply = "";
      selectedAction = "no_action";

      // Get available transitions for the current state
      if (workflow && workflow.states) {
        console.log({ workflow})
        const currentState = workflow.states.find(
          (s) => s.state === (selectedReport.attributes.state || "Pending"),
        );
        availableTransitions = currentState?.next || [];
      } else {
        availableTransitions = [];
      }
    } catch (error) {
      console.error("Error loading report details:", error);
      errorToastMessage(
        $_("reports.admin.error.loading_details_failed") ||
          "Failed to load report details",
      );
    }
  }

  function closeReplyModal() {
    showReplyModal = false;
    selectedReport = null;
    adminReply = "";
    selectedAction = "no_action";
  }

  async function submitReply() {
    if (!adminReply.trim()) {
      errorToastMessage(
        $_("reports.admin.validation.reply_required") || "Please enter a reply",
      );
      return;
    }

    try {
      isSubmittingReply = true;
      const success = await replyToReport(
        selectedReport.shortname,
        adminReply,
        selectedAction !== "no_action" ? selectedAction : undefined,
      );

      if (success) {
        successToastMessage(
          $_("reports.admin.success.reply_sent") || "Reply sent successfully",
        );
        closeReplyModal();
        await loadReports();
      } else {
        errorToastMessage(
          $_("reports.admin.error.reply_failed") || "Failed to send reply",
        );
      }
    } catch (error) {
      console.error("Error submitting reply:", error);
      errorToastMessage(
        $_("reports.admin.error.reply_failed") || "Failed to send reply",
      );
    } finally {
      isSubmittingReply = false;
    }
  }

  async function updateStatus(reportShortname, newStatus) {
    try {
      const success = await updateReportStatus(reportShortname, newStatus);
      if (success) {
        successToastMessage(
          $_("reports.admin.success.status_updated") ||
            "Status updated successfully",
        );
        await loadReports();
      } else {
        errorToastMessage(
          $_("reports.admin.error.status_update_failed") ||
            "Failed to update status",
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
      errorToastMessage(
        $_("reports.admin.error.status_update_failed") ||
          "Failed to update status",
      );
    }
  }

  function getReportStyle(report) {
    const state =
      report.attributes?.state || report.reportData?.status || "Pending";
    const normalizedState = state.toLowerCase();

    // Default style
    let style = {
      color: "bg-gray-50 text-gray-500",
      icon: "🔍",
      label: state,
      isEndState: false,
    };

    if (workflow) {
      // Check if it's an initial state
      const isInitial = isInitialState(report);
      if (isInitial) {
        style = {
          ...style,
          color: "bg-gray-50 text-gray-500",
          icon: "📥",
          label: state,
        };
      } else {
        const stateObj = workflow.states?.find(
          (s) => s.state?.toLowerCase() === normalizedState,
        );
        if (stateObj) {
          const isEnd = !stateObj.next || stateObj.next.length === 0;
          if (isEnd) {
            style = {
              ...style,
              color: "bg-red-50 text-red-600",
              label: stateObj.name || state,
              isEndState: true,
            };
          } else {
            style = {
              ...style,
              color: "bg-green-50 text-green-600",
              label: stateObj.name || state,
            };
          }
        }
      }
    }
    return { ...style };
  }

  function isInitialState(report) {
    if (!workflow || !workflow.initial_state)
      return report.attributes.state === "Pending";
    const normalizedState = (report.attributes.state || "Pending").toLowerCase();
    const initialStates = Array.isArray(workflow.initial_state)
      ? workflow.initial_state
      : [workflow.initial_state];
    return initialStates.some(
      (s) =>
        s.name?.toLowerCase() === normalizedState ||
        s.state?.toLowerCase() === normalizedState,
    );
  }

  $effect(() => {
    if (selectedStatusFilter) {
      loadReports();
    }
  });
</script>

<div class="admin-reports-page bg-gray-50 min-h-screen">
  <div class="container mx-auto px-4 py-8 pt-12 max-w-7xl">
    <!-- Header -->
    <div class="page-header text-center mb-10">
      <h1 class="page-title text-3xl font-bold text-gray-900 mb-2">
        {$_("reports.admin.title") || "Reports Management"}
      </h1>
      <p class="page-description text-gray-500">
        {$_("reports.admin.description") || "Review and manage user reports"}
      </p>
    </div>

    <!-- Filters -->
    <div class="filters-section flex justify-center mb-10">
      <div class="filter-group flex flex-col items-center gap-2">
        <label
          for="status-filter"
          class="filter-label text-xs font-medium text-gray-400"
        >
          {$_("reports.admin.filter_by_status") || "Filter by Status"}
        </label>
        <select
          id="status-filter"
          bind:value={selectedStatusFilter}
          class="filter-select px-6 py-2 border-0 bg-white rounded-full shadow-sm text-sm font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {#each statusFilters as filter}
            <option value={filter.value}>{filter.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Reports List -->
    {#if isLoading}
      <div class="loading-state">
        <Diamonds color="#3b82f6" size="40" unit="px" />
        <p class="loading-text">
          {$_("reports.admin.loading") || "Loading reports..."}
        </p>
      </div>
    {:else if reports.length === 0}
      <div class="empty-state">
        <div class="empty-icon-container">
          <InboxOutline class="w-16 h-16 text-gray-300" />
        </div>
        <h3 class="empty-title">
          {$_("reports.admin.empty.title") || "No Reports Found"}
        </h3>
        <p class="empty-message">
          {selectedStatusFilter === "all"
            ? $_("reports.admin.empty.no_reports") ||
              "No reports have been submitted yet."
            : $_("reports.admin.empty.no_reports_filter") ||
              `No ${selectedStatusFilter} reports found.`}
        </p>
        {#if selectedStatusFilter !== "all"}
          <button
            class="clear-filters-btn mt-6"
            onclick={() => (selectedStatusFilter = "all")}
          >
            {$_("reports.admin.actions.clear_filters") || "Clear All Filters"}
          </button>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each reports as report}
          {@const { color, icon, label, isEndState } = getReportStyle(report)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-default"
            tabindex="0"
            role="button"
            onkeypress={(e) => {
              if (e.key === "Enter" && isInitialState(report)) {
                openReplyModal(report);
              }
            }}
            onclick={(e) => {
              // Only open if clicking on the card itself, not the buttons
              if (e.target === e.currentTarget && isInitialState(report))
                openReplyModal(report);
            }}
          >
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-2">
                  <span
                    class="type-text text-sm font-bold">{report.reportData.report_type?.replace("_", " ") ||
                      "General"}</span
                  >
                </div>
                {#if !isEndState}
                  <div class="report-status">
                    <span
                      class="status-badge px-3 py-1 text-xs font-semibold rounded-full capitalize {color}"
                    >
                      {#if icon}<span class="mr-1">{icon}</span>{/if}
                      {label}
                    </span>
                  </div>
                {/if}
              </div>

            <div class="report-content flex-grow">
              <h3 class="report-title text-lg font-bold text-gray-900 mb-1">
                {report.reportData.title}
              </h3>
              <p
                class="report-description text-gray-500 text-sm mb-4 line-clamp-3"
              >
                {report.reportData.description}
              </p>

              <div class="reported-entry-info bg-gray-50 rounded-xl p-4 mb-4">
                <h4
                  class="reported-entry-title text-xs font-medium text-gray-400 mb-2"
                >
                  {$_("reports.admin.reported_entry") || "Reported Entry"}
                </h4>
                <div class="reported-entry-details flex flex-col gap-1">
                  <span class="entry-title text-sm font-bold text-gray-900"
                    >{report.reportData.reported_entry_title}</span
                  >
                  <span class="entry-id text-xs text-gray-400"
                    >({report.reportData.reported_entry})</span
                  >
                  <span class="entry-space text-xs text-gray-400"
                    >in {report.reportData.reported_space}</span
                  >
                </div>
              </div>

              <div class="report-meta flex flex-col gap-2 mb-4">
                <div class="meta-item text-xs text-gray-400">
                  {$_("reports.admin.reported_by") || "Reported by"}:
                  <span class="font-bold text-gray-600 ml-1"
                    >{report.attributes.owner_shortname}</span
                  >
                </div>
                <div class="meta-item text-xs text-gray-400">
                  {$_("reports.admin.reported_at") || "Reported"}:
                  <span class="font-medium text-gray-500 ml-1"
                    >{formatRelativeTime(
                      report.reportData.created_at ||
                        report.attributes.created_at,
                    )}</span
                  >
                </div>
              </div>

              {#if report.reportData.replies && report.reportData.replies.length > 0}
                <div class="replies-section mt-4 pt-4 border-t border-gray-100">
                  <h4
                    class="replies-title text-xs font-bold text-gray-800 mb-3"
                  >
                    {$_("reports.admin.notes") || "Admin Notes"}
                  </h4>
                  {#each report.reportData.replies as reply}
                    <div class="reply-item bg-gray-50 rounded-xl p-3 mb-2">
                      <div
                        class="reply-header flex justify-between items-center mb-1"
                      >
                        <span
                          class="reply-admin text-xs font-bold text-gray-700"
                          >{reply.admin_shortname}</span
                        >
                        <span class="reply-time text-[10px] text-gray-400"
                          >{formatRelativeTime(reply.timestamp)}</span
                        >
                      </div>
                      <p class="reply-content text-xs text-gray-500 m-0">
                        {reply.reply}
                      </p>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div
              class="report-actions mt-auto pt-4 flex gap-2 flex-wrap text-sm font-semibold"
            >
              {#if workflow}
                {@const stateObj = workflow.states?.find(
                  (s) =>
                    s.state?.toLowerCase() ===
                    (report.attributes.state || "Pending").toLowerCase(),
                )}
                 {@const isInitial = isInitialState(report)}
                {@const isEndState =
                  stateObj && (!stateObj.next || stateObj.next.length === 0)}

                {#if isEndState}
                  <span class="text-red-500 cursor-default">
                    {stateObj.name || report.attributes.state}
                  </span>
                {:else if isInitial || stateObj}
                  <button
                    class="action-btn text-blue-500 hover:text-blue-600 bg-transparent p-0 border-0"
                    onclick={() => openReplyModal(report)}
                  >
                    {$_("reports.admin.actions.reply") || "Take action"}
                  </button>
                {:else}
                  <span class="text-gray-400 cursor-default">
                    {report.attributes.state || "Pending"}
                  </span>
                {/if}
              {:else}
                <button
                  class="action-btn text-blue-500 hover:text-blue-600 bg-transparent p-0 border-0"
                  onclick={() => openReplyModal(report)}
                >
                  {$_("reports.admin.actions.reply") || "Take action"}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Reply Modal -->
<Modal
  title={$_("reports.admin.reply_modal.title") || "Reply to Report"}
  bind:open={showReplyModal}
  size="lg"
  class="bg-white dark:bg-white"
  headerClass="text-gray-900 dark:text-gray-900"
  placement="center"
  autoclose={false}
>
  {#if selectedReport}
    <!-- Report Summary -->
    <div class="report-summary">
      <h3 class="summary-title">{selectedReport.reportData.title}</h3>
      <p class="summary-description">
        {selectedReport.reportData.description}
      </p>
      <div class="summary-meta">
        <span
          ><strong>Entry:</strong>
          {selectedReport.reportData.reported_entry_title}</span
        >
        <span
          ><strong>Type:</strong>
          {selectedReport.reportData.report_type}</span
        >
      </div>
    </div>

    <!-- Reply Form -->
    <form
      id="reply-form"
      onsubmit={(e) => {
        e.preventDefault();
        submitReply();
      }}
      class="reply-form"
    >
      <div class="form-group">
        <label for="adminReply" class="form-label">
          {$_("reports.admin.reply_modal.your_notes") || "Your Notes"} *
        </label>
        <textarea
          id="adminReply"
          bind:value={adminReply}
          class="form-textarea"
          placeholder={$_("reports.admin.reply_modal.notes_placeholder") ||
            "Enter your notes to this report..."}
          rows="4"
          required
        ></textarea>
      </div>

      <div class="form-group">
        <label for="actionSelect" class="form-label">
          {$_("reports.admin.reply_modal.action") || "Action to Take"}
        </label>
        <select
          id="actionSelect"
          bind:value={selectedAction}
          class="form-select"
        >
          <option value="no_action"
            >{$_("reports.admin.actions.no_action") ||
              "No Action Required"}</option
          >
          {#each availableTransitions as transition}
            <option value={transition.action}>{transition.action}</option>
          {/each}
        </select>
      </div>
    </form>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      class="cancel-button"
      onclick={closeReplyModal}
      disabled={isSubmittingReply}
    >
      {$_("common.cancel") || "Cancel"}
    </button>
    <button
      type="submit"
      form="reply-form"
      class="submit-button"
      disabled={isSubmittingReply || !adminReply.trim()}
    >
      {#if isSubmittingReply}
        <Diamonds color="#ffffff" size="16" unit="px" />
        {$_("reports.admin.reply_modal.sending") || "Sending..."}
      {:else}
        {$_("reports.admin.reply_modal.send_reply") || "Send Reply"}
      {/if}
    </button>
  {/snippet}
</Modal>

<style>
  /* Modal Styles removed - now using flowbite Modal */

  .report-summary {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .summary-description {
    color: #6b7280;
    margin-bottom: 0.75rem;
  }

  .summary-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .reply-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-textarea,
  .form-select {
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    padding: 0.75rem;
    font-size: 0.875rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-textarea {
    resize: vertical;
    min-height: 4rem;
  }

  .cancel-button,
  .submit-button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cancel-button {
    background-color: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .cancel-button:hover:not(:disabled) {
    background-color: #f9fafb;
  }

  .submit-button {
    background-color: #3b82f6;
    color: white;
    border: 1px solid #3b82f6;
  }

  .submit-button:hover:not(:disabled) {
    background-color: #2563eb;
    border-color: #2563eb;
  }

  .submit-button:disabled,
  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .cancel-button,
    .submit-button {
      width: 100%;
      justify-content: center;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 6rem 2rem;
    border-radius: 2rem;
    border: 1px dashed #e5e7eb;
  }

  .empty-icon-container {
    width: 5rem;
    height: 5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9fafb;
    border-radius: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .empty-message {
    font-size: 1rem;
    color: #6b7280;
    max-width: 24rem;
    margin: 0 auto;
  }

  .clear-filters-btn {
    padding: 0.625rem 1.25rem;
    background-color: white;
    color: #3b82f6;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    cursor: pointer;
  }

  .clear-filters-btn:hover {
    background-color: #f9fafb;
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 6rem 2rem;
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    font-size: 1rem;
    color: #6b7280;
    font-weight: 500;
  }
</style>
