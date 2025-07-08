<script>
  import DashboardHeader from "@/routes/components/DashboardHeader.svelte";
  import { signout, user } from "@/stores/user";
  import { onMount } from "svelte";
  import { getProfile } from "@/lib/dmart_services";
  import { goto } from "@roxi/routify";
  import { Dmart } from "@edraj/tsdmart";
  import { website } from "@/config";
  import axios from "axios";

  $goto;

  const publicRoutes = ["/home", { path: "/catalogs", wildcard: true }];

  function isPublicRoute(path) {
    return publicRoutes.some((route) => {
      if (typeof route === "string") {
        return path === route;
      }

      if (route.wildcard) {
        return path.startsWith(route.path);
      }
      return path === route.path;
    });
  }

  const dmartAxios = axios.create({
    baseURL: website.backend,
    withCredentials: true,
    timeout: 30000,
  });

  dmartAxios.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.code === "ERR_NETWORK") {
        console.warn("Network error: Check connection or server.");
      }
      if (
        error.response?.status === 401 &&
        !isPublicRoute(window.location.pathname)
      ) {
        $goto("/login");
      }
      return Promise.reject(error);
    }
  );

  Dmart.setAxiosInstance(dmartAxios);

  onMount(async () => {
    const currentPath = window.location.pathname;

    if (isPublicRoute(currentPath)) {
      return;
    }

    try {
      const p = await getProfile();
      if (p === null || p?.response.data.error?.type === "jwtauth") {
        await signout();
        $goto("/login");
      } else {
        if (currentPath === "/" || currentPath === "/login") {
          $goto("/dashboard");
        }
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      await signout();
      $goto("/login");
    }
  });
</script>

<DashboardHeader />
<slot />
