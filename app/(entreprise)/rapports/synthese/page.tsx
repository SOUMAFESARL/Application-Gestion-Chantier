import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SyntheseDocument } from "./SyntheseDocument";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journal.synthese");
  return { title: t("titre") };
}

type Parametres = { [cle: string]: string | string[] | undefined };

const texte = (valeur: string | string[] | undefined) => (typeof valeur === "string" ? valeur : "");

/**
 * Écran « Synthèse périodique »
 *
 * Motif d'interface : Circuit d'approbation
 *
 * La synthèse d'un chantier sur une semaine, un mois ou une période libre,
 * agrégée des rapports journaliers. Tout ce qui la décrit est dans l'adresse
 * (`?projet=&type=&debut=&fin=`) : elle se partage comme un lien.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Parametres> }) {
  const parametres = await searchParams;
  return (
    <SyntheseDocument
      projetId={texte(parametres.projet)}
      type={texte(parametres.type)}
      debut={texte(parametres.debut)}
      fin={texte(parametres.fin)}
    />
  );
}
