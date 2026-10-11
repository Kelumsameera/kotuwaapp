import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/formatDate";

// The status history of one sub-order, newest at the bottom.
export default function OrderTimeline({ events }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <ol className="relative ml-2 border-l border-line">
      {events.map((event, index) => (
        <li key={`${event.status}-${index}`} className="mb-3 ml-4">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-brand" aria-hidden="true" />
          <div className="text-sm font-medium text-ink">{t(`orderStatus.${event.status}`)}</div>
          <div className="text-xs text-subtle">
            {formatDateTime(event.at, locale)}
            {event.byRole && ` · ${t(`roles.${event.byRole}`)}`}
          </div>
          {event.note && <div className="text-sm text-ink">{event.note}</div>}
        </li>
      ))}
    </ol>
  );
}
