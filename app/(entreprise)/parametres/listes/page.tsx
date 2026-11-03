import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionListesValeurs } from "@/features/decoupage/components/GestionListesValeurs";

import { NavigationListesModeles } from "./NavigationListesModeles";

/**
 * Écran dédié aux listes de valeurs de découpage de l'entreprise (`/parametres/listes`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("decoupage.listes");
  return { title: t("titre") };
}

export default async function PageListesValeurs() {
  const t = await getTranslations("projets.referentiels.gestion");
  return (
    <div className="flex flex-col gap-5">
      <NavigationListesModeles titre={t("titrePage")} description={t("descriptionPage")} />
      <GestionListesValeurs />
    </div>
  );
}
