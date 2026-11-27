/**
 * Règles de calcul du domaine Abonnement — pures, sans réseau ni React.
 */

import type { CodePlan, DefinitionPlan, Periodicite } from "./types";

const JOUR_MS = 24 * 3600 * 1000;

export interface DureeRestanteAbonnement {
  annees: number;
  mois: number;
  jours: number;
  totalJours: number;
}

/** Décalage calendaire de `n` mois en UTC avec bornage au dernier jour du mois. */
function decalerMoisUtc(date: Date, n: number): Date {
  const cible = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
  const dernierJour = new Date(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cible.setUTCDate(Math.min(date.getUTCDate(), dernierJour));
  return cible;
}

function dateLocaleEnUtcMinuit(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function parserDateIsoEnUtcMinuit(dateIso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso.trim());
  if (!match) return null;
  const annee = Number(match[1]);
  const mois = Number(match[2]) - 1;
  const jour = Number(match[3]);
  const resultat = new Date(Date.UTC(annee, mois, jour));
  if (
    resultat.getUTCFullYear() !== annee ||
    resultat.getUTCMonth() !== mois ||
    resultat.getUTCDate() !== jour
  ) {
    return null;
  }
  return resultat;
}

function calculerDureeCalendaire(debut: Date, fin: Date): DureeRestanteAbonnement {
  const totalJours = Math.round((fin.getTime() - debut.getTime()) / JOUR_MS);
  if (totalJours <= 0) {
    return { annees: 0, mois: 0, jours: 0, totalJours: 0 };
  }

  let moisPleins =
    (fin.getUTCFullYear() - debut.getUTCFullYear()) * 12 +
    fin.getUTCMonth() -
    debut.getUTCMonth();
  if (decalerMoisUtc(debut, moisPleins) > fin) {
    moisPleins -= 1;
  }

  const jours = Math.round(
    (fin.getTime() - decalerMoisUtc(debut, moisPleins).getTime()) / JOUR_MS,
  );

  return {
    annees: Math.floor(moisPleins / 12),
    mois: moisPleins % 12,
    jours,
    totalJours,
  };
}

/**
 * Découpe calendairement le temps restant jusqu'à une date d'échéance ISO (`YYYY-MM-DD`)
 * en années, mois et jours exacts selon le calendrier grégorien.
 */
export function dureeRestanteDepuisDate(
  dateFinIso: string | null | undefined,
  maintenant: Date = new Date(),
): DureeRestanteAbonnement | null {
  if (!dateFinIso) return null;
  const fin = parserDateIsoEnUtcMinuit(dateFinIso);
  if (!fin) return null;
  return calculerDureeCalendaire(dateLocaleEnUtcMinuit(maintenant), fin);
}

/**
 * Repli calendaire exact à partir d'un nombre de jours restants quand seule
 * l'information numérique est disponible.
 */
export function dureeRestanteDepuisJours(
  joursRestants: number,
  maintenant: Date = new Date(),
): DureeRestanteAbonnement {
  if (joursRestants <= 0) {
    return { annees: 0, mois: 0, jours: 0, totalJours: 0 };
  }
  const debut = dateLocaleEnUtcMinuit(maintenant);
  const fin = new Date(
    Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate() + joursRestants),
  );
  return calculerDureeCalendaire(debut, fin);
}

/** Vrai uniquement pour « 1 an », « 1 mois » ou « 1 jour » (accord de « restant »). */
export function estDureeSinguliere(duree: {
  annees: number;
  mois: number;
  jours: number;
}): boolean {
  return duree.annees + duree.mois + duree.jours === 1;
}

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
