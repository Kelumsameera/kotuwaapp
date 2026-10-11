"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LOCALES } from "@/i18n/config";

// Text in English, Sinhala and Tamil with one tab per language.
// English is required; the others are optional and fall back to English for shoppers.
// value: { en, si, ta }   onChange(newValue)
export default function TranslatedInput({ label, value, onChange, multiline = false, required = true, error, maxLength }) {
  const t = useTranslations("languages");
  const tForm = useTranslations("form");
  const [activeLocale, setActiveLocale] = useState("en");

  // Updates the text for the selected language only.
  function updateText(event) {
    onChange({ ...value, [activeLocale]: event.target.value });
  }

  const inputClass =
    "block w-full rounded-md border bg-surface px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-brand " +
    (error ? "border-red-500" : "border-line");

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <div role="tablist" className="flex gap-1">
          {LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={activeLocale === locale}
              onClick={() => setActiveLocale(locale)}
              className={`rounded px-2 py-1 text-xs ${
                activeLocale === locale ? "bg-brand text-white" : "border border-line text-ink hover:bg-muted"
              }`}
            >
              {t(locale)}
              {locale === "en" && required ? " *" : ""}
            </button>
          ))}
        </div>
      </div>

      {multiline ? (
        <textarea rows={5} className={inputClass} value={value?.[activeLocale] || ""} onChange={updateText} maxLength={maxLength} lang={activeLocale} />
      ) : (
        <input className={`${inputClass} min-h-11`} value={value?.[activeLocale] || ""} onChange={updateText} maxLength={maxLength} lang={activeLocale} />
      )}

      {activeLocale !== "en" && <p className="mt-1 text-xs text-subtle">{tForm("fallbackHint")}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
