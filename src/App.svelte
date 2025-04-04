<script module lang="ts">
  import {Router, createRouter} from "@roxi/routify";
  import routes from "../.routify/routes.default";
  import Dmart from "@edraj/tsdmart"
  import { SvelteToast } from '@zerodevx/svelte-toast'
  import {website} from "@/config";

  const prefix = "";
</script>

<script lang="ts">
  import {setupI18n, dir, locale} from "./i18n";

  function findRoute(routers, paths) {
    if (paths.length === 0) {
      return routers;
    }

    let [currentPath, ...remainingPaths] = paths;
    if (currentPath.endsWith(".")) {
      currentPath = currentPath.slice(0, -1);
    }

    const matchingChild = routers.children.find(
      (child) => child.name === `${currentPath}`
    );

    if (matchingChild) {
      return findRoute(matchingChild, remainingPaths);
    } else {
      return null;
    }
  }

  let createdRouter = null;

  async function prepareRouter() {
    if (createdRouter === null) {
      createdRouter = createRouter({
        routes: routes,
        urlRewrite: {
          toInternal: (url) => {
            const oldURL = url;

            url = url.replaceAll('//', "/");
            url = url.replace(`/${prefix}`, "");
            url = url === "" ? "/" : url;

            if ($locale == "ar" && url.endsWith(".ar")) {
              return oldURL;
            }
            if ($locale == "ku" && url.endsWith(".ku")) {
              return oldURL;
            }

            url = url.replaceAll(".ar", "").replaceAll(".ku", "");
            if (url.endsWith("index")){
              url = url.slice(0, -5);
            }
            if (url.endsWith("/")){
              url = url.slice(0, -1);
            }

            const lang = $locale === "en" ? null : $locale;
            const paths = url.split("/");

            let fileName = paths[paths.length - 1];
            if (fileName === "") {
              fileName = "index";
            }

            const tryPaths = [
              fileName,
              "index"
            ];
            if (lang) {
              tryPaths.unshift(`index.${lang}`);
            }

            for (const tryPath of tryPaths) {
              paths.push(tryPath);
              let result = findRoute(routes, paths);
              if (result !== null) {
                const surl = url.split("/");
                if (surl.length === 1) {
                  return url;
                }
                return (
                        surl.join("/") + `/${paths[paths.length - 1]}`
                );
              }
              paths.pop();
            }

            return url;
          },
          toExternal: (url) => {
            document.dir = $dir;
            return `/${prefix}${url}`;
          },
        },
      });
    }
    return createdRouter;
  }

  setupI18n();
</script>

<svelte:head>
  <link rel="stylesheet" media="screen"
        href="{new URL('bootstrap-icons/font/bootstrap-icons.min.css', import.meta.url).href}">
  {#if $dir === "rtl"}
    <link rel="stylesheet" media="screen"
          href="{new URL('bootstrap/dist/css/bootstrap.rtl.min.css', import.meta.url).href}">
  {:else}
    <link rel="stylesheet" media="screen"
          href="{new URL('bootstrap/dist/css/bootstrap.min.css', import.meta.url).href}">
  {/if}
  <link rel="stylesheet" media="screen" href="{new URL('./app.css', import.meta.url).href}">
</svelte:head>


<div id="routify-app">
  <SvelteToast />
  {#await prepareRouter() then router}
    <Router {router}/>
  {/await}
</div>