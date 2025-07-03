<script lang="ts">
    import {mount, onMount} from "svelte";
  import Editor from "cl-editor";
  import { createEventDispatcher } from "svelte";

  let {
    editor = $bindable(),
    content = $bindable(""),
  } : {
    editor: any
    content: string
  } = $props();

    const uid = Math.random().toString(36).substring(7);
  let maindiv;

  onMount(async () => {
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
                //'u',
                //'strike',
                //'sup',
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
                //'forecolor',
                //'backcolor',
                "removeFormat",
                /*{
                                  name: 'save', // required
                                  icon: '<svg class="icon blink"><use xlink:href="/symbol-defs.svg#floppy-disk" /></svg>', // string or html string (ex. <svg>...</svg>)
                                  title: 'Save',
                                  result: () => {
                                      if(changed) {
                                          let html = editor.getHtml(true);
                                          data.attributes.payload.embedded = html;
                                          update(html);
                                          //console.log("Hi there: ", html);
                                          changed = false;
                                      }
                                  }
                  }*/
            ],
        },
        html: content,
    });
      editor.setHtml(content, true);
  });

  export function getContent() {
      return editor.getHtml(true);
  }
</script>

<div class="h-100 pt-1" bind:this="{maindiv}" id="htmleditor-{uid}"></div>

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
