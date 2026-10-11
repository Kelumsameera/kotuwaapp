import { useTranslations } from "next-intl";

// Colour for each shop/product status.
const COLORS = {
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  draft: "bg-muted text-subtle",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

// A small coloured label such as "Approved" or "Pending review".
export default function StatusBadge({ status }) {
  const t = useTranslations("status");
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status] || COLORS.draft}`}>
      {t(status)}
    </span>
  );
}
