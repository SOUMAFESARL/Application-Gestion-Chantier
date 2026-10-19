/**
 * Règles métier du domaine Tiers.
 */

import { texte } from "@/i18n/horsReact";
import {
  analyserTelephone,
  CODE_INTERNATIONAL,
  paysTelephone,
  telephoneInternationalValide,
} from "@/features/referentiels/telephone";

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
