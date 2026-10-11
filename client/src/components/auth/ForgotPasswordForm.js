"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

// Asks for an email and requests a password reset link.
export default function ForgotPasswordForm() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  // Sends the reset request.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email } });
      setIsSent(true);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Card title={t("auth.forgot.title")} className="mx-auto max-w-md">
      {isSent ? (
        <Alert type="success">{t("auth.forgot.sent")}</Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-subtle">{t("auth.forgot.intro")}</p>
          {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
          <TextField label={t("auth.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" isBusy={isBusy} className="w-full">
            {t("auth.forgot.submit")}
          </Button>
        </form>
      )}
    </Card>
  );
}
