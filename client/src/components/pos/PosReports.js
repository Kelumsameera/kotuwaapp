"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Pager from "@/components/ui/Pager";
import Receipt from "./Receipt";
import TotalsCards from "./TotalsCards";

// Per-cashier totals as a table.
function CashierTable({ cashiers }) {
  const t = useTranslations();
  if (cashiers.length === 0) return <p className="text-sm text-subtle">{t("pos.noSales")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-subtle">
          <tr>
            <th className="py-1 font-medium">{t("pos.cashier")}</th>
            <th className="py-1 font-medium">{t("pos.salesCount")}</th>
            <th className="py-1 font-medium">{t("pos.cash")}</th>
            <th className="py-1 font-medium">{t("pos.card")}</th>
            <th className="py-1 font-medium">{t("pos.salesTotal")}</th>
            <th className="py-1 font-medium">{t("pos.voids")}</th>
          </tr>
        </thead>
        <tbody>
          {cashiers.map((row) => (
            <tr key={row.cashierId} className="border-t border-line text-ink">
              <td className="py-1.5">
                {row.name} <span className="text-xs text-subtle">({t(`roles.${row.role}`)})</span>
              </td>
              <td className="py-1.5">{row.completedCount}</td>
              <td className="py-1.5">{formatMoney(row.cash)}</td>
              <td className="py-1.5">{formatMoney(row.card)}</td>
              <td className="py-1.5 font-semibold">{formatMoney(row.total)}</td>
              <td className="py-1.5">{row.voidedCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The day's sales list with reprint and void (owner only).
function SalesList({ date }) {
  const t = useTranslations();
  const locale = useLocale();
  const { data, error, page, setPage, pageCount, reload } = usePagedList("/pos/sales", { date });
  const [receipt, setReceipt] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Opens a sale's receipt for reprinting.
  async function openReceipt(sale) {
    try {
      setReceipt(await api(`/pos/sales/${sale.id}`));
    } catch (openError) {
      setActionError(openError);
    }
  }

  // Cancels a sale after asking for the reason (stock goes back).
  async function voidSale(sale) {
    const reason = window.prompt(t("pos.voidPrompt"));
    if (!reason) return;
    try {
      await api(`/pos/sales/${sale.id}/void`, { method: "POST", body: { reason } });
      reload();
    } catch (voidError) {
      setActionError(voidError);
    }
  }

  return (
    <div className="space-y-3">
      {(error || actionError) && <Alert type="error">{errorMessage(error || actionError, t)}</Alert>}
      {data?.sales.length === 0 && <p className="text-sm text-subtle">{t("pos.noSales")}</p>}
      <ul className="divide-y divide-line text-sm">
        {data?.sales.map((sale) => (
          <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <span className="font-medium text-ink">{sale.billNumber}</span>{" "}
              <span className="text-subtle">
                · {formatDateTime(sale.completedAt, locale)} · {sale.cashier.name} · {t(`pos.${sale.payment?.method || "cash"}`)}
              </span>
              {sale.status === "voided" && <div className="text-xs text-red-600">{t("pos.voidedBecause", { reason: sale.voidReason })}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${sale.status === "voided" ? "text-subtle line-through" : "text-ink"}`}>{formatMoney(sale.total)}</span>
              <Button variant="secondary" className="min-h-9 px-3" onClick={() => openReceipt(sale)}>
                {t("pos.receipt")}
              </Button>
              {sale.status === "completed" && (
                <Button variant="danger" className="min-h-9 px-3" onClick={() => voidSale(sale)}>
                  {t("pos.void")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} onPageChange={setPage} />

      {receipt && (
        <Dialog title={t("pos.receipt")} onClose={() => setReceipt(null)}>
          <div className="mb-3 rounded-md border border-line">
            <Receipt sale={receipt.sale} shop={receipt.shop} />
          </div>
          <Button onClick={() => window.print()} className="w-full">
            🖨 {t("pos.print")}
          </Button>
        </Dialog>
      )}
    </div>
  );
}

// Owner reports: pick a day for totals, best sellers, hours and cashiers; or a date range per cashier.
export default function PosReports({ today }) {
  const t = useTranslations();
  const locale = useLocale();
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [daily, setDaily] = useState(null);
  const [range, setRange] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    api(`/pos/reports/daily?date=${date}`)
      .then((data) => {
        if (!isCancelled) setDaily(data.report);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });
    return () => {
      isCancelled = true;
    };
  }, [date]);

  // Loads the per-cashier report for the chosen dates.
  async function loadRange(event) {
    event.preventDefault();
    try {
      setRange((await api(`/pos/reports/cashiers?from=${from}&to=${to}`)).report);
    } catch (loadError) {
      setError(loadError);
    }
  }

  const dateInput = "min-h-10 rounded-md border border-line bg-surface px-2 text-ink";

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      <label className="flex items-center gap-2 text-sm text-ink">
        {t("pos.day")}
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={dateInput} />
      </label>

      {daily && (
        <>
          <TotalsCards totals={daily.totals} />
          <div className="grid gap-6 md:grid-cols-2">
            <Card title={t("pos.topItems")}>
              {daily.topItems.length === 0 ? (
                <p className="text-sm text-subtle">{t("pos.noSales")}</p>
              ) : (
                <ul className="text-sm">
                  {daily.topItems.map((item) => (
                    <li key={item.variantId} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate text-ink">
                        {pickText(item.name, locale)} <span className="text-subtle">{item.sku}</span>
                      </span>
                      <span className="whitespace-nowrap text-ink">
                        {item.quantity} · {formatMoney(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={t("pos.byHour")}>
              {daily.byHour.length === 0 ? (
                <p className="text-sm text-subtle">{t("pos.noSales")}</p>
              ) : (
                <ul className="text-sm">
                  {daily.byHour.map((row) => (
                    <li key={row.hour} className="flex justify-between py-0.5 text-ink">
                      <span>{`${String(row.hour).padStart(2, "0")}:00`}</span>
                      <span>
                        {row.count} · {formatMoney(row.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card title={t("pos.byCashier")}>
            <CashierTable cashiers={daily.cashiers} />
          </Card>
          <Card title={t("pos.salesList")}>
            <SalesList date={date} />
          </Card>
        </>
      )}

      <Card title={t("pos.cashierReport")}>
        <form onSubmit={loadRange} className="mb-4 flex flex-wrap items-end gap-2 text-sm text-ink">
          <label>
            {t("pos.from")}
            <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={`${dateInput} block`} />
          </label>
          <label>
            {t("pos.to")}
            <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className={`${dateInput} block`} />
          </label>
          <Button type="submit" variant="secondary">
            {t("pos.show")}
          </Button>
        </form>
        {range && <CashierTable cashiers={range.cashiers} />}
      </Card>
    </div>
  );
}
