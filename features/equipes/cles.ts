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
