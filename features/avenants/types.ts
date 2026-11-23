/**
 * Les avenants au contrat d'un projet (30/10/2026) : des jours accordés et un montant, sur le
 * projet entier ou sur des cases de l'arbre. Le mot « avenant » est réservé à l'acte signé ; le
 * reste est une modification tracée (décisions v1.2, §11bis).
 */

export interface Avenant {
  id: string;
  numero: string;
  dateSignature: string;
  objet: string;
  /** Prolongation accordée (3 composantes >= 0, jamais négatives). */
  anneesAccordees: number;
  moisAccordes: number;
  joursAccordes: number;
  /** En centimes (>= 0) ; `null` si aucun impact financier ou sans `projets.voir_montants`. */
  montant: number | null;
  porteSur: "PROJET" | "CASES";
  cases: { id: string; libelle: string }[];
  document: { nom: string; type: string } | null;
  ordreService: { nom: string; type: string } | null;
  creeLe: string;
}

export interface SaisieAvenant {
  numero: string;
  dateSignature: string;
  objet: string;
  anneesAccordees: number;
  moisAccordes: number;
  joursAccordes: number;
  montant: number | null;
  /** Vide : l'avenant porte sur le projet entier. */
  casesIds: string[];
  /** Obligatoire : l'avenant signé. */
  document: File;
  /** Obligatoire : l'ordre de service lié à l'avenant. */
  ordreService: File;
}
