<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "@/i18n";
  import {
    getReports,
    getReportDetails,
    replyToReport,
    updateReportStatus,
  } from "@/lib/dmart_services";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { Diamonds } from "svelte-loading-spinners";
  import { formatDate } from "@/lib/helpers";

  let reports = $state([]);
  let isLoading = $state(true);
  let selectedReport = $state(null);
  let showReplyModal = $state(false);
  let adminReply = $state("");
  let isSubmittingReply = $state(false);
  let selectedAction = $state("no_action");

  const statusFilters = [
    { value: "all", label: $_("reports.admin.filters.all") || "All Reports" },
    {
      value: "pending",
      label: $_("reports.admin.filters.pending") || "Pending",
    },
    {
      value: "under_review",
      label: $_("reports.admin.filters.under_review") || "Under Review",
    },
    { value: "solved", label: $_("reports.admin.filters.solved") || "Solved" },
  ];

  const actionOptions = [
    {
      value: "no_action",
      label: $_("reports.admin.actions.no_action") || "No Action Required",
    },
    {
      value: "warn_user",
      label: $_("reports.admin.actions.warn_user") || "Warn User",
    },
    {
      value: "delete_entry",
      label:
        $_("reports.admin.actions.delete_entry") || "Delete Reported Entry",
    },
  ];

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
    await loadReports();
  });

  async function loadReports() {
    try {
      isLoading = true;
      const response = await getReports(
        selectedStatusFilter === "all" ? undefined : selectedStatusFilter
      );
      reports = response.records.map((report) => ({
        ...report,
        reportData: report.attributes?.payload?.body || {},
      }));
    } catch (error) {
      console.error("Error loading reports:", error);
      errorToastMessage(
        $_("reports.admin.error.loading_failed") || "Failed to load reports"
      );
    } finally {
      isLoading = false;
    }
  }

  async function openReplyModal(report) {
    try {
      const detailedReport = await getReportDetails(report.shortname);
      selectedReport = {
        ...report,
        reportData:
          detailedReport?.attributes?.payload?.body || report.reportData,
      };
      showReplyModal = true;
      adminReply = "";
      selectedAction = "no_action";
    } catch (error) {
      console.error("Error loading report details:", error);
      errorToastMessage(
        $_("reports.admin.error.loading_details_failed") ||
          "Failed to load report details"
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
        $_("reports.admin.validation.reply_required") || "Please enter a reply"
      );
      return;
    }

    try {
      isSubmittingReply = true;
      const success = await replyToReport(
        selectedReport.shortname,
        adminReply,
        selectedAction !== "no_action"
          ? (selectedAction as "warn_user" | "delete_entry")
          : undefined
      );

      if (success) {
        successToastMessage(
          $_("reports.admin.success.reply_sent") || "Reply sent successfully"
        );
        closeReplyModal();
        await loadReports();
      } else {
        errorToastMessage(
          $_("reports.admin.error.reply_failed") || "Failed to send reply"
        );
      }
    } catch (error) {
      console.error("Error submitting reply:", error);
      errorToastMessage(
        $_("reports.admin.error.reply_failed") || "Failed to send reply"
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
            "Status updated successfully"
        );
        await loadReports();
      } else {
        errorToastMessage(
          $_("reports.admin.error.status_update_failed") ||
            "Failed to update status"
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
      errorToastMessage(
        $_("reports.admin.error.status_update_failed") ||
          "Failed to update status"
      );
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "under_review":
        return "bg-blue-100 text-blue-800";
      case "solved":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getTypeIcon(reportType) {
    switch (reportType) {
      case "inappropriate_content":
        return "⚠️";
      case "spam":
        return "🚫";
      case "misinformation":
        return "❌";
      case "copyright_violation":
        return "©️";
      case "harassment":
        return "🛡️";
      default:
        return "🔍";
    }
  }

  $effect(() => {
    if (selectedStatusFilter) {
      loadReports();
    }
  });
</script>

<div class="admin-reports-page">
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          {$_("reports.admin.title") || "Reports Management"}
        </h1>
        <p class="page-description">
          {$_("reports.admin.description") || "Review and manage user reports"}
        </p>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-group">
          <label for="status-filter" class="filter-label">
            {$_("reports.admin.filter_by_status") || "Filter by Status"}
          </label>
          <select
            id="status-filter"
            bind:value={selectedStatusFilter}
            class="filter-select"
          >
            {#each statusFilters as filter}
              <option value={filter.value}>{filter.label}</option>
            {/each}
          </select>
        </div>
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
        <div class="empty-icon">📋</div>
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
      </div>
    {:else}
      <div class="reports-grid">
        {#each reports as report}
          <div class="report-card">
            <div class="report-header">
              <div class="report-type">
                <span class="type-icon"
                  >{getTypeIcon(report.reportData.report_type)}</span
                >
                <span class="type-text"
                  >{report.reportData.report_type?.replace("_", " ") ||
                    "General"}</span
                >
              </div>
              <div class="report-status">
                <span
                  class="status-badge {getStatusColor(
                    report.reportData.status
                  )}"
                >
                  {report.reportData.status || "pending"}
                </span>
              </div>
            </div>

            <div class="report-content">
              <h3 class="report-title">{report.reportData.title}</h3>
              <p class="report-description">{report.reportData.description}</p>

              <div class="reported-entry-info">
                <h4 class="reported-entry-title">
                  {$_("reports.admin.reported_entry") || "Reported Entry"}
                </h4>
                <div class="reported-entry-details">
                  <span class="entry-title"
                    >{report.reportData.reported_entry_title}</span
                  >
                  <span class="entry-id"
                    >({report.reportData.reported_entry})</span
                  >
                  <span class="entry-space"
                    >in {report.reportData.reported_space}</span
                  >
                </div>
              </div>

              <div class="report-meta">
                <span class="meta-item">
                  <strong
                    >{$_("reports.admin.reported_by") || "Reported by"}:</strong
                  >
                  {report.attributes.owner_shortname}
                </span>
                <span class="meta-item">
                  <strong
                    >{$_("reports.admin.reported_at") || "Reported"}:</strong
                  >
                  {formatRelativeTime(
                    report.reportData.created_at || report.attributes.created_at
                  )}
                </span>
              </div>

              {#if report.reportData.replies && report.reportData.replies.length > 0}
                <div class="replies-section">
                  <h4 class="replies-title">
                    {$_("reports.admin.notes") || "Admin Notes"}
                  </h4>
                  {#each report.reportData.replies as reply}
                    <div class="reply-item">
                      <div class="reply-header">
                        <span class="reply-admin">{reply.admin_shortname}</span>
                        <span class="reply-time"
                          >{formatRelativeTime(reply.timestamp)}</span
                        >
                      </div>
                      <p class="reply-content">{reply.reply}</p>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="report-actions">
              {#if report.reportData.status !== "solved"}
                <button
                  class="action-btn reply-btn"
                  onclick={() => openReplyModal(report)}
                >
                  {$_("reports.admin.actions.reply") || "Reply"}
                </button>

                {#if report.reportData.status === "pending"}
                  <button
                    class="action-btn review-btn"
                    onclick={() =>
                      updateStatus(report.shortname, "under_review")}
                  >
                    {$_("reports.admin.actions.mark_reviewing") ||
                      "Mark as Under Review"}
                  </button>
                {/if}

                <button
                  class="action-btn solve-btn"
                  onclick={() => updateStatus(report.shortname, "solved")}
                >
                  {$_("reports.admin.actions.mark_solved") || "Mark as Solved"}
                </button>
              {:else}
                <span class="solved-text">
                  {$_("reports.admin.status.solved") ||
                    "This report has been resolved"}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Reply Modal -->
{#if showReplyModal && selectedReport}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeReplyModal();
    }}
  >
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("reports.admin.reply_modal.title") || "Reply to Report"}
        </h2>
        <button type="button" class="close-button" onclick={closeReplyModal}>
          ✕
        </button>
      </div>

      <div class="modal-body">
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
              {#each actionOptions as action}
                <option value={action.value}>{action.label}</option>
              {/each}
            </select>
          </div>

          <div class="modal-actions">
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
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-reports-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #e0e7ff 100%);
    padding: 2rem 0;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .header-content {
    text-align: center;
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .page-description {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  .filters-section {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .filter-select {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background-color: white;
    min-width: 200px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    color: #6b7280;
    font-size: 1.125rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .empty-message {
    color: #6b7280;
    max-width: 28rem;
    margin: 0;
  }

  .reports-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .report-card {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
  }

  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .report-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .type-icon {
    font-size: 1.25rem;
  }

  .type-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    text-transform: capitalize;
  }

  .status-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    text-transform: capitalize;
  }

  .report-content {
    margin-bottom: 1.5rem;
  }

  .report-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .report-description {
    color: #6b7280;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .reported-entry-info {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .reported-entry-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .reported-entry-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entry-title {
    font-weight: 500;
    color: #111827;
  }

  .entry-id,
  .entry-space {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .report-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }

  .replies-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
    margin-top: 1rem;
  }

  .replies-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .reply-item {
    background-color: #f3f4f6;
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .reply-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .reply-admin {
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
  }

  .reply-time {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .reply-content {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .report-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .reply-btn {
    background-color: #3b82f6;
    color: white;
  }

  .reply-btn:hover {
    background-color: #2563eb;
  }

  .review-btn {
    background-color: #f59e0b;
    color: white;
  }

  .review-btn:hover {
    background-color: #d97706;
  }

  .solve-btn {
    background-color: #10b981;
    color: white;
  }

  .solve-btn:hover {
    background-color: #059669;
  }

  .solved-text {
    font-size: 0.875rem;
    color: #6b7280;
    font-style: italic;
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-container {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-width: 42rem;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .close-button {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.5rem;
    line-height: 1;
  }

  .close-button:hover {
    color: #374151;
  }

  .modal-body {
    padding: 1.5rem;
  }

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

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
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
    .reports-grid {
      grid-template-columns: 1fr;
    }

    .modal-container {
      margin: 0.5rem;
      max-height: calc(100vh - 1rem);
    }

    .modal-header,
    .modal-body {
      padding: 1rem;
    }

    .modal-actions {
      flex-direction: column;
    }

    .cancel-button,
    .submit-button {
      width: 100%;
      justify-content: center;
    }
  }
</style>
