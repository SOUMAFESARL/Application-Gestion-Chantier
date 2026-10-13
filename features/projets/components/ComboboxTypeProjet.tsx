"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { TYPES_PROJET } from "@/features/projets/regles";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  valeur: string;
  onChange: (valeur: string) => void;
}

/**
 * Le type d'un projet, en combobox — même fonctionnement que `ComboboxVille` :
 * on choisit un type prédéfini, ou on tape le sien dans la recherche et le
 * combobox propose de l'utiliser tel quel. Un type prédéfini s'enregistre par
 * son code, un type libre par son libellé (voir `libelleTypeProjet`).
 *
 * Il ne porte ni libellé ni message : c'est `FormItem` qui les pose.
 */
export function ComboboxTypeProjet({ valeur, onChange, ...props }: Props) {
  const t = useTranslations("projets.tiroirCreation");

  const options: OptionCombobox[] = TYPES_PROJET.map((type) => ({
    valeur: type,
    libelle: t(`typeProjet.${type}`),
  }));

  return (
    <Combobox
      options={options}
      valeur={valeur}
      onChange={onChange}
      placeholder={t("selectionner")}
      placeholderRecherche={t("rechercherType")}
      aucunResultat={t("aucunTypeTrouve")}
      libelleSaisieLibre={(saisie) => t("utiliserType", { saisie })}
      {...props}
    />
  );
}
