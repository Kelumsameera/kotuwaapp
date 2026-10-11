"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import { centsToInput, inputToCents } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import TranslatedInput from "@/components/ui/TranslatedInput";
import ImagePicker from "@/components/ui/ImagePicker";
import Alert from "@/components/ui/Alert";
import VariantsEditor, { emptyVariant } from "./VariantsEditor";

const MAX_IMAGES = 8;
const MONEY_FIELDS = ["price", "compareAtPrice", "costPrice"];

// Turns a product from the API into form values (money as rupee text).
function productToForm(product) {
  if (!product) {
    return { category: "", name: { en: "" }, description: { en: "" }, images: [], weightGrams: "0", variants: [emptyVariant()] };
  }
  return {
    category: product.category,
    name: product.name,
    description: product.description,
    images: product.images,
    weightGrams: String(product.weightGrams),
    variants: product.variants.map((variant) => ({
      _id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.options.size,
      color: variant.options.color,
      price: centsToInput(variant.price),
      compareAtPrice: centsToInput(variant.compareAtPrice),
      costPrice: centsToInput(variant.costPrice),
      stock: String(variant.stock),
    })),
  };
}

// Turns form values into the API body. Returns { body, errors }.
// errors lists money fields typed wrong, e.g. { "variants.0.price": moneyMessage }.
function formToBody(form, moneyMessage) {
  const errors = {};

  const variants = form.variants.map((variant, index) => {
    const result = { sku: variant.sku.trim(), barcode: variant.barcode.trim(), options: { size: variant.size, color: variant.color } };
    if (variant._id) result._id = variant._id;
    else result.stock = Number.parseInt(variant.stock, 10) || 0;

    for (const field of MONEY_FIELDS) {
      const cents = inputToCents(variant[field]);
      if (Number.isNaN(cents)) errors[`variants.${index}.${field}`] = moneyMessage;
      else if (cents !== null) result[field] = cents;
    }
    return result;
  });

  const body = {
    category: form.category,
    name: form.name,
    images: form.images,
    weightGrams: Number.parseInt(form.weightGrams, 10) || 0,
    variants,
  };
  if (form.description.en || form.description.si || form.description.ta) body.description = form.description;

  return { body, errors };
}

// Create or edit a product. onSaved(product) runs after a successful save.
export default function ProductForm({ product, onSaved }) {
  const t = useTranslations();
  const locale = useLocale();
  const isEditing = Boolean(product);
  const [form, setForm] = useState(() => productToForm(product));
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [localErrors, setLocalErrors] = useState({});
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    api("/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  const errors = { ...fieldErrors(error), ...localErrors };

  // Updates one form value.
  function setValue(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  // Saves the product.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);

    const { body, errors: moneyErrors } = formToBody(form, t("product.moneyFormat"));
    setLocalErrors(moneyErrors);
    if (Object.keys(moneyErrors).length > 0) return;

    setIsBusy(true);
    try {
      const path = isEditing ? `/seller/products/${product.id}` : "/seller/products";
      const data = await api(path, { method: isEditing ? "PATCH" : "POST", body });
      setIsSaved(true);
      onSaved?.(data.product);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  // Sub-categories are shown as "Parent › Child".
  const categoryOptions = categories.map((category) => {
    const parent = categories.find((candidate) => candidate.id === category.parent);
    const name = pickText(category.name, locale);
    return { value: category.id, label: parent ? `${pickText(parent.name, locale)} › ${name}` : name };
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {isSaved && <Alert type="success">{t("common.saved")}</Alert>}

      <TranslatedInput label={t("product.name")} value={form.name} onChange={(value) => setValue("name", value)} maxLength={150} error={errors["name.en"]} />
      <TranslatedInput
        label={t("product.description")}
        value={form.description}
        onChange={(value) => setValue("description", value)}
        multiline
        required={false}
        maxLength={5000}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t("product.category")}
          name="category"
          value={form.category}
          onChange={(e) => setValue("category", e.target.value)}
          placeholder={t("product.chooseCategory")}
          options={categoryOptions}
          error={errors.category}
        />
        <TextField
          label={t("product.weightGrams")}
          name="weightGrams"
          type="number"
          min={0}
          hint={t("product.weightHint")}
          value={form.weightGrams}
          onChange={(e) => setValue("weightGrams", e.target.value)}
          error={errors.weightGrams}
        />
      </div>

      <ImagePicker label={t("product.images")} images={form.images} onChange={(images) => setValue("images", images)} maxImages={MAX_IMAGES} />

      <VariantsEditor variants={form.variants} onChange={(variants) => setValue("variants", variants)} errors={errors} />

      <Button type="submit" isBusy={isBusy}>
        {isEditing ? t("common.save") : t("product.saveDraft")}
      </Button>
    </form>
  );
}
