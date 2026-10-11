"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { centsToInput, inputToCents } from "@/lib/money";

const SORTS = ["newest", "price_asc", "price_desc", "rating"];

// Price range and sort controls. Changing them loads the page again with new URL settings.
// Prices are typed in rupees and sent to the API in cents.
export default function ProductFilters({ query }) {
  const t = useTranslations("store");
  const router = useRouter();
  const [minPrice, setMinPrice] = useState(centsToInput(query.minPrice ?? null));
  const [maxPrice, setMaxPrice] = useState(centsToInput(query.maxPrice ?? null));

  // Builds the /products URL from the current settings plus the given changes.
  function goTo(changes) {
    const params = new URLSearchParams();
    const next = { ...query, ...changes, page: undefined };
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    router.push(`/products?${params}`);
  }

  // Applies the price range (empty or invalid boxes mean "no limit").
  function applyPrices(event) {
    event.preventDefault();
    const min = inputToCents(minPrice);
    const max = inputToCents(maxPrice);
    goTo({ minPrice: Number.isFinite(min) ? min : undefined, maxPrice: Number.isFinite(max) ? max : undefined });
  }

  const inputClass = "min-h-10 w-24 rounded-md border border-line bg-surface px-2 text-sm text-ink";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <form onSubmit={applyPrices} className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-subtle">
          {t("minPrice")}
          <input inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={`${inputClass} block`} />
        </label>
        <label className="text-sm text-subtle">
          {t("maxPrice")}
          <input inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`${inputClass} block`} />
        </label>
        <button type="submit" className="min-h-10 rounded-md border border-line px-3 text-sm text-ink hover:bg-muted">
          {t("apply")}
        </button>
      </form>

      <label className="text-sm text-subtle">
        {t("sortBy")}
        <select
          value={query.sort || "newest"}
          onChange={(e) => goTo({ sort: e.target.value })}
          className="block min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink"
        >
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sort.${sort}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
