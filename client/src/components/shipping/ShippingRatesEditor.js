"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { centsToInput, inputToCents } from "@/lib/money";
import { useDistricts } from "@/lib/useDistricts";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

// Turns API rates (cents) into editable rows (rupee text).
function ratesToRows(rates) {
  return rates.map((rate) => ({ district: rate.district || "", baseFee: centsToInput(rate.baseFee), extraPerKg: centsToInput(rate.extraPerKg) }));
}

// Edits a list of delivery rates: one default row ("All other districts") plus any district rows.
// onSave(rates) receives rates in cents and must return the saved rates.
export default function ShippingRatesEditor({ initialRates, onSave }) {
  const t = useTranslations();
  const locale = useLocale();
  const districts = useDistricts();
  const [rows, setRows] = useState(() => ratesToRows(initialRates));
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Updates one field of one row.
  function updateRow(index, field, value) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  // Converts the rows to cents and saves them.
  async function save() {
    setError(null);
    setIsSaved(false);
    const rates = rows.map((row) => ({
      district: row.district || null,
      baseFee: inputToCents(row.baseFee) ?? 0,
      extraPerKg: inputToCents(row.extraPerKg) ?? 0,
    }));
    if (rates.some((rate) => Number.isNaN(rate.baseFee) || Number.isNaN(rate.extraPerKg))) {
      setError({ code: "VALIDATION_ERROR" });
      return;
    }

    setIsBusy(true);
    try {
      const saved = await onSave(rates);
      setRows(ratesToRows(saved));
      setIsSaved(true);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  const input = "min-h-10 w-full rounded border border-line bg-surface px-2 text-sm text-ink";

  return (
    <div className="space-y-3">
      <p className="text-sm text-subtle">{t("shipping.ratesHelp")}</p>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {isSaved && <Alert type="success">{t("common.saved")}</Alert>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-subtle">
            <tr>
              <th className="py-1 pr-2 font-medium">{t("address.district")}</th>
              <th className="py-1 pr-2 font-medium">{t("shipping.firstKg")}</th>
              <th className="py-1 pr-2 font-medium">{t("shipping.extraKg")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="py-1 pr-2">
                  <select value={row.district} onChange={(e) => updateRow(index, "district", e.target.value)} className={input} aria-label={t("address.district")}>
                    <option value="">{t("shipping.allOtherDistricts")}</option>
                    {districts.map((district) => (
                      <option key={district.key} value={district.key}>
                        {pickText(district.name, locale)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input inputMode="decimal" value={row.baseFee} onChange={(e) => updateRow(index, "baseFee", e.target.value)} className={input} aria-label={t("shipping.firstKg")} />
                </td>
                <td className="py-1 pr-2">
                  <input inputMode="decimal" value={row.extraPerKg} onChange={(e) => updateRow(index, "extraPerKg", e.target.value)} className={input} aria-label={t("shipping.extraKg")} />
                </td>
                <td className="py-1">
                  <button type="button" onClick={() => setRows(rows.filter((unused, i) => i !== index))} className="text-xs text-red-600 hover:underline">
                    {t("product.removeVariant")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setRows([...rows, { district: "", baseFee: "", extraPerKg: "" }])}>
          + {t("shipping.addRate")}
        </Button>
        <Button type="button" isBusy={isBusy} onClick={save}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
