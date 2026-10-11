"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoney, inputToCents } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";

// Quick cash buttons in rupees (common Sri Lankan notes).
const QUICK_NOTES = [1000, 2000, 5000];

// Payment: cash (with change) or card (with an optional reference). Enter confirms.
export default function PayDialog({ total, onPay, onClose, isBusy, error }) {
  const t = useTranslations("pos");
  const [method, setMethod] = useState("cash");
  const [cashText, setCashText] = useState("");
  const [cardReference, setCardReference] = useState("");

  const cashReceived = cashText === "" ? total : inputToCents(cashText);
  const cashIsValid = Number.isFinite(cashReceived) && cashReceived >= total;
  const change = cashIsValid ? cashReceived - total : 0;

  // Sends the payment to the screen, which completes the sale.
  function confirm(event) {
    event.preventDefault();
    if (method === "cash") {
      if (!cashIsValid) return;
      onPay({ method: "cash", cashReceived });
    } else {
      onPay({ method: "card", cardReference: cardReference || undefined });
    }
  }

  const tabClass = (isActive) =>
    `flex-1 rounded-md py-3 text-base font-medium ${isActive ? "bg-brand text-white" : "border border-line text-ink"}`;

  return (
    <Dialog title={t("pay")} onClose={onClose}>
      <form onSubmit={confirm} className="space-y-4">
        <div className="text-center text-3xl font-bold text-ink">{formatMoney(total)}</div>
        <div className="flex gap-2">
          <button type="button" className={tabClass(method === "cash")} onClick={() => setMethod("cash")}>
            💵 {t("cash")}
          </button>
          <button type="button" className={tabClass(method === "card")} onClick={() => setMethod("card")}>
            💳 {t("card")}
          </button>
        </div>

        {method === "cash" ? (
          <div className="space-y-3">
            <label className="block text-sm text-ink">
              {t("cashReceived")} (Rs)
              <input
                autoFocus
                inputMode="decimal"
                value={cashText}
                onChange={(e) => setCashText(e.target.value)}
                placeholder={String(total / 100)}
                className="mt-1 block min-h-12 w-full rounded-md border border-line bg-surface px-3 text-xl text-ink"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_NOTES.map((note) => (
                <button key={note} type="button" onClick={() => setCashText(String(note))} className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-muted">
                  Rs {note.toLocaleString("en-LK")}
                </button>
              ))}
              <button type="button" onClick={() => setCashText("")} className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-muted">
                {t("exact")}
              </button>
            </div>
            <div className={`rounded-md p-3 text-center text-xl font-semibold ${cashIsValid ? "bg-muted text-ink" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
              {cashIsValid ? `${t("change")}: ${formatMoney(change)}` : t("notEnoughCash")}
            </div>
          </div>
        ) : (
          <label className="block text-sm text-ink">
            {t("cardReference")} ({t("optional")})
            <input
              autoFocus
              value={cardReference}
              onChange={(e) => setCardReference(e.target.value)}
              maxLength={60}
              className="mt-1 block min-h-12 w-full rounded-md border border-line bg-surface px-3 text-ink"
            />
          </label>
        )}

        {error && <Alert type="error">{error}</Alert>}
        <Button type="submit" isBusy={isBusy} disabled={method === "cash" && !cashIsValid} className="min-h-12 w-full text-base">
          {t("completeSale")} (Enter)
        </Button>
      </form>
    </Dialog>
  );
}
