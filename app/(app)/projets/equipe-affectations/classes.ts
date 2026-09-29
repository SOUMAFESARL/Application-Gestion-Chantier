/**
 * Ce que les blocs de l'écran « Équipes et affectations » disent de la même
 * façon : la pastille d'une équipe, le badge de sa nature, les avatars.
 *
 * **Aucune valeur en dur** : chaque teinte passe par un jeton de la charte.
 */

import type { VarianteBadge } from "@/components/ui";
import type { NatureEquipe } from "@/features/projets/types";

/**
 * La pastille d'une équipe, prise dans l'ordre de la liste des équipes du
 * chantier : la même équipe garde sa teinte sur la carte et dans la liste des
 * affectations. Ni le rouge ni l'ambre, que les statuts portent déjà — une
 * équipe « rouge » se lirait comme une équipe en retard.
 */
const PASTILLES = [
  "bg-information",
  "bg-primary-500",
  "bg-succes",
  "bg-secondary-500",
  "bg-primary-300",
  "bg-secondary-300",
  "bg-neutral-400",
] as const;

export function pastilleEquipe(rang: number): string {
  return PASTILLES[((rang % PASTILLES.length) + PASTILLES.length) % PASTILLES.length];
}

export const BADGE_NATURE: Record<NatureEquipe, VarianteBadge> = {
  INTERNE: "secondaire",
  SOUS_TRAITANT: "avertissement",
};

/** Une pastille d'avatar : le chef se distingue des membres par sa teinte. */
export const AVATAR =
  "-ml-1.5 flex size-7 items-center justify-center rounded-full border-2 border-solid border-neutral-0 text-xs font-semibold first:ml-0";
export const AVATAR_CHEF = "bg-primary-100 text-primary-800";
export const AVATAR_MEMBRE = "bg-secondary-100 text-secondary-700";
