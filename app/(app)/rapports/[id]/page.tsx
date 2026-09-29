import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RapportJournalierDocument } from "./RapportJournalierDocument";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journal.rapport");
  return { title: t("titre") };
}

/**
 * Écran « Rapport journalier »
 *
 * Motif d'interface : Circuit d'approbation
 *
 * Le rapport d'un lot pour un jour, tel que le chef de chantier l'a signé,
 * et où en est sa validation CC → CT → CP. La page ne porte que le gabarit :
 * la lecture vit dans `RapportJournalierDocument`.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RapportJournalierDocument id={id} />;
}
