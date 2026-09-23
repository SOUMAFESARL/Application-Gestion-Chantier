import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function EquipementsPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("equipements.titre")} description={t("aConstruire", { motif: t("equipements.motif") })} />
  );
}
