"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { useMyShop } from "@/lib/useMyShop";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import StatusBadge from "@/components/ui/StatusBadge";
import ShopForm from "./ShopForm";

const PRODUCT_STATUSES = ["draft", "pending", "approved", "rejected"];

// Counts the seller's products in each status (one tiny request per status).
async function countProductsByStatus() {
  const counts = {};
  for (const status of PRODUCT_STATUSES) {
    const data = await api(`/seller/products?status=${status}&limit=1`);
    counts[status] = data.total;
  }
  return counts;
}

// Explains what the shop's status means for the seller.
function ShopStatusCard({ shop }) {
  const t = useTranslations("seller");
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{shop.name}</h2>
        <StatusBadge status={shop.status} />
      </div>
      <p className="mt-2 text-sm text-subtle">{t(`shopStatusHelp.${shop.status}`)}</p>
      {shop.statusReason && <p className="mt-2 text-sm text-red-600">{t("reason", { reason: shop.statusReason })}</p>}
    </Card>
  );
}

// Seller dashboard: open a shop first, then see shop status and product counts.
export default function SellerHome() {
  const t = useTranslations();
  const { shop, setShop, isLoading, hasNoShop, error } = useMyShop();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!shop) return undefined;
    let isCancelled = false;
    countProductsByStatus()
      .then((result) => {
        if (!isCancelled) setCounts(result);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [shop]);

  if (isLoading) return <p className="text-subtle">{t("common.loading")}</p>;
  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;

  if (hasNoShop) {
    return (
      <Card title={t("shop.openTitle")}>
        <p className="mb-4 text-sm text-subtle">{t("shop.openIntro")}</p>
        <ShopForm shop={null} onSaved={setShop} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ShopStatusCard shop={shop} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRODUCT_STATUSES.map((status) => (
          <Link key={status} href={`/seller/products?status=${status}`} className="rounded-lg border border-line bg-surface p-4 hover:bg-muted">
            <div className="text-2xl font-semibold text-ink">{counts ? counts[status] : "–"}</div>
            <div className="text-sm text-subtle">{t(`status.${status}`)}</div>
          </Link>
        ))}
      </div>
      <Link href="/seller/products/new" className="inline-block rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
        {t("product.add")}
      </Link>
    </div>
  );
}
