"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { LOTS_INDICATIFS } from "@/features/referentiels/lots";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  valeur: string;
  onChange: (valeur: string) => void;
}

/** La liste ne change pas : elle se construit une fois, au chargement du module. */
const OPTIONS: OptionCombobox[] = LOTS_INDICATIFS.flatMap(({ famille, lots }) =>
  lots.map((nom) => ({ valeur: nom, libelle: nom, groupe: famille })),
);

/**
 * Le nom d'un lot, en combobox — même geste que la localité d'un chantier
 * (`ComboboxVille`) : on cherche dans la liste indicative des lots, rangée
 * par corps d'état, et un nom qui n'y figure pas se **tape dans la
 * recherche** puis s'utilise tel quel.
 *
 * Comme `ComboboxVille`, il ne porte ni libellé ni message : `FormItem` les
 * pose, et `id` / `aria-*` vont au bouton réellement focalisable.
 */
export function ComboboxNomLot({ valeur, onChange, ...props }: Props) {
  const t = useTranslations("projets.lotsActivites.formLot");
  return (
    <Combobox
      options={OPTIONS}
      valeur={valeur}
      onChange={onChange}
      placeholder={t("champNomChoisir")}
      placeholderRecherche={t("champNomRechercher")}
      aucunResultat={t("champNomAucunResultat")}
      libelleSaisieLibre={(saisie) => t("champNomUtiliserSaisie", { saisie })}
      {...props}
    />
  );
}
