import Link from "next/link";
import { useTranslations } from "next-intl";

// The bottom bar: tracking link and site name.
export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-subtle">
        <span>
          {t("common.appName")} · {t("common.tagline")}
        </span>
        <nav className="flex gap-4">
          <Link href="/track" className="hover:text-ink">
            {t("track.title")}
          </Link>
          <Link href="/register?as=seller" className="hover:text-ink">
            {t("home.sellCta")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
