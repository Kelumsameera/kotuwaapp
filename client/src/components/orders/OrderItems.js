import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import ProductImage from "@/components/store/ProductImage";

// The bought items of one sub-order (as copied at checkout).
export default function OrderItems({ items }) {
  const t = useTranslations("store");
  const locale = useLocale();

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const name = pickText(item.name, locale);
        const options = [item.options.size, item.options.color].filter(Boolean).join(" · ");
        return (
          <li key={item.variantId} className="flex gap-3 py-2">
            <ProductImage image={item.image} alt={name} sizes="56px" className="h-14 w-14 shrink-0 rounded" />
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-ink">{name}</span>
              <div className="text-xs text-subtle">
                {[options, item.sku].filter(Boolean).join(" · ")} · {item.quantity} × {formatMoney(item.unitPrice)}
              </div>
            </div>
            <div className="text-sm font-medium text-ink">{formatMoney(item.lineTotal)}</div>
          </li>
        );
      })}
      {items.length === 0 && <li className="py-2 text-sm text-subtle">{t("noProducts")}</li>}
    </ul>
  );
}
