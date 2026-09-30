/**
 * Les règles de la liste des collaborateurs — pures, sans React.
 */

import type { Collaborateur } from "./types";

export type FiltreCollaborateurs = "TOUS" | "ACTIFS" | "INVITES";

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
