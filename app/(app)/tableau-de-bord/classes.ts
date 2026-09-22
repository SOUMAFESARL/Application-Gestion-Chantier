/**
 * Les classes partagées par les neuf composants du tableau de bord.
 *
 * Elles vivaient dans `TableauDeBord.module.css`, seul fichier que les neuf
 * importaient : c'était lui, et non un composant, qui tenait leur cohérence.
 * En passant à Tailwind, ce rôle devait aller quelque part — un module de
 * constantes plutôt qu'une copie du même enchaînement de classes dans chaque
 * fichier, où la première divergence serait passée inaperçue.
 *
 * Ce qui n'est utilisé qu'à un seul endroit n'est **pas** ici : il reste dans
 * son composant, où on le lit en même temps que le balisage qu'il habille.
 */

/** En-tête d'une carte du panneau latéral : titre à gauche, action à droite. */
export const CARTE_ENTETE = "mb-3 flex items-center justify-between";
export const CARTE_TITRE = "flex items-center gap-1.5 text-sm font-bold text-neutral-900";

/** La ligne secondaire sous un nom de chantier, et les montants en colonne. */
export const PROJET_DETAIL = "text-xs text-neutral-500";
export const MONTANT_TAB = "font-semibold tabular-nums";

/**
 * La jauge double : l'avancement réel remplit la piste, l'avancement théorique
 * y pose un repère. C'est l'écart entre les deux qui se lit, pas la barre.
 */
export const JAUGE_PISTE = "relative my-1 h-2 rounded-full bg-neutral-200";
export const JAUGE_REMPLI = "h-full rounded-full transition-[width] duration-300";
export const JAUGE_CIBLE =
  "absolute top-[-3px] bottom-[-3px] w-[3px] -translate-x-1/2 rounded-sm bg-neutral-900";
