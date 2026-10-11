"use client";

import { useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePosSession } from "@/lib/usePosSession";
import Alert from "@/components/ui/Alert";
import PosScreen from "@/components/pos/PosScreen";

// /pos — the billing screen (shop owner and cashiers; see proxy.js).
export default function PosPage() {
  const t = useTranslations();
  const { session, error } = usePosSession();

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!session) return <p className="text-subtle">{t("common.loading")}</p>;
  return <PosScreen session={session} />;
}
