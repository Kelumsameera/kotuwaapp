// Locale codes for dates in each site language, always shown in Sri Lanka time.
const DATE_LOCALES = { en: "en-LK", si: "si-LK", ta: "ta-LK" };

// "11 Oct 2026, 3:45 pm" in the site language.
export function formatDateTime(value, locale) {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] || "en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

// "11 Oct 2026" in the site language.
export function formatDate(value, locale) {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] || "en-LK", { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(
    new Date(value)
  );
}
