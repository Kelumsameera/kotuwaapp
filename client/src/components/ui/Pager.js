import { useTranslations } from "next-intl";
import Button from "./Button";

// Previous / "Page 2 of 5" / Next.
export default function Pager({ page, pageCount, onPageChange }) {
  const t = useTranslations();
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-subtle">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t("common.previous")}
      </Button>
      <span>{t("admin.pageInfo", { page, pages: pageCount })}</span>
      <Button variant="secondary" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        {t("common.next")}
      </Button>
    </div>
  );
}
