import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionReferentiel } from "@/features/projets/components/GestionReferentiel";
import { REFERENTIEL_FONCTIONS_EQUIPE } from "@/features/projets/referentiels";

import { NavigationListesModeles } from "../NavigationListesModeles";

/**
 * Écran dédié aux fonctions d'équipe de l'entreprise (`/parametres/listes/fonctions-equipe`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projets.referentiels.gestion");
  return { title: t(`titre.${REFERENTIEL_FONCTIONS_EQUIPE}`) };
}

export default async function PageFonctionsEquipe() {
  const t = await getTranslations("projets.referentiels.gestion");
  return (
    <div className="flex flex-col gap-5">
      <NavigationListesModeles titre={t("titrePage")} description={t("descriptionPage")} />
      <GestionReferentiel categorie={REFERENTIEL_FONCTIONS_EQUIPE} />
    </div>
  );
}
