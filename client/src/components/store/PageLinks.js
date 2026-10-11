import Link from "next/link";
import { useTranslations } from "next-intl";

// Previous / Next links for server-rendered lists. makeHref(page) builds each link.
export default function PageLinks({ page, total, limit, makeHref }) {
  const t = useTranslations();
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (pageCount <= 1) return null;

  const linkClass = "rounded-md border border-line px-4 py-2 text-sm text-ink hover:bg-muted";
  return (
    <nav className="mt-6 flex items-center justify-between text-sm text-subtle">
      {page > 1 ? <Link href={makeHref(page - 1)} className={linkClass}>{t("common.previous")}</Link> : <span />}
      <span>{t("admin.pageInfo", { page, pages: pageCount })}</span>
      {page < pageCount ? <Link href={makeHref(page + 1)} className={linkClass}>{t("common.next")}</Link> : <span />}
    </nav>
  );
}
