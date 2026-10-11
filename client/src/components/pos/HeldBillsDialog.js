"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";

// The shop's parked bills: resume one into the screen, or delete it.
export default function HeldBillsDialog({ onResume, onClose }) {
  const t = useTranslations();
  const locale = useLocale();
  const [held, setHeld] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/pos/held")
      .then((data) => setHeld(data.held))
      .catch((loadError) => setError(loadError));
  }, []);

  // Deletes a held bill (the customer left).
  async function remove(bill) {
    if (!window.confirm(t("pos.confirmDeleteHeld"))) return;
    try {
      await api(`/pos/held/${bill.id}`, { method: "DELETE" });
      setHeld((current) => current.filter((candidate) => candidate.id !== bill.id));
    } catch (removeError) {
      setError(removeError);
    }
  }

  return (
    <Dialog title={t("pos.heldBills")} onClose={onClose} wide>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {held?.length === 0 && <p className="text-sm text-subtle">{t("pos.noHeld")}</p>}
      <ul className="divide-y divide-line">
        {held?.map((bill) => (
          <li key={bill.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <div className="font-medium text-ink">{bill.heldLabel || t("pos.unnamedBill")}</div>
              <div className="text-sm text-subtle">
                {formatDateTime(bill.createdAt, locale)} · {bill.cashier?.name} · {t("pos.itemCount", { count: bill.items.length })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">{formatMoney(bill.total)}</span>
              <Button onClick={() => onResume(bill)}>{t("pos.resume")}</Button>
              <Button variant="secondary" onClick={() => remove(bill)}>
                {t("product.delete")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
