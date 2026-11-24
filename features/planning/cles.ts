/**
 * Clés de cache React Query du domaine Planning (Gantt & dépendances).
 *
 * La clé du planning partage exactement `["projets", projetId, "planning"]` avec
 * `clePlanning(projetId)` de `features/projets/cles.ts` : une invalidation de
 * `["projets", projetId]` ou de `clePlanning(projetId)` rafraîchit donc le Gantt.
 */

/** Données complètes du diagramme de Gantt d'un projet. */
export function clePlanningGantt(projetId: string) {
  return ["projets", projetId, "planning"] as const;
}

/** Prédécesseurs et successeurs d'une case feuille. */
export function cleDependancesElement(elementId: string) {
  return ["elements", elementId, "dependances"] as const;
}
