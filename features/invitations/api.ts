/**
 * Appels d'API pour les invitations de collaborateurs.
 *
 * Conforme au contrat T-017 et au parcours T-015.
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

export interface InvitationDetail {
  id: string;
  email: string;
  nom: string;
  role_propose: string;
  emetteur: string | null;
  expire_le: string;
  utilise_le: string | null;
  statut: "ENVOYEE" | "ACCEPTEE" | "EXPIREE" | "REVOQUEE";
  est_expiree: boolean;
  cree_le: string;
  modifie_le: string;
}

export interface CreerInvitationPayload {
  email: string;
  role_propose: string;
  nom?: string;
  /** Numéro international E.164 (`+2250700000000`). */
  telephone?: string;
}

/**
 * Vérifie un jeton d'invitation sans le consommer (MLD §5.2).
 */
export async function verifierInvitation(jeton: string): Promise<ContenuInvitation> {
  return api.creer<ContenuInvitation>("/invitations/verifier/", { jeton });
}

/**
 * Valide le mot de passe, active le compte utilisateur et renvoie les jetons de session.
 */
export async function accepterInvitation(
  payload: AccepterInvitationPayload,
): Promise<ReponseAccepterInvitation> {
  return api.creer<ReponseAccepterInvitation>("/invitations/accepter/", payload);
}

/**
 * Liste les invitations du tenant.
 */
export async function listerInvitations(): Promise<InvitationDetail[]> {
  return api.lire<InvitationDetail[]>("/invitations/");
}

/**
 * Crée et envoie une nouvelle invitation.
 */
export async function creerInvitation(
  payload: CreerInvitationPayload,
): Promise<InvitationDetail> {
  return api.creer<InvitationDetail>("/invitations/", payload);
}
