"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage, uploadImage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TextField from "@/components/ui/TextField";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimeline from "@/components/orders/OrderTimeline";
import SignaturePad from "./SignaturePad";

// The "Delivered" form: cash collected, a photo and/or the customer's signature.
function DeliveredForm({ delivery, onSubmit, isBusy }) {
  const t = useTranslations();
  const [cashCollected, setCashCollected] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const needsCash = delivery.codAmount > 0;

  // Uploads the photo taken with the phone camera.
  async function takePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      setPhoto(await uploadImage(file, `/rider/deliveries/${delivery.subOrderNumber}/photo`));
    } catch (error) {
      setUploadError(error);
    } finally {
      setIsUploading(false);
    }
  }

  const canSubmit = (!needsCash || cashCollected) && (photo || signature);

  return (
    <div className="space-y-4">
      {needsCash && (
        <label className="flex items-center gap-3 rounded-md border border-line p-3 text-base text-ink">
          <input type="checkbox" className="h-6 w-6" checked={cashCollected} onChange={(e) => setCashCollected(e.target.checked)} />
          {t("delivery.cashCollected", { amount: formatMoney(delivery.codAmount) })}
        </label>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-ink">{t("rider.photo")}</span>
        {photo ? (
          <Image src={photo.url} alt={t("delivery.proof")} width={160} height={160} className="rounded object-cover" />
        ) : (
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-dashed border-line text-sm text-ink">
            {isUploading ? t("common.loading") : `📷 ${t("rider.takePhoto")}`}
            <input type="file" accept="image/*" capture="environment" onChange={takePhoto} className="hidden" />
          </label>
        )}
        {uploadError && <p className="mt-1 text-xs text-red-600">{errorMessage(uploadError, t)}</p>}
      </div>

      <SignaturePad onChange={setSignature} />
      <p className="text-xs text-subtle">{t("rider.proofHint")}</p>

      <Button
        className="min-h-12 w-full text-base"
        disabled={!canSubmit}
        isBusy={isBusy}
        onClick={() => onSubmit({ status: "delivered", cashCollected: needsCash ? cashCollected : undefined, photo: photo || undefined, signature: signature || undefined })}
      >
        {t("rider.confirmDelivered")}
      </Button>
    </div>
  );
}

// The "Could not deliver" form: a reason is required.
function FailedForm({ onSubmit, isBusy }) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <TextField label={t("delivery.failReason")} name="failReason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button variant="danger" className="min-h-12 w-full text-base" disabled={!reason.trim()} isBusy={isBusy} onClick={() => onSubmit({ status: "delivery_failed", failReason: reason })}>
        {t("actions.delivery_failed")}
      </Button>
    </div>
  );
}

// One delivery for the rider: where to go, who to call, what to collect, and the action buttons.
export default function RiderDeliveryDetail({ subOrderNumber }) {
  const t = useTranslations();
  const locale = useLocale();
  const [delivery, setDelivery] = useState(null);
  const [form, setForm] = useState(null); // "delivered" | "delivery_failed" | null
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    api(`/rider/deliveries/${subOrderNumber}`)
      .then((data) => setDelivery(data.delivery))
      .catch((loadError) => setError(loadError));
  }, [subOrderNumber]);

  // Sends a status change and shows the updated delivery.
  async function changeStatus(body) {
    setError(null);
    setIsBusy(true);
    try {
      const data = await api(`/rider/deliveries/${subOrderNumber}/status`, { method: "PATCH", body });
      setDelivery(data.delivery);
      setForm(null);
    } catch (changeError) {
      setError(changeError);
    } finally {
      setIsBusy(false);
    }
  }

  if (!delivery && !error) return <p className="text-subtle">{t("common.loading")}</p>;
  if (!delivery) return <Alert type="error">{errorMessage(error, t)}</Alert>;

  const { dropoff, pickup } = delivery;
  const fullAddress = [dropoff.addressLine1, dropoff.addressLine2, dropoff.city, dropoff.postalCode].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${fullAddress}, Sri Lanka`)}`;
  const can = (status) => delivery.nextStatuses.includes(status);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/rider" className="text-sm text-brand">
        ← {t("nav.rider")}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">{delivery.subOrderNumber}</h1>
        <OrderStatusBadge status={delivery.status} />
      </div>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}

      <Card title={t("rider.deliverTo")}>
        <div className="text-base font-medium text-ink">{dropoff.fullName}</div>
        <div className="text-sm text-ink">{fullAddress}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`tel:${dropoff.phone}`} className="flex min-h-12 items-center justify-center rounded-md bg-brand text-sm font-medium text-white">
            📞 {dropoff.phone}
          </a>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-md border border-line text-sm font-medium text-ink">
            🗺 {t("rider.openMap")}
          </a>
        </div>
        {delivery.codAmount > 0 && (
          <div className="mt-3 rounded-md bg-muted p-3 text-center text-lg font-semibold text-ink">
            {delivery.codCollected ? t("delivery.collected") : t("rider.collect", { amount: formatMoney(delivery.codAmount) })}
          </div>
        )}
      </Card>

      <Card title={t("rider.pickupFrom")}>
        <div className="text-sm text-ink">{pickup.shopName}</div>
        <div className="text-sm text-subtle">{pickup.address}</div>
        {pickup.phone && (
          <a href={`tel:${pickup.phone}`} className="text-sm text-brand">
            📞 {pickup.phone}
          </a>
        )}
        <ul className="mt-2 text-sm text-ink">
          {delivery.items.map((item, index) => (
            <li key={index}>
              {item.quantity} × {pickText(item.name, locale)}
            </li>
          ))}
        </ul>
      </Card>

      {delivery.nextStatuses.length > 0 && (
        <Card>
          <p className="mb-3 text-sm text-subtle">{t("delivery.attemptsValue", { used: delivery.attempts, max: delivery.maxAttempts })}</p>
          <div className="space-y-3">
            {can("out_for_delivery") && (
              <Button className="min-h-12 w-full text-base" isBusy={isBusy} onClick={() => changeStatus({ status: "out_for_delivery" })}>
                {delivery.status === "delivery_failed" ? t("actions.retryDelivery") : t("actions.out_for_delivery")}
              </Button>
            )}
            {can("delivered") && form !== "delivered" && (
              <Button className="min-h-12 w-full text-base" onClick={() => setForm("delivered")}>
                {t("actions.delivered")}
              </Button>
            )}
            {can("delivery_failed") && form !== "delivery_failed" && (
              <Button variant="secondary" className="min-h-12 w-full text-base" onClick={() => setForm("delivery_failed")}>
                {t("actions.delivery_failed")}
              </Button>
            )}
            {form === "delivered" && <DeliveredForm delivery={delivery} onSubmit={changeStatus} isBusy={isBusy} />}
            {form === "delivery_failed" && <FailedForm onSubmit={changeStatus} isBusy={isBusy} />}
          </div>
        </Card>
      )}

      {delivery.status === "delivered" && delivery.codAmount > 0 && !delivery.codCollected && (
        <Button
          variant="secondary"
          className="min-h-12 w-full"
          isBusy={isBusy}
          onClick={async () => {
            try {
              const data = await api(`/rider/deliveries/${subOrderNumber}/cash-collected`, { method: "POST" });
              setDelivery(data.delivery);
            } catch (cashError) {
              setError(cashError);
            }
          }}
        >
          {t("delivery.markCashCollected", { amount: formatMoney(delivery.codAmount) })}
        </Button>
      )}

      <Card title={t("orders.timeline")}>
        <OrderTimeline events={delivery.timeline} />
      </Card>
    </div>
  );
}
