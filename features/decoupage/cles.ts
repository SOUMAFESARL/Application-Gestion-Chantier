/**
 * Les clés de cache React Query du domaine Découpage.
 *
 * Toutes sous `["projets", projetId, …]` quand elles portent sur un projet : invalider le
 * projet entier (`["projets", projetId]`) périme aussi son arbre et son tableau.
 */

/** Le tableau de démarrage pré-rempli d'un projet, pour un modèle donné (ou celui par défaut). */
export function cleTableauDemarrage(projetId: string, modele?: { origine: string; id: string } | null) {
  return ["projets", projetId, "decoupage", "tableau", modele?.origine ?? "", modele?.id ?? ""] as const;
}

/** L'arbre d'un projet, tel que le serveur le filtre pour la personne connectée. */
export function cleArbre(projetId: string) {
  return ["projets", projetId, "decoupage", "arbre"] as const;
}

/** Tout ce que le découpage d'un projet met en cache. */
export function cleDecoupage(projetId: string) {
  return ["projets", projetId, "decoupage"] as const;
}

/** Les modèles de découpage, ceux du type de projet en tête. */
export function cleModeles(typeProjet: string | null) {
  return ["decoupage", "modeles", typeProjet ?? ""] as const;
}

/** Les listes de valeurs (plateforme et entreprise), avec leurs valeurs. */
export const CLE_LISTES = ["decoupage", "listes"] as const;

/** La courbe en S du projet, ou d'une de ses cases. */
export function cleCourbe(projetId: string, caseId: string | null) {
  return ["projets", projetId, "decoupage", "courbe", caseId ?? ""] as const;
}
