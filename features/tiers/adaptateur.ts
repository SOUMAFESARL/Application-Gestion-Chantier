/**
 * L'accès aux données du domaine Tiers.
 *
 * Ce fichier existe pour une seule raison : `ModalCreationProjet` appelait
 * `api.lire("/tiers/")` depuis son `useEffect`. Un écran qui connaît une
 * route d'API est un écran à rouvrir le jour où la route change, et il n'y a
 * aucun endroit où chercher les appels d'un domaine.
 */

import { api } from "@/lib/api";

import type { RoleTiers, TiersOption } from "./types";

interface ChargeTiers {
  id: string;
  raison_sociale: string;
}

/** La clé de cache d'une liste de tiers, filtrée ou non par rôle. */
export const cleTiers = (role?: RoleTiers) => ["tiers", role ?? "tous"] as const;

/**
 * Les tiers, filtrés par rôle si `role` est donné — `CLIENT_MOA` pour les
 * maîtres d'ouvrage, `MAITRE_OEUVRE` pour les maîtres d'œuvre.
 */
export async function listerTiers(
  role?: RoleTiers,
  signal?: AbortSignal,
): Promise<TiersOption[]> {
  const charges = await api.lire<ChargeTiers[]>("/tiers/", role ? { role } : undefined, signal);
  if (!Array.isArray(charges)) return [];
  return charges.map((charge) => ({
    id: charge.id,
    raisonSociale: charge.raison_sociale,
  }));
}

/** Crée un tiers avec un seul rôle : l'ajout rapide depuis un formulaire. */
export async function creerTiers(saisie: {
  raisonSociale: string;
  telephone: string;
  role: RoleTiers;
}): Promise<TiersOption> {
  const charge = await api.creer<ChargeTiers>("/tiers/", {
    raison_sociale: saisie.raisonSociale.trim(),
    telephone: saisie.telephone,
    roles: [saisie.role],
  });
  return { id: charge.id, raisonSociale: charge.raison_sociale };
}
