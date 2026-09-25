import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

/**
 * Écran « Lots & activités »
 *
 * Motif d'interface : Liste filtrable
 *
 * Les lots saisis à l'étape 2 de la création d'un projet, et les activités
 * qu'on y rattache ensuite. Squelette en attendant l'écran.
 */
export default function LotsActivitesPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage
      titre={t("lotsActivites.titre")}
      description={t("aConstruire", { motif: t("lotsActivites.motif") })}
    />
  );
}
