<script lang="ts">
  import { mount, onMount } from "svelte";
  import Editor from "cl-editor";
  import { createEventDispatcher } from "svelte";

  let {
    editor = $bindable(),
    content = $bindable(""),
  }: {
    editor: any;
    content: string;
  } = $props();

  const uid = Math.random().toString(36).substring(7);
  let maindiv;
  let isInitialized = false;

  onMount(async () => {
    initializeEditor();
  });

  $effect(() => {
    if (editor && content && isInitialized) {
      editor.setHtml(content, true);
    }
  });

  function initializeEditor() {
    editor = mount(Editor, {
      target: maindiv,
      props: {
        height: "calc(90%)",
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
    }

    isInitialized = true;
  }

  export function getContent() {
    return editor.getHtml(true);
  }
</script>

<div class="h-100 pt-1" bind:this={maindiv} id="htmleditor-{uid}"></div>

<style>
  :global(.cl) {
    height: 100%;
    padding: 20px;
  }
  :global(.cl-content) {
    font-family: "uthmantn";
    font-size: 1rem !important;
  }
</style>
