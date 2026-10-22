/**
 * Les clés de cache React Query du domaine Projets.
 *
 * Réunies ici parce que plusieurs écrans lisent les mêmes données — la liste
 * des chantiers, les lots d'un chantier, ses équipes — et qu'une clé recopiée
 * à la main dans chacun finit par diverger : deux caches pour une même
 * donnée, dont un seul est invalidé après une écriture.
 */

import type { QueryClient } from "@tanstack/react-query";

/** La liste des chantiers de l'entreprise. */
export const CLE_LISTE_PROJETS = ["projets", "liste"] as const;

/** Les lots d'un chantier, avec leurs activités. */
export function cleLots(projetId: string) {
  return ["projets", projetId, "lots"] as const;
}

/** Les données de la frise de planning d'un chantier. */
export function clePlanning(projetId: string) {
  return ["projets", projetId, "planning"] as const;
}

/** Les chiffres de structure d'un chantier, recomptés par le serveur. */
export function cleStatistiques(projetId: string) {
  return ["projets", projetId, "statistiques"] as const;
}

/** Les équipes constituées sur un chantier. */
export function cleEquipes(projetId: string) {
  return ["projets", projetId, "equipes"] as const;
}

/**
 * Les collaborateurs que l'on peut proposer pour une équipe du chantier. Sous
 * `cleEquipes` : toute écriture sur les équipes la périme avec elles.
 */
export function cleCandidatsEquipes(projetId: string) {
  return ["projets", projetId, "equipes", "candidats"] as const;
}

/** Les chiffres des équipes d'un chantier, recomptés par le serveur. */
export function cleStatistiquesEquipes(projetId: string) {
  return ["projets", projetId, "equipes", "statistiques"] as const;
}

/** Les affectations équipe-activité d'un chantier. */
export function cleAffectationsEquipes(projetId: string) {
  return ["projets", projetId, "equipes", "affectations"] as const;
}

/**
 * Tout ce qu'une écriture sur les équipes d'un chantier périme : les équipes
 * (et, sous leur clé, candidats, statistiques et affectations), les lots — où
 * chaque activité porte le nom et l'effectif de son équipe — et les chiffres
 * de structure du chantier.
 */
export function clesEquipesAInvalider(projetId: string) {
  return [cleEquipes(projetId), cleLots(projetId), cleStatistiques(projetId)] as const;
}

/**
 * Après une écriture sur les équipes : l'équipe que le serveur renvoie est
 * posée dans le cache — la carte ou la ligne change au moment où la fenêtre
 * se referme — puis tout ce qui en dépend est relu. `equipe` absente : seule
 * la relecture a lieu.
 */
export function actualiserEquipes<E extends { id: string }>(
  client: QueryClient,
  projetId: string,
  equipe?: E,
): Promise<unknown> {
  if (equipe) {
    client.setQueryData<E[]>(cleEquipes(projetId), (anciennes) => {
      const liste = anciennes ?? [];
      return liste.some((candidate) => candidate.id === equipe.id)
        ? liste.map((candidate) => (candidate.id === equipe.id ? equipe : candidate))
        : [...liste, equipe];
    });
  }
  return Promise.all(
    clesEquipesAInvalider(projetId).map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}

/** Un chantier dans son détail, pour sa fiche. */
export function cleProjet(projetId: string) {
  return ["projets", projetId, "detail"] as const;
}

/** L'historique des mises à jour manuelles d'avancement d'une activité. */
export function cleHistoriqueAvancement(activiteId: string) {
  return ["activites", activiteId, "historique-avancement"] as const;
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

/** La santé détaillée d'un chantier. */
export function cleSanteProjet(projetId: string) {
  return ["projets", projetId, "sante"] as const;
}

/** L'historique des instantanés de santé d'un chantier. */
export function cleHistoriqueSante(projetId: string) {
  return ["projets", projetId, "sante", "historique"] as const;
}

