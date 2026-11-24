import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { CategorieReferentielPlateforme } from "@/features/administration";

import { ListeReferentiel } from "../ListeReferentiel";

const CATEGORIE_TYPES_PROJET: CategorieReferentielPlateforme = "types-projet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentielsTypesProjet") };
}

export default function PageTypesProjetPlateforme() {
  return <ListeReferentiel categorie={CATEGORIE_TYPES_PROJET} />;
}
