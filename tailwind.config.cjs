/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [rtl(), require("flowbite/plugin")],
  corePlugins: {
    preflight: false,
    container: false,
  },
};
