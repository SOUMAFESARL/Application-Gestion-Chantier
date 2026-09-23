import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HistoriquePaiements } from "./HistoriquePaiements";

/**
 * Écran « Historique des paiements » — `GET /abonnement/paiements/` (T-025).
 *
 * Pas encore écrit côté Django : voir `HistoriquePaiements` et
 * `SIMULATION_ACTIVE`.
 *
 * Pas de largeur centrée : le titre s'aligne sur la gouttière du layout,
 * comme sur tous les autres écrans.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("abonnement.historique");
  return { title: t("titre") };
}

export default function Page() {
  return <HistoriquePaiements />;
}
