/**
 * Ce que les écrans d'un chantier (« Lots & activités », « Équipes et
 * affectations ») disent de la même façon : le sélecteur de chantier collant
 * et les tuiles d'indicateurs.
 *
 * Même rôle que `tableau-de-bord/classes.ts`. **Aucune valeur en dur** :
 * chaque teinte passe par un jeton de la charte.
 */

import type { VarianteBadge } from "@/components/ui";
import type { StatutProjet } from "@/features/projets/types";
import type { couleurIndiceSante } from "@/lib/format";

/** La carte d'un bloc d'écran. */
export const BLOC = "rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm";

/**
 * Le sélecteur de chantier reste collé sous l'en-tête de l'application
 * (`h-16`) quand on descend : c'est lui qui dit de quel chantier on lit
 * l'écran. Il déborde des marges de `<main>` (`px-2` / `sm:px-6`) pour que
 * son fond couvre toute la largeur de ce qui défile dessous.
 */
export const BARRE_PROJET =
  "sticky top-16 z-30 -mx-2 -my-3 bg-background px-2 py-3 sm:-mx-6 sm:px-6 transition-shadow duration-200";

/**
 * L'ombre n'apparaît qu'une fois le sélecteur décollé de sa place : au repos
 * il fait partie de la page, collé il flotte au-dessus de ce qui défile.
 */
export const BARRE_PROJET_COLLEE = "shadow-md";

/**
 * Le fond d'une tuile d'indicateur : une teinte par chiffre, pour qu'on les
 * distingue d'un coup d'œil. Une alerte ne prend sa teinte que s'il y a de
 * quoi alerter — un zéro rouge alarmerait pour rien : l'écran passe alors à
 * `neutre`.
 */
export const FOND_INDICATEUR = {
  primaire: "border-primary-100 bg-primary-50",
  secondaire: "border-secondary-100 bg-secondary-50",
  succes: "border-succes/20 bg-succes-fond",
  erreur: "border-erreur/20 bg-erreur-fond",
  avertissement: "border-avertissement/20 bg-avertissement-fond",
  information: "border-information/20 bg-information-fond",
  neutre: "border-neutral-200 bg-neutral-50",
} as const;

export type FondIndicateur = keyof typeof FOND_INDICATEUR;

/** La couleur du chiffre d'une tuile en alerte. */
export const CHIFFRE_ALERTE: Partial<Record<FondIndicateur, string>> = {
  erreur: "text-erreur",
  avertissement: "text-avertissement",
};

/**
 * Le ton d'un statut de projet — la liste et la fiche le peignent de la même
 * façon. C'est de l'affichage : il ne descend pas dans `regles`.
 */
export const TON_STATUT: Record<StatutProjet, VarianteBadge> = {
  EN_ATTENTE: "neutre",
  EN_COURS: "information",
  EN_RETARD: "avertissement",
  CRITIQUE: "erreur",
  SUSPENDU: "avertissement",
  TERMINE: "succes",
  ARCHIVE: "neutre",
};

/**
 * Le fond de la tuile d'indicateur d'un statut, sur la liste des projets.
 * Il suit le ton du badge (`TON_STATUT`) pour qu'une tuile et les lignes
 * qu'elle compte se reconnaissent ; « Archivé », gris en badge comme
 * « En attente », prend l'ardoise pour ne pas se confondre avec lui.
 */
export const FOND_STATUT: Record<StatutProjet, FondIndicateur> = {
  EN_ATTENTE: "neutre",
  EN_COURS: "information",
  EN_RETARD: "avertissement",
  CRITIQUE: "erreur",
  SUSPENDU: "avertissement",
  TERMINE: "succes",
  ARCHIVE: "secondaire",
};

/** La couleur d'un indice de santé. */
export const TON_SANTE: Record<ReturnType<typeof couleurIndiceSante>, string> = {
  vert: "text-succes",
  orange: "text-avertissement",
  rouge: "text-erreur",
  inconnu: "text-neutral-400",
};
