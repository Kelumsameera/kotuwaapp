"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

// Add or remove stock for one variant, with a note (e.g. "New delivery").
function StockAdjustRow({ productId, variant, onAdjusted }) {
  const t = useTranslations();
  const [change, setChange] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  // Sends the stock change (positive adds, negative removes).
  async function applyChange(event) {
    event.preventDefault();
    const amount = Number.parseInt(change, 10);
    if (!amount) return;

    setError(null);
    setIsBusy(true);
    try {
      const result = await api(`/seller/products/${productId}/variants/${variant.id}/stock`, {
        method: "POST",
        body: { change: amount, note: note || undefined },
      });
      setChange("");
      setNote("");
      onAdjusted(variant.id, result.stock);
    } catch (adjustError) {
      setError(adjustError);
    } finally {
      setIsBusy(false);
    }
  }

  const label = [variant.sku, variant.options.size, variant.options.color].filter(Boolean).join(" · ");

  return (
    <form onSubmit={applyChange} className="flex flex-col gap-2 border-t border-line py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{label}</div>
        <div className="text-sm text-subtle">{t("product.inStock", { count: variant.stock })}</div>
      </div>
      <input
        type="number"
        value={change}
        onChange={(e) => setChange(e.target.value)}
        placeholder="+10 / -2"
        aria-label={t("product.stockChange")}
        className="min-h-10 w-full rounded border border-line bg-surface px-2 text-sm text-ink sm:w-28"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        placeholder={t("product.stockNote")}
        className="min-h-10 w-full rounded border border-line bg-surface px-2 text-sm text-ink sm:w-48"
      />
      <Button type="submit" variant="secondary" isBusy={isBusy} className="min-h-10">
        {t("product.applyStock")}
      </Button>
      {error && <div className="w-full sm:w-auto"><Alert type="error">{errorMessage(error, t)}</Alert></div>}
    </form>
  );
}

// Stock controls for every variant plus the recent stock history.
export default function StockPanel({ product, onStockChanged }) {
  const t = useTranslations("product");
  const [movements, setMovements] = useState([]);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    api(`/seller/products/${product.id}/stock-history`)
      .then((data) => {
        if (!isCancelled) setMovements(data.movements);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [product.id, reloadCount]);

  // Updates the shown stock and reloads the history.
  function handleAdjusted(variantId, stock) {
    onStockChanged(variantId, stock);
    setReloadCount((count) => count + 1);
  }

  const skuById = Object.fromEntries(product.variants.map((variant) => [variant.id, variant.sku]));

  return (
    <Card title={t("stockTitle")}>
      <p className="mb-2 text-xs text-subtle">{t("stockHelp")}</p>
      {product.variants.map((variant) => (
        <StockAdjustRow key={variant.id} productId={product.id} variant={variant} onAdjusted={handleAdjusted} />
      ))}

      <h3 className="mt-6 mb-2 text-sm font-semibold text-ink">{t("stockHistory")}</h3>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
        {movements.map((movement) => (
          <li key={movement.id} className="flex justify-between gap-2 text-subtle">
            <span className="truncate">
              {new Date(movement.createdAt).toLocaleString()} · {skuById[movement.variantId] || "—"} · {t(`stockReason.${movement.reason}`)}
              {movement.note && ` · ${movement.note}`}
            </span>
            <span className={movement.change > 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}>
              {movement.change > 0 ? `+${movement.change}` : movement.change} → {movement.stockAfter}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
