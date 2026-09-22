/**
 * L'accès aux données du domaine Tiers.
 *
 * Ce fichier existe pour une seule raison : `ModalCreationProjet` appelait
 * `api.lire("/tiers/")` depuis son `useEffect`. Un écran qui connaît une
 * route d'API est un écran à rouvrir le jour où la route change, et il n'y a
 * aucun endroit où chercher les appels d'un domaine.
 */

import { api } from "@/lib/api";

import type { TiersOption } from "./types";

interface ChargeTiers {
  id: string;
  raison_sociale: string;
}

/**
 * Les tiers proposables comme maître d'ouvrage.
 *
 * La liste est renvoyée **vide** en cas d'échec plutôt que de lever : le
 * choix du client n'est qu'une partie du formulaire de création, et une
 * panne de cette lecture ne doit pas empêcher d'ouvrir la modale. C'est à
 * l'appelant de décider quoi afficher à la place.
 */
export async function listerTiers(): Promise<TiersOption[]> {
  const charges = await api.lire<ChargeTiers[]>("/tiers/");
  if (!Array.isArray(charges)) return [];
  return charges.map((charge) => ({
    id: charge.id,
    raisonSociale: charge.raison_sociale,
  }));
}
