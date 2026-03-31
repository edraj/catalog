<script lang="ts">
    import { onMount } from 'svelte';
    import { Dmart, QueryType } from '@edraj/tsdmart';
    import { _ } from 'svelte-i18n';

    let {
        formData = $bindable(),
        validateFn = $bindable(),
        isCreate = false,
        fullWidth = false
    } = $props();

    let form = $state<HTMLFormElement | null>(null);

    let availableRoles = $state<any[]>([]);
    let loadingRoles = $state(true);
    let filteredRoles = $state<any[]>([]);
    let rolesSearchTerm = $state('');
    let showRolesDropdown = $state(false);
    let rolesDropdownRef = $state<HTMLDivElement | null>(null);

    let availableGroups = $state<any[]>([]);
    let loadingGroups = $state(true);
    let filteredGroups = $state<any[]>([]);
    let groupsSearchTerm = $state('');
    let showGroupsDropdown = $state(false);
    let groupsDropdownRef = $state<HTMLDivElement | null>(null);

    let isRolesOpen = $state(false);
    let isSocialOpen = $state(false);

    formData = {
        ...formData,
        email: formData.email || null,
        password: formData.password || null,
        msisdn: formData.msisdn || null,
        is_email_verified: formData.is_email_verified || false,
        is_msisdn_verified: formData.is_msisdn_verified || false,
        force_password_change: formData.force_password_change || false,
        type: formData.type || 'mobile',
        language: formData.language || null,
        roles: formData.roles || [],
        groups: formData.groups || [],
        firebase_token: formData.firebase_token || null,
        google_id: formData.google_id || null,
        facebook_id: formData.facebook_id || null,
        social_avatar_url: formData.social_avatar_url || null
    }

    if (!isCreate) {
        formData.old_password = formData.old_password || null;
    } else {
        delete formData.old_password;
    }

    const userTypeOptions = ["bot", "mobile", "web", "admin", "api"]
        .map(type => ({ name: type.charAt(0).toUpperCase() + type.slice(1), value: type }));

    async function getRoles() {
        try {
            const rolesResponse: any = await Dmart.query({
                space_name: 'management',
                subpath: '/roles',
                type: QueryType.search,
                search: '',
                limit: 100,
            });
            if (rolesResponse) {
                availableRoles = rolesResponse.records;
                updateFilteredRoles();
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        } finally {
            loadingRoles = false;
        }
    }

    async function getGroups() {
        try {
            const groupsResponse: any = await Dmart.query({
                space_name: 'management',
                subpath: '/groups',
                type: QueryType.search,
                search: '',
                limit: 100,
            });
            if (groupsResponse) {
                availableGroups = groupsResponse.records;
                updateFilteredGroups();
            }
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            loadingGroups = false;
        }
    }

    onMount(() => {
        getRoles();
        getGroups();

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (rolesDropdownRef && !rolesDropdownRef.contains(target)) {
                showRolesDropdown = false;
            }
            if (groupsDropdownRef && !groupsDropdownRef.contains(target)) {
                showGroupsDropdown = false;
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });

    function updateFilteredRoles() {
        filteredRoles = availableRoles
            .filter(role => role.shortname.toLowerCase().includes(rolesSearchTerm.toLowerCase()))
            .map(role => ({ key: role.shortname, value: role.shortname }));
    }

    function toggleRole(event: MouseEvent, role: { key: string, value: string }) {
        event.stopPropagation();
        const index = formData.roles.indexOf(role.value);
        if (index === -1) {
            formData.roles = [...formData.roles, role.value];
        } else {
            formData.roles = formData.roles.filter((r: string) => r !== role.value);
        }
    }

    function removeRole(role: string) {
        formData.roles = formData.roles.filter((r: string) => r !== role);
    }

    function updateFilteredGroups() {
        filteredGroups = availableGroups
            .filter(group => group.shortname.toLowerCase().includes(groupsSearchTerm.toLowerCase()))
            .map(group => ({ key: group.shortname, value: group.shortname }));
    }

    function toggleGroup(event: MouseEvent, group: { key: string, value: string }) {
        event.stopPropagation();
        const index = formData.groups.indexOf(group.value);
        if (index === -1) {
            formData.groups = [...formData.groups, group.value];
        } else {
            formData.groups = formData.groups.filter((g: string) => g !== group.value);
        }
    }

    function removeGroup(group: string) {
        formData.groups = formData.groups.filter((g: string) => g !== group);
    }

    function validate() {
        if (!form) return false;
        const isValid = form.checkValidity();
        isEmailValid = validateEmail(formData.email)

        if (!isValid || !isEmailValid) {
            form.reportValidity();
            return false;
        }
        return isValid;
    }

    $effect(() => {
        validateFn = validate;
    });

    $effect(() => {
        if(rolesSearchTerm){
            updateFilteredRoles();
        } else {
            filteredRoles = availableRoles.map(role => ({ key: role.shortname, value: role.shortname }));
        }
    });

    $effect(() => {
        if(groupsSearchTerm){
            updateFilteredGroups();
        } else {
            filteredGroups = availableGroups.map(group => ({ key: group.shortname, value: group.shortname }));
        }
    });


    let isEmailValid = $state(true);
    let emailTouched = $state(false);
    function validateEmail(email: string | null): boolean {
        if (!email) return true;
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,6}$/;
        return emailRegex.test(email);
    }
    $effect(() => {
        if (emailTouched) {
            isEmailValid = validateEmail(formData.email);
        }
    });
</script>

<div class={fullWidth ? 'form-card-full' : 'form-card'}>
    <div class="form-container">
        <h2 class="section-title">User Information</h2>

        <form bind:this={form} class="form-body">
            {#if !isCreate}
                <div class="field-group">
                    <label for="old_password" class="field-label">
                        <span class="required">*</span>Old Password
                    </label>
                    <input
                        required
                        id="old_password"
                        type="password"
                        class="input-field"
                        placeholder="••••••••"
                        bind:value={formData.old_password}
                        minlength={8}
                    />
                </div>
            {/if}

            <div class="field-group">
                <label for="password" class="field-label">
                    <span class="required">*</span>New Password
                </label>
                <input
                    required
                    id="password"
                    type="password"
                    class="input-field"
                    placeholder="••••••••"
                    bind:value={formData.password}
                    minlength={8}
                />
                <p class="field-help">Minimum 8 characters</p>
            </div>

            <div class="field-group">
                <label for="email" class="field-label">Email</label>
                <input
                    id="email"
                    type="email"
                    class="input-field"
                    class:input-error={!isEmailValid && emailTouched}
                    placeholder="user@example.com"
                    bind:value={formData.email}
                    onblur={() => emailTouched = true}
                />
                {#if !isEmailValid && emailTouched}
                    <p class="error-text">Please enter a valid email address</p>
                {/if}
            </div>

            <div class="field-group">
                <label for="msisdn" class="field-label">Mobile Number (MSISDN)</label>
                <input
                    id="msisdn"
                    class="input-field"
                    placeholder="+964723456789 / 0712345678"
                    bind:value={formData.msisdn}
                />
            </div>

            <div class="checkbox-row compact">
                <div class="checkbox-group">
                    <input type="checkbox" id="force_password_change" class="checkbox" bind:checked={formData.force_password_change} />
                    <label for="force_password_change" class="checkbox-label">Force Change</label>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="is_email_verified" class="checkbox" bind:checked={formData.is_email_verified} />
                    <label for="is_email_verified" class="checkbox-label">Email Verified</label>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="is_msisdn_verified" class="checkbox" bind:checked={formData.is_msisdn_verified} />
                    <label for="is_msisdn_verified" class="checkbox-label">Phone Verified</label>
                </div>
            </div>

            <div class="grid-row">
                <div class="field-group">
                    <label for="user_type" class="field-label">User Type</label>
                    <select id="user_type" class="input-field" bind:value={formData.type}>
                        {#each userTypeOptions as option}
                            <option value={option.value}>{option.name}</option>
                        {/each}
                    </select>
                </div>
                <div class="field-group">
                    <label for="language" class="field-label">Preferred Language</label>
                    <input id="language" class="input-field" bind:value={formData.language} placeholder="en, ar, etc." />
                </div>
            </div>

            <div class="accordion">
                <button
                    type="button"
                    class="accordion-header"
                    onclick={() => (isRolesOpen = !isRolesOpen)}
                >
                    <span class="accordion-title">Roles and Groups</span>
                    <svg class="accordion-icon" class:rotated={isRolesOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>

                {#if isRolesOpen}
                    <div class="accordion-content">
                        <div class="field-group">
                            <label class="field-label">Roles</label>
                            {#if loadingRoles}
                                <div class="loading-pulse"></div>
                            {:else}
                                <div class="relative-container" bind:this={rolesDropdownRef}>
                                    <div class="search-input-wrapper">
                                        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                        <input
                                            class="input-field search-input"
                                            placeholder="Search roles..."
                                            bind:value={rolesSearchTerm}
                                            onfocus={() => showRolesDropdown = true}
                                        />
                                    </div>

                                    {#if showRolesDropdown && filteredRoles.length > 0}
                                        <div class="dropdown-menu">
                                            {#each filteredRoles as role}
                                                <button
                                                    type="button"
                                                    class="dropdown-item"
                                                    onclick={(e) => toggleRole(e, role)}
                                                >
                                                    <span>{role.key}</span>
                                                    {#if formData.roles.includes(role.value)}
                                                        <span class="badge">Selected</span>
                                                    {/if}
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>

                                <div class="tags-container">
                                    {#if formData.roles.length > 0}
                                        {#each formData.roles as role}
                                            <span class="tag">
                                                {role}
                                                <button type="button" class="tag-remove" onclick={() => removeRole(role)}>×</button>
                                            </span>
                                        {/each}
                                    {:else}
                                        <p class="empty-text">No roles added</p>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <div class="field-group">
                            <label class="field-label">Groups</label>
                            {#if loadingGroups}
                                <div class="loading-pulse"></div>
                            {:else}
                                <div class="relative-container" bind:this={groupsDropdownRef}>
                                    <div class="search-input-wrapper">
                                        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                        <input
                                            class="input-field search-input"
                                            placeholder="Search groups..."
                                            bind:value={groupsSearchTerm}
                                            onfocus={() => showGroupsDropdown = true}
                                        />
                                    </div>

                                    {#if showGroupsDropdown && filteredGroups.length > 0}
                                        <div class="dropdown-menu">
                                            {#each filteredGroups as group}
                                                <button
                                                    type="button"
                                                    class="dropdown-item"
                                                    onclick={(e) => toggleGroup(e, group)}
                                                >
                                                    <span>{group.key}</span>
                                                    {#if formData.groups.includes(group.value)}
                                                        <span class="badge">Selected</span>
                                                    {/if}
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>

                                <div class="tags-container">
                                    {#if formData.groups.length > 0}
                                        {#each formData.groups as group}
                                            <span class="tag tag-gray">
                                                {group}
                                                <button type="button" class="tag-remove" onclick={() => removeGroup(group)}>×</button>
                                            </span>
                                        {/each}
                                    {:else}
                                        <p class="empty-text">No groups added</p>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>

            <div class="accordion">
                <button
                    type="button"
                    class="accordion-header"
                    onclick={() => (isSocialOpen = !isSocialOpen)}
                >
                    <span class="accordion-title">Social and External IDs</span>
                    <svg class="accordion-icon" class:rotated={isSocialOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>

                {#if isSocialOpen}
                    <div class="accordion-content">
                        <div class="field-group">
                            <label for="firebase_token" class="field-label">Firebase Token</label>
                            <textarea id="firebase_token" class="textarea-field" placeholder="Firebase authentication token" bind:value={formData.firebase_token} rows={2}></textarea>
                        </div>

                        <div class="grid-row">
                            <div class="field-group">
                                <label for="google_id" class="field-label">Google ID</label>
                                <input id="google_id" class="input-field" bind:value={formData.google_id} />
                            </div>
                            <div class="field-group">
                                <label for="facebook_id" class="field-label">Facebook ID</label>
                                <input id="facebook_id" class="input-field" bind:value={formData.facebook_id} />
                            </div>
                        </div>

                        <div class="field-group">
                            <label for="social_avatar_url" class="field-label">Social Profile Image URL</label>
                            <input id="social_avatar_url" type="url" class="input-field" bind:value={formData.social_avatar_url} placeholder="https://..." />
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
        font-size: 1.25rem;
        font-weight: 700;
        color: #111827;
        margin: 0;
    }

    .form-body {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .field-label {
        font-weight: 600;
        font-size: 0.8125rem;
        color: #374151;
        display: flex;
        align-items: center;
    }

    .required {
        color: #ef4444;
        margin-right: 0.25rem;
        font-weight: bold;
    }

    .input-field {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1.5px solid #e5e7eb;
        border-radius: 8px;
        font-size: 0.875rem;
        background: #fdfdfd;
        color: #111827;
        transition: all 0.2s ease;
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

    .input-error {
        border-color: #ef4444;
    }

    .textarea-field {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1.5px solid #e5e7eb;
        border-radius: 8px;
        font-size: 0.875rem;
        background: #fdfdfd;
        color: #111827;
        resize: vertical;
        min-height: 80px;
    }

    .textarea-field:focus {
        outline: none;
        border-color: #4f46e5;
        background: white;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .field-help {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .error-text {
        font-size: 0.75rem;
        color: #ef4444;
        margin: 0;
    }

    .checkbox-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        padding: 0.25rem 0;
    }

    .checkbox-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .checkbox {
        width: 1rem;
        height: 1rem;
        border: 1.5px solid #d1d5db;
        border-radius: 4px;
        cursor: pointer;
    }

    .checkbox-label {
        font-size: 0.8125rem;
        color: #4b5563;
        font-weight: 500;
        cursor: pointer;
    }

    .grid-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    @media (min-width: 640px) {
        .grid-row {
            grid-template-columns: 1fr 1fr;
        }
    }

    .accordion {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        overflow: hidden;
        margin-top: 0.25rem;
        background: #fafaf9;
    }

    .accordion-header {
        width: 100%;
        padding: 0.75rem 1rem;
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
        font-size: 0.875rem;
    }

    .accordion-icon {
        width: 1.125rem;
        height: 1.125rem;
        color: #9ca3af;
        transition: transform 0.2s ease;
    }

    .accordion-icon.rotated {
        transform: rotate(180deg);
        color: #4f46e5;
    }

    .accordion-content {
        padding: 1.25rem;
        background-color: white;
        border-top: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .relative-container {
        position: relative;
    }

    .search-input-wrapper {
        position: relative;
    }

    .search-icon {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        width: 1rem;
        height: 1rem;
        color: #9ca3af;
    }

    .search-input {
        padding-left: 2.25rem;
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 0.25rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
        z-index: 20;
        max-height: 200px;
        overflow-y: auto;
    }

    .dropdown-item {
        width: 100%;
        padding: 0.5rem 1rem;
        text-align: left;
        background: none;
        border: none;
        font-size: 0.875rem;
        color: #4b5563;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .dropdown-item:hover {
        background-color: #f9fafb;
        color: #111827;
    }

    .badge {
        background-color: #eef2ff;
        color: #4f46e5;
        font-size: 0.7rem;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-weight: 600;
    }

    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.75rem;
        min-height: 2.25rem;
        padding: 0.5rem;
        background-color: #f8fafc;
        border-radius: 8px;
        border: 1px dashed #cbd5e1;
        align-items: center;
    }

    .tag {
        display: inline-flex;
        align-items: center;
        background-color: #4f46e5;
        color: white;
        padding: 0.2rem 0.75rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .tag-gray {
        background-color: #475569;
        color: white;
    }

    .tag-remove {
        background: none;
        border: none;
        margin-left: 0.375rem;
        cursor: pointer;
        color: white;
        opacity: 0.8;
        font-size: 1rem;
        line-height: 1;
        display: flex;
        align-items: center;
    }

    .tag-remove:hover {
        opacity: 1;
    }

    .empty-text {
        color: #94a3b8;
        font-size: 0.75rem;
        margin: 0;
        width: 100%;
        text-align: center;
        font-style: italic;
    }

    .loading-pulse {
        height: 2.5rem;
        background-color: #f1f5f9;
        border-radius: 8px;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
    }
</style>
