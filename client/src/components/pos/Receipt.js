"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";
import { pickText } from "@/lib/pickText";

// One left/right line on the receipt.
function Row({ left, right, isStrong = false }) {
  return (
    <div className={`flex justify-between gap-2 ${isStrong ? "font-bold" : ""}`}>
      <span>{left}</span>
      <span className="whitespace-nowrap">{right}</span>
    </div>
  );
}

// A printable 80 mm receipt: shop, bill number, date, cashier, items, totals and payment.
// Uses the screen's language; the Noto fonts print Sinhala and Tamil correctly.
// id="receipt-print" is the only part of the page that is printed (see globals.css).
export default function Receipt({ sale, shop }) {
  const t = useTranslations("pos");
  const locale = useLocale();

  return (
    <div id="receipt-print" className="mx-auto w-full max-w-[80mm] bg-white p-3 font-sans text-[12px] leading-snug text-black">
      <div className="text-center">
        <div className="text-base font-bold">{shop.name}</div>
        {shop.address && <div>{shop.address}</div>}
        {shop.phone && <div>{shop.phone}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <Row left={t("billNo")} right={sale.billNumber} />
      <Row left={t("date")} right={formatDateTime(sale.completedAt, locale)} />
      <Row left={t("cashier")} right={sale.cashier?.name || ""} />
      {sale.status === "voided" && <div className="mt-1 text-center font-bold">*** {t("voided")} ***</div>}
      <div className="my-2 border-t border-dashed border-black" />

      {sale.items.map((item) => {
        const options = [item.options.size, item.options.color].filter(Boolean).join(" · ");
        return (
          <div key={item.variantId} className="mb-1">
            <div>
              {pickText(item.name, locale)}
              {options && ` (${options})`}
            </div>
            <Row left={`${item.quantity} × ${formatMoney(item.unitPrice)}`} right={formatMoney(item.unitPrice * item.quantity)} />
            {item.itemDiscount > 0 && <Row left={`  ${t("discount")}`} right={`− ${formatMoney(item.itemDiscount)}`} />}
          </div>
        );
      })}

      <div className="my-2 border-t border-dashed border-black" />
      <Row left={t("subtotal")} right={formatMoney(sale.subtotal)} />
      {sale.itemDiscountTotal + sale.billDiscount > 0 && (
        <Row left={t("discounts")} right={`− ${formatMoney(sale.itemDiscountTotal + sale.billDiscount)}`} />
      )}
      <Row left={t("total")} right={formatMoney(sale.total)} isStrong />
      {sale.payment?.method === "cash" && (
        <>
          <Row left={t("cashReceived")} right={formatMoney(sale.payment.cashReceived)} />
          <Row left={t("change")} right={formatMoney(sale.payment.change)} isStrong />
        </>
      )}
      {sale.payment?.method === "card" && (
        <Row left={t("paidByCard")} right={sale.payment.cardReference || ""} />
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">{t("thankYou")}</div>
    </div>
  );
}
