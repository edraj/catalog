import tailwindcss from "@tailwindcss/vite";
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
  optimizeDeps: {
    include: ["flowbite", "@roxi/routify"],
    exclude: ["@vite/client", "@vite/env"],
  },
  plugins: [
    tailwindcss(),
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
      render: { ssg: false, ssr: false },
      routesDir: {
        default: "src/routes",
        "lang-ar": "src/routes",
      },
    }),
    svelte({
      exclude: ["node_modules/flowbite-svelte"],
      compilerOptions: { dev: !production },
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
          warning.code?.startsWith("a11y") || // warning.filename?.startsWith("/node_modules/svelte-jsoneditor")
          warning.filename?.startsWith("/node_modules")
        )
          return;
        if (typeof defaultHandler != "undefined") defaultHandler(warning);
      },
    }),
  ],
  build: {
    cssCodeSplit: true,
    cssMinify: "lightningcss",
    chunkSizeWarningLimit: 512,
    minify: "esbuild", // Use esbuild instead of terser (faster and built-in)
    target: "esnext",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "asset";
          if (name.endsWith(".css")) {
            return "assets/css/[name]-[hash][extname]";
          }
          if (name.match(/\.(woff2?|eot|ttf|otf)$/)) {
            return "assets/fonts/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        manualChunks(id) {
          // Vendor chunks
          if (id.includes("node_modules")) {
            // Split flowbite into its own chunk
            if (id.includes("flowbite")) {
              return "vendor-flowbite";
            }
            // Split tailwind into its own chunk
            if (id.includes("tailwind")) {
              return "vendor-tailwind";
            }
            // Split svelte into its own chunk
            if (id.includes("svelte")) {
              return "vendor-svelte";
            }
            // Other large libraries
            if (id.includes("@roxi/routify")) {
              return "vendor-routify";
            }
            // Everything else in vendor
            return "vendor";
          }
        },
      },
    },
  },
  esbuild: {
    drop: production ? ["console", "debugger"] : [],
  },
  css: {
    lightningcss: {
      // minify: true, // This is handled by cssMinify above
    },
  },
  server: { port: 1337 },
});
