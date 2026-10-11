import { useTranslations } from "next-intl";
import Card from "@/components/ui/Card";

// Placeholder for areas built in later phases. Reaching it proves route protection works.
export default function ComingSoon({ areaKey, phase }) {
  const t = useTranslations();
  return (
    <Card title={t(`nav.${areaKey}`)}>
      <p className="text-subtle">{t("comingSoon.body", { phase })}</p>
    </Card>
  );
}
