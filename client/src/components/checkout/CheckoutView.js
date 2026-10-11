"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/context/CartContext";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AddressForm from "@/components/address/AddressForm";
import AddressSummary from "@/components/address/AddressSummary";
import OrderItems from "@/components/orders/OrderItems";

// Step 1: choose a saved address or add a new one.
function AddressStep({ addresses, selectedId, onSelect, onAdded }) {
  const t = useTranslations();
  const [isAdding, setIsAdding] = useState(addresses.length === 0);

  // Saves a new address and selects it.
  async function addAddress(body) {
    const data = await api("/users/me/addresses", { method: "POST", body });
    setIsAdding(false);
    onAdded(data.addresses, data.addresses[data.addresses.length - 1].id);
  }

  return (
    <Card title={t("checkout.deliverTo")}>
      <div className="space-y-2">
        {addresses.map((address) => (
          <label key={address.id} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${selectedId === address.id ? "border-brand" : "border-line"}`}>
            <input type="radio" name="address" checked={selectedId === address.id} onChange={() => onSelect(address.id)} className="mt-1" />
            <AddressSummary address={address} />
          </label>
        ))}
      </div>
      <div className="mt-4">
        {isAdding ? (
          <AddressForm onSave={addAddress} onCancel={addresses.length > 0 ? () => setIsAdding(false) : undefined} submitLabel={t("address.add")} />
        ) : (
          <button type="button" onClick={() => setIsAdding(true)} className="text-sm text-brand hover:underline">
            + {t("address.add")}
          </button>
        )}
      </div>
    </Card>
  );
}

// Step 2: what each shop will send, with its delivery fee.
function ReviewStep({ checkout }) {
  const t = useTranslations("checkout");
  return (
    <Card title={t("review")}>
      <p className="mb-3 text-sm text-subtle">{t("splitNote", { count: checkout.groups.length })}</p>
      <div className="space-y-4">
        {checkout.groups.map((group) => (
          <section key={group.shop.id} className="rounded-md border border-line p-3">
            <h3 className="font-medium text-ink">{group.shop.name}</h3>
            <OrderItems items={group.items} />
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between text-subtle">
                <span>{t("delivery")}</span>
                <span>{group.shippingFee === 0 ? t("free") : formatMoney(group.shippingFee)}</span>
              </div>
              <div className="flex justify-between font-medium text-ink">
                <span>{t("shopTotal")}</span>
                <span>{formatMoney(group.total)}</span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

// The checkout page.
export default function CheckoutView() {
  const t = useTranslations();
  const router = useRouter();
  const { reload: reloadCart } = useCart();
  const [addresses, setAddresses] = useState(null);
  const [addressId, setAddressId] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  // One id per checkout visit, so a double click can never create two orders.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Load the address book and pick the default address.
  useEffect(() => {
    api("/users/me/addresses")
      .then((data) => {
        setAddresses(data.addresses);
        const preferred = data.addresses.find((address) => address.isDefault) || data.addresses[0];
        setAddressId(preferred?.id || null);
      })
      .catch((loadError) => setError(loadError));
  }, []);

  // Get delivery fees and totals whenever the address changes.
  useEffect(() => {
    if (!addressId) return undefined;
    let isCancelled = false;
    api("/checkout/preview", { method: "POST", body: { addressId } })
      .then((data) => {
        if (isCancelled) return;
        setCheckout(data.checkout);
        setError(null);
      })
      .catch((previewError) => {
        if (isCancelled) return;
        setCheckout(null);
        setError(previewError);
      });
    return () => {
      isCancelled = true;
    };
  }, [addressId]);

  // Places the order for the total the customer is looking at.
  async function placeOrder() {
    setError(null);
    setNotice("");
    setIsPlacing(true);
    try {
      const data = await api("/checkout/place-order", {
        method: "POST",
        body: { addressId, paymentMethod: "cod", expectedTotal: checkout.grandTotal, idempotencyKey, note: note || undefined },
      });
      reloadCart();
      router.push(`/orders/${data.orderNumber}?placed=1`);
    } catch (placeError) {
      if (placeError.code === "TOTAL_CHANGED") {
        // Show the new total and let the customer confirm again.
        const fresh = await api("/checkout/preview", { method: "POST", body: { addressId } }).catch(() => null);
        if (fresh) setCheckout(fresh.checkout);
        setNotice(t("checkout.totalChanged"));
      } else {
        setError(placeError);
      }
      setIsPlacing(false);
    }
  }

  if (!addresses && !error) return <p className="text-subtle">{t("common.loading")}</p>;

  const cartProblem = error?.code === "CART_HAS_PROBLEMS" || error?.code === "CART_EMPTY";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-ink">{t("checkout.title")}</h1>
        {error && (
          <Alert type="error">
            {errorMessage(error, t)}{" "}
            {cartProblem && (
              <Link href="/cart" className="font-medium underline">
                {t("store.viewCart")}
              </Link>
            )}
          </Alert>
        )}
        {addresses && (
          <AddressStep
            addresses={addresses}
            selectedId={addressId}
            onSelect={setAddressId}
            onAdded={(list, newId) => {
              setAddresses(list);
              setAddressId(newId);
            }}
          />
        )}
        {checkout && <ReviewStep checkout={checkout} />}
      </div>

      {checkout && (
        <aside className="h-fit space-y-4 rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-4">
          <div>
            <h2 className="mb-2 font-semibold text-ink">{t("checkout.payment")}</h2>
            <label className="flex items-start gap-2 rounded-md border border-brand p-3 text-sm">
              <input type="radio" checked readOnly className="mt-1" />
              <span>
                <span className="font-medium text-ink">{t("checkout.cod")}</span>
                <span className="block text-subtle">{t("checkout.codHelp")}</span>
              </span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-ink">{`${t("checkout.note")} (${t("common.optional")})`}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="w-full rounded-md border border-line bg-surface px-2 py-1 text-ink" />
          </label>

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-subtle">
              <dt>{t("checkout.items")}</dt>
              <dd>{formatMoney(checkout.itemsTotal)}</dd>
            </div>
            <div className="flex justify-between text-subtle">
              <dt>{t("checkout.delivery")}</dt>
              <dd>{formatMoney(checkout.shippingTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
              <dt>{t("checkout.total")}</dt>
              <dd>{formatMoney(checkout.grandTotal)}</dd>
            </div>
          </dl>

          {notice && <Alert type="info">{notice}</Alert>}
          <Button onClick={placeOrder} isBusy={isPlacing} className="w-full">
            {t("checkout.placeOrder", { total: formatMoney(checkout.grandTotal) })}
          </Button>
          <p className="text-xs text-subtle">{t("checkout.agreeNote")}</p>
        </aside>
      )}
    </div>
  );
}
