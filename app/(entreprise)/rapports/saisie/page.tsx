import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ChoixRapportSaisie } from "./ChoixRapportSaisie";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journal.saisie");
  return { title: t("titre") };
}

/**
 * Écran « Mes rapports journaliers » — chef de chantier.
 *
 * Motif d'interface : Liste de tâches (mobile d'abord)
 *
 * Le chantier choisi, le rapport du jour choisi, et tous les rapports encore
 * attendus : jamais commencés, en brouillon ou rejetés.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string; projet?: string }> }) {
  const { date, projet } = await searchParams;
  return <ChoixRapportSaisie date={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null} projet={projet ?? null} />;
}
