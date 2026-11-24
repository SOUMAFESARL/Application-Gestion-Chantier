import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { CategorieReferentielPlateforme } from "@/features/administration";

import { ListeReferentiel } from "../ListeReferentiel";

const CATEGORIE_MODES_EXECUTION: CategorieReferentielPlateforme = "modes-execution";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentielsModesExecution") };
}

export default function PageModesExecutionPlateforme() {
  return <ListeReferentiel categorie={CATEGORIE_MODES_EXECUTION} />;
}
