"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { errorMessage } from "@/lib/apiClient";
import { useMyShop } from "@/lib/useMyShop";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import ShopForm from "./ShopForm";

// The shop settings page: edit name, address, description, logo and banner.
export default function ShopSettings() {
  const t = useTranslations();
  const { shop, setShop, isLoading, hasNoShop, error } = useMyShop();

  if (isLoading) return <p className="text-subtle">{t("common.loading")}</p>;
  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (hasNoShop) {
    return (
      <Link href="/seller" className="text-brand hover:underline">
        {t("shop.openTitle")}
      </Link>
    );
  }
  if (shop.status === "suspended") return <Alert type="error">{t("seller.shopStatusHelp.suspended")}</Alert>;

  return (
    <Card title={t("seller.shopSettings")}>
      {shop.status === "rejected" && <p className="mb-4 text-sm text-subtle">{t("shop.resubmitNote")}</p>}
      {/* key: re-create the form with fresh values after each save */}
      <ShopForm key={shop.id + shop.status} shop={shop} onSaved={setShop} />
    </Card>
  );
}
