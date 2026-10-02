import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function RhPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("rh.titre")} description={t("aConstruire", { motif: t("rh.motif") })} />
  );
}
