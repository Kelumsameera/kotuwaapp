import { useTranslations } from "next-intl";

// Colour for each order status.
const COLORS = {
  placed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  packed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  out_for_delivery: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  delivered: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-muted text-subtle",
  delivery_failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  return_requested: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  returned: "bg-muted text-subtle",
};

// A small coloured label such as "Placed" or "Out for delivery".
export default function OrderStatusBadge({ status }) {
  const t = useTranslations("orderStatus");
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status] || COLORS.placed}`}>{t(status)}</span>;
}
