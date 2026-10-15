/**
 * Les clés de cache React Query du domaine Projets.
 *
 * Réunies ici parce que plusieurs écrans lisent les mêmes données — la liste
 * des chantiers, les lots d'un chantier, ses équipes — et qu'une clé recopiée
 * à la main dans chacun finit par diverger : deux caches pour une même
 * donnée, dont un seul est invalidé après une écriture.
 */

/** La liste des chantiers de l'entreprise. */
export const CLE_LISTE_PROJETS = ["projets", "liste"] as const;

/** Les lots d'un chantier, avec leurs activités. */
export function cleLots(projetId: string) {
  return ["projets", projetId, "lots"] as const;
}

/** Les chiffres de structure d'un chantier, recomptés par le serveur. */
export function cleStatistiques(projetId: string) {
  return ["projets", projetId, "statistiques"] as const;
}

/** Les équipes constituées sur un chantier. */
export function cleEquipes(projetId: string) {
  return ["projets", projetId, "equipes"] as const;
}

/** Un chantier dans son détail, pour sa fiche. */
export function cleProjet(projetId: string) {
  return ["projets", projetId, "detail"] as const;
}

/** La liste des motifs de report de dates (référentiel). */
export const CLE_MOTIFS_REPORT = ["referentiels", "motifs-report"] as const;

/** L'historique des modifications de dates pour un objet donné. */
export function cleHistoriqueDates(objet: "projets" | "lots" | "activites", id: string) {
  return [objet, id, "historique-dates"] as const;
}

/** Le journal consolidé des reports d'un projet (projet, lots, activités). */
export function cleJournalReports(projetId: string) {
  return ["projets", projetId, "journal-reports"] as const;
}

