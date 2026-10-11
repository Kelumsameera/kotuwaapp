"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { usePagedList } from "@/lib/usePagedList";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";

const STATUSES = ["requested", "approved", "paid", "rejected"];

// Admin: payout requests. Approve → send the bank transfer → mark paid with its reference.
export default function PayoutsReview() {
  const t = useTranslations();
  const locale = useLocale();
  const [status, setStatus] = useState("requested");
  const { data, error, page, setPage, pageCount, reload } = usePagedList("/admin/payouts", { status });
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Runs one review action. Reject asks for a reason; "mark paid" asks for the bank reference.
  async function review(payout, action) {
    const body = { action };
    if (action === "reject") {
      body.note = window.prompt(t("admin.reasonPrompt"));
      if (!body.note) return;
    }
    if (action === "mark_paid") {
      body.reference = window.prompt(t("payouts.referencePrompt"));
      if (!body.reference) return;
    }

    setActionError(null);
    setBusyId(payout.id);
    try {
      await api(`/admin/payouts/${payout.id}`, { method: "PATCH", body });
      reload();
    } catch (reviewError) {
      setActionError(reviewError);
    } finally {
      setBusyId(null);
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
            {t(`payoutStatus.${value}`)}
          </option>
        ))}
      </select>

      {(error || actionError) && <Alert type="error">{errorMessage(error || actionError, t)}</Alert>}
      {data?.payouts.length === 0 && <p className="py-8 text-center text-subtle">{t("earnings.noPayouts")}</p>}

      <ul className="space-y-3">
        {data?.payouts.map((payout) => (
          <li key={payout.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">{payout.shop?.name}</span>
              <span className="text-lg font-semibold text-ink">{formatMoney(payout.amount)}</span>
            </div>
            <div className="text-sm text-subtle">
              {formatDate(payout.createdAt, locale)} · {t("payouts.earningsCount", { count: payout.earningsCount })}
            </div>
            <div className="mt-2 rounded-md bg-muted p-2 text-sm text-ink">
              {payout.bank.bankName}
              {payout.bank.branch && ` (${payout.bank.branch})`} · {payout.bank.accountName} · <span className="font-mono">{payout.bank.accountNumber}</span>
            </div>
            {payout.reference && <div className="mt-1 text-sm text-subtle">{t("earnings.reference", { reference: payout.reference })}</div>}
            {payout.note && <div className="mt-1 text-sm text-subtle">{payout.note}</div>}

            <div className="mt-3 flex flex-wrap gap-2">
              {payout.status === "requested" && (
                <Button isBusy={busyId === payout.id} onClick={() => review(payout, "approve")}>
                  {t("admin.approve")}
                </Button>
              )}
              {payout.status === "approved" && (
                <Button isBusy={busyId === payout.id} onClick={() => review(payout, "mark_paid")}>
                  {t("payouts.markPaid")}
                </Button>
              )}
              {["requested", "approved"].includes(payout.status) && (
                <Button variant="secondary" isBusy={busyId === payout.id} onClick={() => review(payout, "reject")}>
                  {t("admin.reject")}
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
