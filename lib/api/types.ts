/**
 * Formes de réponse de l'API — conventions §4.
 *
 * Les types des ressources elles-mêmes (`Projet`, `Lot`, …) ne sont pas
 * écrits à la main : ils seront générés depuis le contrat OpenAPI, dans
 * `types/api.ts`. Ici on ne décrit que les enveloppes.
 */

/** Enveloppe de collection — conventions §4.2. */
export interface ReponsePaginee<T> {
  total: number;
  page: number;
  nombre_pages: number;
  suivant: string | null;
  precedent: string | null;
  /** Toujours un tableau, jamais `null` — même vide. */
  resultats: T[];
}

/** Paramètres de liste communs à toutes les collections — conventions §8. */
export interface ParametresListe {
  page?: number;
  taille_page?: number;
  recherche?: string;
  tri?: string;
}

/** Couple code / libellé servi par `/referentiels/enumerations/`. */
export interface OptionEnumeration {
  code: string;
  libelle: string;
}

export type Enumerations = Record<string, OptionEnumeration[]>;

/** Réponse de `/auth/token/`. */
export interface Jetons {
  access: string;
  refresh: string;
}
