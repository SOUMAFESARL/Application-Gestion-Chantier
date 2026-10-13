/**
 * Ce que les trois blocs de l'écran « Lots & activités » disent de la même
 * façon : le ton d'un statut d'activité, la carte, la jauge.
 *
 * Même rôle que `tableau-de-bord/classes.ts` : partagé ici, explicitement,
 * plutôt que recopié d'un bloc à l'autre. **Aucune valeur en dur** : chaque
 * teinte passe par un jeton de la charte.
 */

import type { VarianteBadge } from "@/components/ui";
import type { StatutActivite } from "@/features/projets/types";

export { BLOC } from "../classes";

export const BADGE_STATUT: Record<StatutActivite, VarianteBadge> = {
  A_VENIR: "neutre",
  EN_COURS: "information",
  EN_RETARD: "erreur",
  BLOQUE: "avertissement",
  TERMINE: "succes",
};

/** La barre du planning prend la teinte de son statut. */
export const BARRE_STATUT: Record<StatutActivite, string> = {
  A_VENIR: "bg-neutral-300",
  EN_COURS: "bg-information",
  EN_RETARD: "bg-erreur",
  BLOQUE: "bg-avertissement",
  TERMINE: "bg-succes",
};

/** L'anneau d'avancement de la structure : sa piste, puis sa part remplie. */
export const CERCLE_PISTE = "stroke-neutral-200";
export const CERCLE_REMPLI = "stroke-succes transition-[stroke-dasharray] duration-300";

/**
 * Le panneau d'activité colle, lui, sous le sélecteur : en-tête (64 px) +
 * sélecteur (~90 px) + un peu d'air. À revoir si l'un des deux change de hauteur.
 */
export const PANNEAU_COLLE = "xl:sticky xl:top-44";
