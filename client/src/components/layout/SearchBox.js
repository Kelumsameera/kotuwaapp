"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

// The search box in the header. Searches products in any of the three languages.
export default function SearchBox() {
  const t = useTranslations("store");
  const router = useRouter();
  const [text, setText] = useState("");

  // Opens the product list for the typed words.
  function handleSubmit(event) {
    event.preventDefault();
    const search = text.trim();
    router.push(search ? `/products?${new URLSearchParams({ search })}` : "/products");
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={100}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="min-h-10 w-full rounded-l-md border border-line bg-page px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
      />
      <button type="submit" className="rounded-r-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark">
        {t("searchButton")}
      </button>
    </form>
  );
}
