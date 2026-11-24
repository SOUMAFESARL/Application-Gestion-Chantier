/**
 * Règles métier du domaine Tiers — pures, sans React.
 */

import { texte } from "@/i18n/horsReact";
import {
  analyserTelephone,
  CODE_INTERNATIONAL,
  paysTelephone,
  telephoneInternationalValide,
} from "@/features/referentiels/telephone";

import {
  ROLES_TIERS,
  TYPES_TIERS,
  type CriteresTiers,
  type FiltreStatutTiers,
  type RoleTiers,
  type Tiers,
  type TypeTiers,
} from "./types";

/** Permission requise pour créer, modifier, activer/désactiver ou supprimer un tiers. */
export const PERMISSION_TIERS_ECRIRE = "tiers.ecrire";

/** Permission requise pour consulter les tiers. */
export const PERMISSION_TIERS_LIRE = "tiers.lire";

export const CRITERES_TIERS_VIDES: CriteresTiers = {
  recherche: "",
  role: "",
  typeTiers: "",
  statut: "",
};

/**
 * Valide le numéro de téléphone d'un tiers selon le pays par défaut reçu
 * et les règles internationales.
 */
export function telephoneTiersValide(
  telephone: string,
  paysDefaut: string,
): boolean {
  const brut = (telephone || "").trim();
  if (!brut) return false;
  return telephoneInternationalValide(brut, paysDefaut);
}

/**
 * Retourne le message d'erreur si le numéro de téléphone saisi est complet mais invalide,
 * ou undefined s'il est vide, en cours de saisie ou valide.
 */
export function erreurTelephoneTiers(
  telephone: string,
  paysDefaut: string,
): string | undefined {
  const { pays, national } = analyserTelephone(telephone, paysDefaut, {
    international: true,
  });

  if (!national) return undefined;

  // Seuil de complétude : 8 chiffres minimum pour le format international E.164, ou la longueur minimale du pays.
  const minimum =
    pays === CODE_INTERNATIONAL ? 8 : paysTelephone(pays).longueurMin;

  if (national.length < minimum) return undefined;

  if (!telephoneTiersValide(telephone, paysDefaut)) {
    return texte("tiersAjoutRapide.erreurFormat");
  }

  return undefined;
}

function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function criteresTiersActifs(criteres: CriteresTiers): boolean {
  return (
    criteres.recherche.trim() !== "" ||
    criteres.role !== "" ||
    criteres.typeTiers !== "" ||
    criteres.statut !== ""
  );
}

export function filtrerTiers(liste: Tiers[], criteres: CriteresTiers): Tiers[] {
  const terme = normaliser(criteres.recherche);

  return liste.filter((tiers) => {
    if (criteres.role && !tiers.roles.includes(criteres.role)) return false;
    if (criteres.typeTiers && tiers.typeTiers !== criteres.typeTiers) return false;
    if (criteres.statut === "ACTIF" && !tiers.estActif) return false;
    if (criteres.statut === "INACTIF" && tiers.estActif) return false;
    if (!terme) return true;

    return [
      tiers.raisonSociale,
      tiers.telephone,
      tiers.email,
      tiers.ville,
      tiers.rccm,
      tiers.nif,
    ].some((champ) => normaliser(champ).includes(terme));
  });
}

export function rolesPresentsTiers(liste: Tiers[]): RoleTiers[] {
  const presents = new Set<RoleTiers>();
  for (const tiers of liste) {
    for (const role of tiers.roles) {
      presents.add(role);
    }
  }
  return ROLES_TIERS.filter((role) => presents.has(role));
}

export function typesPresentsTiers(liste: Tiers[]): TypeTiers[] {
  const presents = new Set(liste.map((tiers) => tiers.typeTiers));
  return TYPES_TIERS.filter((type) => presents.has(type));
}

export function statutsPresentsTiers(
  liste: Tiers[],
): Exclude<FiltreStatutTiers, "">[] {
  const out: Exclude<FiltreStatutTiers, "">[] = [];
  if (liste.some((t) => t.estActif)) out.push("ACTIF");
  if (liste.some((t) => !t.estActif)) out.push("INACTIF");
  return out;
}

export function initialesTiers(raisonSociale: string): string {
  const mots = raisonSociale.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return `${mots[0][0] ?? ""}${mots[1][0] ?? ""}`.toUpperCase();
}

export function formaterNoteEvaluation(note: number | null): string {
  if (note === null || Number.isNaN(note)) return "";
  return `${note.toFixed(1)}/5`;
}
