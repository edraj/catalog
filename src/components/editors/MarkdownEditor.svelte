<script lang="ts">
  import { marked } from "marked";
  import { mangle } from "marked-mangle";
  import { gfmHeadingId } from "marked-gfm-heading-id";

  marked.use(mangle());
  marked.use(
    gfmHeadingId({
      prefix: "my-prefix-",
    }),
  );

  interface FieldType {
    value: string;
    label: string;
    description: string;
  }

  interface Props {
    content?: string;
    handleSave?: any;
    enableDynamicContent?: boolean;
    onDropKey?: (key: { name: string; type: string }) => void;
  }

  let { 
    content = $bindable(""), 
    handleSave = () => {},
    enableDynamicContent = true,
    onDropKey = null
  }: Props = $props();

  const fieldTypes: FieldType[] = [
    { value: "string", label: "String", description: "Short text value" },
    { value: "text", label: "Text", description: "Long text content" },
    { value: "int", label: "Integer", description: "Whole number" },
    { value: "float", label: "Float", description: "Decimal number" },
    { value: "bool", label: "Boolean", description: "True/False value" },
    { value: "list", label: "List", description: "Array of values" },
    { value: "object", label: "Object", description: "Single object" },
    { value: "list_object", label: "List Object", description: "Array of objects" },
  ];

  if (typeof content !== "string") {
    content = "";
  }

  let textarea;
  let activeTab = $state("editor");
  let start = 0,
    end = 0;
  let showDynamicMenu = $state(false);
  let dynamicFieldName = $state("");
  let selectedFieldType = $state("string");
  let dynamicMenuRef: HTMLDivElement;
  let isDraggingOver = $state(false);

  function handleSelect() {
    start = textarea.selectionStart;
    end = textarea.selectionEnd;
  }

  function insertDynamicContent() {
    if (!dynamicFieldName.trim()) return;
    
    const placeholder = `{{${dynamicFieldName.trim()}:${selectedFieldType}}}`;
    const cursorPos = textarea.selectionStart;
    
    const before = content.substring(0, cursorPos);
    const after = content.substring(cursorPos);
    
    content = before + placeholder + after;
    handleSave();
    
    // Reset and close menu
    dynamicFieldName = "";
    selectedFieldType = "string";
    showDynamicMenu = false;
    
    // Set cursor after the inserted placeholder
    setTimeout(() => {
      const newCursorPos = cursorPos + placeholder.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }

  function toggleDynamicMenu() {
    showDynamicMenu = !showDynamicMenu;
    if (showDynamicMenu) {
      // Reset fields when opening
      dynamicFieldName = "";
      selectedFieldType = "string";
    }
  }

  function handleMenuClickOutside(event: MouseEvent) {
    if (dynamicMenuRef && !dynamicMenuRef.contains(event.target as Node)) {
      showDynamicMenu = false;
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      showDynamicMenu = false;
    } else if (event.key === "Enter" && dynamicFieldName.trim()) {
      event.preventDefault();
      insertDynamicContent();
    }
  }

  function handleDragOver(event: DragEvent) {
    if (onDropKey) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      isDraggingOver = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    isDraggingOver = false;
  }

  function handleDrop(event: DragEvent) {
    if (!onDropKey) return;
    
    event.preventDefault();
    isDraggingOver = false;
    
    try {
      const keyData = event.dataTransfer.getData("application/json");
      if (keyData) {
        const key = JSON.parse(keyData);
        insertKeyAtCursor(key);
        onDropKey(key);
      }
    } catch (e) {
      console.error("Error handling drop:", e);
    }
  }

  function insertKeyAtCursor(key: { name: string; type: string }) {
    const placeholder = `{{${key.name}:${key.type}}}`;
    const cursorPos = textarea.selectionStart;
    
    const before = content.substring(0, cursorPos);
    const after = content.substring(cursorPos);
    
    content = before + placeholder + after;
    handleSave();
    
    // Set cursor after the inserted placeholder
    setTimeout(() => {
      const newCursorPos = cursorPos + placeholder.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }

  const listViewInsert =
    "{% ListView \n" +
    '   type="subpath"\n' +
    '   space_name="" \n' +
    '   subpath="/" \n' +
    "   is_clickable=false %}\n" +
    "{% /ListView %}\n";
  const tableInsert = `| Header 1 | Header 2 |
|----------|----------|
|  Cell1   |  Cell2   |`;

  function handleKeyDown(event) {
    if (event.ctrlKey) {
      if (["b", "i", "t"].includes(event.key)) {
        event.preventDefault();
        switch (event.key) {
          case "b":
            handleFormatting("**");
            break;
          case "i":
            handleFormatting("_");
            break;
          case "t":
            handleFormatting("~~");
            break;
        }
      }
    }
  }

  function handleFormatting(format: any, isWrap = true, isPerLine = false) {
    if (isWrap && start === 0 && end === 0) {
      return;
    }
    if (isWrap) {
      textarea.value =
        textarea.value.substring(0, start) +
        format +
        textarea.value.substring(start, end) +
        format +
        textarea.value.substring(end);
    } else {
      start = textarea.selectionStart;
      end = textarea.selectionEnd;
      if (isPerLine) {
        const lines = textarea.value.split("\n");
        let lineStart =
          textarea.value.substring(0, start).split("\n").length - 1;
        let lineEnd = textarea.value.substring(0, end).split("\n").length - 1;

        if (textarea.value[end] === "\n") {
          lineEnd--;
        }

        for (let i = lineStart; i <= lineEnd; i++) {
          lines[i] = `${format} ` + lines[i];
        }

        textarea.value = lines.join("\n");
      } else {
        let lineStart = textarea.value.lastIndexOf("\n", start - 1) + 1;
        let lineEnd = textarea.value.indexOf("\n", end);
        if (lineEnd === -1) {
          lineEnd = textarea.value.length;
        }
        textarea.value =
          textarea.value.substring(0, lineStart) +
          `${format} ` +
          textarea.value.substring(lineStart, lineEnd) +
          textarea.value.substring(lineEnd);
      }
    }

    start = 0;
    end = 0;
    content = structuredClone(textarea.value);
  }

  export function getContent() {
    return marked(content);
  }

  // Tab switching functionality
  function switchTab(tabName) {
    activeTab = tabName;
  }

  // Handle click outside to close dynamic menu
  $effect(() => {
    if (showDynamicMenu) {
      document.addEventListener("click", handleMenuClickOutside);
      return () => {
        document.removeEventListener("click", handleMenuClickOutside);
      };
    }
  });

  //   if (typeof window !== "undefined") {
  //     window.addEventListener("click", (e) => {
  //       const target = e.target as HTMLElement;
  //       if (target.classList && target.classList.contains("tab-btn")) {
  //         const tabName = target.dataset.tab;
  //         switchTab(tabName);
  //       }
  //     });
  //   }
</script>

<div class="markdown-editor-container">
  <div class="editor-toolbar">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("**")}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("_")}
        title="Italic"
      >
        <i>I</i>
      </button>
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("~~")}
        title="Strikethrough"
      >
        <del>S</del>
      </button>
    </div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("*", false, true)}
        title="Bullet List"
      >
        <span>•</span>
      </button>
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("1.", false, true)}
        title="Numbered List"
      >
        <span>1.</span>
      </button>
    </div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("#", false)}
        title="Heading 1"
      >
        <span>H1</span>
      </button>
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("##", false)}
        title="Heading 2"
      >
        <span>H2</span>
      </button>
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting("###", false)}
        title="Heading 3"
      >
        <span>H3</span>
      </button>
    </div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting(tableInsert, false)}
        title="Insert Table"
      >
        <span>⊞</span>
      </button>
      <button
        class="toolbar-btn"
        onclick={() => handleFormatting(listViewInsert, false)}
        title="Insert List View"
      >
        <span>☰</span>
      </button>
    </div>

    {#if enableDynamicContent}
      <div class="toolbar-group dynamic-content-group">
        <div class="dynamic-content-wrapper" bind:this={dynamicMenuRef}>
          <button
            class="toolbar-btn dynamic-btn"
            onclick={toggleDynamicMenu}
            title="Insert Dynamic Content"
            class:active={showDynamicMenu}
          >
            <span>{`{ }`}</span>
          </button>
          
          {#if showDynamicMenu}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
            <div 
              class="dynamic-menu" 
              onclick={(e) => e.stopPropagation()}
              onkeydown={handleMenuKeyDown}
              role="dialog"
              aria-label="Dynamic content insertion"
              tabindex="-1"
            >
              <div class="dynamic-menu-header">
                <span>Insert Dynamic Field</span>
              </div>
              <div class="dynamic-menu-body">
                <div class="field-input-group">
                  <label for="field-name">Field Name</label>
                  <input
                    id="field-name"
                    type="text"
                    bind:value={dynamicFieldName}
                    placeholder="e.g., username, price, description"
                    onkeydown={handleMenuKeyDown}
                  />
                </div>
                <div class="field-input-group">
                  <label for="field-type">Field Type</label>
                  <select id="field-type" bind:value={selectedFieldType}>
                    {#each fieldTypes as type}
                      <option value={type.value} title={type.description}>
                        {type.label}
                      </option>
                    {/each}
                  </select>
                </div>
                <div class="field-preview">
                  <code>{'{{'}{dynamicFieldName ? `${dynamicFieldName}:${selectedFieldType}` : 'field_name:type'}{'}}'}</code>
                </div>
              </div>
              <div class="dynamic-menu-footer">
                <button 
                  class="btn-insert" 
                  onclick={insertDynamicContent}
                  disabled={!dynamicFieldName.trim()}
                >
                  Insert
                </button>
                <button class="btn-cancel" onclick={() => showDynamicMenu = false}>
                  Cancel
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="editor-tabs">
    <div class="tab-buttons">
      <button
        class="tab-btn active"
        data-tab="editor"
        onclick={() => switchTab("editor")}>Editor</button
      >
      <button
        class="tab-btn"
        data-tab="preview"
        onclick={() => switchTab("preview")}>Preview</button
      >
    </div>

    <div class="tab-content">
      <div
        class="tab-panel {activeTab === 'editor' ? 'active' : ''}"
        data-panel="editor"
      >
        <textarea
          bind:this={textarea}
          onselect={handleSelect}
          onkeydown={handleKeyDown}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          rows="20"
          maxlength="4096"
          class="markdown-textarea {isDraggingOver ? 'drag-over' : ''}"
          bind:value={content}
          oninput={() => handleSave()}
          placeholder="Write your content in Markdown..."
        ></textarea>
      </div>
      <div
        class="tab-panel {activeTab === 'preview' ? 'active' : ''}"
        data-panel="preview"
      >
        <div class="markdown-preview">
          {@html marked(content)}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .markdown-editor-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 0.75rem;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    flex-wrap: wrap;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.5rem;
    border-right: 1px solid #d1d5db;
  }

  .toolbar-group:last-child {
    border-right: none;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toolbar-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .toolbar-btn:active {
    background: #e5e7eb;
  }

  .editor-tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-buttons {
    display: flex;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .tab-btn {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
  }

  .tab-btn:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .tab-btn.active {
    color: #2563eb;
    background: white;
    border-bottom-color: #2563eb;
  }

  .tab-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .tab-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
  }

  .tab-panel.active {
    opacity: 1;
    visibility: visible;
  }

  .markdown-textarea {
    width: 100%;
    height: 100%;
    padding: 1rem;
    border: none;
    outline: none;
    resize: none;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    font-size: 0.875rem;
    line-height: 1.6;
    background: white;
    color: #374151;
    transition: background-color 0.2s ease;
  }

  .markdown-textarea.drag-over {
    background: #eff6ff;
    box-shadow: inset 0 0 0 3px #3b82f6;
  }

  .markdown-preview {
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
    background: white;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    line-height: 1.6;
    color: #374151;
  }

  .markdown-preview :global(h1) {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem 0;
    color: #1f2937;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .markdown-preview :global(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: #1f2937;
  }

  .markdown-preview :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: #1f2937;
  }

  .markdown-preview :global(p) {
    margin: 0.75rem 0;
  }

  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .markdown-preview :global(ul) {
    list-style-type: disc;
  }

  .markdown-preview :global(ol) {
    list-style-type: decimal;
  }

  .markdown-preview :global(li) {
    margin: 0.25rem 0;
  }

  .markdown-preview :global(blockquote) {
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-left: 4px solid #d1d5db;
    color: #6b7280;
  }

  .markdown-preview :global(code) {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.875rem;
  }

  .markdown-preview :global(pre) {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .markdown-preview :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  .markdown-preview :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    text-align: left;
  }

  .markdown-preview :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  .markdown-preview :global(strong) {
    font-weight: 600;
  }

  .markdown-preview :global(em) {
    font-style: italic;
  }

  .markdown-preview :global(del) {
    text-decoration: line-through;
  }

  /* Dynamic Content Menu Styles */
  .dynamic-content-wrapper {
    position: relative;
  }

  .dynamic-btn {
    font-family: monospace;
    font-weight: 600;
  }

  .dynamic-btn.active {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
  }

  .dynamic-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 280px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 100;
    overflow: hidden;
  }

  .dynamic-menu-header {
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
  }

  .dynamic-menu-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .field-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-input-group label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .field-input-group input,
  .field-input-group select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #374151;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .field-input-group input:focus,
  .field-input-group select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .field-preview {
    padding: 0.5rem 0.75rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
  }

  .field-preview code {
    color: #2563eb;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  }

  .dynamic-menu-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  .btn-insert,
  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .btn-insert {
    background: #2563eb;
    color: white;
  }

  .btn-insert:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-insert:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }

  .btn-cancel {
    background: white;
    color: #6b7280;
    border: 1px solid #d1d5db;
  }

  .btn-cancel:hover {
    background: #f3f4f6;
    color: #374151;
  }

  @media (max-width: 768px) {
    .editor-toolbar {
      padding: 0.5rem;
      gap: 0.25rem;
    }

    .toolbar-group {
      padding: 0 0.25rem;
    }

    .toolbar-btn {
      width: 1.75rem;
      height: 1.75rem;
      font-size: 0.75rem;
    }

    .tab-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .markdown-textarea,
    .markdown-preview {
      padding: 0.75rem;
    }

    .dynamic-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: calc(100vw - 2rem);
      max-width: 320px;
      right: auto;
    }
  }
</style>
