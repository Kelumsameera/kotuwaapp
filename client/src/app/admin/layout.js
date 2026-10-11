import { useTranslations } from "next-intl";
import SubNav from "@/components/ui/SubNav";

// Shared tabs for every /admin page. Access is checked by proxy.js and by the API.
export default function AdminLayout({ children }) {
  const t = useTranslations("admin");
  const links = [
    { href: "/admin", label: t("users") },
    { href: "/admin/shops", label: t("shops") },
    { href: "/admin/products", label: t("products") },
    { href: "/admin/categories", label: t("categories") },
    { href: "/admin/orders", label: t("orders") },
    { href: "/admin/settings", label: t("settings") },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-ink">{t("title")}</h1>
      <SubNav links={links} />
      {children}
    </div>
  );
}
