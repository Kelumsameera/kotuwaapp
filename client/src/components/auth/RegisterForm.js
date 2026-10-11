"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

// Sign-up form for customers and sellers. Other roles cannot be chosen here.
export default function RegisterForm({ initialRole }) {
  const t = useTranslations();
  const locale = useLocale();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: initialRole });
  const [error, setError] = useState(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const errorsByField = fieldErrors(error);

  // Updates one field of the form.
  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  // Sends the sign-up form. Empty phone is left out because it's optional.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const body = { ...form, preferredLanguage: locale };
      if (!body.phone) delete body.phone;
      await api("/auth/register", { method: "POST", body });
      setRegisteredEmail(form.email);
    } catch (registerError) {
      setError(registerError);
    } finally {
      setIsBusy(false);
    }
  }

  if (registeredEmail) {
    return (
      <Card title={t("auth.register.title")} className="mx-auto max-w-md">
        <Alert type="success">{t("auth.register.done", { email: registeredEmail })}</Alert>
      </Card>
    );
  }

  const roleButton = (role, label) => (
    <button
      type="button"
      onClick={() => setForm((current) => ({ ...current, role }))}
      aria-pressed={form.role === role}
      className={`min-h-11 flex-1 rounded-md border text-sm font-medium ${
        form.role === role ? "border-brand bg-brand text-white" : "border-line text-ink hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card title={t("auth.register.title")} className="mx-auto max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}

        <div>
          <span className="mb-1 block text-sm font-medium text-ink">{t("auth.register.accountType")}</span>
          <div className="flex gap-2">
            {roleButton("customer", t("auth.register.asCustomer"))}
            {roleButton("seller", t("auth.register.asSeller"))}
          </div>
          {form.role === "seller" && <p className="mt-2 text-xs text-subtle">{t("auth.register.sellerNote")}</p>}
        </div>

        <TextField label={t("auth.name")} name="name" autoComplete="name" required value={form.name} onChange={updateField} error={errorsByField.name} />
        <TextField label={t("auth.email")} name="email" type="email" autoComplete="email" required value={form.email} onChange={updateField} error={errorsByField.email} />
        <TextField
          label={`${t("auth.phone")} (${t("common.optional")})`}
          name="phone"
          type="tel"
          autoComplete="tel"
          hint={t("auth.phoneHint")}
          value={form.phone}
          onChange={updateField}
          error={errorsByField.phone}
        />
        <TextField
          label={t("auth.password")}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint={t("auth.passwordHint")}
          value={form.password}
          onChange={updateField}
          error={errorsByField.password}
        />

        <Button type="submit" isBusy={isBusy} className="w-full">
          {t("auth.register.submit")}
        </Button>

        <p className="text-center text-sm text-subtle">
          {t("auth.register.haveAccount")}{" "}
          <Link href="/login" className="text-brand hover:underline">
            {t("nav.login")}
          </Link>
        </p>
      </form>
    </Card>
  );
}
