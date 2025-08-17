<script lang="ts">
  import { Card, Tabs, TabItem, Button } from "flowbite-svelte";
  import { marked } from "marked";
  import { mangle } from "marked-mangle";
  import { gfmHeadingId } from "marked-gfm-heading-id";

  marked.use(mangle());
  marked.use(
    gfmHeadingId({
      prefix: "my-prefix-",
    })
  );

  interface Props {
    content?: string;
    handleSave?: any;
  }

  let { content = $bindable(""), handleSave = () => {} }: Props = $props();

  if (typeof content !== "string") {
    content = "";
  }

  let textarea;
  let start = 0,
    end = 0;
  function handleSelect() {
    start = textarea.selectionStart;
    end = textarea.selectionEnd;
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
    const container = document.querySelector(".markdown-editor-container");

    // Update tab buttons
    container
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    container
      .querySelector(`.tab-btn[data-tab="${tabName}"]`)
      .classList.add("active");

    // Update tab panels
    container
      .querySelectorAll(".tab-panel")
      .forEach((panel) => panel.classList.remove("active"));
    container
      .querySelector(`.tab-panel[data-panel="${tabName}"]`)
      .classList.add("active");
  }

  if (typeof window !== "undefined") {
    window.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList && target.classList.contains("tab-btn")) {
        const tabName = target.dataset.tab;
        switchTab(tabName);
      }
    });
  }
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
  </div>

  <div class="editor-tabs">
    <div class="tab-buttons">
      <button class="tab-btn active" data-tab="editor">Editor</button>
      <button class="tab-btn" data-tab="preview">Preview</button>
    </div>

    <div class="tab-content">
      <div class="tab-panel active" data-panel="editor">
        <textarea
          bind:this={textarea}
          onselect={handleSelect}
          onkeydown={handleKeyDown}
          rows="20"
          maxlength="4096"
          class="markdown-textarea"
          bind:value={content}
          oninput={() => handleSave()}
          onblur={(e) => {
            e.preventDefault();
            textarea.focus();
          }}
          placeholder="Write your content in Markdown..."
        ></textarea>
      </div>

      <div class="tab-panel" data-panel="preview">
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
  }
</style>
