<script lang="ts">
  import { goto, params } from "@roxi/routify";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import { _ } from "svelte-i18n";
  $goto;

  let { isCreate, formData = $bindable(), validateFn = $bindable() } = $props();

  formData = {
    ...formData,
    shortname: formData.shortname || null,
    is_active: formData.is_active || true,
    slug: formData.slug || null,
    displayname: {
      en: formData.displayname?.en || null,
      ar: formData.displayname?.ar || null,
      ku: formData.displayname?.ku || null,
    },
    description: {
      en: formData.description?.en || null,
      ar: formData.description?.ar || null,
      ku: formData.description?.ku || null,
    },
  };

  let form;
  $effect(() => {
    validateFn = validate;
  });

  function validate() {
    const isValid = form.checkValidity();
    if (!isValid) {
      form.reportValidity();
    }
    return isValid;
  }

  let isShortnameUpdateOpen = $state(false);
  let newShortname = $state("");
  let isUpdatingShortname = $state(false);
  let shortnameUpdateError = $state(null);
  let isTranslationsOpen = $state(false);

  function handleShortnameModalUpdate() {
    newShortname = formData.shortname;
    shortnameUpdateError = null;
    isShortnameUpdateOpen = true;
  }

  async function updateShortname() {
    if (!newShortname || newShortname === formData.shortname) return;
    if (!newShortname.match(/^[a-zA-Z0-9_]+$/)) {
      shortnameUpdateError = $_("validation.shortname_format");
      return;
    }

    isUpdatingShortname = true;

    try {
      const resourceType =
        $params.resource_type ||
        ($params.subpath && ResourceType.folder) ||
        ResourceType.space;
      const newSubpath =
        resourceType === ResourceType.folder
          ? $params.subpath.split("/").slice(0, -1).join("-") || "/"
          : $params.subpath;

      const moveAttrb = {
        src_space_name: $params.space_name,
        src_subpath: newSubpath,
        src_shortname: formData.shortname,
        dest_space_name: $params.space_name,
        dest_subpath: newSubpath,
        dest_shortname: newShortname,
      };

      await Dmart.request({
        space_name: $params.space_name,
        request_type: RequestType.move,
        records: [
          {
            resource_type: resourceType,
            shortname: formData.shortname,
            subpath: newSubpath,
            attributes: moveAttrb,
          },
        ],
      });

      let url = "/management/content";
      let gotoPayload: any = {
        space_name: $params.space_name,
      };
      if (resourceType === ResourceType.space) {
        url += "/[space_name]";
      } else {
        if (resourceType === ResourceType.folder) {
          url += "/[space_name]/[subpath]";
          gotoPayload = {
            ...gotoPayload,
            subpath: `${newSubpath.replaceAll("-", "/")}-${newShortname}`,
          };
        } else {
          url += `/[space_name]/[subpath]/[shortname]/[resource_type]`;
          gotoPayload = {
            ...gotoPayload,
            subpath: newSubpath.replaceAll("-", "/"),
            shortname: newShortname,
            resource_type: resourceType,
          };
        }
      }
      $goto(`${url}`, gotoPayload);
    } catch (error) {
      shortnameUpdateError =
        error.response.data.error?.info[0]?.failed[0].error ||
        error.response.data.error?.message ||
        $_("errors.shortname_update_failed");
    } finally {
      isUpdatingShortname = false;
    }
  }
</script>

