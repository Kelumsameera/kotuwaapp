"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SelectField from "@/components/ui/SelectField";
import TextField from "@/components/ui/TextField";
import TranslatedInput from "@/components/ui/TranslatedInput";

const EMPTY_FORM = { name: { en: "" }, parent: "", commissionPercent: "10", sortOrder: "0" };

// Form to add a new category.
function NewCategoryForm({ topLevelCategories, onCreated }) {
  const t = useTranslations();
  const locale = useLocale();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const errors = fieldErrors(error);

  // Sends the new category.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await api("/admin/categories", {
        method: "POST",
        body: {
          name: form.name,
          parent: form.parent || null,
          commissionPercent: Number(form.commissionPercent),
          sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        },
      });
      setForm(EMPTY_FORM);
      onCreated();
    } catch (createError) {
      setError(createError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Card title={t("admin.newCategory")}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
        <TranslatedInput label={t("admin.categoryName")} value={form.name} onChange={(name) => setForm({ ...form, name })} maxLength={80} error={errors["name.en"]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label={t("admin.parentCategory")}
            name="parent"
            value={form.parent}
            onChange={(e) => setForm({ ...form, parent: e.target.value })}
            placeholder={t("admin.noParent")}
            options={topLevelCategories.map((category) => ({ value: category.id, label: pickText(category.name, locale) }))}
          />
          <TextField
            label={t("admin.commissionPercent")}
            name="commissionPercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.commissionPercent}
            onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
            error={errors.commissionPercent}
          />
          <TextField label={t("admin.sortOrder")} name="sortOrder" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </div>
        <Button type="submit" isBusy={isBusy}>
          {t("admin.addCategory")}
        </Button>
      </form>
    </Card>
  );
}

// One category row: edit commission, show/hide, delete.
function CategoryRow({ category, parentName, onChanged, onError }) {
  const t = useTranslations();
  const locale = useLocale();
  const [commission, setCommission] = useState(String(category.commissionPercent));
  const [isBusy, setIsBusy] = useState(false);

  // Runs one change against the API, then reloads the list.
  async function run(request) {
    onError(null);
    setIsBusy(true);
    try {
      await request();
      onChanged();
    } catch (changeError) {
      onError(changeError);
    } finally {
      setIsBusy(false);
    }
  }

  const saveCommission = () =>
    run(() => api(`/admin/categories/${category.id}`, { method: "PATCH", body: { commissionPercent: Number(commission) } }));
  const toggleActive = () =>
    run(() => api(`/admin/categories/${category.id}`, { method: "PATCH", body: { isActive: !category.isActive } }));
  const remove = () => {
    if (window.confirm(t("admin.confirmDeleteCategory"))) run(() => api(`/admin/categories/${category.id}`, { method: "DELETE" }));
  };

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 text-ink">
        {parentName && <span className="text-subtle">{parentName} › </span>}
        {pickText(category.name, locale)}
        {!category.isActive && <span className="ml-2 text-xs text-subtle">({t("admin.hidden")})</span>}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            aria-label={t("admin.commissionPercent")}
            className="min-h-9 w-20 rounded border border-line bg-surface px-2 text-sm text-ink"
          />
          {commission !== String(category.commissionPercent) && (
            <Button variant="secondary" className="min-h-9 px-3" isBusy={isBusy} onClick={saveCommission}>
              {t("common.save")}
            </Button>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <Button variant="secondary" className="min-h-9 px-3" isBusy={isBusy} onClick={toggleActive}>
            {category.isActive ? t("product.hide") : t("product.show")}
          </Button>
          <Button variant="danger" className="min-h-9 px-3" isBusy={isBusy} onClick={remove}>
            {t("product.delete")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Admin page: all categories with commission %, plus a form to add more.
export default function CategoriesManager() {
  const t = useTranslations();
  const locale = useLocale();
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    api("/admin/categories")
      .then((data) => {
        if (!isCancelled) setCategories(data.categories);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });
    return () => {
      isCancelled = true;
    };
  }, [reloadCount]);

  const reload = () => setReloadCount((count) => count + 1);
  const topLevel = (categories || []).filter((category) => !category.parent);
  const nameOf = (id) => pickText(categories?.find((category) => category.id === id)?.name, locale);

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-muted text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">{t("admin.categoryName")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.commissionPercent")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {categories?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-subtle">
                  {t("admin.noCategories")}
                </td>
              </tr>
            )}
            {categories?.map((category) => (
              <CategoryRow
                key={`${category.id}-${category.commissionPercent}-${category.isActive}`}
                category={category}
                parentName={category.parent ? nameOf(category.parent) : ""}
                onChanged={reload}
                onError={setError}
              />
            ))}
          </tbody>
        </table>
      </div>

      <NewCategoryForm topLevelCategories={topLevel} onCreated={reload} />
    </div>
  );
}
