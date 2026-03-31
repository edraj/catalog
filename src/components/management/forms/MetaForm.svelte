<script lang="ts">
    import { _ } from 'svelte-i18n';

    let {
        isCreate,
        formData = $bindable(),
        validateFn = $bindable(),
        fullWidth = false
    } = $props();

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

    let form = $state<HTMLFormElement | null>(null);
    $effect(() => {
        validateFn = validate;
    });

    function validate() {
        if (!form) return false;
        const isValid = form.checkValidity();
        if (!isValid) {
            form.reportValidity();
        }
        return isValid;
    }

    let isTranslationsOpen = $state(false);

</script>

<div class={fullWidth ? 'form-card-full' : 'form-card'}>
    <div class="form-container">
        <h2 class="section-title">Meta Information</h2>

        <form bind:this={form} class="form-body">
            <!-- Shortname Field -->
            <div class="field-group">
                <label for="shortname" class="field-label">
                    <span class="required">*</span>Shortname
                </label>
                <input
                    required
                    id="shortname"
                    class="input-field"
                    class:input-readonly={!isCreate}
                    placeholder="e.g. user_profile"
                    bind:value={formData.shortname}
                    readonly={!isCreate}
                />
                <p class="field-help">Lowercase alphanumeric and underscores only.</p>
            </div>

            <!-- Slug Field -->
            <div class="field-group">
                <label for="slug" class="field-label">Slug</label>
                <input
                    id="slug"
                    class="input-field"
                    placeholder="e.g. user-profile"
                    bind:value={formData.slug}
                />
            </div>

            <!-- Active Checkbox -->
            <div class="checkbox-group">
                <input
                    type="checkbox"
                    id="is_active"
                    class="checkbox"
                    bind:checked={formData.is_active}
                />
                <label for="is_active" class="checkbox-label">Active</label>
            </div>

            <!-- Translations Accordion -->
            <div class="accordion">
                <button
                    type="button"
                    class="accordion-header"
                    onclick={() => (isTranslationsOpen = !isTranslationsOpen)}
                >
                    <span class="accordion-title">Translations</span>
                    <svg class="accordion-icon" class:rotated={isTranslationsOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>

                {#if isTranslationsOpen}
                    <div class="accordion-content">
                        <!-- Display Names -->
                        <div class="field-group horizontal">
                            <label class="field-label mini">Display Name</label>
                            <div class="translation-grid flex">
                                <div class="translation-item">
                                    <span class="lang-badge">EN</span>
                                    <input id="displayname-en" class="input-field compact" bind:value={formData.displayname.en} />
                                </div>
                                <div class="translation-item">
                                    <span class="lang-badge">AR</span>
                                    <input id="displayname-ar" class="input-field compact" bind:value={formData.displayname.ar} />
                                </div>
                                <div class="translation-item">
                                    <span class="lang-badge">KU</span>
                                    <input id="displayname-ku" class="input-field compact" bind:value={formData.displayname.ku} />
                                </div>
                            </div>
                        </div>

                        <!-- Descriptions -->
                        <div class="field-group horizontal">
                            <label class="field-label mini">Description</label>
                            <div class="translation-grid flex">
                                <div class="translation-item">
                                    <span class="lang-badge">EN</span>
                                    <textarea id="description-en" class="textarea-field compact" bind:value={formData.description.en} rows="1"></textarea>
                                </div>
                                <div class="translation-item">
                                    <span class="lang-badge">AR</span>
                                    <textarea id="description-ar" class="textarea-field compact" bind:value={formData.description.ar} rows="1"></textarea>
                                </div>
                                <div class="translation-item">
                                    <span class="lang-badge">KU</span>
                                    <textarea id="description-ku" class="textarea-field compact" bind:value={formData.description.ku} rows="1"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </form>
    </div>
</div>

<style>
    .form-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        width: 100%;
        max-width: 56rem;
        margin: 0.5rem auto;
        padding: 1.5rem;
        border: 1px solid #e5e7eb;
    }

    .form-card-full {
        width: 100%;
        padding: 0;
        background: transparent;
        border: none;
        box-shadow: none;
    }

    .form-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .section-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: #111827;
        margin: 0;
    }

    .form-body {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .field-group.horizontal {
        flex-direction: row;
        align-items: flex-start;
        gap: 1rem;
    }

    .field-label {
        font-weight: 600;
        font-size: 0.8125rem;
        color: #374151;
        display: flex;
        align-items: center;
        min-width: 120px;
    }

    .field-label.mini {
        min-width: 100px;
        padding-top: 0.5rem;
    }

    .required {
        color: #ef4444;
        margin-right: 0.25rem;
        font-weight: bold;
    }

    .input-field {
        width: 100%;
        padding: 0.375rem 0.625rem;
        border: 1.5px solid #e5e7eb;
        border-radius: 6px;
        font-size: 0.8125rem;
        background: #fdfdfd;
        color: #111827;
        transition: all 0.2s ease;
    }

    .input-field.compact {
        padding: 0.25rem 0.5rem;
    }

    .input-field:focus {
        outline: none;
        border-color: #4f46e5;
        background: white;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .input-field::placeholder {
        color: #9ca3af;
    }

    .input-readonly {
        background-color: #f3f4f6;
        color: #6b7280;
        cursor: not-allowed;
        border-color: #e5e7eb;
    }

    .input-readonly:focus {
        border-color: #e5e7eb;
        box-shadow: none;
    }

    .textarea-field {
        width: 100%;
        padding: 0.375rem 0.625rem;
        border: 1.5px solid #e5e7eb;
        border-radius: 6px;
        font-size: 0.8125rem;
        background: #fdfdfd;
        color: #111827;
        resize: vertical;
        min-height: 40px;
    }

    .textarea-field.compact {
        padding: 0.25rem 0.5rem;
        min-height: 32px;
    }

    .textarea-field:focus {
        outline: none;
        border-color: #4f46e5;
        background: white;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .field-help {
        font-size: 0.7125rem;
        color: #6b7280;
    }

    .checkbox-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0;
    }

    .checkbox {
        width: 0.875rem;
        height: 0.875rem;
        border: 1.5px solid #d1d5db;
        border-radius: 3px;
        cursor: pointer;
    }

    .checkbox-label {
        font-size: 0.8125rem;
        color: #4b5563;
        font-weight: 500;
        cursor: pointer;
    }

    .accordion {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        margin-top: 0.25rem;
        background: #fafaf9;
    }

    .accordion-header {
        width: 100%;
        padding: 0.5rem 0.75rem;
        background-color: transparent;
        border: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .accordion-header:hover {
        background-color: #f3f4f6;
    }

    .accordion-title {
        font-weight: 600;
        color: #374151;
        font-size: 0.8125rem;
    }

    .accordion-icon {
        width: 1rem;
        height: 1rem;
        color: #9ca3af;
        transition: transform 0.2s ease;
    }

    .accordion-icon.rotated {
        transform: rotate(180deg);
        color: #4f46e5;
    }

    .accordion-content {
        padding: 0.75rem 1rem;
        background-color: white;
        border-top: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .translation-grid.flex {
        display: flex;
        flex: 1;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .translation-item {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex: 1;
        min-width: 150px;
    }

    .lang-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 24px;
        padding: 0 6px;
        background: #f3f4f6;
        color: #6b7280;
        font-size: 10px;
        font-weight: 700;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
    }
</style>
