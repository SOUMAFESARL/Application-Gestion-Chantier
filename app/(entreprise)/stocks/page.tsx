import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { OngletStock } from "@/features/stocks";

import { GestionStock } from "./GestionStock";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stocks");
  return { title: t("titre") };
}

const ONGLETS: readonly OngletStock[] = [
  "afaire",
  "stock",
  "demandes",
  "commandes",
  "receptions",
  "mouvements",
  "inventaires",
  "referentiel",
];

/**
 * Écran « Stock de chantier » — module F9 (cahier v1.2).
 *
 * Motif d'interface : Liste filtrable à onglets
 *
 * `?onglet=` ouvre un onglet (le tableau de bord y renvoie la file des DA),
 * `?projet=` un chantier. Tout le reste se lit côté navigateur.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; projet?: string }>;
}) {
  const { onglet, projet } = await searchParams;
  const ongletInitial = ONGLETS.find((cle) => cle === onglet) ?? null;
  return <GestionStock ongletInitial={ongletInitial} projetInitial={projet ?? ""} />;
}
