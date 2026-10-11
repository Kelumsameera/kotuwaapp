"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";

// Admin: every order, with each shop's part, status and commission.
export default function AdminOrdersList() {
  const t = useTranslations();
  const locale = useLocale();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, page, setPage, pageCount } = usePagedList("/admin/orders", { search });

  // Applies the order-number search.
  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchText.trim());
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="KT-261011-000001"
          aria-label={t("admin.searchOrder")}
          className="min-h-11 flex-1 rounded-md border border-line bg-surface px-3 text-ink"
        />
        <Button type="submit" variant="secondary">
          {t("common.search")}
        </Button>
      </form>

      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {data?.orders.length === 0 && <p className="py-8 text-center text-subtle">{t("orders.none")}</p>}

      <ul className="space-y-3">
        {data?.orders.map((order) => (
          <li key={order.orderNumber} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">{order.orderNumber}</span>
              <span className="text-sm text-subtle">{formatDateTime(order.createdAt, locale)}</span>
            </div>
            <div className="text-sm text-subtle">
              {order.customer?.name} · {order.customer?.email} · {order.shippingAddress.city}
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {order.subOrders.map((subOrder) => (
                  <tr key={subOrder.id} className="border-t border-line">
                    <td className="py-1 text-ink">{subOrder.shop?.name}</td>
                    <td className="py-1">
                      <OrderStatusBadge status={subOrder.status} />
                    </td>
                    <td className="py-1 text-right text-ink">{formatMoney(subOrder.total)}</td>
                    <td className="py-1 text-right text-subtle">{t("admin.commissionShort", { amount: formatMoney(subOrder.commissionTotal) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-right font-semibold text-ink">{formatMoney(order.grandTotal)}</div>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
