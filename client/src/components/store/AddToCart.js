"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/context/CartContext";
import { errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import WishlistButton from "./WishlistButton";

const LOW_STOCK = 5;

// A readable name for a variant, e.g. "XL · Red" (or the SKU if it has no options).
function variantLabel(variant) {
  return [variant.options.size, variant.options.color].filter(Boolean).join(" · ") || variant.sku;
}

// Price, variant choice, quantity and the "Add to cart" button on the product page.
export default function AddToCart({ product }) {
  const t = useTranslations();
  const { addItem, canShop } = useCart();
  const firstInStock = product.variants.find((variant) => variant.stock > 0) || product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock.id);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const variant = product.variants.find((candidate) => candidate.id === variantId);
  const maxQuantity = Math.min(variant.stock, 99);

  // Picks another variant and resets the quantity.
  function chooseVariant(id) {
    setVariantId(id);
    setQuantity(1);
    setMessage(null);
  }

  // Adds the chosen variant to the cart.
  async function handleAdd() {
    setMessage(null);
    setIsBusy(true);
    try {
      await addItem({ productId: product.id, variantId, quantity });
      setMessage({ type: "success" });
    } catch (addError) {
      setMessage({ type: "error", text: errorMessage(addError, t) });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-2xl font-semibold text-ink">
        {formatMoney(variant.price)}
        {variant.compareAtPrice > variant.price && (
          <span className="ml-3 text-base font-normal text-subtle line-through">{formatMoney(variant.compareAtPrice)}</span>
        )}
      </div>

      {product.variants.length > 1 && (
        <div>
          <span className="mb-2 block text-sm font-medium text-ink">{t("store.chooseOption")}</span>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseVariant(option.id)}
                aria-pressed={option.id === variantId}
                className={`min-h-10 rounded-md border px-3 text-sm ${
                  option.id === variantId ? "border-brand bg-brand text-white" : "border-line text-ink hover:bg-muted"
                } ${option.stock === 0 ? "opacity-50" : ""}`}
              >
                {variantLabel(option)}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className={`text-sm ${variant.stock === 0 ? "text-red-600" : "text-subtle"}`}>
        {variant.stock === 0 && t("store.soldOut")}
        {variant.stock > 0 && variant.stock <= LOW_STOCK && t("store.onlyLeft", { count: variant.stock })}
        {variant.stock > LOW_STOCK && t("store.inStock")}
      </p>

      {canShop ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-subtle">
            <span className="sr-only">{t("store.quantity")}</span>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={variant.stock === 0}
              className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
            >
              {Array.from({ length: Math.max(maxQuantity, 1) }, (unused, index) => index + 1).map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={handleAdd} isBusy={isBusy} disabled={variant.stock === 0} className="flex-1 sm:flex-none">
            {t("store.addToCart")}
          </Button>
          <WishlistButton productId={product.id} productSlug={product.slug} />
        </div>
      ) : (
        <Alert type="info">{t("store.staffCannotBuy")}</Alert>
      )}

      {message?.type === "success" && (
        <Alert type="success">
          {t("store.addedToCart")}{" "}
          <Link href="/cart" className="font-medium underline">
            {t("store.viewCart")}
          </Link>
        </Alert>
      )}
      {message?.type === "error" && <Alert type="error">{message.text}</Alert>}
    </div>
  );
}
