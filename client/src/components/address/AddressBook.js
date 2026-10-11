"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import AddressForm from "./AddressForm";
import AddressSummary from "./AddressSummary";

// "My addresses" on the account page: add, edit, delete, make default.
export default function AddressBook() {
  const t = useTranslations();
  const [addresses, setAddresses] = useState(null);
  const [editingId, setEditingId] = useState(null); // an address id, "new", or null
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/users/me/addresses")
      .then((data) => setAddresses(data.addresses))
      .catch((loadError) => setError(loadError));
  }, []);

  // Saves a new or changed address, then closes the form.
  async function save(body) {
    const isNew = editingId === "new";
    const data = await api(isNew ? "/users/me/addresses" : `/users/me/addresses/${editingId}`, {
      method: isNew ? "POST" : "PATCH",
      body,
    });
    setAddresses(data.addresses);
    setEditingId(null);
  }

  // Deletes an address after confirmation.
  async function remove(addressId) {
    if (!window.confirm(t("address.confirmDelete"))) return;
    try {
      const data = await api(`/users/me/addresses/${addressId}`, { method: "DELETE" });
      setAddresses(data.addresses);
    } catch (removeError) {
      setError(removeError);
    }
  }

  return (
    <Card title={t("address.myAddresses")}>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      {!addresses && !error && <p className="text-subtle">{t("common.loading")}</p>}

      <ul className="space-y-3">
        {addresses?.map((address) => (
          <li key={address.id} className="rounded-md border border-line p-3">
            {editingId === address.id ? (
              <AddressForm initial={address} onSave={save} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <AddressSummary address={address} />
                <div className="flex items-center gap-3 text-sm">
                  {address.isDefault && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-subtle">{t("address.default")}</span>}
                  <button type="button" onClick={() => setEditingId(address.id)} className="text-brand hover:underline">
                    {t("address.edit")}
                  </button>
                  <button type="button" onClick={() => remove(address.id)} className="text-red-600 hover:underline">
                    {t("product.delete")}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {editingId === "new" ? (
          <AddressForm onSave={save} onCancel={() => setEditingId(null)} submitLabel={t("address.add")} />
        ) : (
          <button type="button" onClick={() => setEditingId("new")} className="text-sm text-brand hover:underline">
            + {t("address.add")}
          </button>
        )}
      </div>
    </Card>
  );
}
