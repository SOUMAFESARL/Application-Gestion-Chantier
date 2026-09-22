"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

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
    <div className={cn("mb-4 flex flex-col gap-1", className)}>
      <label className="text-sm font-semibold text-neutral-800" htmlFor={identifiant}>
        {libelle}
        {required && (
          <span className="ml-0.5 text-erreur" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={identifiant}
          className={cn(
            "h-[var(--input-height)] w-full rounded-md border border-neutral-300 bg-neutral-0 px-[var(--input-padding-x)]",
            "text-neutral-700 outline-none transition-[border-color,box-shadow]",
            "placeholder:text-neutral-500",
            "not-disabled:not-focus:hover:border-neutral-400",
            // Le rembourrage perd 1 px des que la bordure en gagne un : sans
            // cette compensation, le passage a 2 px de filet au focus
            // decalerait le texte saisi, et le formulaire entier tremblerait.
            "focus:border-2 focus:border-primary-500 focus:px-[calc(var(--input-padding-x)-1px)]",
            "focus:text-neutral-900 focus:shadow-[var(--shadow-focus)]",
            "disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400",
            enErreur && [
              "border-2 border-erreur px-[calc(var(--input-padding-x)-1px)]",
              "focus:border-erreur focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-erreur)_12%,transparent)]",
            ],
            (iconeDroite || actionDroite) && "pr-12",
          )}
          aria-invalid={enErreur || undefined}
          aria-describedby={erreur || aide ? idAide : undefined}
          aria-required={required || undefined}
          required={required}
          {...reste}
        />
        {iconeDroite && (
          <span className="pointer-events-none absolute right-3 flex items-center text-neutral-500">
            {iconeDroite}
          </span>
        )}
        {/* Contrairement a l'icone, l'action recoit les clics : le bouton qui
            revele un mot de passe garde sa cible tactile. */}
        {actionDroite && (
          <span
            className={cn(
              "absolute right-1 flex items-center",
              "[&_button]:flex [&_button]:size-10 [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center",
              "[&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-neutral-500",
              "[&_button]:after:absolute [&_button]:after:-inset-1 [&_button]:after:content-['']",
              "[&_button:hover]:bg-neutral-100 [&_button:hover]:text-neutral-700",
            )}
          >
            {actionDroite}
          </span>
        )}
      </div>

      {(erreur || aide) && (
        <p
          id={idAide}
          className={cn(
            "text-xs",
            enErreur ? "font-medium text-erreur" : "text-neutral-600",
          )}
        >
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
});
