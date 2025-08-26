import { mount, hydrate } from "svelte";
import App from "./App.svelte";
import "./app.css";

const isClient = typeof window !== 'undefined';
const isHydrating = isClient && document.body.hasAttribute('data-svelte-hydrated');

if (isClient) {
  const target = document.body;

  hydrate(App, {target,});

  document.body.setAttribute('data-svelte-hydrated', 'true');
}