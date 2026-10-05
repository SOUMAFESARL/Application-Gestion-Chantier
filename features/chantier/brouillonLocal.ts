/**
 * La copie locale du rapport en cours — ce qui survit à une coupure.
 *
 * Le brouillon part au serveur toutes les 30 secondes ; entre deux envois, ou
 * quand le réseau du chantier tombe, la saisie est recopiée ici à chaque
 * frappe. Fermer l'onglet, perdre le réseau ou vider la batterie ne coûte
 * donc rien : à la réouverture, la copie la plus récente l'emporte.
 *
 * C'est le pendant web du SQLite chiffré de l'application Android (SFD §8) :
 * moins protégé — le `localStorage` n'est pas chiffré —, il ne garde que le
 * rapport en cours, et l'efface dès qu'il est soumis.
 */

import type { ValeursRapport } from "./validations";

const PREFIXE = "ccd.journal.saisie";

export interface CopieLocale {
  valeurs: ValeursRapport;
  /** L'instant de la dernière frappe recopiée. */
  modifieLe: string;
}

function cle(projetId: string, date: string): string {
  return `${PREFIXE}.${projetId}.${date}`;
}

export function lireCopieLocale(projetId: string, date: string): CopieLocale | null {
  try {
    const brut = localStorage.getItem(cle(projetId, date));
    if (!brut) return null;
    const copie = JSON.parse(brut) as CopieLocale;
    // Une copie d'avant la saisie libre des matériaux portait des lignes du
    // stock (`materiauId`, `utilise`) : on les laisse plutôt que de casser le formulaire.
    const materiaux = (copie.valeurs.materiaux ?? []).filter((ligne) => typeof ligne.designation === "string");
    return { ...copie, valeurs: { ...copie.valeurs, materiaux } };
  } catch {
    return null;
  }
}

/** `false` quand le poste refuse (stockage plein, navigation privée) : la saisie reste en mémoire. */
export function ecrireCopieLocale(projetId: string, date: string, valeurs: ValeursRapport): boolean {
  const copie: CopieLocale = { valeurs, modifieLe: new Date().toISOString() };
  try {
    localStorage.setItem(cle(projetId, date), JSON.stringify(copie));
    return true;
  } catch {
    // Les photos et les pièces jointes pèsent : sans elles, au moins le texte est sauf.
    try {
      const sansPhotos: CopieLocale = { ...copie, valeurs: { ...valeurs, photos: [], piecesJointes: [] } };
      localStorage.setItem(cle(projetId, date), JSON.stringify(sansPhotos));
    } catch {
      // Rien de plus à tenter.
    }
    return false;
  }
}

export function effacerCopieLocale(projetId: string, date: string): void {
  try {
    localStorage.removeItem(cle(projetId, date));
  } catch {
    // Rien à effacer.
  }
}
