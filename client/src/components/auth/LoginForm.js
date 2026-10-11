"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/apiClient";
import { homePathForRole, safeNextPath } from "@/lib/roleAreas";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

// Email + password login. If the session can be refreshed silently, it skips the form.
export default function LoginForm({ next }) {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // Already logged in (or the refresh cookie still works): go straight on.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(safeNextPath(next) || homePathForRole(user.role));
    }
  }, [isLoading, user, next, router]);

  // Sends the login form.
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setNotice("");
    setIsBusy(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError);
    } finally {
      setIsBusy(false);
    }
  }

  // Sends a fresh verification email for unverified accounts.
  async function resendVerification() {
    try {
      await api("/auth/resend-verification", { method: "POST", body: { email } });
    } finally {
      setError(null);
      setNotice(t("auth.login.resent"));
    }
  }

  if (isLoading || user) {
    return <p className="text-center text-subtle">{t("common.loading")}</p>;
  }

  return (
    <Card title={t("auth.login.title")} className="mx-auto max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{errorMessage(error, t)}</Alert>}
        {notice && <Alert type="success">{notice}</Alert>}
        {error?.code === "EMAIL_NOT_VERIFIED" && (
          <button type="button" onClick={resendVerification} className="text-sm text-brand underline">
            {t("auth.login.resend")}
          </button>
        )}

        <TextField label={t("auth.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label={t("auth.password")} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />

        <Button type="submit" isBusy={isBusy} className="w-full">
          {t("auth.login.submit")}
        </Button>

        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="text-brand hover:underline">
            {t("auth.login.forgot")}
          </Link>
          <span className="text-subtle">
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className="text-brand hover:underline">
              {t("auth.login.createAccount")}
            </Link>
          </span>
        </div>
      </form>
    </Card>
  );
}
