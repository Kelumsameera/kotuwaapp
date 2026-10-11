"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Pager from "@/components/ui/Pager";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";

const STATUSES = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "delivery_failed", "return_requested", "returned"];

// Admin: every delivery, with a "delayed only" filter, oldest updates first.
export default function DeliveriesBoard() {
  const t = useTranslations();
  const locale = useLocale();
  const [status, setStatus] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const { data, error, page, setPage, pageCount } = usePagedList("/admin/deliveries", {
    status,
    delayed: delayedOnly ? "true" : "",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
          aria-label={t("admin.colStatus")}
        >
          <option value="">{t("product.allStatuses")}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`orderStatus.${value}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={delayedOnly}
            onChange={(e) => {
              setPage(1);
              setDelayedOnly(e.target.checked);
            }}
          />
          {t("adminDelivery.delayedOnly")}
        </label>
        <Link href="/admin/deliveries/report" className="ml-auto text-sm text-brand hover:underline">
          {t("adminDelivery.report")} →
        </Link>
      </div>

      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {data?.deliveries.length === 0 && <p className="py-8 text-center text-subtle">{t("orders.none")}</p>}

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {data?.deliveries.map((delivery) => (
          <li key={delivery.id}>
            <Link href={`/admin/deliveries/${delivery.subOrderNumber}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{delivery.subOrderNumber}</div>
                <div className="text-sm text-subtle">
                  {delivery.shop?.name} → {delivery.shippingAddress.city} · {t("adminDelivery.lastUpdate", { date: formatDateTime(delivery.updatedAt, locale) })}
                </div>
                <div className="text-xs text-subtle">
                  {delivery.delivery.rider ? t("adminDelivery.riderIs", { name: delivery.delivery.rider.name }) : t("adminDelivery.noRider")}
                  {delivery.delivery.attempts > 0 && ` · ${t("delivery.attemptsValue", { used: delivery.delivery.attempts, max: delivery.delivery.maxAttempts })}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-ink">{formatMoney(delivery.total)}</div>
                <OrderStatusBadge status={delivery.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
