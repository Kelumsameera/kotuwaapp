import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/formatDate";

// One label/value line.
function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

// Delivery details for sellers and admins: method, courier, rider, attempts, cash and proof.
export default function DeliveryInfo({ order }) {
  const t = useTranslations("delivery");
  const locale = useLocale();
  const delivery = order.delivery;

  return (
    <dl className="space-y-1 text-sm">
      {delivery.method && <Row label={t("method")}>{delivery.method === "self" ? t("methodSelf") : t("methodCourier")}</Row>}
      {delivery.courierName && (
        <Row label={t("courierName")}>
          {delivery.courierName} · {delivery.trackingNumber}
          {delivery.trackingUrl && (
            <a href={delivery.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-brand underline">
              {t("trackLink")}
            </a>
          )}
        </Row>
      )}
      {delivery.rider && <Row label={t("rider")}>{[delivery.rider.name, delivery.rider.phone].filter(Boolean).join(" · ")}</Row>}
      <Row label={t("attempts")}>{t("attemptsValue", { used: delivery.attempts, max: delivery.maxAttempts })}</Row>
      {delivery.failReasons.length > 0 && <Row label={t("failReasons")}>{delivery.failReasons.join("; ")}</Row>}
      {delivery.codAmount > 0 && (
        <Row label={t("cod")}>
          {formatMoney(delivery.codAmount)} · {delivery.codCollected ? t("collected") : t("notCollected")}
        </Row>
      )}
      {delivery.deliveredAt && <Row label={t("deliveredAt")}>{formatDateTime(delivery.deliveredAt, locale)}</Row>}
      {delivery.proof && (
        <Row label={t("proof")}>
          {delivery.proof.hasSignature && <span>{t("signatureTaken")} </span>}
          {delivery.proof.photo && (
            <a href={delivery.proof.photo.url} target="_blank" rel="noopener noreferrer" className="inline-block align-middle">
              <Image src={delivery.proof.photo.url} alt={t("proof")} width={64} height={64} className="rounded object-cover" />
            </a>
          )}
        </Row>
      )}
      {order.cancelReason && <Row label={t("cancelReason")}>{order.cancelReason}</Row>}
      {order.returnRequest && <Row label={t("returnReason")}>{order.returnRequest.reason}</Row>}
    </dl>
  );
}
