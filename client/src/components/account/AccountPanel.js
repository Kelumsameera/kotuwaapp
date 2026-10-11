"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import AddressBook from "@/components/address/AddressBook";

// Lets the user edit their name and phone.
function ProfileForm({ user, onSaved }) {
  const t = useTranslations();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Saves the profile changes.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);
    setIsBusy(true);
    try {
      const body = { name };
      if (phone) body.phone = phone;
      const data = await api("/users/me", { method: "PATCH", body });
      onSaved(data.user);
      setIsSaved(true);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Card title={t("account.profile")}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
        {isSaved && <Alert type="success">{t("common.saved")}</Alert>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-subtle">{t("auth.email")}</dt>
          <dd className="break-all text-ink">
            {user.email} {!user.isEmailVerified && <span className="text-red-600">({t("account.unverified")})</span>}
          </dd>
          <dt className="text-subtle">{t("account.role")}</dt>
          <dd className="text-ink">{t(`roles.${user.role}`)}</dd>
        </dl>
        <TextField label={t("auth.name")} name="name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors(error).name} />
        <TextField label={t("auth.phone")} name="phone" type="tel" hint={t("auth.phoneHint")} value={phone} onChange={(e) => setPhone(e.target.value)} error={fieldErrors(error).phone} />
        <Button type="submit" isBusy={isBusy}>
          {t("common.save")}
        </Button>
      </form>
    </Card>
  );
}

// Lets the user change their password (logs out other devices).
function ChangePasswordForm() {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [isDone, setIsDone] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Sends the password change.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsDone(false);
    setIsBusy(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
      setIsDone(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (changeError) {
      setError(changeError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Card title={t("account.changePassword")}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
        {isDone && <Alert type="success">{t("account.passwordChanged")}</Alert>}
        <TextField label={t("account.currentPassword")} name="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <TextField
          label={t("account.newPassword")}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint={t("auth.passwordHint")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={fieldErrors(error).newPassword}
        />
        <Button type="submit" isBusy={isBusy}>
          {t("account.changePassword")}
        </Button>
      </form>
    </Card>
  );
}

// The "My account" page content.
export default function AccountPanel() {
  const t = useTranslations();
  const { user, isLoading, setUser } = useAuth();

  if (isLoading || !user) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">{t("account.title")}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm user={user} onSaved={setUser} />
        <ChangePasswordForm />
      </div>
      {user.role === "customer" && <AddressBook />}
    </div>
  );
}
