import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AssistantAbonnement } from "./AssistantAbonnement";

/**
 * Écran « Formule & Tarifs » — souscription à l'abonnement via CinetPay.
 *
 * `POST /abonnement/souscription/` n'est pas encore écrit côté Django : voir
 * `AssistantAbonnement` et `SIMULATION_ACTIVE` (`abonnement`, T-025).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("abonnement.tarifs");
  return { title: t("titre") };
}

export default function Page() {
  return <AssistantAbonnement />;
}
