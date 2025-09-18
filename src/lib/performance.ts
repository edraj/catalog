// Production optimization utilities for font and CSS loading

/**
 * Lazy load non-critical fonts
 */
export function loadFontsLazily() {
  if (typeof window !== "undefined") {
    // Load heavy Uthman bold font only when needed
    const loadUthmanBold = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/uthman/uthman.css";
      link.media = "print";
      link.onload = function () {
        this.media = "all";
      };
      document.head.appendChild(link);
    };

    // Load additional IranYekan weights only when needed
    const loadExtraIranYekanWeights = () => {
      const weights = ["thin", "light", "extrabold", "black", "extrablack"];
      weights.forEach((weight) => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.href = `/assets/iranyekan/woff2/iranyekanweb${weight}.woff2`;
        link.as = "font";
        link.type = "font/woff2";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      });
    };

    // Load fonts when page is idle
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        loadUthmanBold();
        loadExtraIranYekanWeights();
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        loadUthmanBold();
        loadExtraIranYekanWeights();
      }, 1000);
    }
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources() {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    requestIdleCallback(() => {
      // Preload critical images or other assets
      const criticalAssets = ["/vite.svg", "/assets/svelte.svg"];

      criticalAssets.forEach((asset) => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.href = asset;
        link.as = "image";
        document.head.appendChild(link);
      });
    });
  }
}

/**
 * Service Worker registration for caching
 */
export function registerServiceWorker() {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered: ", registration);
        })
        .catch((registrationError) => {
          console.log("SW registration failed: ", registrationError);
        });
    });
  }
}
