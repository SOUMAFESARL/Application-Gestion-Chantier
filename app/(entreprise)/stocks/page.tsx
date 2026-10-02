import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

export default function StocksPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("stocks.titre")} description={t("aConstruire", { motif: t("stocks.motif") })} />
  );
}
