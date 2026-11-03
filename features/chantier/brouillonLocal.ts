/**
 * La copie locale du rapport en cours — ce qui survit à une coupure réseau.
 *
 * La clé inclut l'identifiant du rédacteur (`utilisateurId`) afin que deux comptes
 * sur le même appareil partagé ne mélangent jamais leurs brouillons locaux.
 */

import type { ValeursRapport } from "./validations";

const PREFIXE = "ccd.journal.saisie";

export interface CopieLocale {
  valeurs: ValeursRapport;
  /** L'instant de la dernière frappe recopiée. */
  modifieLe: string;
}

function cle(projetId: string, date: string, utilisateurId?: string | null): string {
  const porteur = utilisateurId || "anonyme";
  return `${PREFIXE}.${porteur}.${projetId}.${date}`;
}

export function lireCopieLocale(
  projetId: string,
  date: string,
  utilisateurId?: string | null,
): CopieLocale | null {
  try {
    const brut = localStorage.getItem(cle(projetId, date, utilisateurId));
    if (!brut) return null;
    const copie = JSON.parse(brut) as CopieLocale;
    if (!copie?.valeurs || !Array.isArray(copie.valeurs.blocages)) return null;
    const materiaux = (copie.valeurs.materiaux ?? []).filter(
      (ligne) => typeof ligne.designation === "string",
    );
    return { ...copie, valeurs: { ...copie.valeurs, materiaux } };
  } catch {
    return null;
  }
}

/** `false` quand le poste refuse (stockage plein, navigation privée) : la saisie reste en mémoire. */
export function ecrireCopieLocale(
  projetId: string,
  date: string,
  valeurs: ValeursRapport,
  utilisateurId?: string | null,
): boolean {
  const copie: CopieLocale = { valeurs, modifieLe: new Date().toISOString() };
  const cleStockage = cle(projetId, date, utilisateurId);
  try {
    localStorage.setItem(cleStockage, JSON.stringify(copie));
    return true;
  } catch {
    try {
      const sansPhotos: CopieLocale = {
        ...copie,
        valeurs: { ...valeurs, photos: [], piecesJointes: [] },
      };
      localStorage.setItem(cleStockage, JSON.stringify(sansPhotos));
    } catch {
      // Rien de plus à tenter.
    }
    return false;
  }
}

export function effacerCopieLocale(
  projetId: string,
  date: string,
  utilisateurId?: string | null,
): void {
  try {
    localStorage.removeItem(cle(projetId, date, utilisateurId));
  } catch {
    // Rien à effacer.
  }
}
