import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionReferentiel } from "@/features/projets/components/GestionReferentiel";
import { REFERENTIEL_TYPES_PROJET } from "@/features/projets/referentiels";

import { NavigationListesModeles } from "../NavigationListesModeles";

/**
 * Écran dédié aux types de projet de l'entreprise (`/parametres/listes/types-projet`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projets.referentiels.gestion");
  return { title: t(`titre.${REFERENTIEL_TYPES_PROJET}`) };
}

export default async function PageTypesProjet() {
  const t = await getTranslations("projets.referentiels.gestion");
  return (
    <div className="flex flex-col gap-5">
      <NavigationListesModeles titre={t("titrePage")} description={t("descriptionPage")} />
      <GestionReferentiel categorie={REFERENTIEL_TYPES_PROJET} />
    </div>
  );
}
