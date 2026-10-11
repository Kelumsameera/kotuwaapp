"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TextField from "@/components/ui/TextField";

const EMPTY = { name: "", email: "", phone: "", password: "" };

// Form to add a cashier. The seller picks the first password and tells the cashier.
function AddCashierForm({ onAdded }) {
  const t = useTranslations();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const errors = fieldErrors(error);
  const set = (name) => (event) => setForm({ ...form, [name]: event.target.value });

  // Creates the cashier account.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await api("/seller/staff", { method: "POST", body: form });
      setForm(EMPTY);
      onAdded();
    } catch (addError) {
      setError(addError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("auth.name")} name="name" value={form.name} onChange={set("name")} error={errors.name} />
        <TextField label={t("auth.phone")} name="phone" type="tel" hint={t("auth.phoneHint")} value={form.phone} onChange={set("phone")} error={errors.phone} />
        <TextField label={t("auth.email")} name="email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
        <TextField label={t("staff.firstPassword")} name="password" type="password" autoComplete="new-password" hint={t("auth.passwordHint")} value={form.password} onChange={set("password")} error={errors.password} />
      </div>
      <Button type="submit" isBusy={isBusy}>
        {t("staff.add")}
      </Button>
    </form>
  );
}

// One cashier row: turn on/off and set a new password.
function CashierRow({ cashier, onChanged }) {
  const t = useTranslations();
  const [message, setMessage] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  // Runs a change and shows the result.
  async function run(request, successText) {
    setMessage(null);
    setIsBusy(true);
    try {
      await request();
      if (successText) setMessage({ type: "success", text: successText });
      onChanged();
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error, t) });
    } finally {
      setIsBusy(false);
    }
  }

  // Asks for a new password and sets it.
  function resetPassword() {
    const password = window.prompt(t("staff.newPasswordPrompt"));
    if (!password) return;
    run(() => api(`/seller/staff/${cashier.id}/password`, { method: "POST", body: { password } }), t("staff.passwordChanged"));
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {cashier.name} {!cashier.isActive && <span className="text-sm text-red-600">({t("admin.disabled")})</span>}
            {!cashier.isEmailVerified && <span className="text-sm text-amber-700 dark:text-amber-400"> ({t("account.unverified")})</span>}
          </div>
          <div className="text-sm text-subtle">
            {cashier.email} · {cashier.phone}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="min-h-9 px-3" isBusy={isBusy} onClick={resetPassword}>
            {t("staff.resetPassword")}
          </Button>
          <Button
            variant={cashier.isActive ? "danger" : "secondary"}
            className="min-h-9 px-3"
            isBusy={isBusy}
            onClick={() => run(() => api(`/seller/staff/${cashier.id}/status`, { method: "PATCH", body: { isActive: !cashier.isActive } }))}
          >
            {cashier.isActive ? t("admin.disable") : t("admin.enable")}
          </Button>
        </div>
      </div>
      {message && <Alert type={message.type}>{message.text}</Alert>}
    </li>
  );
}

// Staff page: the shop's cashiers. Cashiers can only use the POS (no earnings, payouts or cost prices).
export default function StaffManager() {
  const t = useTranslations();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    api("/seller/staff")
      .then(setData)
      .catch((loadError) => setError(loadError));
  }, [reloadCount]);

  const reload = () => setReloadCount((count) => count + 1);

  return (
    <div className="space-y-6">
      <p className="text-sm text-subtle">{t("staff.intro")}</p>
      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
      <Card title={t("staff.cashiers", { count: data?.staff.length ?? 0, max: data?.max ?? 20 })}>
        {data?.staff.length === 0 && <p className="text-sm text-subtle">{t("staff.none")}</p>}
        <ul className="divide-y divide-line">
          {data?.staff.map((cashier) => (
            <CashierRow key={`${cashier.id}-${cashier.isActive}`} cashier={cashier} onChanged={reload} />
          ))}
        </ul>
      </Card>
      <Card title={t("staff.add")}>
        <AddCashierForm onAdded={reload} />
      </Card>
    </div>
  );
}
