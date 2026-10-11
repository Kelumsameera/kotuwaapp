"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

// Sends the token from the email link to the server once, then shows the result.
export default function VerifyEmail({ token }) {
  const t = useTranslations();
  const [status, setStatus] = useState(token ? "working" : "failed");
  // The token works only once, so never send it twice (React runs effects twice in dev).
  const hasSent = useRef(false);

  useEffect(() => {
    if (!token || hasSent.current) return;
    hasSent.current = true;
    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(() => setStatus("success"))
      .catch(() => setStatus("failed"));
  }, [token]);

  return (
    <Card title={t("auth.verify.title")} className="mx-auto max-w-md space-y-4">
      {status === "working" && <p className="text-subtle">{t("auth.verify.working")}</p>}
      {status === "success" && <Alert type="success">{t("auth.verify.success")}</Alert>}
      {status === "failed" && <Alert type="error">{t("auth.verify.failed")}</Alert>}
      {status !== "working" && (
        <Link href="/login" className="mt-4 inline-block text-brand hover:underline">
          {t("nav.login")}
        </Link>
      )}
    </Card>
  );
}
