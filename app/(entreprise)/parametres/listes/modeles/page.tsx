import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionModelesDecoupage } from "@/features/decoupage/components/GestionModelesDecoupage";

import { NavigationListesModeles } from "../NavigationListesModeles";

/**
 * Écran dédié aux modèles de découpage de projet de l'entreprise (`/parametres/listes/modeles`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("decoupage.modeles");
  return { title: t("titre") };
}

export default async function PageModelesDecoupage() {
  const t = await getTranslations("projets.referentiels.gestion");
  return (
    <div className="flex flex-col gap-5">
      <NavigationListesModeles titre={t("titrePage")} description={t("descriptionPage")} />
      <GestionModelesDecoupage />
    </div>
  );
}
