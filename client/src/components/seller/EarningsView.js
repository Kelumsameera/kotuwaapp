"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { useMyShop } from "@/lib/useMyShop";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pager from "@/components/ui/Pager";
import TextField from "@/components/ui/TextField";

const PAYOUT_COLORS = {
  requested: "text-amber-700 dark:text-amber-400",
  approved: "text-blue-700 dark:text-blue-400",
  paid: "text-green-700 dark:text-green-400",
  rejected: "text-red-600",
};

// The bank account payouts are sent to. Every change is recorded in the admin's audit log.
function BankDetailsForm({ shop, onSaved }) {
  const t = useTranslations();
  const [form, setForm] = useState(shop.bankDetails);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const errors = fieldErrors(error);
  const set = (name) => (event) => setForm({ ...form, [name]: event.target.value });

  // Saves the bank details on the shop.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);
    setIsBusy(true);
    try {
      const data = await api("/seller/shop", { method: "PATCH", body: { bankDetails: form } });
      onSaved(data.shop);
      setIsSaved(true);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {isSaved && <Alert type="success">{t("common.saved")}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("earnings.bankName")} name="bankName" value={form.bankName} onChange={set("bankName")} error={errors["bankDetails.bankName"]} />
        <TextField label={`${t("earnings.branch")} (${t("common.optional")})`} name="branch" value={form.branch} onChange={set("branch")} />
        <TextField label={t("earnings.accountName")} name="accountName" value={form.accountName} onChange={set("accountName")} error={errors["bankDetails.accountName"]} />
        <TextField label={t("earnings.accountNumber")} name="accountNumber" inputMode="numeric" value={form.accountNumber} onChange={set("accountNumber")} error={errors["bankDetails.accountNumber"]} />
      </div>
      <Button type="submit" variant="secondary" isBusy={isBusy}>
        {t("common.save")}
      </Button>
    </form>
  );
}

// Earnings page: totals, bank details, payout request, payout history and every earning.
export default function EarningsView() {
  const t = useTranslations();
  const locale = useLocale();
  const { shop, setShop } = useMyShop();
  const [status, setStatus] = useState("");
  const earnings = usePagedList("/seller/earnings", { status });
  const payouts = usePagedList("/seller/payouts", {}, 10);
  const [requestError, setRequestError] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestedNote, setRequestedNote] = useState("");

  const summary = earnings.data?.summary;
  const hasOpenPayout = payouts.data?.payouts.some((payout) => ["requested", "approved"].includes(payout.status));

  // Asks the admin to pay out all available earnings.
  async function requestPayout() {
    setRequestError(null);
    setIsRequesting(true);
    try {
      const data = await api("/seller/payouts", { method: "POST" });
      setRequestedNote(t("earnings.requested", { amount: formatMoney(data.payout.amount) }));
      earnings.reload();
      payouts.reload();
    } catch (error) {
      setRequestError(error);
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["available", "pending", "inPayout", "paid"].map((key) => (
            <div key={key} className="rounded-lg border border-line bg-surface p-4">
              <div className="text-xl font-semibold text-ink">{formatMoney(summary[key])}</div>
              <div className="text-sm text-subtle">{t(`earnings.${key}`)}</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-subtle">{t("earnings.howItWorks")}</p>

      <Card title={t("earnings.requestTitle")}>
        {requestError && <Alert type="error">{errorMessage(requestError, t)}</Alert>}
        {requestedNote && <Alert type="success">{requestedNote}</Alert>}
        <p className="mb-3 text-sm text-subtle">{t("earnings.minimum", { amount: formatMoney(earnings.data?.minPayout) })}</p>
        <Button
          onClick={requestPayout}
          isBusy={isRequesting}
          disabled={!summary || summary.available < earnings.data.minPayout || !earnings.data.hasBankDetails || hasOpenPayout}
        >
          {t("earnings.requestButton", { amount: formatMoney(summary?.available || 0) })}
        </Button>
        {earnings.data && !earnings.data.hasBankDetails && <p className="mt-2 text-sm text-red-600">{t("errors.BANK_DETAILS_REQUIRED")}</p>}
        {hasOpenPayout && <p className="mt-2 text-sm text-subtle">{t("errors.PAYOUT_OPEN")}</p>}
      </Card>

      {shop && (
        <Card title={t("earnings.bankTitle")}>
          <BankDetailsForm
            shop={shop}
            onSaved={(saved) => {
              setShop(saved);
              earnings.reload();
            }}
          />
        </Card>
      )}

      <Card title={t("earnings.payoutHistory")}>
        {payouts.data?.payouts.length === 0 && <p className="text-sm text-subtle">{t("earnings.noPayouts")}</p>}
        <ul className="divide-y divide-line text-sm">
          {payouts.data?.payouts.map((payout) => (
            <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-subtle">{formatDate(payout.createdAt, locale)}</span>
              <span className="font-medium text-ink">{formatMoney(payout.amount)}</span>
              <span className={PAYOUT_COLORS[payout.status]}>{t(`payoutStatus.${payout.status}`)}</span>
              <span className="w-full text-xs text-subtle">
                {payout.bank.bankName} {payout.bank.accountNumber}
                {payout.reference && ` · ${t("earnings.reference", { reference: payout.reference })}`}
                {payout.note && ` · ${payout.note}`}
              </span>
            </li>
          ))}
        </ul>
        <Pager page={payouts.page} pageCount={payouts.pageCount} onPageChange={payouts.setPage} />
      </Card>

      <Card title={t("earnings.listTitle")}>
        <select
          value={status}
          onChange={(e) => {
            earnings.setPage(1);
            setStatus(e.target.value);
          }}
          className="mb-3 min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          aria-label={t("product.status")}
        >
          <option value="">{t("product.allStatuses")}</option>
          {["pending", "available", "paid", "reversed"].map((value) => (
            <option key={value} value={value}>
              {t(`earningStatus.${value}`)}
            </option>
          ))}
        </select>
        {earnings.error && <Alert type="error">{errorMessage(earnings.error, t)}</Alert>}
        {earnings.data?.earnings.length === 0 && <p className="text-sm text-subtle">{t("earnings.none")}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-subtle">
              <tr>
                <th className="py-1 font-medium">{t("earnings.order")}</th>
                <th className="py-1 font-medium">{t("earnings.gross")}</th>
                <th className="py-1 font-medium">{t("sellerOrders.commission")}</th>
                <th className="py-1 font-medium">{t("earnings.net")}</th>
                <th className="py-1 font-medium">{t("product.status")}</th>
              </tr>
            </thead>
            <tbody>
              {earnings.data?.earnings.map((earning) => (
                <tr key={earning.id} className="border-t border-line text-ink">
                  <td className="py-1.5">{earning.subOrderNumber}</td>
                  <td className="py-1.5">{formatMoney(earning.gross)}</td>
                  <td className="py-1.5">− {formatMoney(earning.commission)}</td>
                  <td className="py-1.5 font-medium">{formatMoney(earning.net)}</td>
                  <td className="py-1.5 text-subtle">
                    {t(`earningStatus.${earning.status}`)}
                    {earning.status === "pending" && ` · ${t("earnings.releaseOn", { date: formatDate(earning.releaseAt, locale) })}`}
                    {earning.inPayout && earning.status === "available" && ` · ${t("earnings.inPayout")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={earnings.page} pageCount={earnings.pageCount} onPageChange={earnings.setPage} />
      </Card>
    </div>
  );
}
