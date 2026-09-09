"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import styles from "./Champ.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  libelle: string;
  /** Message d'erreur. Sa présence bascule le champ en état d'erreur. */
  erreur?: string;
  /** Aide affichée sous le champ, remplacée par l'erreur le cas échéant. */
  aide?: string;
  iconeDroite?: ReactNode;
  /** Bouton à droite du champ — l'œil qui révèle un mot de passe. */
  actionDroite?: ReactNode;
}

/**
 * Champ de saisie — charte §7.4.
 *
 * L'erreur est affichée **sous le champ**, en toutes lettres, et reliée à
 * l'entrée par `aria-describedby` : un lecteur d'écran l'annonce, et la
 * couleur n'est jamais le seul porteur de l'information (charte §8.4).
 */
export const Champ = forwardRef<HTMLInputElement, Props>(function Champ(
  { libelle, erreur, aide, iconeDroite, actionDroite, required, className, ...reste },
  ref,
) {
  const identifiant = useId();
  const idAide = `${identifiant}-aide`;
  const enErreur = Boolean(erreur);

  return (
    <div className={[styles.groupe, className ?? ""].filter(Boolean).join(" ")}>
      <label className={styles.libelle} htmlFor={identifiant}>
        {libelle}
        {required && (
          <span className={styles.obligatoire} aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className={styles.enveloppe}>
        <input
          ref={ref}
          id={identifiant}
          className={[
            styles.champ,
            enErreur ? styles.erreur : "",
            iconeDroite || actionDroite ? styles.avecIcone : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={enErreur || undefined}
          aria-describedby={erreur || aide ? idAide : undefined}
          aria-required={required || undefined}
          required={required}
          {...reste}
        />
        {iconeDroite && <span className={styles.icone}>{iconeDroite}</span>}
        {actionDroite && <span className={styles.action}>{actionDroite}</span>}
      </div>

      {(erreur || aide) && (
        <p id={idAide} className={enErreur ? styles.messageErreur : styles.messageAide}>
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
});
