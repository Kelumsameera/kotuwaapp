"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TextField from "@/components/ui/TextField";

const EMPTY = { name: "", email: "", phone: "", password: "" };

// Admin: creates a delivery rider account (riders cannot sign up themselves).
export default function CreateRiderForm() {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [createdEmail, setCreatedEmail] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const errors = fieldErrors(error);
  const set = (name) => (event) => setForm({ ...form, [name]: event.target.value });

  // Sends the new rider.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await api("/admin/riders", { method: "POST", body: form });
      setCreatedEmail(form.email);
      setForm(EMPTY);
      setIsOpen(false);
    } catch (createError) {
      setError(createError);
    } finally {
      setIsBusy(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="space-y-2">
        {createdEmail && <Alert type="success">{t("admin.riderCreated", { email: createdEmail })}</Alert>}
        <Button variant="secondary" onClick={() => setIsOpen(true)}>
          + {t("admin.addRider")}
        </Button>
      </div>
    );
  }

  return (
    <Card title={t("admin.addRider")}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("auth.name")} name="name" value={form.name} onChange={set("name")} error={errors.name} />
          <TextField label={t("auth.phone")} name="phone" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
          <TextField label={t("auth.email")} name="email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
          <TextField label={t("auth.password")} name="password" type="password" autoComplete="new-password" hint={t("auth.passwordHint")} value={form.password} onChange={set("password")} error={errors.password} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" isBusy={isBusy}>
            {t("admin.addRider")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
