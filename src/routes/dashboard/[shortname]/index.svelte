<script lang="ts">
  import { params } from "@roxi/routify";
  import {
    checkCurrentUserReactedIdea,
    createComment,
    createReaction,
    deleteReactionComment,
    getAvatar,
    getCatalogWorkflow,
    getEntityAttachmentsCount,
    getEntity,
    progressEntity,
  } from "@/lib/dmart_services";
  import { formatDate } from "@/lib/helpers";
  import { Button, Card, Input } from "flowbite-svelte";
  import Attachments from "@/routes/components/Attachments.svelte";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import { user } from "@/stores/user";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { goto } from "@roxi/routify";
  $goto;
  import { onMount } from "svelte";
  import Avatar from "@/routes/components/Avatar.svelte";
  import { Diamonds } from "svelte-loading-spinners";
  import {
    ArrowLeftOutline,
    CheckCircleSolid,
    ClockOutline,
    CloseCircleSolid,
    EditOutline,
    EyeSlashSolid,
    EyeSolid,
    HeartSolid,
    MessagesSolid,
    TagOutline,
    TrashBinSolid,
    UserCircleOutline,
    UserSettingsOutline,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";

  let entity = $state(null);
  let isLoading = $state(false);
  let isLoadingPage: boolean = $state(true);
  let isOwner = $state(false);
  let userReactionEntry = $state(null);

  let workflows: any = $state({});
  let workflowSteps = $state([]);

  let counts: any = $state({});
  let isAdmin = JSON.parse(localStorage.getItem("roles") ?? "[]").includes(
    "super_admin"
  );

  onMount(async () => {
    isLoadingPage = true;
    await refreshIdea();
    isOwner = $user.shortname === entity.owner_shortname;
    await refreshCounts();
    workflows = await getCatalogWorkflow();
    if (Object.keys(workflows).length) {
      await refreshIdeaState();
    } else if (workflows === null) {
      errorToastMessage("Failed to fetch workflow!", true);
    }
    isLoadingPage = false;
  });

  function handleEdit(entity) {
    $goto(`/dashboard/{shortname}/edit`, {
      shortname: entity.shortname,
    });
  }

  async function handlePublish(isActive) {
    const response = await Dmart.request({
      space_name: "catalog",
      request_type: RequestType.update,
      records: [
        {
          resource_type: ResourceType.ticket,
          shortname: $params.shortname,
          subpath: "posts",
          attributes: {
            is_active: !isActive,
          },
        },
      ],
    });

    if (response.status === "success") {
      window.location.reload();
    } else {
      errorToastMessage(response.error.message);
    }
  }

  let comment = $state("");
  async function handleAddComment() {
    if (comment) {
      const response = await createComment(
        $params.space_name,
        $params.subpath,
        $params.shortname,
        comment
      );
      if (response) {
        successToastMessage("Comment added successfully");
        comment = "";
        await refreshIdea();
      } else {
        errorToastMessage("Failed to add comment!");
      }
    }
  }

  async function deleteComment(shortname: string) {
    const response = deleteReactionComment(
      ResourceType.comment,
      `posts/${entity.shortname}`,
      shortname
    );

    if (response) {
      await refreshIdea();
      successToastMessage("Comment deleted successfully");
    } else {
      errorToastMessage("Failed to delete the comment!");
    }
  }

  async function handleReaction() {
    let response = null;
    if (userReactionEntry === null) {
      response = await createReaction($params.shortname);
    } else {
      response = await deleteReactionComment(
        ResourceType.reaction,
        `posts/${entity.shortname}`,
        userReactionEntry
      );
    }
    if (response) {
      await refreshCounts();
    } else {
      errorToastMessage("Failed to react!");
    }
  }

  async function refreshIdea() {
    entity = await getEntity($params.shortname);
    await refreshCounts();
  }

  async function refreshCounts() {
    const _counts = await getEntityAttachmentsCount(entity.shortname);
    userReactionEntry = await checkCurrentUserReactedIdea(
      $user.shortname,
      entity.shortname
    );
    counts = _counts[0].attributes;
  }

  async function refreshIdeaState() {
    const _workflow = workflows.states.filter(
      (state: any) => state.state === entity.state
    );
    if (_workflow.length === 0) {
      errorToastMessage("Entity is in invalid state!", true);
    } else if (_workflow.length > 1) {
      errorToastMessage("Entity has a corrupted workflow!", true);
    } else {
      workflowSteps = _workflow[0].next.map((state: any) => {
        return {
          ...state,
          title: (workflows.states.filter(
            (_state: any) => state.state === _state.state
          ) ?? [{ name: "N/A" }])[0].name,
        };
      });
    }
  }

  async function handleProgressTicket(state: string) {
    const response = await progressEntity($params.shortname, state);
    if (response) {
      successToastMessage("Ticket progressed successfully");
      await refreshIdea();
      await refreshIdeaState();
    } else {
      errorToastMessage("Failed to progress ticket!");
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="mb-8">
      <Button
        onclick={() => history.back()}
        class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 px-4 py-2 rounded-lg font-medium"
      >
        <ArrowLeftOutline
          class="w-5 h-5 me-2 ltr:rotate-0 rtl:rotate-180 transform transition-transform duration-200"
        />
        {isLoading ? $_("Loading") : $_("Back")}
      </Button>
    </div>

    {#if isLoadingPage}
      <div class="py-16 flex justify-center">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else}
      {#if isOwner || isAdmin}
        <div
          class="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8"
        >
          {#if entity.is_open}
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                <span class="text-gray-700 font-medium">
                  {entity.is_active
                    ? `Last updated ${formatDate(entity.updated_at)}`
                    : "Draft - Not published"}
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button
                  color="primary"
                  onclick={() => handleEdit(entity)}
                  class="px-4 py-2 rounded-lg font-medium transition-all duration-200"
                >
                  <EditOutline class="w-5 h-5 me-2" />
                  {isLoading ? $_("Loading") : $_("Edit")}
                </Button>
                <Button
                  color={entity.is_active ? "red" : "green"}
                  onclick={() => handlePublish(entity.is_active)}
                  class="px-4 py-2 rounded-lg font-medium transition-all duration-200"
                >
                  {#if entity.is_active}
                    <EyeSlashSolid class="me-2 w-4 h-4" />
                  {:else}
                    <EyeSolid class="me-2 w-4 h-4" />
                  {/if}
                  {isLoading
                    ? $_("Loading")
                    : entity.is_active
                      ? $_("UnPublish")
                      : $_("Publish")}
                </Button>
                {#if isAdmin}
                  {#each workflowSteps as workflowStep}
                    <Button
                      color="yellow"
                      onclick={() => handleProgressTicket(workflowStep.action)}
                      class="px-4 py-2 rounded-lg font-medium transition-all duration-200"
                    >
                      <UserSettingsOutline class="w-5 h-5 me-2" />
                      {workflowStep.title}
                    </Button>
                  {/each}
                {/if}
              </div>
            </div>
          {:else}
            <div class="text-center py-4">
              <div class="flex items-center justify-center space-x-3 mb-2">
                <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                <span class="text-gray-700 font-medium text-lg"
                  >{$_("ThisEntityIsClosed")}</span
                >
              </div>
              <p class="text-gray-500 text-sm">
                {$_("NoFurtherActionsCanBePerformed")}
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="p-8 border-b border-gray-100">
          <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-4 leading-tight">
              {entity.payload.body.title}
            </h1>

            <div
              class="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-6"
            >
              <div class="flex items-center">
                <ClockOutline class="w-4 h-4 me-2" />
                <span class="font-medium">{formatDate(entity.updated_at)}</span>
              </div>
              <div class="flex items-center">
                <UserCircleOutline class="w-4 h-4 me-2" />
                <span class="font-medium">{entity.owner_shortname}</span>
              </div>
              <div class="flex items-center">
                {#if entity.is_active}
                  <CheckCircleSolid class="text-green-500 me-2 w-5 h-5" />
                {:else}
                  <CloseCircleSolid class="text-red-500 me-2 w-5 h-5" />
                {/if}
                <span class="font-medium"
                  >{entity.is_active ? $_("Active") : $_("Inactive")}</span
                >
              </div>
            </div>

            {#if entity.payload.body.long_description}
              <p class="text-gray-700 text-lg leading-relaxed mb-6">
                {entity.payload.body.long_description}
              </p>
            {/if}

            <div class="flex items-center space-x-8 mb-6">
              <div class="flex items-center text-gray-600">
                <MessagesSolid class="w-4 h-4 me-2" />
                <span class="font-semibold">{counts.comment ?? 0}</span>
                <span class="ms-1 text-sm">{$_("Comments")}</span>
              </div>
              <div class="flex items-center text-gray-600">
                <HeartSolid class="w-4 h-4 me-2 text-red-500 text-lg" />
                <span class="font-semibold">{counts.reaction ?? 0}</span>
                <span class="ms-1 text-sm">{$_("Reactions")}</span>
              </div>
            </div>

            {#if entity.tags && entity.tags.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each entity.tags as tag}
                  <span
                    class="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200"
                  >
                    <TagOutline class="w-4 h-4 me-1.5" />
                    {tag}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="p-8">
          <div
            class="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900"
          >
            {@html entity.payload.body.content}
          </div>
        </div>

        {#if entity.attachments.media && Object.keys(entity.attachments.media).length > 0}
          <div class="px-8 pb-8">
            <div class="border-t border-gray-100 pt-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">
                {$_("Attachments")}
              </h3>
              <Attachments
                resource_type={ResourceType.ticket}
                space_name={"catalog"}
                subpath={"posts"}
                parent_shortname={entity.shortname}
                attachments={Object.values(entity.attachments.media ?? [])}
                {isOwner}
              />
            </div>
          </div>
        {/if}
      </div>

      <div
        class="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="p-6 border-b border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 flex items-center">
            <MessagesSolid class="w-7 h-7 me-2" />
            {$_("Comments")} ({(entity.attachments.comment ?? []).length})
          </h3>
        </div>

        <div class="comment-section p-6">
          {#if (entity.attachments.comment ?? []).length === 0}
            <div class="text-center py-8">
              <div
                class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"
              >
                <MessagesSolid class="w-8 h-8 text-gray-400" />
              </div>
              <p class="text-gray-500 text-lg">{$_("NoComments")}</p>
              <p class="text-gray-400 text-sm mt-1">{$_("NoComments2")}</p>
            </div>
          {:else}
            <div class="space-y-6">
              {#each entity.attachments.comment ?? [] as comment}
                <div class="flex space-x-4 group">
                  <div class="flex-shrink-0">
                    {#await getAvatar(comment.attributes.owner_shortname) then avatar}
                      <Avatar src={avatar} size="40" />
                    {/await}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div
                      class="bg-gray-50 rounded-xl p-4 group-hover:bg-gray-100 transition-colors duration-200"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-2">
                          <span class="font-semibold text-gray-900"
                            >{comment.attributes.owner_shortname}</span
                          >
                          <span class="text-gray-500 text-sm"
                            >{formatDate(comment.attributes.created_at)}</span
                          >
                        </div>
                        {#if isOwner}
                          <Button
                            size="sm"
                            color="red"
                            onclick={() => deleteComment(comment.shortname)}
                            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1"
                          >
                            <TrashBinSolid class="w-4 h-4" />
                          </Button>
                        {/if}
                      </div>
                      <p class="text-gray-700 leading-relaxed">
                        {comment.attributes.payload.body.body}
                      </p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div
        class="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div class="flex items-center space-x-4">
          <Button
            color="light"
            onclick={handleReaction}
            class="flex items-center mx-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            {#if userReactionEntry}
              <HeartSolid class="text-red-500 w-5 h-5 me-2" />
            {:else}
              <HeartSolid class="text-gray-400 w-5 h-5 me-2" />
            {/if}
            <span class="font-medium">{counts.reaction ?? 0}</span>
          </Button>
          <div class="flex-1 flex space-x-2">
            <Input
              placeholder={$_("AddComment")}
              bind:value={comment}
              class="flex-1 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <Button
              onclick={handleAddComment}
              class="px-4 py-2  rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200"
            >
              <MessagesSolid class="w-5 h-5 me-2" />
              {$_("Send")}
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .comment-section {
    max-height: 400px;
    overflow-y: auto;
  }

  .comment-section::-webkit-scrollbar {
    width: 6px;
  }

  .comment-section::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  .comment-section::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  .comment-section::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .prose {
    color: #374151;
    line-height: 1.7;
  }
</style>
