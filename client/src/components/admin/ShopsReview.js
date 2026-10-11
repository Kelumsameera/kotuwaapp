"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import StatusBadge from "@/components/ui/StatusBadge";

const STATUSES = ["pending", "approved", "suspended", "rejected"];

// Admin list of shops with approve / suspend / reject buttons.
export default function ShopsReview() {
  const t = useTranslations();
  const [status, setStatus] = useState("pending");
  const { data, error, page, setPage, pageCount, reload } = usePagedList("/admin/shops", { status });
  const [actionError, setActionError] = useState(null);
  const [busyShopId, setBusyShopId] = useState(null);

  // Changes a shop's status. Suspend and reject ask for a reason the seller will see.
  async function changeStatus(shop, newStatus) {
    let reason;
    if (newStatus !== "approved") {
      reason = window.prompt(t("admin.reasonPrompt"));
      if (!reason) return;
    }

    setActionError(null);
    setBusyShopId(shop.id);
    try {
      await api(`/admin/shops/${shop.id}/status`, { method: "PATCH", body: { status: newStatus, reason } });
      reload();
    } catch (changeError) {
      setActionError(changeError);
    } finally {
      setBusyShopId(null);
    }
  }

  return (
    <div className="space-y-4">
      <select
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value);
        }}
        className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
        aria-label={t("admin.colStatus")}
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {t(`status.${value}`)}
          </option>
        ))}
      </select>

      {(error || actionError) && <Alert type="error">{errorMessage(error || actionError, t)}</Alert>}
      {data && data.shops.length === 0 && <p className="py-8 text-center text-subtle">{t("admin.noShops")}</p>}

      <ul className="space-y-3">
        {data?.shops.map((shop) => (
          <li key={shop.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{shop.name}</span>
              <StatusBadge status={shop.status} />
            </div>
            <p className="mt-1 text-sm text-subtle">
              {[shop.address.addressLine1, shop.address.city, shop.address.district].filter(Boolean).join(", ")} · {shop.phone}
            </p>
            {shop.statusReason && <p className="mt-1 text-sm text-red-600">{t("seller.reason", { reason: shop.statusReason })}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {shop.status !== "approved" && (
                <Button isBusy={busyShopId === shop.id} onClick={() => changeStatus(shop, "approved")}>
                  {t("admin.approve")}
                </Button>
              )}
              {shop.status === "pending" && (
                <Button variant="secondary" isBusy={busyShopId === shop.id} onClick={() => changeStatus(shop, "rejected")}>
                  {t("admin.reject")}
                </Button>
              )}
              {shop.status === "approved" && (
                <Button variant="danger" isBusy={busyShopId === shop.id} onClick={() => changeStatus(shop, "suspended")}>
                  {t("admin.suspend")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
