"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import TotalsCards from "@/components/pos/TotalsCards";

// /pos/my-day — the logged-in person's own sales today, to count the cash drawer at shift end.
export default function MyDayPage() {
  const t = useTranslations();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/pos/reports/my-day")
      .then((data) => setReport(data.report))
      .catch((loadError) => setError(loadError));
  }, []);

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!report) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">{t("pos.myDayTitle", { date: report.date })}</h1>
      <TotalsCards totals={report.totals} />
      <p className="text-sm text-subtle">{t("pos.cashDrawerHint")}</p>
    </div>
  );
}
