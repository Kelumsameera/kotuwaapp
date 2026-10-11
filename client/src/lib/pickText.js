// Picks the text for the current language from { en, si, ta }, falling back to English.
export function pickText(text, locale) {
  if (!text) return "";
  return text[locale] || text.en || "";
}
