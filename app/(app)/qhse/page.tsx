import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function QhsePage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("qhse.titre")} description={t("aConstruire", { motif: t("qhse.motif") })} />
  );
}
