/**
 * Fusion de classes Tailwind — la fonction que tout composant shadcn attend.
 *
 * `clsx` assemble (conditions, tableaux, faux-amis `undefined`), `twMerge`
 * arbitre : entre `p-2` reçu par défaut et `p-6` passé par l'appelant, c'est
 * le second qui gagne, quelle que soit sa place dans la chaîne. Sans cet
 * arbitrage, l'ordre de déclaration dans la feuille compilée déciderait, et
 * une prop `className` ne pourrait plus rien corriger.
 */
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...entrees: ClassValue[]) {
  return twMerge(clsx(entrees));
}
