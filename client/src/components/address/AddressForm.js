"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { errorMessage, fieldErrors } from "@/lib/apiClient";
import { useDistricts } from "@/lib/useDistricts";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import TextField from "@/components/ui/TextField";

const EMPTY = { fullName: "", phone: "", addressLine1: "", addressLine2: "", city: "", district: "", postalCode: "", isDefault: false };

// A Sri Lanka address form: name, phone, street, district (dropdown), city (suggestions), postal code.
// onSave(body) must return a promise; errors from it are shown in the form.
export default function AddressForm({ initial, onSave, onCancel, submitLabel }) {
  const t = useTranslations();
  const locale = useLocale();
  const districts = useDistricts();
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const errors = fieldErrors(error);
  const selectedDistrict = districts.find((district) => district.key === form.district);

  // Updates one field.
  function setValue(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  // When a known city is typed, fill in its postal code.
  function changeCity(value) {
    const knownCity = selectedDistrict?.cities.find((city) => city.name.en.toLowerCase() === value.toLowerCase());
    setForm((current) => ({ ...current, city: value, postalCode: knownCity?.postalCode || current.postalCode }));
  }

  // Sends the address to the parent's save function.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      // id and province are not sent: the URL names the address and the server sets the province.
      const { id, province, ...body } = form;
      await onSave(body);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("address.fullName")} name="fullName" autoComplete="name" value={form.fullName} onChange={(e) => setValue("fullName", e.target.value)} error={errors.fullName} />
        <TextField label={t("auth.phone")} name="phone" type="tel" autoComplete="tel" hint={t("auth.phoneHint")} value={form.phone} onChange={(e) => setValue("phone", e.target.value)} error={errors.phone} />
      </div>
      <TextField label={t("address.line1")} name="addressLine1" autoComplete="address-line1" value={form.addressLine1} onChange={(e) => setValue("addressLine1", e.target.value)} error={errors.addressLine1} />
      <TextField label={`${t("address.line2")} (${t("common.optional")})`} name="addressLine2" autoComplete="address-line2" value={form.addressLine2} onChange={(e) => setValue("addressLine2", e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={t("address.district")}
          name="district"
          value={form.district}
          onChange={(e) => setValue("district", e.target.value)}
          placeholder={t("address.chooseDistrict")}
          options={districts.map((district) => ({ value: district.key, label: pickText(district.name, locale) }))}
          error={errors.district}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">{t("address.city")}</span>
          <input
            list="address-city-options"
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => changeCity(e.target.value)}
            className={`block min-h-11 w-full rounded-md border bg-surface px-3 text-base text-ink outline-none focus:ring-2 focus:ring-brand ${errors.city ? "border-red-500" : "border-line"}`}
          />
          <datalist id="address-city-options">
            {(selectedDistrict?.cities || []).map((city) => (
              <option key={city.name.en} value={city.name.en} />
            ))}
          </datalist>
          {errors.city && <span className="mt-1 block text-xs text-red-600">{errors.city}</span>}
        </label>
        <TextField label={t("address.postalCode")} name="postalCode" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={(e) => setValue("postalCode", e.target.value)} error={errors.postalCode} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setValue("isDefault", e.target.checked)} />
        {t("address.makeDefault")}
      </label>
      <div className="flex gap-2">
        <Button type="submit" isBusy={isBusy}>
          {submitLabel || t("common.save")}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
