// The languages the site supports. English is the fallback for anything missing.
export const LOCALES = ["en", "si", "ta"];
export const DEFAULT_LOCALE = "en";

// The cookie that remembers the chosen language.
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Returns the locale if it is supported, otherwise English.
export function toSupportedLocale(value) {
  return LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}
