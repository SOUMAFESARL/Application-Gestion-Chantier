"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type VarianteBouton = "primaire" | "secondaire" | "ghost" | "danger";
export type TailleBouton = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  /** Affiche un indicateur et désactive le bouton. Charte §8.3 : retour visuel sous 0,3 s. */
  enCours?: boolean;
  /** Occupe toute la largeur disponible — usage mobile courant. */
  pleineLargeur?: boolean;
  iconeGauche?: ReactNode;
  iconeDroite?: ReactNode;
}

/**
 * Socle commun à toutes les variantes.
 *
 * `border border-transparent` est là pour que la variante secondaire, qui
 * seule porte un filet, ne décale pas les autres d'un pixel ; et
 * `bg-transparent` parce que `globals.css` n'importe pas le preflight de
 * Tailwind — sans lui, un `button` garderait le fond gris du navigateur.
 *
 * `after:-inset-1` est la règle terrain §8.2 : la zone cliquable déborde le
 * visuel de 4 px, pour rester atteignable avec des gants de chantier.
 */
const SOCLE = [
  "relative inline-flex cursor-pointer appearance-none items-center justify-center gap-2",
  "rounded-md border border-transparent bg-transparent font-semibold leading-none whitespace-nowrap",
  "transition-colors disabled:cursor-not-allowed",
  "after:absolute after:-inset-1 after:content-['']",
  "[&_svg]:block [&_svg]:shrink-0",
].join(" ");

/**
 * Les hauteurs viennent des jetons de la charte, jamais de l'échelle Tailwind :
 * 48 px en `lg` est la cible tactile du Socle §8, pas un choix d'esthétique.
 * Et sous un pointeur grossier — un doigt — `sm` et `md` s'y alignent aussi.
 */
const TAILLES: Record<TailleBouton, string> = {
  sm: "h-[var(--button-height-sm)] px-4 text-sm pointer-coarse:h-[var(--button-height-lg)]",
  md: "h-[var(--button-height-md)] px-6 text-base pointer-coarse:h-[var(--button-height-lg)]",
  lg: "h-[var(--button-height-lg)] px-6 text-base",
};

/**
 * `not-disabled:` et non `disabled:pointer-events-none` : le curseur
 * « interdit » doit rester visible sur un bouton desactive, ce qu'un
 * `pointer-events-none` supprimerait avec le survol.
 */
const VARIANTES: Record<VarianteBouton, string> = {
  primaire: [
    "bg-primary-500 text-neutral-0",
    "not-disabled:hover:bg-primary-600 not-disabled:active:bg-primary-700",
    "disabled:bg-neutral-200 disabled:text-neutral-400",
  ].join(" "),
  secondaire: [
    "border-primary-500 text-primary-600",
    "not-disabled:hover:border-primary-600 not-disabled:hover:bg-primary-50 not-disabled:hover:text-primary-700",
    "not-disabled:active:border-primary-700 not-disabled:active:bg-primary-100 not-disabled:active:text-primary-800",
    "disabled:border-neutral-200 disabled:text-neutral-400",
  ].join(" "),
  ghost: [
    "font-medium text-neutral-700",
    "not-disabled:hover:bg-neutral-100 not-disabled:hover:text-neutral-900",
    "not-disabled:active:bg-neutral-200",
    "disabled:text-neutral-400",
  ].join(" "),
  // Danger : reserve aux actions destructrices — archivage, revocation, rejet.
  danger: [
    "bg-erreur text-neutral-0",
    "not-disabled:hover:brightness-92",
    "disabled:bg-neutral-200 disabled:text-neutral-400",
  ].join(" "),
};

/**
 * Bouton — charte §7.3.
 *
 * Trois points non négociables, hérités des règles terrain (§8.2) :
 *   · la zone cliquable fait 48 px de haut au minimum sur mobile, même
 *     quand le visuel est plus petit ;
 *   · un bouton en cours d'action est désactivé — sinon un chef de
 *     chantier sur réseau lent soumet son rapport trois fois ;
 *   · l'anneau de focus n'est jamais supprimé.
 */
export const Bouton = forwardRef<HTMLButtonElement, Props>(function Bouton(
  {
    variante = "primaire",
    taille = "md",
    enCours = false,
    pleineLargeur = false,
    iconeGauche,
    iconeDroite,
    disabled,
    children,
    className,
    type = "button",
    ...reste
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        SOCLE,
        TAILLES[taille],
        VARIANTES[variante],
        pleineLargeur && "w-full",
        className,
      )}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      {...reste}
    >
      {enCours ? (
        <span
          // 0,7 s plutot que la seconde de `animate-spin` : le rythme de
          // l'ancien indicateur, conserve tel quel.
          className="block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent [animation-duration:0.7s]"
          aria-hidden="true"
        />
      ) : (
        iconeGauche
      )}
      <span className="inline-flex items-center justify-center gap-2 leading-none empty:hidden">
        {children}
      </span>
      {!enCours && iconeDroite}
    </button>
  );
});
