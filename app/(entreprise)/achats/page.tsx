import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function AchatsPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("achats.titre")} description={t("aConstruire", { motif: t("achats.motif") })} />
  );
}
