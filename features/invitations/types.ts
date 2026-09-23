/**
 * Les types du domaine des collaborateurs — sans forme HTTP.
 */

export type StatutCollaborateur = "ACTIF" | "INVITE" | "EXPIREE";

/** Une ligne du tableau des collaborateurs : un compte actif ou une invitation. */
export interface Collaborateur {
  id: string;
  nomComplet: string;
  email: string;
  /** Numéro international E.164, vide quand il n'est pas connu. */
  telephone: string;
  /** Code du rôle (`CT`, `DP`…) — le libellé vient du catalogue. */
  role: string;
  statut: StatutCollaborateur;
  /** Date ISO de création, ou `null` pour le compte principal. */
  creeLe: string | null;
}
