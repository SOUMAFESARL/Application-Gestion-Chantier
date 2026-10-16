"use client";

import type { ComponentProps } from "react";

import { REFERENTIEL_TYPES_PROJET } from "../referentiels";
import { ComboboxReferentiel } from "./ComboboxReferentiel";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  valeur: string;
  onChange: (valeur: string) => void;
}

/**
 * Le type d'un projet, choisi dans le référentiel `types-projet` (plateforme
 * et entreprise) et enregistré par son code. Un type absent s'ajoute sur place.
 *
 * Il ne porte ni libellé ni message : c'est `FormItem` qui les pose.
 */
export function ComboboxTypeProjet(props: Props) {
  return <ComboboxReferentiel categorie={REFERENTIEL_TYPES_PROJET} valeurPar="code" {...props} />;
}
