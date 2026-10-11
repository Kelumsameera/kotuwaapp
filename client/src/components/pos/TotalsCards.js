import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";

// Sales totals as cards: total, cash, card, discounts, sales count and voids.
export default function TotalsCards({ totals }) {
  const t = useTranslations("pos");
  const cards = [
    { label: t("salesTotal"), value: formatMoney(totals.total), strong: true },
    { label: t("cash"), value: formatMoney(totals.cash) },
    { label: t("card"), value: formatMoney(totals.card) },
    { label: t("salesCount"), value: totals.completedCount },
    { label: t("discounts"), value: formatMoney(totals.discounts) },
    { label: t("voidedSummary", { count: totals.voidedCount }), value: formatMoney(totals.voidedTotal) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-line bg-surface p-4">
          <div className={`text-ink ${card.strong ? "text-2xl font-bold" : "text-xl font-semibold"}`}>{card.value}</div>
          <div className="text-sm text-subtle">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
