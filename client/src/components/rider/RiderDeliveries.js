"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Pager from "@/components/ui/Pager";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";

// The rider's list: deliveries still to do, or finished ones. Big cards for phones.
export default function RiderDeliveries() {
  const t = useTranslations();
  const [scope, setScope] = useState("active");
  const { data, error, page, setPage, pageCount } = usePagedList("/rider/deliveries", { scope });
  const tabClass = (isActive) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand text-white" : "border border-line text-ink"}`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold text-ink">{t("nav.rider")}</h1>
      <div className="flex gap-2">
        <button type="button" className={tabClass(scope === "active")} onClick={() => { setPage(1); setScope("active"); }}>
          {t("rider.toDeliver")}
        </button>
        <button type="button" className={tabClass(scope === "done")} onClick={() => { setPage(1); setScope("done"); }}>
          {t("rider.done")}
        </button>
      </div>

      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {data?.deliveries.length === 0 && <p className="py-8 text-center text-subtle">{t("rider.none")}</p>}

      <ul className="space-y-3">
        {data?.deliveries.map((delivery) => (
          <li key={delivery.subOrderNumber}>
            <Link href={`/rider/deliveries/${delivery.subOrderNumber}`} className="block rounded-lg border border-line bg-surface p-4 active:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{delivery.dropoff.fullName}</span>
                <OrderStatusBadge status={delivery.status} />
              </div>
              <div className="mt-1 text-sm text-subtle">
                {delivery.dropoff.addressLine1}, {delivery.dropoff.city}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-subtle">{delivery.subOrderNumber}</span>
                {delivery.codAmount > 0 && !delivery.codCollected && (
                  <span className="font-semibold text-ink">{t("rider.collect", { amount: formatMoney(delivery.codAmount) })}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
