"use client";

import { useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { usePosSession } from "@/lib/usePosSession";
import Alert from "@/components/ui/Alert";
import PosReports from "@/components/pos/PosReports";

// /pos/reports — daily and per-cashier POS reports (shop owner only; the API refuses cashiers).
export default function PosReportsPage() {
  const t = useTranslations();
  const { session, error } = usePosSession();

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!session) return <p className="text-subtle">{t("common.loading")}</p>;
  return <PosReports today={session.today} />;
}
