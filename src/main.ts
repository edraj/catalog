import { hydrate } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { loadFontsLazily, preloadCriticalResources } from "./lib/performance";
import {configReady} from './config';


configReady.then(async () => {
  const isClient = typeof window !== "undefined";
  const isHydrating =
      isClient && document.body.hasAttribute("data-svelte-hydrated");

  if (isClient) {
    const target = document.body;

    hydrate(App, { target });

    document.body.setAttribute("data-svelte-hydrated", "true");

    // Initialize performance optimizations
    loadFontsLazily();
    preloadCriticalResources();
  }
});

