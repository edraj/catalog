<script lang="ts">
  import { generateJsonDiagram, generateClassDiagram, getPlantUMLImageUrl } from "@/lib/plantuml";

  let { 
    data = {}, 
    title = "View",
    type = "json",
    isAdmin = false
  }: { 
    data: any; 
    title?: string;
    type?: "json" | "class";
    isAdmin?: boolean;
  } = $props();

  let showCode = $state(false);
  
  let plantumlCode = $derived(
    type === "json" 
      ? generateJsonDiagram(data, title)
      : generateClassDiagram(data, title)
  );
  
  let imageUrl = $derived(getPlantUMLImageUrl(plantumlCode));
  
  // Format the raw data (payload) for display
  let formattedData = $derived(
    typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
  );
  
  function toggleCode() {
    showCode = !showCode;
  }
</script>

<div class="plantuml-viewer">
  <div class="viewer-toolbar">
    <div class="toolbar-left">
      <span class="viewer-type-badge">{type === "json" ? "JSON" : "Class"} Diagram</span>
    </div>
    <div class="toolbar-right">
      {#if isAdmin}
        <button class="toolbar-btn" onclick={toggleCode}>
          {showCode ? "Hide Payload" : "Show Payload"}
        </button>
      {/if}
    </div>
  </div>
  
  <div class="diagram-container">
    {#if imageUrl}
      <img 
        src={imageUrl} 
        alt={title}
        class="diagram-image"
        onerror={(e) => console.error("Failed to load PlantUML diagram:", e)}
      />
    {:else}
      <div class="loading-state">
        <svg class="loading-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>Generating diagram...</p>
      </div>
    {/if}
  </div>
  
  {#if showCode && isAdmin}
    <div class="code-panel">
      <div class="code-header">JSON Payload</div>
      <pre class="code-block"><code>{formattedData}</code></pre>
    </div>
  {/if}
</div>

<style>
  .plantuml-viewer {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    margin: 1rem 0;
  }

  .viewer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
  }

  .viewer-type-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .toolbar-btn {
    padding: 6px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toolbar-btn:hover {
    background: #e2e8f0;
  }

  .diagram-container {
    display: flex;
    justify-content: center;
    padding: 20px;
    background: transparent;
    min-height: 150px;
    overflow-x: auto;
  }

  .diagram-image {
    max-width: 100%;
    height: auto;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    color: #9ca3af;
  }

  .loading-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 8px;
  }

  .code-panel {
    border-top: 1px solid #e5e7eb;
  }

  .code-header {
    padding: 8px 16px;
    background: #f1f5f9;
    border-bottom: 1px solid #e5e7eb;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .code-block {
    margin: 0;
    padding: 16px;
    background: #1e293b;
    color: #e2e8f0;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
  }
</style>
