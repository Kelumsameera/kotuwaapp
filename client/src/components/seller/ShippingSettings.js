"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { useMyShop } from "@/lib/useMyShop";
import { centsToInput, inputToCents } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TextField from "@/components/ui/TextField";
import ShippingRatesEditor from "@/components/shipping/ShippingRatesEditor";

// The shop's own free-delivery amount (empty = use the site's amount).
function FreeShippingForm({ shop, onSaved }) {
  const t = useTranslations();
  const [amount, setAmount] = useState(centsToInput(shop.freeShippingThreshold));
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Saves the amount on the shop.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);
    const cents = inputToCents(amount);
    if (Number.isNaN(cents)) {
      setError({ code: "VALIDATION_ERROR" });
      return;
    }
    setIsBusy(true);
    try {
      const data = await api("/seller/shop", { method: "PATCH", body: { freeShippingThreshold: cents } });
      onSaved(data.shop);
      setIsSaved(true);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <TextField
        label={t("settings.freeShipping")}
        name="freeShipping"
        inputMode="decimal"
        hint={t("sellerShipping.freeHint")}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-60"
      />
      <Button type="submit" variant="secondary" isBusy={isBusy}>
        {t("common.save")}
      </Button>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {isSaved && <Alert type="success">{t("common.saved")}</Alert>}
    </form>
  );
}

// Delivery rates page: free-delivery amount and the shop's own rates (they replace the site's defaults).
export default function ShippingSettings() {
  const t = useTranslations();
  const { shop, setShop, isLoading } = useMyShop();
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/seller/shipping-rates")
      .then((data) => setRates(data.rates))
      .catch((loadError) => setError(loadError));
  }, []);

  // Saves the shop's rates and returns the stored list.
  async function saveRates(newRates) {
    const data = await api("/seller/shipping-rates", { method: "PUT", body: { rates: newRates } });
    return data.rates;
  }

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (isLoading || !rates) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <Card title={t("sellerShipping.freeTitle")}>{shop && <FreeShippingForm shop={shop} onSaved={setShop} />}</Card>
      <Card title={t("sellerShipping.ratesTitle")}>
        {rates.length === 0 && <p className="mb-3 text-sm text-subtle">{t("sellerShipping.usingDefaults")}</p>}
        <ShippingRatesEditor initialRates={rates} onSave={saveRates} />
      </Card>
    </div>
  );
}
