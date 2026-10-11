"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { pickText } from "@/lib/pickText";
import { formatDateTime } from "@/lib/formatDate";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TextField from "@/components/ui/TextField";
import OrderStatusBadge from "./OrderStatusBadge";

// One shop's parcel: items, courier link and the status timeline.
function TrackedPart({ part }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-ink">{part.shopName}</div>
          <div className="text-xs text-subtle">{part.subOrderNumber}</div>
        </div>
        <OrderStatusBadge status={part.status} />
      </div>
      <ul className="mb-3 text-sm text-ink">
        {part.items.map((item, index) => (
          <li key={index}>
            {item.quantity} × {pickText(item.name, locale)}
          </li>
        ))}
      </ul>
      {part.trackingNumber && (
        <p className="mb-3 text-sm text-ink">
          {t("orders.courier", { courier: part.courierName, number: part.trackingNumber })}
          {part.trackingUrl && (
            <a href={part.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-brand underline">
              {t("orders.trackWithCourier")}
            </a>
          )}
        </p>
      )}
      <ol className="space-y-1 border-l border-line pl-4 text-sm">
        {part.timeline.map((event, index) => (
          <li key={index}>
            <span className="font-medium text-ink">{t(`orderStatus.${event.status}`)}</span>{" "}
            <span className="text-subtle">{formatDateTime(event.at, locale)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// Public "Track your order" page: order number + the phone number used at checkout. No login.
export default function TrackOrder() {
  const t = useTranslations();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  // Looks the order up.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setTracking(null);
    setIsBusy(true);
    try {
      const params = new URLSearchParams({ orderNumber: orderNumber.trim().toUpperCase(), phone: phone.trim() });
      const data = await api(`/track?${params}`);
      setTracking(data.tracking);
    } catch (trackError) {
      setError(trackError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card title={t("track.title")}>
        <p className="mb-4 text-sm text-subtle">{t("track.intro")}</p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t("track.orderNumber")} name="orderNumber" placeholder="KT-261011-000001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            <TextField label={t("track.phone")} name="phone" type="tel" hint={t("auth.phoneHint")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" isBusy={isBusy}>
            {t("track.submit")}
          </Button>
        </form>
      </Card>

      {tracking && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">{t("orders.orderTitle", { number: tracking.orderNumber })}</h2>
          {tracking.parts.map((part) => (
            <TrackedPart key={part.subOrderNumber} part={part} />
          ))}
        </div>
      )}
    </div>
  );
}
