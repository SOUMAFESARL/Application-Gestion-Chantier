import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { CategorieReferentielPlateforme } from "@/features/administration";

import { ListeReferentiel } from "../ListeReferentiel";

const CATEGORIE_FONCTIONS_EQUIPE: CategorieReferentielPlateforme = "fonctions-equipe";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentielsFonctionsEquipe") };
}

export default function PageFonctionsEquipePlateforme() {
  return <ListeReferentiel categorie={CATEGORIE_FONCTIONS_EQUIPE} />;
}
