/**
 * Les clés de cache React Query du journal de chantier.
 *
 * Réunies ici pour la même raison que `features/projets/cles.ts` : une
 * relance écrite depuis un onglet doit invalider la clé que lisent les autres.
 */

import type { DemandeSynthese } from "./types";

/** Le journal des dernières semaines, tous chantiers confondus. */
export const CLE_JOURNAL = ["chantier", "journal"] as const;

/** Un rapport journalier dans son détail. */
export function cleRapport(id: string) {
  return ["chantier", "rapports", id] as const;
}

/** Une synthèse périodique : un chantier, une période. */
export function cleSynthese(demande: DemandeSynthese) {
  return ["chantier", "syntheses", demande.projetId, demande.type, demande.debut, demande.fin] as const;
}
