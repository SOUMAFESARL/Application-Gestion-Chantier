/**
 * Appels d'API de l'activation d'un compte invité (contrat T-017, parcours
 * T-015). La liste et l'ajout des collaborateurs sont dans `adaptateur.ts`.
 */

import { api } from "@/lib/api";

export interface ContenuInvitation {
  email: string;
  nom: string;
  role_propose: string;
  role_libelle: string;
  entreprise: string;
  expire_dans: number;
}

export interface AccepterInvitationPayload {
  jeton: string;
  nom?: string;
  prenom?: string;
  mot_de_passe: string;
}

export interface ReponseAccepterInvitation {
  message: string;
  access: string;
  refresh: string;
  expire_dans: number;
  utilisateur: {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    role_global: string;
    is_dg: boolean;
    is_owner: boolean;
    langue?: string;
  };
}

/**
 * Vérifie un jeton d'invitation sans le consommer (MLD §5.2).
 */
export async function verifierInvitation(jeton: string): Promise<ContenuInvitation> {
  return api.creer<ContenuInvitation>("/invitations/verifier/", { jeton });
}

/**
 * Valide le mot de passe et active le compte utilisateur.
 */
export async function accepterInvitation(
  payload: AccepterInvitationPayload,
): Promise<ReponseAccepterInvitation> {
  return api.creer<ReponseAccepterInvitation>("/invitations/accepter/", payload);
}
