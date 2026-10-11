import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, toSupportedLocale } from "./config";

// Copies English text into any key the chosen language has not translated yet.
function fillMissingWithEnglish(english, translated) {
  const result = { ...english };
  for (const [key, value] of Object.entries(translated || {})) {
    const isNested = value && typeof value === "object";
    result[key] = isNested ? fillMissingWithEnglish(english[key] || {}, value) : value;
  }
  return result;
}

// Loads the translation file for one language.
async function loadMessages(locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

// Runs on every request: picks the language from the cookie and loads its messages.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = toSupportedLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  const english = await loadMessages(DEFAULT_LOCALE);
  const messages = locale === DEFAULT_LOCALE ? english : fillMissingWithEnglish(english, await loadMessages(locale));

  return { locale, messages, timeZone: "Asia/Colombo" };
});
