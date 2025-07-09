import {
  addMessages,
  getLocaleFromNavigator,
  locale,
  init,
  _,
  time,
  date,
  number,
} from "svelte-i18n";
import { website } from "@/config";
import { derived, writable } from "svelte/store";
import ar from "./ar.json";
import en from "./en.json";
import ku from "./ku.json";

addMessages("ar", ar);
addMessages("en", en);
addMessages("ku", ku);

let l17ns = { ar: ar, en: en, ku: ku };
let available_locales = ["ar", "en", "ku"];

function switchLocale(_locale: string) {
  if (!(_locale in website.languages)) {
    _locale = website.default_language;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("preferred_locale", JSON.stringify(_locale));
  }
  locale.set(_locale);
  window.location.reload();
}

function getPreferredLocale(): string {
  let preferred_locale = "en";

  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("preferred_locale");
    try {
      preferred_locale = JSON.parse(stored || '"en"');
    } catch {
      preferred_locale = "en";
    }
  }

  if (preferred_locale && preferred_locale in website.languages) {
    return preferred_locale;
  }

  let fallback: string = "";
  let _locale = getLocaleFromNavigator();
  let _locale_found = false;

  for (const key in website.languages) {
    if (fallback.trim().length === 0) {
      fallback = key;
    }
    if (!_locale_found && _locale && _locale.startsWith(key)) {
      _locale = key;
      _locale_found = true;
    }
  }

  if (!_locale_found) {
    _locale = fallback || "en";
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem("preferred_locale", JSON.stringify(_locale));
  }

  return _locale;
}

function setupI18n() {
  let _locale: string = getPreferredLocale();

  if (!(_locale in l17ns) && website.default_language) {
    _locale = website.default_language;
  }

  init({
    initialLocale: _locale,
    fallbackLocale: website.default_language,
  });
}

const rtl = ["ar", "ku"]; // Arabic, Farsi, Urdu, Kurdish

const dir = derived(locale, ($locale) =>
  rtl.indexOf($locale ? $locale : "") >= 0 ? "rtl" : "ltr"
);
const isLocaleLoaded = derived(
  locale,
  ($locale) => typeof $locale === "string"
);

export {
  _,
  dir,
  setupI18n,
  time,
  date,
  number,
  locale,
  isLocaleLoaded,
  switchLocale,
  available_locales,
};
