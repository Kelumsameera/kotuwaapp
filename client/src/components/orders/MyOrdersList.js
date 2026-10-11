"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Pager from "@/components/ui/Pager";
import OrderStatusBadge from "./OrderStatusBadge";

// The customer's orders, newest first. Each shows every shop's part with its own status.
export default function MyOrdersList() {
  const t = useTranslations();
  const locale = useLocale();
  const { data, error, page, setPage, pageCount } = usePagedList("/orders", {}, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">{t("orders.myOrders")}</h1>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {!data && !error && <p className="text-subtle">{t("common.loading")}</p>}
      {data?.orders.length === 0 && (
        <p className="py-8 text-center text-subtle">
          {t("orders.none")}{" "}
          <Link href="/products" className="text-brand hover:underline">
            {t("home.shopCta")}
          </Link>
        </p>
      )}

      <ul className="space-y-3">
        {data?.orders.map((order) => (
          <li key={order.orderNumber}>
            <Link href={`/orders/${order.orderNumber}`} className="block rounded-lg border border-line bg-surface p-4 hover:bg-muted">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{order.orderNumber}</span>
                <span className="text-sm text-subtle">{formatDate(order.createdAt, locale)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {order.subOrders.map((subOrder) => (
                  <li key={subOrder.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-ink">{subOrder.shop?.name}</span>
                    <OrderStatusBadge status={subOrder.status} />
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-right font-semibold text-ink">{formatMoney(order.grandTotal)}</div>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
