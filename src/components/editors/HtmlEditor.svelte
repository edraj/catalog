<script lang="ts">
  import { mount, onMount } from "svelte";
  import Editor from "cl-editor";
  import { createEventDispatcher } from "svelte";

  let {
    editor = $bindable(),
    content = $bindable(""),
    onContentChange = () => {},
  }: {
    editor: any;
    content: string;
    onContentChange: (html: string) => void;
  } = $props();

  const uid = Math.random().toString(36).substring(7);
  let maindiv;
  let isInitialized = false;
  let lastSetContent = "";

  onMount(async () => {
    initializeEditor();
  });

  $effect(() => {
    if (editor && isInitialized && content !== lastSetContent) {
      editor.setHtml(content, true);
      lastSetContent = content;
    }
  });

  function initializeEditor() {
    editor = mount(Editor, {
      target: maindiv,
      props: {
        height: "calc(100% - 20px)",
        actions: [
          "viewHtml",
          "undo",
          "redo",
          "b",
          "i",
          "sub",
          "h1",
          "h2",
          "p",
          "blockquote",
          "ol",
          "ul",
          "hr",
          "left",
          "right",
          "center",
          "justify",
          "a",
          "image",
          "removeFormat",
        ],
      },
      html: content,
    });

    if (content) {
      editor.setHtml(content, true);
      lastSetContent = content;
    }

    editor.on("change", () => {
      const newContent = editor.getHtml(true);
      lastSetContent = newContent;
      onContentChange(newContent);
    });

    isInitialized = true;
  }

  export function getContent() {
    return editor.getHtml(true);
  }
</script>

<div class="html-editor-container">
  <div class="editor-wrapper" bind:this={maindiv} id="htmleditor-{uid}"></div>
</div>

<style>
  .html-editor-container {
    height: 100%;
    background: white;
    border-radius: 0.75rem;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
  }

  .editor-wrapper {
    flex: 1;
    height: 100%;
    min-height: 500px;
  }

  :global(.cl) {
    height: 100% !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    background: white !important;
  }

  :global(.cl-toolbar) {
    background: #f9fafb !important;
    border-bottom: 1px solid #e5e7eb !important;
    padding: 0.75rem 1rem !important;
    border-radius: 0 !important;
  }

  :global(.cl-toolbar button) {
    background: white !important;
    border: 1px solid #d1d5db !important;
    border-radius: 0.375rem !important;
    color: #374151 !important;
    margin: 0 0.125rem !important;
    padding: 0.375rem 0.5rem !important;
    font-size: 0.875rem !important;
    transition: all 0.2s ease !important;
  }

  :global(.cl-toolbar button:hover) {
    background: #f3f4f6 !important;
    border-color: #9ca3af !important;
  }

  :global(.cl-toolbar button.active) {
    background: #2563eb !important;
    color: white !important;
    border-color: #2563eb !important;
  }

  :global(.cl-content) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif !important;
    font-size: 1rem !important;
    line-height: 1.6 !important;
    padding: 1rem !important;
    color: #374151 !important;
    background: white !important;
    border: none !important;
    outline: none !important;
  }

  :global(.cl-content:focus) {
    outline: none !important;
    box-shadow: none !important;
  }

  :global(.cl-content h1) {
    font-size: 1.875rem !important;
    font-weight: 700 !important;
    margin: 1.5rem 0 1rem 0 !important;
    color: #1f2937 !important;
  }

  :global(.cl-content h2) {
    font-size: 1.5rem !important;
    font-weight: 600 !important;
    margin: 1.25rem 0 0.75rem 0 !important;
    color: #1f2937 !important;
  }

  :global(.cl-content p) {
    margin: 0.75rem 0 !important;
  }

  :global(.cl-content ul),
  :global(.cl-content ol) {
    margin: 0.75rem 0 !important;
    padding-left: 1.5rem !important;
  }

  :global(.cl-content blockquote) {
    margin: 1rem 0 !important;
    padding: 0.75rem 1rem !important;
    background: #f9fafb !important;
    border-left: 4px solid #d1d5db !important;
    color: #6b7280 !important;
  }

  :global(.cl-content a) {
    color: #2563eb !important;
    text-decoration: underline !important;
  }

  :global(.cl-content a:hover) {
    color: #1d4ed8 !important;
  }

  @media (max-width: 768px) {
    :global(.cl-toolbar) {
      padding: 0.5rem !important;
    }

    :global(.cl-toolbar button) {
      padding: 0.25rem 0.375rem !important;
      font-size: 0.75rem !important;
      margin: 0 0.0625rem !important;
    }

    :global(.cl-content) {
      padding: 0.75rem !important;
      font-size: 0.875rem !important;
    }
  }
</style>
