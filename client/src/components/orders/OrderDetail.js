"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AddressSummary from "@/components/address/AddressSummary";
import OrderItems from "./OrderItems";
import OrderStatusBadge from "./OrderStatusBadge";
import OrderTimeline from "./OrderTimeline";

// Cancel / ask-for-return buttons for one part of the order (asks for a reason first).
function CustomerActions({ subOrder, onChanged }) {
  const t = useTranslations();
  const locale = useLocale();
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  // Asks for a reason, then sends the change.
  async function change(status) {
    const reason = window.prompt(t(status === "cancelled" ? "orders.cancelPrompt" : "orders.returnPrompt"));
    if (!reason) return;
    setError(null);
    setIsBusy(true);
    try {
      const data = await api(`/orders/sub-orders/${subOrder.subOrderNumber}/status`, { method: "PATCH", body: { status, note: reason } });
      onChanged(data.subOrder);
    } catch (changeError) {
      setError(changeError);
    } finally {
      setIsBusy(false);
    }
  }

  if (subOrder.nextStatuses.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {subOrder.nextStatuses.includes("cancelled") && (
          <Button variant="danger" isBusy={isBusy} onClick={() => change("cancelled")}>
            {t("actions.cancelled")}
          </Button>
        )}
        {subOrder.nextStatuses.includes("return_requested") && (
          <>
            <Button variant="secondary" isBusy={isBusy} onClick={() => change("return_requested")}>
              {t("actions.return_requested")}
            </Button>
            <span className="text-xs text-subtle">{t("orders.returnUntil", { date: formatDateTime(subOrder.returnDeadline, locale) })}</span>
          </>
        )}
      </div>
    </div>
  );
}

// One shop's part of the order: items, delivery, status and its own timeline.
function SubOrderCard({ subOrder, onChanged }) {
  const t = useTranslations("orders");
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          {subOrder.shop ? (
            <Link href={`/shops/${subOrder.shop.slug}`} className="font-medium text-ink hover:text-brand">
              {subOrder.shop.name}
            </Link>
          ) : null}
          <div className="text-xs text-subtle">{subOrder.subOrderNumber}</div>
        </div>
        <OrderStatusBadge status={subOrder.status} />
      </div>

      <OrderItems items={subOrder.items} />

      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between text-subtle">
          <span>{t("delivery")}</span>
          <span>{formatMoney(subOrder.shippingFee)}</span>
        </div>
        <div className="flex justify-between font-medium text-ink">
          <span>{t("partTotal")}</span>
          <span>{formatMoney(subOrder.total)}</span>
        </div>
      </div>

      {subOrder.delivery.trackingNumber && (
        <p className="mt-3 text-sm text-ink">
          {t("courier", { courier: subOrder.delivery.courierName, number: subOrder.delivery.trackingNumber })}
          {subOrder.delivery.trackingUrl && (
            <a href={subOrder.delivery.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-brand underline">
              {t("trackWithCourier")}
            </a>
          )}
        </p>
      )}

      {subOrder.delivery.proof && <p className="mt-2 text-sm text-subtle">{t("proofRecorded")}</p>}
      <CustomerActions subOrder={subOrder} onChanged={onChanged} />

      <h3 className="mt-4 mb-2 text-sm font-semibold text-ink">{t("timeline")}</h3>
      <OrderTimeline events={subOrder.timeline} />
    </Card>
  );
}

// The customer's order page: a thank-you note after checkout, every shop's part, and totals.
export default function OrderDetail({ orderNumber, justPlaced }) {
  const t = useTranslations();
  const locale = useLocale();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/orders/${orderNumber}`)
      .then((data) => setOrder(data.order))
      .catch((loadError) => setError(loadError));
  }, [orderNumber]);

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!order) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      {justPlaced && (
        <Alert type="success">
          <strong>{t("orders.thankYou")}</strong> {t("orders.placedNote", { total: formatMoney(order.grandTotal) })}
        </Alert>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">{t("orders.orderTitle", { number: order.orderNumber })}</h1>
        <span className="text-sm text-subtle">{formatDateTime(order.createdAt, locale)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {order.subOrders.map((subOrder) => (
            <SubOrderCard
              key={subOrder.id}
              subOrder={subOrder}
              onChanged={(changed) =>
                setOrder((current) => ({
                  ...current,
                  subOrders: current.subOrders.map((part) => (part.id === changed.id ? { ...changed, shop: part.shop } : part)),
                }))
              }
            />
          ))}
        </div>

        <aside className="h-fit space-y-4">
          <Card title={t("checkout.deliverTo")}>
            <AddressSummary address={order.shippingAddress} />
          </Card>
          <Card title={t("checkout.payment")}>
            <p className="text-sm text-ink">{t("checkout.cod")}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-subtle">
                <dt>{t("checkout.items")}</dt>
                <dd>{formatMoney(order.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between text-subtle">
                <dt>{t("checkout.delivery")}</dt>
                <dd>{formatMoney(order.shippingTotal)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
                <dt>{t("checkout.total")}</dt>
                <dd>{formatMoney(order.grandTotal)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
