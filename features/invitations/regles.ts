/**
 * Les règles de la liste des collaborateurs — pures, sans React.
 */

import type { ProfilUtilisateur } from "@/features/auth/api";

import type { InvitationDetail } from "./api";
import type { Collaborateur, StatutCollaborateur } from "./types";

export type FiltreCollaborateurs = "TOUS" | "ACTIFS" | "INVITES";

/** Le compte connecté, premier de la liste : il est toujours actif. */
export function collaborateurDepuisProfil(profil: ProfilUtilisateur): Collaborateur {
  return {
    id: profil.id,
    nomComplet: `${profil.prenom} ${profil.nom}`.trim() || profil.email,
    email: profil.email,
    telephone: "",
    role: profil.role_global,
    statut: "ACTIF",
    creeLe: null,
  };
}

/** Une invitation acceptée est un collaborateur actif ; une invitation échue, une expirée. */
export function collaborateurDepuisInvitation(invitation: InvitationDetail): Collaborateur {
  const statut: StatutCollaborateur =
    invitation.statut === "ACCEPTEE"
      ? "ACTIF"
      : invitation.est_expiree || invitation.statut === "EXPIREE"
        ? "EXPIREE"
        : "INVITE";

  return {
    id: invitation.id,
    nomComplet: invitation.nom,
    email: invitation.email,
    telephone: "",
    role: invitation.role_propose,
    statut,
    creeLe: invitation.cree_le,
  };
}

/** Recherche sur le nom ou l'email, insensible à la casse. */
export function filtrerCollaborateurs(
  collaborateurs: Collaborateur[],
  filtre: FiltreCollaborateurs,
  recherche: string,
): Collaborateur[] {
  const requete = recherche.trim().toLowerCase();
  return collaborateurs.filter((c) => {
    if (filtre === "ACTIFS" && c.statut !== "ACTIF") return false;
    if (filtre === "INVITES" && c.statut !== "INVITE") return false;
    if (!requete) return true;
    return c.nomComplet.toLowerCase().includes(requete) || c.email.toLowerCase().includes(requete);
  });
}

/** Les deux premières initiales du nom. */
export function initiales(nomComplet: string): string {
  return nomComplet
    .split(/\s+/)
    .map((partie) => partie[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
