import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function ContratsPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("contrats.titre")} description={t("aConstruire", { motif: t("contrats.motif") })} />
  );
}
