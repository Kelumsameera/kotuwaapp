"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import { useDistricts } from "@/lib/useDistricts";
import { pickText } from "@/lib/pickText";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import TranslatedInput from "@/components/ui/TranslatedInput";
import ImagePicker from "@/components/ui/ImagePicker";
import Alert from "@/components/ui/Alert";

// Turns a shop from the API into form values.
function shopToForm(shop) {
  return {
    name: shop?.name || "",
    phone: shop?.phone || "",
    description: shop?.description || { en: "" },
    addressLine1: shop?.address?.addressLine1 || "",
    city: shop?.address?.city || "",
    district: shop?.address?.district || "",
    postalCode: shop?.address?.postalCode || "",
    logo: shop?.logo ? [shop.logo] : [],
    banner: shop?.banner ? [shop.banner] : [],
    lowStockThreshold: String(shop?.lowStockThreshold ?? 5),
    cashierMaxDiscountPercent: String(shop?.cashierMaxDiscountPercent ?? 10),
    deliveryMethods: shop?.deliveryMethods || { selfDelivery: true, courier: true },
  };
}

// Turns form values into the API body. Images and threshold only exist once the shop exists.
function formToBody(form, isEditing) {
  const body = {
    name: form.name,
    phone: form.phone,
    address: {
      addressLine1: form.addressLine1,
      city: form.city,
      district: form.district,
      postalCode: form.postalCode,
    },
  };
  if (form.description.en || form.description.si || form.description.ta) body.description = form.description;
  if (isEditing) {
    body.logo = form.logo[0] || null;
    body.banner = form.banner[0] || null;
    body.lowStockThreshold = Number(form.lowStockThreshold) || 0;
    body.cashierMaxDiscountPercent = Math.min(100, Math.max(0, Number.parseInt(form.cashierMaxDiscountPercent, 10) || 0));
    body.deliveryMethods = form.deliveryMethods;
  }
  return body;
}

// Form to open a new shop (shop = null) or edit an existing one.
export default function ShopForm({ shop, onSaved }) {
  const t = useTranslations();
  const locale = useLocale();
  const districts = useDistricts();
  const isEditing = Boolean(shop);
  const [form, setForm] = useState(() => shopToForm(shop));
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const errors = fieldErrors(error);
  const selectedDistrict = districts.find((district) => district.key === form.district);

  // Updates one form value.
  function setValue(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  // When a known city is typed, fill in its postal code.
  function changeCity(value) {
    const knownCity = selectedDistrict?.cities.find((city) => city.name.en.toLowerCase() === value.toLowerCase());
    setForm((current) => ({ ...current, city: value, postalCode: knownCity?.postalCode || current.postalCode }));
  }

  // Saves the shop.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);
    setIsBusy(true);
    try {
      const data = await api("/seller/shop", { method: isEditing ? "PATCH" : "POST", body: formToBody(form, isEditing) });
      setIsSaved(true);
      onSaved?.(data.shop);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {isSaved && <Alert type="success">{t("common.saved")}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("shop.name")} name="name" required value={form.name} onChange={(e) => setValue("name", e.target.value)} error={errors.name} />
        <TextField label={t("auth.phone")} name="phone" type="tel" hint={t("auth.phoneHint")} value={form.phone} onChange={(e) => setValue("phone", e.target.value)} error={errors.phone} />
      </div>

      <TranslatedInput
        label={t("shop.description")}
        value={form.description}
        onChange={(value) => setValue("description", value)}
        multiline
        required={false}
        maxLength={2000}
      />

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-ink">{t("shop.address")}</legend>
        <TextField label={t("address.line1")} name="addressLine1" value={form.addressLine1} onChange={(e) => setValue("addressLine1", e.target.value)} error={errors["address.addressLine1"]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label={t("address.district")}
            name="district"
            value={form.district}
            onChange={(e) => setValue("district", e.target.value)}
            placeholder={t("address.chooseDistrict")}
            options={districts.map((district) => ({ value: district.key, label: pickText(district.name, locale) }))}
            error={errors["address.district"]}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">{t("address.city")}</span>
            <input
              list="shop-city-options"
              value={form.city}
              onChange={(e) => changeCity(e.target.value)}
              className="block min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink outline-none focus:ring-2 focus:ring-brand"
            />
            <datalist id="shop-city-options">
              {(selectedDistrict?.cities || []).map((city) => (
                <option key={city.name.en} value={city.name.en} />
              ))}
            </datalist>
            {errors["address.city"] && <span className="mt-1 block text-xs text-red-600">{errors["address.city"]}</span>}
          </label>
          <TextField label={t("address.postalCode")} name="postalCode" inputMode="numeric" value={form.postalCode} onChange={(e) => setValue("postalCode", e.target.value)} error={errors["address.postalCode"]} />
        </div>
      </fieldset>

      {isEditing && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImagePicker label={t("shop.logo")} images={form.logo} onChange={(images) => setValue("logo", images)} />
            <ImagePicker label={t("shop.banner")} images={form.banner} onChange={(images) => setValue("banner", images)} />
          </div>
          <TextField
            label={t("shop.lowStockThreshold")}
            name="lowStockThreshold"
            type="number"
            min={0}
            hint={t("shop.lowStockHint")}
            value={form.lowStockThreshold}
            onChange={(e) => setValue("lowStockThreshold", e.target.value)}
            className="max-w-xs"
          />
          <TextField
            label={t("shop.cashierMaxDiscount")}
            name="cashierMaxDiscountPercent"
            type="number"
            min={0}
            max={100}
            hint={t("shop.cashierMaxDiscountHint")}
            value={form.cashierMaxDiscountPercent}
            onChange={(e) => setValue("cashierMaxDiscountPercent", e.target.value)}
            className="max-w-xs"
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t("delivery.shopMethods")}</legend>
            {["selfDelivery", "courier"].map((method) => (
              <label key={method} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.deliveryMethods[method]}
                  onChange={(e) => setValue("deliveryMethods", { ...form.deliveryMethods, [method]: e.target.checked })}
                />
                {t(`settings.${method}`)}
              </label>
            ))}
          </fieldset>
        </>
      )}

      <Button type="submit" isBusy={isBusy}>
        {isEditing ? t("common.save") : t("shop.open")}
      </Button>
    </form>
  );
}
