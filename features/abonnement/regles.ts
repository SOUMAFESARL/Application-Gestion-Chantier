/**
 * Règles de calcul du domaine Abonnement — pures, sans réseau ni React.
 */

import type { CodePlan, DefinitionPlan, Periodicite } from "./types";

export function planParCode(plans: DefinitionPlan[], code: CodePlan): DefinitionPlan | undefined {
  return plans.find((plan) => plan.code === code);
}

/** Le prix TTC du plan pour la périodicité choisie. */
export function prixPeriode(plan: DefinitionPlan, periodicite: Periodicite): number {
  return periodicite === "ANNUELLE" ? plan.prix_annuel_centimes : plan.prix_mensuel_centimes;
}

/**
 * Décompose un montant TTC en HT + TVA à partir d'un taux en pourcentage.
 * L'arrondi porte sur le HT — c'est la TVA qui absorbe l'écart, jamais le
 * total affiché au client, qui doit rester celui du plan choisi.
 */
export function decomposerTva(
  montantTtcCentimes: number,
  tauxTvaPourcent: number,
): { ht: number; tva: number } {
  const ht = Math.round(montantTtcCentimes / (1 + tauxTvaPourcent / 100));
  return { ht, tva: montantTtcCentimes - ht };
}
