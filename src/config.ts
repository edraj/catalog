export interface WebsiteConfig {
  title: string;
  footer: string;
  short_name: string;
  display_name: string;
  description: string;
  default_language: string;
  languages: Record<string, string>;
  backend: string;
  webtransport: string;
  backend_timeout?: number;
  delay_total_count?: boolean;
  theme?: {
    type: "solid" | "gradient";
    value: string;
  };
}

const defaultConfig: WebsiteConfig = {
  title: "DMART Unified Data Platform",
  footer: "dmart.cc unified data platform",
  short_name: "dmart",
  display_name: "dmart",
  description: "dmart unified data platform",
  default_language: "ar",
  languages: { ar: "العربية", en: "English" },
  backend: "http://localhost:8282",
  webtransport: "http://localhost:8585",

  backend_timeout: 30000,
  delay_total_count: false,
};

const loadConfig = async (): Promise<WebsiteConfig> => {
  try {
    const basePath = import.meta.env.BASE_URL || '/';
    const configUrl = new URL('config.json', window.location.origin + basePath).href;
    const response = await fetch(configUrl);
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading configuration:', error);
    if (import.meta.env.PROD) {
      console.error('CRITICAL: config.json could not be loaded in production. Using default config.');
    }
    return { ...defaultConfig };
  }
};

export let website: WebsiteConfig = { ...defaultConfig };

export const configReady: Promise<void> = loadConfig().then(config => {
  website = config;
});
