"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import SubNav from "@/components/ui/SubNav";

// Tabs for the POS. Reports are for the shop owner only (the API refuses cashiers anyway).
export default function PosLayout({ children }) {
  const t = useTranslations("pos");
  const { user } = useAuth();
  const links = [
    { href: "/pos", label: t("billing") },
    { href: "/pos/my-day", label: t("myDay") },
  ];
  if (user?.role === "seller") links.push({ href: "/pos/reports", label: t("reports") });

  return (
    <div className="print:m-0">
      <SubNav links={links} />
      {children}
    </div>
  );
}
