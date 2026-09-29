/**
 * Les classes et les tons partagés par les blocs du tableau de bord.
 *
 * Même rôle que `app/(admin)/admin/tons.ts` : ce que plusieurs blocs doivent
 * dire de la même façon — une santé, une gravité, une carte — se partage ici,
 * explicitement, plutôt que par un enchaînement de classes recopié. Ce qui
 * n'est utilisé qu'à un seul endroit reste dans son composant.
 *
 * **Aucune valeur en dur** (règle 4) : chaque teinte passe par un jeton de la
 * charte. Une santé n'a pas sa propre couleur, elle emprunte celle de sa
 * gravité.
 */

import type { VarianteBadge } from "@/components/ui";
import type { GraviteAlerte, NiveauSante } from "@/features/tableauDeBord";

/* ------------------------------------------------------------------ *
 * Les blocs.
 * ------------------------------------------------------------------ */

/** Un bloc du tableau de bord : la carte claire de `docs/interface.jpg`. */
export const BLOC = "flex flex-col rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm";
/** L'en-tête est séparé du contenu par un filet, dans tous les blocs. */
export const BLOC_ENTETE =
  "flex items-start justify-between gap-3 border-b border-neutral-200 px-5 pt-5 pb-4";
export const BLOC_TITRE = "text-base font-semibold text-neutral-900";
export const BLOC_SOUS_TITRE = "mt-0.5 text-xs text-neutral-500";
export const BLOC_CORPS = "px-5 pt-2 pb-5";
/** La phrase d'un bloc vide : il dit que tout va bien, il ne disparaît pas. */
export const BLOC_VIDE = "py-6 text-center text-sm text-neutral-500";

/** Une ligne de liste dans un bloc, séparée de la suivante par un filet. */
export const LIGNE_LISTE = "flex items-start gap-3 border-b border-neutral-100 py-3 last:border-b-0";

/** La ligne secondaire sous un nom de chantier, et les montants en colonne. */
export const PROJET_DETAIL = "text-xs text-neutral-500";
export const MONTANT_TAB = "font-semibold tabular-nums";

/* ------------------------------------------------------------------ *
 * La santé — vert, orange, rouge (CDC module 1).
 * ------------------------------------------------------------------ */

export const PASTILLE_SANTE: Record<NiveauSante, string> = {
  BON: "bg-succes",
  VIGILANCE: "bg-avertissement",
  CRITIQUE: "bg-erreur",
};

export const TEXTE_SANTE: Record<NiveauSante, string> = {
  BON: "text-succes",
  VIGILANCE: "text-avertissement",
  CRITIQUE: "text-erreur",
};

export const BADGE_SANTE: Record<NiveauSante, VarianteBadge> = {
  BON: "succes",
  VIGILANCE: "avertissement",
  CRITIQUE: "erreur",
};

/* ------------------------------------------------------------------ *
 * La gravité d'une alerte.
 * ------------------------------------------------------------------ */

export const BADGE_GRAVITE: Record<GraviteAlerte, VarianteBadge> = {
  CRITIQUE: "erreur",
  ATTENTION: "avertissement",
};

export const ICONE_GRAVITE: Record<GraviteAlerte, string> = {
  CRITIQUE: "bg-erreur-fond text-erreur",
  ATTENTION: "bg-avertissement-fond text-avertissement",
};

/* ------------------------------------------------------------------ *
 * Les tuiles d'indicateurs.
 * ------------------------------------------------------------------ */

/** La tuile elle-même est `Indicateur`, partagée avec la liste des projets. */
export const TUILE_UNITE = "ml-1 text-sm font-medium text-neutral-500";

/* ------------------------------------------------------------------ *
 * La jauge d'avancement.
 * ------------------------------------------------------------------ */

/**
 * La jauge double : l'avancement réel remplit la piste, l'avancement théorique
 * y pose un repère. C'est l'écart entre les deux qui se lit, pas la barre.
 */
export const JAUGE_PISTE = "relative my-1 h-2 rounded-full bg-neutral-200";
export const JAUGE_REMPLI = "h-full rounded-full transition-[width] duration-300";
export const JAUGE_CIBLE =
  "absolute top-[-3px] bottom-[-3px] w-[3px] -translate-x-1/2 rounded-sm bg-neutral-900";

/* ------------------------------------------------------------------ *
 * Les graphiques.
 * ------------------------------------------------------------------ */

export const TEINTE_PREVU = "var(--color-graphique-3)";
export const TEINTE_CONSOMME = "var(--color-graphique-1)";
export const TEINTE_DEPASSEMENT = "var(--color-semantic-error)";
export const TEINTE_GRILLE = "var(--color-neutral-200)";
export const TEINTE_CURSEUR = "var(--color-neutral-100)";
