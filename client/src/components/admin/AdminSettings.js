"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TextField from "@/components/ui/TextField";
import ShippingRatesEditor from "@/components/shipping/ShippingRatesEditor";

// Free shipping amount, return period and allowed delivery methods.
function GeneralSettingsForm({ settings, onSaved }) {
  const t = useTranslations();
  const [freeShipping, setFreeShipping] = useState(centsToInput(settings.freeShippingThreshold));
  const [returnDays, setReturnDays] = useState(String(settings.returnPeriodDays));
  const [methods, setMethods] = useState(settings.deliveryMethods);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Saves the settings. An empty free-shipping box means "no free shipping".
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);
    const threshold = inputToCents(freeShipping);
    if (Number.isNaN(threshold)) {
      setError({ code: "VALIDATION_ERROR" });
      return;
    }

    setIsBusy(true);
    try {
      const data = await api("/admin/settings", {
        method: "PATCH",
        body: { freeShippingThreshold: threshold, returnPeriodDays: Number.parseInt(returnDays, 10) || 0, deliveryMethods: methods },
      });
      onSaved(data.settings);
      setIsSaved(true);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {isSaved && <Alert type="success">{t("common.saved")}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("settings.freeShipping")} name="freeShipping" inputMode="decimal" hint={t("settings.freeShippingHint")} value={freeShipping} onChange={(e) => setFreeShipping(e.target.value)} />
        <TextField label={t("settings.returnDays")} name="returnDays" type="number" min={0} max={60} hint={t("settings.returnDaysHint")} value={returnDays} onChange={(e) => setReturnDays(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{t("settings.deliveryMethods")}</legend>
        {["selfDelivery", "courier"].map((method) => (
          <label key={method} className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={methods[method]} onChange={(e) => setMethods({ ...methods, [method]: e.target.checked })} />
            {t(`settings.${method}`)}
          </label>
        ))}
      </fieldset>
      <Button type="submit" isBusy={isBusy}>
        {t("common.save")}
      </Button>
    </form>
  );
}

// Admin settings page: general settings plus the default delivery rates for all shops.
export default function AdminSettings() {
  const t = useTranslations();
  const [settings, setSettings] = useState(null);
  const [rates, setRates] = useState(null);
  const [fallback, setFallback] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api("/admin/settings"), api("/admin/shipping-rates")])
      .then(([settingsData, ratesData]) => {
        setSettings(settingsData.settings);
        setRates(ratesData.rates);
        setFallback(ratesData.fallback);
      })
      .catch((loadError) => setError(loadError));
  }, []);

  // Saves the default rates and returns the stored list.
  async function saveRates(newRates) {
    const data = await api("/admin/shipping-rates", { method: "PUT", body: { rates: newRates } });
    return data.rates;
  }

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!settings) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <Card title={t("settings.general")}>
        <GeneralSettingsForm settings={settings} onSaved={setSettings} />
      </Card>
      <Card title={t("shipping.defaultRates")}>
        {rates.length === 0 && fallback && (
          <p className="mb-3 text-sm text-subtle">
            {t("shipping.usingFallback", { first: formatMoney(fallback.baseFee), extra: formatMoney(fallback.extraPerKg) })}
          </p>
        )}
        <ShippingRatesEditor initialRates={rates} onSave={saveRates} />
      </Card>
    </div>
  );
}
