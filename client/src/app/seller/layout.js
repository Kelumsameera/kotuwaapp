import { useTranslations } from "next-intl";
import SubNav from "@/components/ui/SubNav";

// Shared tabs for every /seller page. Access is checked by proxy.js and by the API.
export default function SellerLayout({ children }) {
  const t = useTranslations("seller");
  const links = [
    { href: "/seller", label: t("dashboard") },
    { href: "/seller/shop", label: t("shopSettings") },
    { href: "/seller/products", label: t("products") },
    { href: "/seller/orders", label: t("orders") },
    { href: "/seller/earnings", label: t("earnings") },
    { href: "/seller/staff", label: t("staff") },
    { href: "/seller/shipping", label: t("deliveryRates") },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-ink">{t("title")}</h1>
      <SubNav links={links} />
      {children}
    </div>
  );
}
