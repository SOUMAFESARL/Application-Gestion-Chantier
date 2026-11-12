/**
 * Les clés de cache React Query du domaine Équipes.
 */

import type { FiltresRegistre } from "./types";

/** Le registre de main-d'œuvre de l'entreprise, sous tous ses filtres. */
export const CLE_REGISTRE = ["main-oeuvre"] as const;

export function cleRegistre(filtres: FiltresRegistre = {}) {
  return [...CLE_REGISTRE, filtres] as const;
}

/** Les tiers de l'entreprise, tous rôles confondus : les partenaires d'une équipe. */
export const CLE_PARTENAIRES = ["tiers", "tous"] as const;

/** Les collaborateurs avec compte de l'entreprise pour affectation aux équipes. */
export const CLE_UTILISATEURS_ENTREPRISE = ["main-oeuvre", "utilisateurs"] as const;

export function cleUtilisateursEntreprise() {
  return CLE_UTILISATEURS_ENTREPRISE;
}

/** Les équipes d'un projet. Sous `["projets", id]` : invalider le projet les périme aussi. */
export function cleEquipesProjet(projetId: string) {
  return ["projets", projetId, "equipes-chantier"] as const;
}
