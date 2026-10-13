import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranSaisie } from "./EcranSaisie";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journal.saisie");
  return { title: t("titre") };
}

/**
 * Écran « Rédiger le rapport journalier » — chef de chantier.
 *
 * Motif d'interface : Formulaire de saisie terrain (mobile d'abord)
 *
 * Un chantier, un jour (`?date=AAAA-MM-JJ`, aujourd'hui par défaut) : le
 * rapport couvre tous les lots en cours du chantier. La page ne porte que le
 * gabarit : tout se lit côté navigateur, dans `EcranSaisie`.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projetId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ projetId }, { date }] = await Promise.all([params, searchParams]);
  const jour = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  return <EcranSaisie projetId={projetId} date={jour} />;
}
