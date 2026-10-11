"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/apiClient";

// "♡ Save" button. Guests are sent to log in; staff accounts don't see it.
export default function WishlistButton({ productId, productSlug }) {
  const t = useTranslations("store");
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const isCustomer = user?.role === "customer";

  // For customers, find out whether this product is already saved.
  useEffect(() => {
    if (!isCustomer) return undefined;
    let isCancelled = false;
    api("/wishlist")
      .then((data) => {
        if (!isCancelled) setIsSaved(data.products.some((product) => product.id === productId));
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [isCustomer, productId]);

  const buttonClass = "min-h-11 rounded-md border border-line px-4 text-sm text-ink hover:bg-muted";

  if (!user) {
    return (
      <Link href={`/login?next=/products/${productSlug}`} className={`${buttonClass} inline-flex items-center`}>
        ♡ {t("saveToWishlist")}
      </Link>
    );
  }
  if (!isCustomer) return null;

  // Saves or un-saves the product.
  async function toggle() {
    setIsBusy(true);
    try {
      await api(`/wishlist/${productId}`, { method: isSaved ? "DELETE" : "PUT" });
      setIsSaved(!isSaved);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={isBusy} aria-pressed={isSaved} className={buttonClass}>
      {isSaved ? `♥ ${t("savedToWishlist")}` : `♡ ${t("saveToWishlist")}`}
    </button>
  );
}
