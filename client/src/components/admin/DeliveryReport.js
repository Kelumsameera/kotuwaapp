"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

const PERIODS = [7, 30, 90];

// One big number with a label.
function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-sm text-subtle">{label}</div>
    </div>
  );
}

// Admin: how deliveries are going, cash still to collect, and each rider's numbers.
export default function DeliveryReport() {
  const t = useTranslations();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    api(`/admin/deliveries-report?days=${days}`)
      .then((result) => {
        if (!isCancelled) setData(result);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });
    return () => {
      isCancelled = true;
    };
  }, [days]);

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!data) return <p className="text-subtle">{t("common.loading")}</p>;
  const { report, cod } = data;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setDays(period)}
            className={`rounded-md px-3 py-1.5 text-sm ${days === period ? "bg-brand text-white" : "border border-line text-ink"}`}
          >
            {t("adminDelivery.lastDays", { days: period })}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("adminDelivery.orders")} value={report.totalOrders} />
        <Stat label={t("adminDelivery.delivered")} value={report.deliveredCount} />
        <Stat label={t("adminDelivery.avgHours")} value={report.averageHoursToDeliver} />
        <Stat label={t("adminDelivery.firstAttempt")} value={`${report.firstAttemptSuccessPercent}%`} />
        <Stat label={t("adminDelivery.withProof")} value={`${report.proofPercent}%`} />
        <Stat label={t("adminDelivery.delayedNow")} value={report.delayedNow} />
        <Stat label={t("delivery.codPending")} value={formatMoney(cod.total)} />
        <Stat label={t("adminDelivery.deliveredNotCollected")} value={formatMoney(cod.deliveredNotCollected.amount)} />
      </div>

      <Card title={t("adminDelivery.byStatus")}>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(report.byStatus).map(([status, count]) => (
            <li key={status} className="flex justify-between">
              <span className="text-subtle">{t(`orderStatus.${status}`)}</span>
              <span className="text-ink">{count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t("adminDelivery.riders")}>
        {report.riders.length === 0 ? (
          <p className="text-sm text-subtle">{t("adminDelivery.noRiderData")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>
                <th className="py-1 font-medium">{t("admin.colName")}</th>
                <th className="py-1 font-medium">{t("adminDelivery.assigned")}</th>
                <th className="py-1 font-medium">{t("adminDelivery.delivered")}</th>
                <th className="py-1 font-medium">{t("adminDelivery.failedAttempts")}</th>
              </tr>
            </thead>
            <tbody>
              {report.riders.map((rider) => (
                <tr key={rider.id} className="border-t border-line text-ink">
                  <td className="py-1">{rider.name}</td>
                  <td className="py-1">{rider.assigned}</td>
                  <td className="py-1">{rider.delivered}</td>
                  <td className="py-1">{rider.failedAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