<div class="form-card">
  <form bind:this={form} class="form-container">
    <!-- Shortname Field -->
    <div class="field-group">
      <label for="shortname" class="field-label">
        {#if isCreate}<span class="required">*</span>{/if}
        {$_("fields.shortname")}
      </label>
      <div class="input-with-button">
        <input
          required
          id="shortname"
          class="input-field input-left"
          placeholder={$_("placeholders.shortname")}
          bind:value={formData.shortname}
          disabled={!isCreate}
        />
        <button
          type="button"
          class="button-secondary button-right"
          onclick={() =>
            isCreate
              ? (formData.shortname = "auto")
              : handleShortnameModalUpdate()}
        >
          {isCreate ? $_("buttons.auto") : $_("buttons.update")}
        </button>
      </div>
      {#if isCreate}
        <p class="field-help">
          {$_("help.shortname")}
        </p>
      {/if}
    </div>

    <!-- Active Checkbox -->
    <div class="field-group">
      <div class="checkbox-group">
        <input
          type="checkbox"
          id="is_active"
          class="checkbox"
          bind:checked={formData.is_active}
        />
        <label for="is_active" class="checkbox-label"
          >{$_("fields.active")}</label
        >
      </div>
      <p class="field-help">{$_("help.active")}</p>
    </div>

    <!-- Slug Field -->
    <div class="field-group">
      <label for="slug" class="field-label">{$_("fields.slug")}</label>
      <input
        id="slug"
        class="input-field"
        placeholder={$_("placeholders.slug")}
        bind:value={formData.slug}
      />
      <p class="field-help">{$_("help.slug")}</p>
    </div>

    <div class="accordion">
      <button
        type="button"
        class="accordion-header"
        onclick={() => (isTranslationsOpen = !isTranslationsOpen)}
      >
        <span class="accordion-title">{$_("sections.translations")}</span>
        <svg
          class="accordion-icon {isTranslationsOpen ? 'rotated' : ''}"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>

      {#if isTranslationsOpen}
        <div class="accordion-content">
          <div class="field-group">
            <label class="field-label">{$_("fields.displayname")}</label>
            <div class="translation-grid">
              <div>
                <label class="translation-label"
                  >{$_("languages.english")}</label
                >
                <input
                  class="input-field"
                  bind:value={formData.displayname.en}
                />
              </div>
              <div>
                <label class="translation-label">{$_("languages.arabic")}</label
                >
                <input
                  class="input-field"
                  bind:value={formData.displayname.ar}
                />
              </div>
              <div>
                <label class="translation-label"
                  >{$_("languages.kurdish")}</label
                >
                <input
                  class="input-field"
                  bind:value={formData.displayname.ku}
                />
              </div>
            </div>
          </div>

          <!-- Descriptions -->
          <div class="field-group">
            <label class="field-label">{$_("fields.description")}</label>
            <div class="translation-grid">
              <div>
                <label class="translation-label"
                  >{$_("languages.english")}</label
                >
                <textarea
                  class="textarea-field"
                  bind:value={formData.description.en}
                  rows="3"
                ></textarea>
              </div>
              <div>
                <label class="translation-label">{$_("languages.arabic")}</label
                >
                <textarea
                  class="textarea-field"
                  bind:value={formData.description.ar}
                  rows="3"
                ></textarea>
              </div>
              <div>
                <label class="translation-label"
                  >{$_("languages.kurdish")}</label
                >
                <textarea
                  class="textarea-field"
                  bind:value={formData.description.ku}
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </form>
</div>

<!-- Modal -->
{#if isShortnameUpdateOpen}
  <div class="modal-overlay" onclick={() => (isShortnameUpdateOpen = false)}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">{$_("modal.update_shortname.title")}</h3>
        <button
          class="modal-close"
          onclick={() => (isShortnameUpdateOpen = false)}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-warning">
          {$_("modal.update_shortname.warning")}
        </p>

        {#if shortnameUpdateError}
          <div class="alert alert-error">
            <svg class="alert-icon" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              ></path>
            </svg>
            {shortnameUpdateError}
          </div>
        {/if}

        <div class="field-group">
          <label for="new-shortname" class="field-label"
            >{$_("modal.update_shortname.new_shortname")}</label
          >
          <input
            id="new-shortname"
            class="input-field"
            placeholder={formData.shortname}
            bind:value={newShortname}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="button-secondary"
          onclick={() => (isShortnameUpdateOpen = false)}
        >
          {$_("buttons.cancel")}
        </button>
        <button
          class="button-primary"
          disabled={!newShortname ||
            newShortname === formData.shortname ||
            isUpdatingShortname}
          onclick={updateShortname}
        >
          {isUpdatingShortname
            ? $_("buttons.updating")
            : $_("buttons.update_shortname")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .form-card {
    background: white;
    border-radius: 12px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    max-width: 56rem;
    margin: 0.5rem auto;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
  }

  .form-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    font-weight: 500;
    font-size: 0.875rem;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .required {
    color: #ef4444;
    font-size: 1.125rem;
    vertical-align: middle;
    margin-right: 0.25rem;
  }

  .field-help {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .input-field {
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.15s ease-in-out;
    background: white;
  }

  .input-field:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .input-field:disabled {
    background-color: #f9fafb;
    color: #6b7280;
    cursor: not-allowed;
  }

  .textarea-field {
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.15s ease-in-out;
    background: white;
    resize: vertical;
    font-family: inherit;
  }

  .textarea-field:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .input-with-button {
    display: flex;
    margin-right: 12px;
  }

  .input-left {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: 0;
    flex: 1;
  }

  .button-right {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: 1px solid #d1d5db;
  }

  .button-primary {
    background-color: #3b82f6;
    color: white;
    border: 1px solid #3b82f6;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
  }

  .button-primary:hover:not(:disabled) {
    background-color: #2563eb;
    border-color: #2563eb;
  }

  .button-primary:disabled {
    background-color: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }

  .button-secondary {
    background-color: white;
    color: #374151;
    border: 1px solid #d1d5db;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
  }

  .button-secondary:hover {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .checkbox {
    width: 1rem;
    height: 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .checkbox-label {
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    margin: 0;
  }

  .translation-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .translation-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .translation-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
    margin-bottom: 0.25rem;
    display: block;
  }

  .accordion {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .accordion-header {
    width: 100%;
    padding: 1rem;
    background-color: #f9fafb;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
  }

  .accordion-header:hover {
    background-color: #f3f4f6;
  }

  .accordion-title {
    font-weight: 500;
    color: #374151;
  }

  .accordion-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.15s ease-in-out;
  }

  .accordion-icon.rotated {
    transform: rotate(180deg);
  }

  .accordion-content {
    padding: 1.5rem;
    background-color: white;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 0.75rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 28rem;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: color 0.15s ease-in-out;
  }

  .modal-close:hover {
    color: #374151;
  }

  .modal-close svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-warning {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .alert {
    padding: 0.75rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .alert-error {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .alert-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }
</style>
