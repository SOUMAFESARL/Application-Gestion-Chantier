"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./Bouton.module.css";

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
  const classes = [
    styles.bouton,
    styles[variante],
    styles[taille],
    pleineLargeur ? styles.pleineLargeur : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      {...reste}
    >
      {enCours ? (
        <span className={styles.indicateur} aria-hidden="true" />
      ) : (
        iconeGauche
      )}
      <span className={styles.libelle}>{children}</span>
      {!enCours && iconeDroite}
    </button>
  );
});
