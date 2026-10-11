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

// The seller's orders (only their own shop's sub-orders), newest first.
export default function SellerOrdersList({ initialStatus = "" }) {
  const t = useTranslations();
  const locale = useLocale();
  const [status, setStatus] = useState(initialStatus);
  const { data, error, page, setPage, pageCount } = usePagedList("/seller/orders", { status });

  return (
    <div className="space-y-4">
      <select
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value);
        }}
        className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
        aria-label={t("product.status")}
      >
        <option value="">{t("product.allStatuses")}</option>
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {t(`orderStatus.${value}`)}
          </option>
        ))}
      </select>

      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {data?.orders.length === 0 && <p className="py-8 text-center text-subtle">{t("orders.none")}</p>}

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {data?.orders.map((order) => (
          <li key={order.id}>
            <Link href={`/seller/orders/${order.subOrderNumber}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{order.subOrderNumber}</div>
                <div className="text-sm text-subtle">
                  {formatDateTime(order.createdAt, locale)} · {order.shippingAddress.fullName} · {order.shippingAddress.city}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-ink">{formatMoney(order.total)}</div>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
