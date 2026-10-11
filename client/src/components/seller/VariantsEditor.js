"use client";

import { useTranslations } from "next-intl";

// An empty variant row for the form. Money fields are text in rupees, e.g. "4500.00".
export function emptyVariant() {
  return { _id: "", sku: "", barcode: "", size: "", color: "", price: "", compareAtPrice: "", costPrice: "", stock: "0" };
}

// Table of variants (size/colour/price/stock). One row per sellable version.
// Stock can only be typed for NEW variants; existing stock is changed with the stock panel.
export default function VariantsEditor({ variants, onChange, errors = {} }) {
  const t = useTranslations("product");

  // Updates one field of one variant.
  function updateVariant(index, field, value) {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)));
  }

  // Removes a variant row.
  function removeVariant(index) {
    onChange(variants.filter((variant, i) => i !== index));
  }

  const cellInput = "min-h-10 w-full rounded border border-line bg-surface px-2 text-sm text-ink";

  const columns = [
    { field: "sku", label: t("sku"), required: true },
    { field: "barcode", label: t("barcode") },
    { field: "size", label: t("size") },
    { field: "color", label: t("color") },
    { field: "price", label: t("priceRs"), required: true, inputMode: "decimal" },
    { field: "compareAtPrice", label: t("compareAtPriceRs"), inputMode: "decimal" },
    { field: "costPrice", label: t("costPriceRs"), inputMode: "decimal" },
    { field: "stock", label: t("stock"), inputMode: "numeric" },
  ];

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink">{t("variants")}</span>
      <p className="mb-2 text-xs text-subtle">{t("variantsHelp")}</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted text-subtle">
            <tr>
              {columns.map((column) => (
                <th key={column.field} className="px-2 py-2 font-medium">
                  {column.label}
                  {column.required && " *"}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={variant._id || `new-${index}`} className="border-t border-line align-top">
                {columns.map((column) => {
                  const isLockedStock = column.field === "stock" && variant._id;
                  const error = errors[`variants.${index}.${column.field}`];
                  return (
                    <td key={column.field} className="px-2 py-2">
                      {isLockedStock ? (
                        <span className="block py-2 text-xs text-subtle">{t("stockLockedHint")}</span>
                      ) : (
                        <input
                          aria-label={column.label}
                          inputMode={column.inputMode}
                          value={variant[column.field]}
                          onChange={(e) => updateVariant(index, column.field, e.target.value)}
                          className={`${cellInput} ${error ? "border-red-500" : ""}`}
                        />
                      )}
                      {error && <span className="block text-xs text-red-600">{error}</span>}
                    </td>
                  );
                })}
                <td className="px-2 py-2">
                  {variants.length > 1 && (
                    <button type="button" onClick={() => removeVariant(index)} className="py-2 text-xs text-red-600 hover:underline">
                      {t("removeVariant")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...variants, emptyVariant()])} className="mt-2 text-sm text-brand hover:underline">
        + {t("addVariant")}
      </button>
    </div>
  );
}
