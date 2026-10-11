"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import AddressSummary from "@/components/address/AddressSummary";
import OrderItems from "@/components/orders/OrderItems";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimeline from "@/components/orders/OrderTimeline";

// One line of the money summary.
function MoneyRow({ label, value, isStrong = false }) {
  return (
    <div className={`flex justify-between ${isStrong ? "font-semibold text-ink" : "text-subtle"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// One of the seller's orders: what to pack, where to send it, cash to collect, and earnings.
export default function SellerOrderDetail({ subOrderNumber }) {
  const t = useTranslations();
  const locale = useLocale();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/seller/orders/${subOrderNumber}`)
      .then((data) => setOrder(data.order))
      .catch((loadError) => setError(loadError));
  }, [subOrderNumber]);

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!order) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-ink">{order.subOrderNumber}</h2>
          <div className="text-sm text-subtle">{formatDateTime(order.createdAt, locale)}</div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card title={t("sellerOrders.toPack")}>
            <OrderItems items={order.items} />
          </Card>
          <Card title={t("orders.timeline")}>
            <OrderTimeline events={order.timeline} />
            <p className="mt-3 text-xs text-subtle">{t("sellerOrders.actionsSoon")}</p>
          </Card>
        </div>

        <aside className="h-fit space-y-4">
          <Card title={t("checkout.deliverTo")}>
            <AddressSummary address={order.shippingAddress} />
          </Card>
          <Card title={t("sellerOrders.money")}>
            <dl className="space-y-1 text-sm">
              <MoneyRow label={t("checkout.items")} value={formatMoney(order.itemsSubtotal)} />
              <MoneyRow label={t("checkout.delivery")} value={formatMoney(order.shippingFee)} />
              <MoneyRow label={t("sellerOrders.cashToCollect")} value={formatMoney(order.delivery.codAmount)} isStrong />
              <MoneyRow label={t("sellerOrders.commission")} value={`− ${formatMoney(order.commissionTotal)}`} />
              <MoneyRow label={t("sellerOrders.youEarn")} value={formatMoney(order.sellerNet)} isStrong />
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
