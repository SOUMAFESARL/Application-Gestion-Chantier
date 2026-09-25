/**
 * Formats d'affichage — Socle Commun §1.2 et §1.3, charte §9.
 *
 * L'API ne formate rien : elle renvoie des entiers de centimes et des
 * horodatages UTC. Toute mise en forme passe par ce module, et par lui
 * seul — c'est ce qui évite que deux écrans affichent le même montant
 * de deux façons différentes.
 */

import { texte } from "@/i18n/horsReact";
import { LANGUE_PAR_DEFAUT } from "@/i18n/langue";

/** Espace insécable — séparateur de milliers imposé par le Socle Commun §1.3. */
const INSECABLE = " ";

/**
 * Le nom d'un pays depuis son code ISO, par la plateforme.
 *
 * Même raisonnement que pour les mois : `Intl` connait les neuf pays de M8
 * dans toutes les langues, au caractère près. Ils étaient écrits en français
 * dans un tableau de libellés, hors de portée du garde-fou du Socle §1.1.
 */
const nomsDePays = new Intl.DisplayNames([LANGUE_PAR_DEFAUT], { type: "region" });

export function nomDePays(code: string): string {
  return nomsDePays.of(code) ?? code;
}

/** Marque d'absence de valeur. Jamais « 0 FCFA » pour dire « non renseigné ». */
export const ABSENT = "—";

// ---------------------------------------------------------------------------
// Montants
// ---------------------------------------------------------------------------

/**
 * Convertit des centimes de FCFA en francs.
 * Le FCFA n'a pas de subdivision à l'usage : on arrondit à l'entier.
 */
export function centimesEnFrancs(centimes: number): number {
  return Math.round(centimes / 100);
}

/**
 * Montant complet, pour un formulaire ou une fiche.
 * `87500000000` → « 875 000 000 FCFA »
 */
export function formaterMontant(
  centimes: number | null | undefined,
  options: { avecDevise?: boolean } = {},
): string {
  if (centimes === null || centimes === undefined) return ABSENT;

  const { avecDevise = true } = options;
  const francs = centimesEnFrancs(centimes);
  const nombre = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  })
    .format(francs)
    .replace(/\s/g, INSECABLE);

  return avecDevise ? `${nombre}${INSECABLE}FCFA` : nombre;
}

/**
 * Montant abrégé, pour un tableau ou une tuile d'indicateur.
 * `87500000000` → « 875 M FCFA » · `120000000000` → « 1,2 Md FCFA »
 */
export function formaterMontantCourt(centimes: number | null | undefined): string {
  if (centimes === null || centimes === undefined) return ABSENT;

  const francs = centimesEnFrancs(centimes);
  const absolu = Math.abs(francs);
  const signe = francs < 0 ? "-" : "";

  const abreger = (valeur: number, unite: string): string => {
    const arrondi = Math.round(valeur * 10) / 10;
    const texte = Number.isInteger(arrondi)
      ? String(arrondi)
      : String(arrondi).replace(".", ",");
    return `${signe}${texte}${INSECABLE}${unite}${INSECABLE}FCFA`;
  };

  if (absolu >= 1_000_000_000) return abreger(absolu / 1_000_000_000, "Md");
  if (absolu >= 1_000_000) return abreger(absolu / 1_000_000, "M");
  if (absolu >= 1_000) return abreger(absolu / 1_000, "k");
  return formaterMontant(centimes);
}

/**
 * Montant en millions de FCFA, sans unité — pour une colonne dont l'en-tête
 * porte déjà « M FCFA ». `120000000000` → « 1 200 » · `48550000000` → « 485,5 »
 */
export function formaterMillions(centimes: number | null | undefined): string {
  if (centimes === null || centimes === undefined) return ABSENT;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
    .format(centimesEnFrancs(centimes) / 1_000_000)
    .replace(/\s/g, INSECABLE);
}

/**
 * Saisie utilisateur → centimes. L'utilisateur tape « 875 000 000 ».
 * Renvoie `null` si la saisie ne contient aucun chiffre.
 */
export function saisieEnCentimes(saisie: string): number | null {
  const chiffres = saisie.replace(/[^\d-]/g, "");
  if (chiffres === "" || chiffres === "-") return null;
  return Number.parseInt(chiffres, 10) * 100;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function versDate(valeur: string | Date | null | undefined): Date | null {
  if (!valeur) return null;
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-03-01` → « 01/03/2026 » */
export function formaterDate(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur);
  if (!date) return ABSENT;
  const jour = String(date.getDate()).padStart(2, "0");
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}/${date.getFullYear()}`;
}

/** `2026-08-25T07:12:04Z` → « 07:12 » (heure locale de l'utilisateur) */
export function formaterHeure(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur);
  if (!date) return ABSENT;
  const heures = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${heures}:${minutes}`;
}

/** `2026-08-25T07:12:04Z` → « 25/08/2026 à 07:12 » */
export function formaterDateHeure(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur);
  if (!date) return ABSENT;
  return texte("format.dateHeure", { date: formaterDate(date), heure: formaterHeure(date) });
}

/** Durée en jours → « 18 mois » au-delà de 60 jours, « 47 jours » sinon. */
export function formaterDuree(jours: number | null | undefined): string {
  if (jours === null || jours === undefined) return ABSENT;
  if (Math.abs(jours) >= 60) {
    const mois = Math.round(jours / 30);
    return `${mois} mois`;
  }
  return `${jours} jour${Math.abs(jours) > 1 ? "s" : ""}`;
}

// ---------------------------------------------------------------------------
// Pourcentages
// ---------------------------------------------------------------------------

/**
 * L'API transporte les pourcentages en chaîne décimale (`"42.50"`)
 * pour qu'aucune couche ne les arrondisse en chemin.
 */
export function formaterPourcentage(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return ABSENT;
  const nombre = typeof valeur === "string" ? Number.parseFloat(valeur) : valeur;
  if (Number.isNaN(nombre)) return ABSENT;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(nombre)}${INSECABLE}%`;
}

/** Indice de santé 0-100 → couleur sémantique de la charte (CDC module 1). */
export function couleurIndiceSante(indice: number | null | undefined): "vert" | "orange" | "rouge" | "inconnu" {
  if (indice === null || indice === undefined) return "inconnu";
  if (indice >= 70) return "vert";
  if (indice >= 40) return "orange";
  return "rouge";
}
