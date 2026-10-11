"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import { useMyShop } from "@/lib/useMyShop";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import StatusBadge from "@/components/ui/StatusBadge";
import ShopForm from "./ShopForm";

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

// One big number with a label, optionally a link.
function Stat({ label, value, href }) {
  const content = (
    <>
      <div className="text-xl font-semibold text-ink sm:text-2xl">{value}</div>
      <div className="text-sm text-subtle">{label}</div>
    </>
  );
  const className = "block rounded-lg border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={`${className} hover:bg-muted`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

// Orders waiting for the seller, with links to the filtered order list.
function ToDoCard({ toDo }) {
  const t = useTranslations();
  const waiting = Object.entries(toDo).filter(([, count]) => count > 0);
  return (
    <Card title={t("sellerDashboard.toDo")}>
      {waiting.length === 0 ? (
        <p className="text-sm text-subtle">{t("sellerDashboard.allDone")}</p>
      ) : (
        <ul className="space-y-1">
          {waiting.map(([status, count]) => (
            <li key={status}>
              <Link href={`/seller/orders?status=${status}`} className="flex justify-between rounded px-2 py-1 text-sm hover:bg-muted">
                <span className="text-ink">{t(`orderStatus.${status}`)}</span>
                <span className="font-semibold text-ink">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Variants that are running out, linking to their product page.
function LowStockCard({ lowStock }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Card title={t("sellerDashboard.lowStock", { count: lowStock.count })}>
      {lowStock.count === 0 ? (
        <p className="text-sm text-subtle">{t("sellerDashboard.noLowStock", { threshold: lowStock.threshold })}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {lowStock.items.map((item) => (
            <li key={item.variantId}>
              <Link href={`/seller/products/${item.productId}`} className="flex justify-between gap-2 py-1.5 hover:text-brand">
                <span className="truncate text-ink">
                  {pickText(item.name, locale)} <span className="text-subtle">{[item.options.size, item.options.color, item.sku].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={item.stock === 0 ? "font-semibold text-red-600" : "font-semibold text-ink"}>{item.stock}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Seller dashboard: open a shop first; then sales, to-dos, money and low stock at a glance.
export default function SellerHome() {
  const t = useTranslations();
  const { shop, setShop, isLoading, hasNoShop, error } = useMyShop();
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    if (!shop) return undefined;
    let isCancelled = false;
    api("/seller/dashboard")
      .then((data) => {
        if (!isCancelled) setDashboard(data.dashboard);
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

      {dashboard && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("sellerDashboard.salesToday", { count: dashboard.sales.today.orders })} value={formatMoney(dashboard.sales.today.amount)} />
            <Stat label={t("sellerDashboard.sales30", { count: dashboard.sales.last30Days.orders })} value={formatMoney(dashboard.sales.last30Days.amount)} />
            <Stat label={t("earnings.available")} value={formatMoney(dashboard.earnings.available)} href="/seller/earnings" />
            <Stat label={t("delivery.codPending")} value={formatMoney(dashboard.cod.total)} href="/seller/orders?status=delivered" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ToDoCard toDo={dashboard.toDo} />
            <LowStockCard lowStock={dashboard.lowStock} />
          </div>
        </>
      )}

      <Link href="/seller/products/new" className="inline-block rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
        {t("product.add")}
      </Link>
    </div>
  );
}
