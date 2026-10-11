"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import AddressSummary from "@/components/address/AddressSummary";
import DeliveryInfo from "@/components/orders/DeliveryInfo";
import OrderActions from "@/components/orders/OrderActions";
import OrderItems from "@/components/orders/OrderItems";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimeline from "@/components/orders/OrderTimeline";

// Dropdown to assign (or remove) a rider.
function RiderPicker({ delivery, onUpdated }) {
  const t = useTranslations();
  const [riders, setRiders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/admin/users?role=rider&limit=100")
      .then((data) => setRiders(data.users.filter((user) => user.isActive)))
      .catch(() => {});
  }, []);

  // Saves the chosen rider.
  async function assign(event) {
    setError(null);
    try {
      const data = await api(`/admin/deliveries/${delivery.subOrderNumber}/rider`, {
        method: "PATCH",
        body: { riderId: event.target.value || null },
      });
      onUpdated(data.delivery);
    } catch (assignError) {
      setError(assignError);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={delivery.delivery.rider?.id || ""}
        onChange={assign}
        className="min-h-11 w-full rounded-md border border-line bg-surface px-2 text-ink"
        aria-label={t("delivery.rider")}
      >
        <option value="">{t("adminDelivery.noRider")}</option>
        {riders.map((rider) => (
          <option key={rider.id} value={rider.id}>
            {rider.name} {rider.phone && `· ${rider.phone}`}
          </option>
        ))}
      </select>
      {riders.length === 0 && <p className="text-xs text-subtle">{t("adminDelivery.noRidersYet")}</p>}
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
    </div>
  );
}

// Admin view of one delivery: fix its status, assign a rider, see proof and history.
export default function AdminDeliveryDetail({ subOrderNumber }) {
  const t = useTranslations();
  const [delivery, setDelivery] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/admin/deliveries/${subOrderNumber}`)
      .then((data) => setDelivery(data.delivery))
      .catch((loadError) => setError(loadError));
  }, [subOrderNumber]);

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!delivery) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-ink">{delivery.subOrderNumber}</h2>
          <div className="text-sm text-subtle">{delivery.shop?.name}</div>
        </div>
        <OrderStatusBadge status={delivery.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title={t("delivery.nextStep")}>
            <OrderActions
              order={delivery}
              statusUrl={`/admin/deliveries/${delivery.subOrderNumber}/status`}
              cashUrl={`/admin/deliveries/${delivery.subOrderNumber}/cash-collected`}
              onUpdated={setDelivery}
            />
            {delivery.nextStatuses.length === 0 && <p className="text-sm text-subtle">{t("delivery.nothingToDo")}</p>}
          </Card>
          <Card title={t("sellerOrders.toPack")}>
            <OrderItems items={delivery.items} />
          </Card>
          <Card title={t("orders.timeline")}>
            <OrderTimeline events={delivery.timeline} />
          </Card>
        </div>
        <aside className="h-fit space-y-4">
          <Card title={t("delivery.rider")}>
            <RiderPicker delivery={delivery} onUpdated={setDelivery} />
          </Card>
          <Card title={t("checkout.deliverTo")}>
            <AddressSummary address={delivery.shippingAddress} />
          </Card>
          <Card title={t("delivery.title")}>
            <DeliveryInfo order={delivery} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
