import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionReferentiel } from "@/features/projets/components/GestionReferentiel";
import { REFERENTIEL_MODES_EXECUTION } from "@/features/projets/referentiels";

import { NavigationListesModeles } from "../NavigationListesModeles";

/**
 * Écran dédié aux modes d'exécution de l'entreprise (`/parametres/listes/modes-execution`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projets.referentiels.gestion");
  return { title: t(`titre.${REFERENTIEL_MODES_EXECUTION}`) };
}

export default async function PageModesExecution() {
  const t = await getTranslations("projets.referentiels.gestion");
  return (
    <div className="flex flex-col gap-5">
      <NavigationListesModeles titre={t("titrePage")} description={t("descriptionPage")} />
      <GestionReferentiel categorie={REFERENTIEL_MODES_EXECUTION} />
    </div>
  );
}
