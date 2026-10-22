import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CalendrierEntreprise } from "./CalendrierEntreprise";

/**
 * Écran « Calendrier de l'entreprise » (SFD F3 §6, erratum E-4).
 *
 * Un seul calendrier par entreprise, lu partout où l'on compte des jours
 * ouvrés. Tout le monde le consulte ; le modifier exige
 * `administration.calendrier_gerer` — la garde de l'écran (`CalendrierEntreprise`)
 * masque les gestes d'écriture, le serveur refuse de toute façon.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendrier");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return <CalendrierEntreprise />;
}
