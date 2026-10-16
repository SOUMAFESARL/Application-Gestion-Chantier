import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { GestionReferentiel } from "@/features/projets/components/GestionReferentiel";
import { REFERENTIEL_LOTS, REFERENTIEL_TYPES_PROJET } from "@/features/projets/referentiels";

/**
 * Les listes de l'entreprise : types de projet et noms de lot. Ce qu'elle y
 * ajoute est proposé à tous ses collaborateurs ; ce que la plateforme y a
 * posé ne se retire pas d'ici.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projets.referentiels.gestion");
  return { title: t("titrePage") };
}

export default async function Page() {
  const t = await getTranslations("projets.referentiels.gestion");
  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titrePage")} description={t("descriptionPage")} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GestionReferentiel categorie={REFERENTIEL_TYPES_PROJET} />
        <GestionReferentiel categorie={REFERENTIEL_LOTS} />
      </div>
    </div>
  );
}
