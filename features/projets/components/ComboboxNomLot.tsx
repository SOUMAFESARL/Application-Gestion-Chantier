"use client";

import type { ComponentProps } from "react";

import { REFERENTIEL_LOTS } from "../referentiels";
import { ComboboxReferentiel } from "./ComboboxReferentiel";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  valeur: string;
  onChange: (valeur: string) => void;
}

/**
 * Le nom d'un lot, choisi dans le référentiel `lots` — la liste indicative
 * par corps d'état posée par la plateforme, plus les noms ajoutés par
 * l'entreprise. Un nom absent s'ajoute sur place et reste proposé à tous.
 *
 * Il ne porte ni libellé ni message : `FormItem` les pose, et `id` / `aria-*`
 * vont au bouton réellement focalisable.
 */
export function ComboboxNomLot(props: Props) {
  return <ComboboxReferentiel categorie={REFERENTIEL_LOTS} valeurPar="libelle" {...props} />;
}
