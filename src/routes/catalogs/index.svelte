<script lang="ts">
  import { onMount } from "svelte";
  import { getSpaces } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  $goto;

  let isLoading = $state(true);
  let spaces = $state([]);
  let error = $state(null);

  onMount(async () => {
    try {
      const response = await getSpaces();

      console.log("Full spaces response:", response);
      console.log("Spaces records:", response.records);

      if (response.records && response.records.length > 0) {
        console.log("First space record:", response.records[0]);
        console.log("Space attributes:", response.records[0].attributes);
      }

      spaces = response.records || [];
    } catch (err) {
      console.error("Error fetching spaces:", err);
      error = "Failed to load catalogs";
    } finally {
      isLoading = false;
    }
  });

  function handleSpaceClick(space: any) {
    $goto(`/catalogs/{space_name}`, {
      space_name: space.shortname,
    });
  }

  function getDisplayName(space: any): string {
    const displayname = space.attributes?.displayname;
    if (displayname) {
      return (
        displayname[$locale] ||
        displayname.en ||
        displayname.ar ||
        space.shortname
      );
    }
    return space.shortname || "Unnamed Space";
  }

  function getDescription(space: any): string {
    const description = space.attributes?.description;
    if (description) {
      return (
        description[$locale] ||
        description.en ||
        description.ar ||
        "No description available"
      );
    }
    return "No description available";
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Explore Catalogs</h1>
        <p class="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover all available spaces and their content. Browse through
          different catalogs to find what interests you most.
        </p>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    {#if isLoading}
      <div class="flex justify-center py-16">
        <Diamonds color="#3b82f6" size="60" unit="px" />
      </div>
    {:else if error}
      <div class="text-center py-16">
        <div
          class="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          Error Loading Catalogs
        </h3>
        <p class="text-gray-600">{error}</p>
      </div>
    {:else if spaces.length === 0}
      <div class="text-center py-16">
        <div
          class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          No Catalogs Available
        </h3>
        <p class="text-gray-600">
          There are currently no public catalogs to display.
        </p>
      </div>
    {:else}
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">
              Available Catalogs ({spaces.length})
            </h2>
            <div class="text-sm text-gray-500">
              Public spaces you can explore
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Space
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Owner
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Website
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each spaces as space, index}
                <tr
                  class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                  onclick={() => handleSpaceClick(space)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSpaceClick(space);
                    }
                  }}
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-12 w-12">
                        <div
                          class="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md"
                        >
                          <span class="text-white font-bold text-lg">
                            {space.shortname
                              ? space.shortname.charAt(0).toUpperCase()
                              : "S"}
                          </span>
                        </div>
                      </div>
                      <div class="ml-6">
                        <div class="text-sm font-semibold text-gray-900">
                          {getDisplayName(space)}
                        </div>
                        <div class="text-sm text-gray-500 max-w-xs truncate">
                          {getDescription(space)}
                        </div>
                        <div class="text-xs text-blue-600 font-medium mt-1">
                          {space.shortname}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {space
                        .attributes?.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'}"
                    >
                      <div
                        class="w-1.5 h-1.5 rounded-full mr-1.5 {space.attributes
                          ?.is_active
                          ? 'bg-green-400'
                          : 'bg-red-400'}"
                      ></div>
                      {space.attributes?.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div
                        class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2"
                      >
                        <span class="text-xs font-medium text-gray-600">
                          {space.attributes?.owner_shortname
                            ? space.attributes.owner_shortname
                                .charAt(0)
                                .toUpperCase()
                            : "U"}
                        </span>
                      </div>
                      <span class="text-sm text-gray-900">
                        {space.attributes?.owner_shortname || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(space.attributes?.created_at)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {#if space.attributes?.primary_website}
                      <a
                        href={space.attributes.primary_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                        onclick={(e) => e.stopPropagation()}
                      >
                        <svg
                          class="w-4 h-4 inline mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          ></path>
                        </svg>
                        Visit
                      </a>
                    {:else}
                      <span class="text-gray-400">No website</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="ml-6">
              <p class="text-sm font-medium text-gray-500">Total Spaces</p>
              <p class="text-2xl font-semibold text-gray-900">
                {spaces.length}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="ml-6">
              <p class="text-sm font-medium text-gray-500">Active Spaces</p>
              <p class="text-2xl font-semibold text-gray-900">
                {spaces.filter((s) => s.attributes?.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="ml-6">
              <p class="text-sm font-medium text-gray-500">With Websites</p>
              <p class="text-2xl font-semibold text-gray-900">
                {spaces.filter((s) => s.attributes?.primary_website).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  /* Responsive table */
  @media (max-width: 768px) {
    .overflow-x-auto {
      -webkit-overflow-scrolling: touch;
    }

    th,
    td {
      padding: 0.75rem 1rem;
    }

    th {
      font-size: 0.75rem;
    }

    td {
      font-size: 0.875rem;
    }
  }

  /* Hover effects */
  tbody tr:hover {
    background-color: #f9fafb;
  }

  /* Focus styles for accessibility */
  tbody tr:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }
</style>
