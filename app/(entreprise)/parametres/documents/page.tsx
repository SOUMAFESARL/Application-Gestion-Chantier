import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ReglageDocumentsEntreprise } from "./ReglageDocumentsEntreprise";

/**
 * Écran « En-tête et pied des documents » : ce que l'entreprise imprime en haut et en bas
 * de ses PDF (fiche projet, rapports, synthèses, bons de réception).
 *
 * Tout le monde le consulte ; le modifier exige `administration.documents_gerer` (DG et AD) —
 * la garde de l'écran (`ReglageDocumentsEntreprise`) désactive les contrôles d'écriture, le
 * serveur refuse de toute façon.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reglageDocuments");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return <ReglageDocumentsEntreprise />;
}
