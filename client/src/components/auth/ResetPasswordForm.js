"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage, fieldErrors } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

// Sets a new password using the token from the reset email.
export default function ResetPasswordForm({ token }) {
  const t = useTranslations();
  const [password, setPassword] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  // Sends the new password.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password } });
      setIsDone(true);
    } catch (resetError) {
      setError(resetError);
    } finally {
      setIsBusy(false);
    }
  }

  if (!token) {
    return (
      <Card title={t("auth.reset.title")} className="mx-auto max-w-md">
        <Alert type="error">{t("auth.reset.missingToken")}</Alert>
      </Card>
    );
  }

  return (
    <Card title={t("auth.reset.title")} className="mx-auto max-w-md">
      {isDone ? (
        <div className="space-y-4">
          <Alert type="success">{t("auth.reset.success")}</Alert>
          <Link href="/login" className="inline-block text-brand hover:underline">
            {t("nav.login")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
          <TextField
            label={t("auth.reset.newPassword")}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            hint={t("auth.passwordHint")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors(error).password}
          />
          <Button type="submit" isBusy={isBusy} className="w-full">
            {t("auth.reset.submit")}
          </Button>
        </form>
      )}
    </Card>
  );
}
