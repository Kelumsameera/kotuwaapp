"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import StatusBadge from "@/components/ui/StatusBadge";

const STATUSES = ["pending", "approved", "rejected", "draft"];

// One product card with its photos, text in every language, and variants.
function ProductCard({ product, isBusy, onReview }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{pickText(product.name, locale)}</span>
        <StatusBadge status={product.status} />
        <span className="text-sm text-subtle">· {product.shopName}</span>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {product.images.map((image) => (
          <div key={image.publicId} className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-muted">
            <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
          </div>
        ))}
      </div>

      <dl className="mt-3 grid gap-1 text-sm">
        {["en", "si", "ta"].map((language) =>
          product.name[language] ? (
            <div key={language} className="text-ink">
              <span className="text-subtle">{t(`languages.${language}`)}: </span>
              {product.name[language]}
            </div>
          ) : null
        )}
        {product.description.en && <p className="whitespace-pre-line text-subtle">{product.description.en}</p>}
      </dl>

      <ul className="mt-2 text-sm text-subtle">
        {product.variants.map((variant) => (
          <li key={variant.id}>
            {[variant.sku, variant.options.size, variant.options.color].filter(Boolean).join(" · ")} — {formatMoney(variant.price)}
          </li>
        ))}
      </ul>

      {product.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button isBusy={isBusy} onClick={() => onReview(product, "approve")}>
            {t("admin.approve")}
          </Button>
          <Button variant="secondary" isBusy={isBusy} onClick={() => onReview(product, "reject")}>
            {t("admin.reject")}
          </Button>
        </div>
      )}
    </li>
  );
}

// Admin queue of products waiting for approval.
export default function ProductsReview() {
  const t = useTranslations();
  const [status, setStatus] = useState("pending");
  const { data, error, page, setPage, pageCount, reload } = usePagedList("/admin/products", { status });
  const [actionError, setActionError] = useState(null);
  const [busyProductId, setBusyProductId] = useState(null);

  // Approves or rejects a product. Rejecting asks for a reason the seller will see.
  async function review(product, decision) {
    let reason;
    if (decision === "reject") {
      reason = window.prompt(t("admin.reasonPrompt"));
      if (!reason) return;
    }

    setActionError(null);
    setBusyProductId(product.id);
    try {
      await api(`/admin/products/${product.id}/review`, { method: "PATCH", body: { decision, reason } });
      reload();
    } catch (reviewError) {
      setActionError(reviewError);
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <div className="space-y-4">
      <select
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value);
        }}
        className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
        aria-label={t("admin.colStatus")}
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {t(`status.${value}`)}
          </option>
        ))}
      </select>

      {(error || actionError) && <Alert type="error">{errorMessage(error || actionError, t)}</Alert>}
      {data && data.products.length === 0 && <p className="py-8 text-center text-subtle">{t("product.none")}</p>}

      <ul className="space-y-3">
        {data?.products.map((product) => (
          <ProductCard key={product.id} product={product} isBusy={busyProductId === product.id} onReview={review} />
        ))}
      </ul>

      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
