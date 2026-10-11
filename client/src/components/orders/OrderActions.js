"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import TextField from "@/components/ui/TextField";

// Which extra fields each action asks for. The server checks all of them again.
const NEEDS_NOTE_REQUIRED = ["delivery_failed"];

// The button label for moving to a status (a few depend on where the order is now).
function actionLabelKey(order, nextStatus) {
  if (order.status === "return_requested" && nextStatus === "delivered") return "refuseReturn";
  if (order.status === "return_requested" && nextStatus === "returned") return "acceptReturn";
  if (order.status === "delivery_failed" && nextStatus === "out_for_delivery") return "retryDelivery";
  if (order.status === "delivery_failed" && nextStatus === "returned") return "returnToSeller";
  return nextStatus;
}

// The fields for the chosen action, e.g. courier details for "shipped".
function ActionFields({ order, action, form, setForm, couriers, deliveryMethods }) {
  const t = useTranslations("delivery");
  const set = (name) => (event) =>
    setForm({ ...form, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value });
  const isRefusingReturn = order.status === "return_requested" && action === "delivered";

  return (
    <div className="space-y-3">
      {action === "shipped" && (
        <>
          <SelectField
            label={t("method")}
            name="method"
            value={form.method}
            onChange={set("method")}
            options={[
              deliveryMethods.selfDelivery && { value: "self", label: t("methodSelf") },
              deliveryMethods.courier && { value: "courier", label: t("methodCourier") },
            ].filter(Boolean)}
            placeholder={t("chooseMethod")}
          />
          {form.method === "courier" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink">{t("courierName")}</span>
                <input list="courier-names" value={form.courierName} onChange={set("courierName")} className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-ink" />
                <datalist id="courier-names">
                  {couriers.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <TextField label={t("trackingNumber")} name="trackingNumber" value={form.trackingNumber} onChange={set("trackingNumber")} />
              <TextField label={`${t("trackingUrl")} (https://)`} name="trackingUrl" value={form.trackingUrl} onChange={set("trackingUrl")} />
            </div>
          )}
        </>
      )}

      {action === "delivery_failed" && <TextField label={t("failReason")} name="failReason" value={form.failReason} onChange={set("failReason")} />}

      {action === "delivered" && !isRefusingReturn && order.delivery.codAmount > 0 && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.cashCollected} onChange={set("cashCollected")} />
          {t("cashCollected", { amount: formatMoney(order.delivery.codAmount) })}
        </label>
      )}

      {!NEEDS_NOTE_REQUIRED.includes(action) && (
        <TextField
          label={isRefusingReturn ? t("refuseReason") : t("note")}
          name="note"
          hint={isRefusingReturn ? undefined : t("noteHint")}
          value={form.note}
          onChange={set("note")}
        />
      )}
    </div>
  );
}

// Status buttons for a seller or admin, plus "cash collected" for delivered COD orders.
// statusUrl / cashUrl: the API paths to call. onUpdated(order) receives the changed order.
export default function OrderActions({ order, statusUrl, cashUrl, onUpdated, deliveryMethods = { selfDelivery: true, courier: true } }) {
  const t = useTranslations();
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [couriers, setCouriers] = useState([]);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    api("/couriers")
      .then((data) => setCouriers(data.couriers))
      .catch(() => {});
  }, []);

  // Opens the small form for one action.
  function choose(nextStatus) {
    setError(null);
    setAction(nextStatus);
    setForm({ method: "", courierName: "", trackingNumber: "", trackingUrl: "", failReason: "", note: "", cashCollected: false });
  }

  // Sends the change and hands the updated order back to the page.
  async function submit(request) {
    setError(null);
    setIsBusy(true);
    try {
      const data = await request();
      onUpdated(data.order || data.delivery);
      setAction(null);
    } catch (submitError) {
      setError(submitError);
    } finally {
      setIsBusy(false);
    }
  }

  // Builds the request body: only fields that have a value.
  function bodyFor(nextStatus) {
    const body = { status: nextStatus };
    for (const [key, value] of Object.entries(form)) {
      if (value !== "" && value !== false) body[key] = value;
    }
    return body;
  }

  const canMarkCash = order.status === "delivered" && order.delivery.codAmount > 0 && !order.delivery.codCollected;
  if (order.nextStatuses.length === 0 && !canMarkCash) return null;

  return (
    <div className="space-y-3">
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      <div className="flex flex-wrap gap-2">
        {order.nextStatuses.map((nextStatus) => (
          <Button
            key={nextStatus}
            variant={["cancelled", "delivery_failed"].includes(nextStatus) ? "danger" : action === nextStatus ? "primary" : "secondary"}
            onClick={() => choose(nextStatus)}
          >
            {t(`actions.${actionLabelKey(order, nextStatus)}`)}
          </Button>
        ))}
        {canMarkCash && (
          <Button variant="secondary" isBusy={isBusy && !action} onClick={() => submit(() => api(cashUrl, { method: "POST" }))}>
            {t("delivery.markCashCollected", { amount: formatMoney(order.delivery.codAmount) })}
          </Button>
        )}
      </div>

      {action && (
        <div className="space-y-3 rounded-md border border-line p-3">
          <ActionFields order={order} action={action} form={form} setForm={setForm} couriers={couriers} deliveryMethods={deliveryMethods} />
          <div className="flex gap-2">
            <Button isBusy={isBusy} onClick={() => submit(() => api(statusUrl, { method: "PATCH", body: bodyFor(action) }))}>
              {t("delivery.confirm")}
            </Button>
            <Button variant="secondary" onClick={() => setAction(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
