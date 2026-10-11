import Link from "next/link";
import { useTranslations } from "next-intl";
import Card from "@/components/ui/Card";

// Shown when a logged-in user opens an area their role cannot use.
export default function ForbiddenPage() {
  const t = useTranslations("forbidden");
  return (
    <Card title={t("title")} className="mx-auto max-w-md">
      <p className="text-subtle">{t("body")}</p>
      <Link href="/" className="mt-4 inline-block text-brand hover:underline">
        {t("back")}
      </Link>
    </Card>
  );
}
