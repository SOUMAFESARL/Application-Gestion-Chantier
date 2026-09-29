import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { JournalChantier } from "./JournalChantier";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journal");
  return { title: t("titre") };
}

/**
 * Écran « Journal de chantier » — vue du Directeur Général
 * (docs/PLAN_INTERFACES_DG.md §3).
 *
 * Motif d'interface : Liste filtrable
 *
 * La page ne porte que le gabarit : le journal est lu côté navigateur
 * (React Query), donc tout ce qui dépend de la réponse vit dans
 * `JournalChantier`.
 */
export default function Page() {
  return <JournalChantier />;
}
