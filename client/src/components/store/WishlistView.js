"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import ProductCard from "./ProductCard";

// The customer's saved products, each with a remove button.
export default function WishlistView() {
  const t = useTranslations();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    api("/wishlist")
      .then((data) => {
        if (!isCancelled) setProducts(data.products);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Removes a product and takes it off the screen.
  async function remove(productId) {
    try {
      await api(`/wishlist/${productId}`, { method: "DELETE" });
      setProducts((current) => current.filter((product) => product.id !== productId));
    } catch (removeError) {
      setError(removeError);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">{t("store.wishlistTitle")}</h1>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {!products && !error && <p className="text-subtle">{t("common.loading")}</p>}
      {products?.length === 0 && <p className="py-8 text-center text-subtle">{t("store.wishlistEmpty")}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products?.map((product) => (
          <div key={product.id} className="flex flex-col gap-1">
            <ProductCard product={product} />
            <button type="button" onClick={() => remove(product.id)} className="text-sm text-red-600 hover:underline">
              {t("store.remove")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
