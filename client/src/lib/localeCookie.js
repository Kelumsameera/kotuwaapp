import { LOCALE_COOKIE, toSupportedLocale } from "@/i18n/config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Saves the chosen language in a cookie so the server renders pages in it.
export function saveLocaleCookie(locale) {
  const value = toSupportedLocale(locale);
  document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
