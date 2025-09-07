<script lang="ts">
    import {Dmart} from "@edraj/tsdmart";
    import {onMount} from "svelte";
    import {getFileExtension} from "../../lib/fileUtils";

    let {
    uid = "",
    content = $bindable(""),
    isEditMode = false,
    attachments,
    resource_type,
    space_name,
    subpath,
    parent_shortname,
    changed = () => {},
  } = $props();

  let showAttachments = $state(false);
  let maindiv: HTMLDivElement;
  let editor: any;

  let format: any;
  let h: any;
  let Editor: any;

  let underline, strike, superscript, subscript;
  let alignLeft, alignCenter, alignRight, alignJustify;

  onMount(async () => {
    const mod = await import("typewriter-editor");
    Editor = mod.Editor;
    h = mod.h;
    format = mod.format;

    underline = format({
      name: "underline",
      selector: "u",
      styleSelector:
        '[style*="text-decoration:underline"], [style*="text-decoration: underline"]',
      commands: (editor) => () => editor.toggleTextFormat({ underline: true }),
      shortcuts: "Mod+U",
      render: (attributes, children) => h("u", null, children),
    });

    strike = format({
      name: "strike",
      selector: "strike, s",
      styleSelector:
        '[style*="text-decoration:line-through"], [style*="text-decoration: line-through"]',
      commands: (editor) => () => editor.toggleTextFormat({ strike: true }),
      shortcuts: "Mod+Shift+X",
      render: (attributes, children) => h("s", null, children),
    });

    superscript = format({
      name: "superscript",
      selector: "sup",
      commands: (editor) => () =>
        editor.toggleTextFormat({ superscript: true }),
      render: (attributes, children) => h("sup", null, children),
    });

    subscript = format({
      name: "subscript",
      selector: "sub",
      commands: (editor) => () => editor.toggleTextFormat({ subscript: true }),
      render: (attributes, children) => h("sub", null, children),
    });

    alignLeft = format({
      name: "align-left",
      selector: '[style*="text-align:left"], [style*="text-align: left"]',
      commands: (editor) => () => editor.formatLine({ align: "left" }),
      render: (attributes, children) =>
        h("div", { style: "text-align: left" }, children),
    });

    alignCenter = format({
      name: "align-center",
      selector: '[style*="text-align:center"], [style*="text-align: center"]',
      commands: (editor) => () => editor.formatLine({ align: "center" }),
      render: (attributes, children) =>
        h("div", { style: "text-align: center" }, children),
    });

    alignRight = format({
      name: "align-right",
      selector: '[style*="text-align:right"], [style*="text-align: right"]',
      commands: (editor) => () => editor.formatLine({ align: "right" }),
      render: (attributes, children) =>
        h("div", { style: "text-align: right" }, children),
    });

    alignJustify = format({
      name: "align-justify",
      selector: '[style*="text-align:justify"], [style*="text-align: justify"]',
      commands: (editor) => () => editor.formatLine({ align: "justify" }),
      render: (attributes, children) =>
        h("div", { style: "text-align: justify" }, children),
    });

    editor = new Editor({
      root: maindiv,
      html: content || "",
      types: {
        lines: [
          "paragraph",
          "header",
          "list",
          "blockquote",
          "code-block",
          "hr",
          alignLeft,
          alignCenter,
          alignRight,
          alignJustify,
        ],
        formats: [
          "bold",
          "italic",
          underline,
          strike,
          superscript,
          subscript,
          "code",
          "link",
          "clear",
        ],
        embeds: ["image", "br"],
      },
    });

    editor.on("change", () => {
      content = editor.getHTML();
      changed();
    });

    setupToolbar();
  });

  function setupToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = `toolbar-${uid}`;
    toolbar.className = "editor-toolbar";

    const textFormatGroup = document.createElement("div");
    textFormatGroup.className = "toolbar-group";

    const lineFormatGroup = document.createElement("div");
    lineFormatGroup.className = "toolbar-group";

    const alignmentGroup = document.createElement("div");
    alignmentGroup.className = "toolbar-group";

    const insertGroup = document.createElement("div");
    insertGroup.className = "toolbar-group";

    const historyGroup = document.createElement("div");
    historyGroup.className = "toolbar-group";

    const directionGroup = document.createElement("div");
    directionGroup.className = "toolbar-group";

    const attachmentsGroup = document.createElement("div");
    attachmentsGroup.className = "toolbar-group";

    addToolbarButton(textFormatGroup, "Bold", "B", () =>
      editor.formatText("bold")
    );
    addToolbarButton(textFormatGroup, "Italic", "I", () =>
      editor.formatText("italic")
    );
    addToolbarButton(textFormatGroup, "Underline", "U", () =>
      editor.formatText("underline")
    );
    addToolbarButton(textFormatGroup, "Strike", "S", () =>
      editor.formatText("strike")
    );
    addToolbarButton(textFormatGroup, "Superscript", "x²", () =>
      editor.formatText("superscript")
    );
    addToolbarButton(textFormatGroup, "Subscript", "x₂", () =>
      editor.formatText("subscript")
    );
    addToolbarButton(textFormatGroup, "Remove Format", "X", () =>
      editor.removeFormat()
    );

    addToolbarButton(lineFormatGroup, "Heading 1", "H1", () =>
      editor.formatLine({ header: 1 })
    );
    addToolbarButton(lineFormatGroup, "Heading 2", "H2", () =>
      editor.formatLine({ header: 2 })
    );
    addToolbarButton(lineFormatGroup, "Paragraph", "¶", () =>
      editor.formatLine("paragraph")
    );
    addToolbarButton(lineFormatGroup, "Blockquote", '""', () =>
      editor.formatLine("blockquote")
    );
    addToolbarButton(lineFormatGroup, "Ordered List", "1.", () =>
      editor.formatLine({ list: "ordered" })
    );
    addToolbarButton(lineFormatGroup, "Unordered List", "•", () =>
      editor.formatLine({ list: "bullet" })
    );
    addToolbarButton(lineFormatGroup, "Horizontal Rule", "—", () =>
      editor.formatLine("hr")
    );

    addToolbarButton(alignmentGroup, "Align Left", "↤", () =>
      editor.formatLine("align-left")
    );
    addToolbarButton(alignmentGroup, "Align Center", "↔", () =>
      editor.formatLine("align-center")
    );
    addToolbarButton(alignmentGroup, "Align Right", "↦", () =>
      editor.formatLine("align-right")
    );
    addToolbarButton(alignmentGroup, "Justify", "☰", () =>
      editor.formatLine("align-justify")
    );

    addToolbarButton(insertGroup, "Link", "🔗", () => {
      const url = prompt("Enter URL:");
      if (url) editor.formatText({ link: url });
    });

    addToolbarButton(insertGroup, "Image", "🖼", () => {
      const url = prompt("Enter image URL:");
      if (url) editor.insert({ image: url });
    });

    if (isEditMode && attachments?.media?.length > 0) {
      addToolbarButton(attachmentsGroup, "Attachments", "📎", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showAttachments = true;
      });
    }

    addToolbarButton(historyGroup, "Undo", "↶", () =>
      editor.modules.history.undo()
    );
    addToolbarButton(historyGroup, "Redo", "↷", () =>
      editor.modules.history.redo()
    );

    addToolbarButton(directionGroup, "LTR", "LTR", () => {
      maindiv.dir = "ltr";
      editor.formatLine({ direction: "ltr" });
    });
    addToolbarButton(directionGroup, "RTL", "RTL", () => {
      maindiv.dir = "rtl";
      editor.formatLine({ direction: "rtl" });
    });

    toolbar.appendChild(textFormatGroup);
    toolbar.appendChild(lineFormatGroup);
    toolbar.appendChild(alignmentGroup);
    toolbar.appendChild(insertGroup);
    if (isEditMode && attachments?.media?.length > 0) {
      toolbar.appendChild(attachmentsGroup);
    }
    toolbar.appendChild(historyGroup);
    toolbar.appendChild(directionGroup);

    maindiv.parentNode.insertBefore(toolbar, maindiv);
  }

  function addToolbarButton(toolbar, title, icon, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = title;
    button.className = "toolbar-button";
    button.textContent = icon;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      action(event);
    });
    toolbar.appendChild(button);
  }


  function insertAttachment(attachment) {
    const filename = attachment?.attributes?.payload?.body;

    if (editor && attachment) {
      const url = Dmart.get_attachment_url(
        attachment.resource_type,
        space_name,
        subpath,
        parent_shortname,
        attachment.shortname,
        getFileExtension(filename),
        "public"
      );

      const fileExtension = getFileExtension(filename)?.toLowerCase();
      const imageExtensions = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "bmp",
      ];
      const isImage = imageExtensions.includes(fileExtension);

      if (isImage) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);

        const img = document.createElement("img");
        img.src = url;
        img.alt = attachment.shortname || "Image";

        range.deleteContents();
        range.insertNode(img);

        range.setStartAfter(img);
        range.setEndAfter(img);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      showAttachments = false;
    }
  }

  function closeAttachments() {
    showAttachments = false;
  }

  function handleModalClick(event) {
    if (event.target === event.currentTarget) {
      closeAttachments();
    }
  }

  $effect(() => {
    if (editor && typeof editor.setHTML === "function") {
      const currentHtml = editor.getHTML();
      // Ensure content is a string and not null/undefined
      const newContent = content || "";
      if (newContent !== currentHtml) {
        editor.setHTML(newContent);
      }
    }
  });
