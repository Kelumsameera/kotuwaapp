"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import StatusBadge from "@/components/ui/StatusBadge";

const PAGE_SIZE = 20;
const STATUSES = ["draft", "pending", "approved", "rejected"];

// Shows "Rs 1,000.00" or "Rs 1,000.00 – Rs 2,500.00" for a product's variants.
function priceRange(variants) {
  const prices = variants.map((variant) => variant.price);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  return lowest === highest ? formatMoney(lowest) : `${formatMoney(lowest)} – ${formatMoney(highest)}`;
}

// The seller's product list with status filter, search and paging.
export default function ProductList({ initialStatus }) {
  const t = useTranslations();
  const locale = useLocale();
  const [status, setStatus] = useState(initialStatus || "");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const { data: result, error, page, setPage, pageCount } = usePagedList("/seller/products", { status, search }, PAGE_SIZE);

  // Applies the search box.
  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchText.trim());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
          aria-label={t("product.status")}
        >
          <option value="">{t("product.allStatuses")}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("product.searchPlaceholder")}
            className="min-h-11 flex-1 rounded-md border border-line bg-surface px-3 text-ink"
          />
          <Button type="submit" variant="secondary">
            {t("common.search")}
          </Button>
        </form>
        <Link href="/seller/products/new" className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark">
          {t("product.add")}
        </Link>
      </div>

      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {!result && !error && <p className="text-subtle">{t("common.loading")}</p>}
      {result && result.products.length === 0 && <p className="py-8 text-center text-subtle">{t("product.none")}</p>}

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {result?.products.map((product) => {
          const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
          return (
            <li key={product.id}>
              <Link href={`/seller/products/${product.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                  {product.images[0] && <Image src={product.images[0].url} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{pickText(product.name, locale)}</div>
                  <div className="text-sm text-subtle">
                    {priceRange(product.variants)} · {t("product.stockCount", { count: totalStock })}
                    {!product.isActive && ` · ${t("product.hidden")}`}
                  </div>
                </div>
                <StatusBadge status={product.status} />
              </Link>
            </li>
          );
        })}
      </ul>

      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
