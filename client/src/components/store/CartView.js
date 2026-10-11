"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/context/CartContext";
import { errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import ProductImage from "./ProductImage";

// One line in the cart: photo, name, options, quantity, price and remove.
function CartLine({ line, onError }) {
  const t = useTranslations("store");
  const locale = useLocale();
  const { setQuantity, removeItem } = useCart();
  const [isBusy, setIsBusy] = useState(false);
  const name = pickText(line.name, locale);
  const options = [line.options.size, line.options.color].filter(Boolean).join(" · ");
  const maxQuantity = Math.max(1, Math.min(line.availableStock, 99), line.quantity);

  // Runs a cart change and reports any error.
  async function run(change) {
    onError(null);
    setIsBusy(true);
    try {
      await change();
    } catch (changeError) {
      onError(changeError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <li className={`flex gap-3 py-3 ${isBusy ? "opacity-60" : ""}`}>
      <ProductImage image={line.image} alt={name} sizes="80px" className="h-20 w-20 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        {line.slug ? (
          <Link href={`/products/${line.slug}`} className="line-clamp-2 text-sm text-ink hover:text-brand">
            {name}
          </Link>
        ) : (
          <span className="text-sm text-subtle">{t("unavailableItem")}</span>
        )}
        {options && <div className="text-xs text-subtle">{options}</div>}
        {line.problem && <div className="text-xs text-red-600">{t(`cartProblem.${line.problem}`, { count: line.availableStock })}</div>}
        <div className="mt-2 flex items-center gap-3">
          {line.problem !== "UNAVAILABLE" && (
            <select
              value={line.quantity}
              disabled={isBusy}
              onChange={(e) => run(() => setQuantity(line.variantId, Number(e.target.value)))}
              aria-label={t("quantity")}
              className="min-h-9 rounded border border-line bg-surface px-2 text-sm text-ink"
            >
              {Array.from({ length: maxQuantity }, (unused, index) => index + 1).map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          )}
          <button type="button" disabled={isBusy} onClick={() => run(() => removeItem(line.variantId))} className="text-sm text-red-600 hover:underline">
            {t("remove")}
          </button>
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="font-semibold text-ink">{formatMoney(line.lineTotal)}</div>
        {line.quantity > 1 && <div className="text-xs text-subtle">{t("each", { price: formatMoney(line.unitPrice) })}</div>}
      </div>
    </li>
  );
}

// The cart page: items grouped by shop (each shop ships separately), with totals.
export default function CartView() {
  const t = useTranslations();
  const { cart, isLoading, canShop } = useCart();
  const [error, setError] = useState(null);

  if (!canShop) return <Alert type="info">{t("store.staffCannotBuy")}</Alert>;
  if (isLoading) return <p className="text-subtle">{t("common.loading")}</p>;

  const hasLines = cart.shops.some((shop) => shop.items.length > 0);
  if (!hasLines) {
    return (
      <Card title={t("store.cartTitle")}>
        <p className="text-subtle">{t("store.cartEmpty")}</p>
        <Link href="/products" className="mt-4 inline-block text-brand hover:underline">
          {t("home.shopCta")}
        </Link>
      </Card>
    );
  }

  const hasProblems = cart.shops.some((shop) => shop.items.some((line) => line.problem));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">{t("store.cartTitle")}</h1>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
        {cart.shops.map((shop) => (
          <section key={shop.shopId || "unavailable"} className="rounded-lg border border-line bg-surface px-4">
            <div className="flex items-center justify-between border-b border-line py-3">
              {shop.shopSlug ? (
                <Link href={`/shops/${shop.shopSlug}`} className="font-medium text-ink hover:text-brand">
                  {shop.shopName}
                </Link>
              ) : (
                <span className="font-medium text-subtle">{t("store.unavailableItems")}</span>
              )}
              {shop.shopId && <span className="text-sm text-subtle">{formatMoney(shop.subtotal)}</span>}
            </div>
            <ul className="divide-y divide-line">
              {shop.items.map((line) => (
                <CartLine key={line.variantId} line={line} onError={setError} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="h-fit space-y-3 rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-4">
        <div className="flex justify-between text-ink">
          <span>{t("store.itemsTotal", { count: cart.itemCount })}</span>
          <span className="font-semibold">{formatMoney(cart.subtotal)}</span>
        </div>
        <p className="text-xs text-subtle">{t("store.shippingAtCheckout")}</p>
        {hasProblems && <Alert type="error">{t("store.fixProblems")}</Alert>}
        <Link
          href="/checkout"
          aria-disabled={hasProblems}
          className={`flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white ${
            hasProblems ? "pointer-events-none bg-subtle" : "bg-brand hover:bg-brand-dark"
          }`}
        >
          {t("store.checkout")}
        </Link>
      </aside>
    </div>
  );
}