</script>

<div class="editor-card">
  <div class="editor-content">
    <div
      class="editor-container"
      bind:this={maindiv}
      id="htmleditor-{uid}"
      tabindex="0"
      role="textbox"
    ></div>
  </div>
</div>

{#if showAttachments}
  <div
    class="attachments-overlay"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={handleModalClick}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="attachments-modal"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="attachments-header">
        <h3 class="attachments-title">Item Attachments</h3>
        <button
          class="attachments-close"
          aria-label={`Close attachments`}
          onclick={closeAttachments}
        >
          ✕
        </button>
      </div>
      <div class="attachments-content">
        {#if attachments?.media?.length > 0}
          <div class="attachments-grid">
            {#each attachments.media as attachment}
              <div class="attachment-item">
                <div class="attachment-info">
                  <div class="attachment-icon">📎</div>
                  <div class="attachment-details">
                    <div class="attachment-name">
                      {attachment.shortname || "Unnamed"}
                    </div>
                    <div class="attachment-type">
                      {attachment.resource_type || "Unknown type"}
                    </div>
                  </div>
                </div>
                <button
                  class="attachment-insert-btn"
                  onclick={() => insertAttachment(attachment)}
                >
                  Insert
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-attachments">
            <div class="no-attachments-icon">📎</div>
            <p>No attachments found for this item</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .editor-card {
    height: 100%;
    max-width: 100%;
    padding: 0.75rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
  }

  .editor-content {
    max-width: 100%;
    color: #1f2937;
    line-height: 1.75;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .editor-container {
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    font-size: 1rem !important;
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 1rem;
    background-color: #ffffff;
    color: #1f2937;
    outline: none;
    transition:
      border-color 0.15s ease-in-out,
      box-shadow 0.15s ease-in-out;
    flex: 1; /* FIX: Allow container to grow */
  }

  .editor-container:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* FIX: Custom scrollbar styling for better appearance */
  .editor-container::-webkit-scrollbar {
    width: 8px;
  }

  .editor-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .editor-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .editor-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  :global(.editor-toolbar) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-bottom: none;
    border-radius: 0.375rem 0.375rem 0 0;
    margin-bottom: 0;
  }

  :global(.toolbar-group) {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
  }

  :global(.toolbar-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    color: #4b5563;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
  }

  :global(.toolbar-button:hover) {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  :global(.toolbar-button:active) {
    background: #e2e8f0;
    transform: translateY(1px);
  }

  .attachments-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
    padding: 1rem;
  }

  .attachments-modal {
    background: white;
    border-radius: 0.75rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 32rem;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .attachments-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
  }

  .attachments-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .attachments-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: all 0.15s ease-in-out;
  }

  .attachments-close:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .attachments-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .attachments-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .attachment-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: #f9fafb;
    transition: all 0.15s ease-in-out;
  }

  .attachment-item:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .attachment-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .attachment-icon {
    font-size: 1.5rem;
    color: #6b7280;
  }

  .attachment-details {
    flex: 1;
  }

  .attachment-name {
    font-weight: 500;
    color: #1f2937;
    margin-bottom: 0.25rem;
  }

  .attachment-type {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .attachment-insert-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
  }

  .attachment-insert-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .no-attachments {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .no-attachments-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
</style>
