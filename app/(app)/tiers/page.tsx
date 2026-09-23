import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function TiersPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("tiers.titre")} description={t("aConstruire", { motif: t("tiers.motif") })} />
  );
}
