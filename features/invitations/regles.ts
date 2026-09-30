/**
 * Les règles de la liste des collaborateurs — pures, sans React.
 */

import type { Collaborateur } from "./types";

export type FiltreCollaborateurs = "TOUS" | "ACTIFS" | "INVITES" | "SUSPENDUS";

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
    if (filtre === "SUSPENDUS" && c.statut !== "DESACTIVE") return false;
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

/**
 * Le compte peut-il être touché par un autre que lui-même ?
 *
 * Ni le propriétaire — il a créé l'entreprise, et une entreprise sans
 * propriétaire n'a plus personne pour la paramétrer — ni soi-même : on ne se
 * coupe pas l'accès depuis sa propre session. Le serveur le refuserait de
 * toute façon ; l'écran ne propose pas un geste voué à l'échec.
 */
function compteGerable(collaborateur: Collaborateur, moiId: string | null): boolean {
  return !collaborateur.estProprietaire && collaborateur.id !== moiId;
}

/**
 * La suspension ne vise qu'un compte actif. Une invitation en attente ne se
 * suspend pas : elle se supprime, ce qui invalide son lien d'activation.
 */
export function suspensionPossible(collaborateur: Collaborateur, moiId: string | null): boolean {
  return collaborateur.statut === "ACTIF" && compteGerable(collaborateur, moiId);
}

export function reactivationPossible(collaborateur: Collaborateur, moiId: string | null): boolean {
  return collaborateur.statut === "DESACTIVE" && compteGerable(collaborateur, moiId);
}

export function suppressionPossible(collaborateur: Collaborateur, moiId: string | null): boolean {
  return compteGerable(collaborateur, moiId);
}
