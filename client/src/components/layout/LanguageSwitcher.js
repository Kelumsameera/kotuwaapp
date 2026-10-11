"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALES } from "@/i18n/config";
import { saveLocaleCookie } from "@/lib/localeCookie";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/apiClient";

// Dropdown to switch between English, Sinhala and Tamil.
// The choice is saved in a cookie, and on the user's account when logged in.
export default function LanguageSwitcher() {
  const t = useTranslations("languages");
  const locale = useLocale();
  const router = useRouter();
  const { user, setUser } = useAuth();

  // Saves the new language and re-renders the page in it.
  async function changeLanguage(event) {
    const newLocale = event.target.value;
    saveLocaleCookie(newLocale);

    if (user) {
      try {
        const data = await api("/users/me/language", { method: "PATCH", body: { language: newLocale } });
        setUser(data.user);
      } catch {
        // The cookie is already saved, so the page still switches language.
      }
    }

    router.refresh();
  }

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={changeLanguage}
        className="min-h-9 rounded-md border border-line bg-surface px-2 text-ink"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
