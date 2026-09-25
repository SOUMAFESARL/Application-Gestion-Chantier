import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

/**
 * Écran « Équipe & affectations »
 *
 * Motif d'interface : Liste filtrable
 *
 * Les affectations saisies à l'étape 3 de la création d'un projet (chef de
 * projet, conducteur de travaux, chefs de chantier…). Squelette en attendant
 * l'écran.
 */
export default function EquipeAffectationsPage() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage
      titre={t("equipeAffectations.titre")}
      description={t("aConstruire", { motif: t("equipeAffectations.motif") })}
    />
  );
}
