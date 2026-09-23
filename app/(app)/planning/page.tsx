import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function PlanningPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("planning.titre")} description={t("aConstruire", { motif: t("planning.motif") })} />
  );
}
