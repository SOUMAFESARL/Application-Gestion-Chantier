/**
 * Les types du domaine des collaborateurs — sans forme HTTP.
 */

/** Les statuts d'un compte (`StatutUtilisateur` côté Django). */
export type StatutCollaborateur = "ACTIF" | "INVITE" | "DESACTIVE";

/** Une ligne du tableau des collaborateurs : un compte actif ou invité. */
export interface Collaborateur {
  id: string;
  prenom: string;
  nom: string;
  nomComplet: string;
  email: string;
  /** Numéro international E.164, vide quand il n'est pas connu. */
  telephone: string;
  /** Code du rôle (`CT`, `CC`…). */
  role: string;
  /** Le libellé du serveur, quand le catalogue ne connaît pas le code. */
  roleLibelle: string;
  statut: StatutCollaborateur;
  /** Le compte qui a créé l'entreprise. */
  estProprietaire: boolean;
  /** Date ISO de création du compte ou de l'invitation. */
  creeLe: string;
}

/** Ce qu'il faut pour inviter un collaborateur. */
export interface CreationCollaborateur {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  role: string;
}

/**
 * Le collaborateur créé, et le lien d'activation quand le serveur le
 * renvoie (en développement : en production, il ne voyage que par email).
 */
export interface CollaborateurAjoute {
  collaborateur: Collaborateur;
  lienActivation: string | null;
}
