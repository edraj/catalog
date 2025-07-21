// import { VitePWA } from "vite-plugin-pwa";
// <reference types="vitest" />
import { defineConfig } from "vite";
import { mdsvex } from "mdsvex";
import preprocess from "svelte-preprocess";
import routify from "@roxi/routify/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import * as path from "path";
import plantuml from "@akebifiky/remark-simple-plantuml";
import svelteMd from "vite-plugin-svelte-md";

const production = process.env.NODE_ENV === "production";

export default defineConfig({
  // base: "/sysadmin",  // "/"
  clearScreen: false,
  resolve: {
    alias: {
      "@": process.cwd() + "/src",
      "~": process.cwd() + "/node_modules",
    },
  },
  plugins: [
    svelteMd(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, "./assets") + "/[!.]*",
          dest: "assets",
        },
      ],
    }),
    routify({
      forceLogging: true,
      render: {
        ssg: {
          enable: true,
          spank: {
            distDir: 'dist/client',
            outDir: 'dist/static',
            entrypoint: 'index.html',
            verbose: true,
          }
        },
        ssr: true,
      },
      routesDir: {
        default: "src/routes",
        "lang-ar": "src/routes",
      },
      // ssr: { enable: false /*production*/ },
    }),
    svelte({
      exclude: ["node_modules/flowbite-svelte"],
      compilerOptions: {
        dev: !production,
      },
      extensions: [".md", ".svelte"],
      preprocess: [
        preprocess(),
        mdsvex({
          extension: "md",
          remarkPlugins: [
            plantuml,
            {
              baseUrl: "https://www.plantuml.com/plantuml/svg",
            },
          ],
        }),
      ],
      onwarn: (warning, defaultHandler) => {
        // Ignore a11y_click_events_have_key_events warning from sveltestrap
        if (
          warning.code?.startsWith("a11y") ||
          // warning.filename?.startsWith("/node_modules/svelte-jsoneditor")
          warning.filename?.startsWith("/node_modules")
        )
          return;
        if (typeof defaultHandler != "undefined") defaultHandler(warning);
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 512,
    cssMinify: "lightningcss",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return id
              .toString()
              .split("node_modules/")[1]
              .split("/")[0]
              .toString();
          }
        },
      },
    },
  },
  server: { port: 1337 },
});
