/** Les clés de cache React Query du domaine Avenants. */

/** Les avenants d'un projet, sous `["projets", id]`. */
export function cleAvenants(projetId: string) {
  return ["projets", projetId, "avenants"] as const;
}
