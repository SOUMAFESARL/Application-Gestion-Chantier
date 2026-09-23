"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { listerVilles } from "@/features/referentiels/villes";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  /** Le code ISO du pays de l'entreprise. Vide tant qu'il n'est pas connu. */
  pays: string;
  valeur: string;
  onChange: (valeur: string) => void;
}

/**
 * La localité d'un chantier, en combobox shadcn — le pendant de
 * `SelecteurVille` pour les formulaires `react-hook-form`.
 *
 * Mêmes règles que lui (voir son commentaire) : la liste suit le pays de
 * l'entreprise, l'agglomération se découpe en communes, et une localité
 * absente du référentiel reste saisissable. Ce qui change est la forme de
 * cette saisie libre : on la **tape dans la recherche**, et le combobox
 * propose de l'utiliser telle quelle — plus d'option « Autre » qui fait
 * apparaître un second champ sous le premier.
 *
 * Il ne porte ni libellé ni message : c'est `FormItem` qui les pose, et le
 * composant transmet `id` / `aria-*` au contrôle réellement focalisable.
 * `SelecteurVille` reste en place pour les écrans qui n'ont pas migré.
 */
export function ComboboxVille({ pays, valeur, onChange, ...props }: Props) {
  const t = useTranslations("referentielVilles");
  const { agglomeration, communes, autres } = listerVilles(pays);

  // Aucune liste pour ce pays : un champ texte, pas une liste vide sans issue.
  if (communes.length + autres.length === 0) {
    const { id, disabled, ...aria } = props;
    return (
      <Input
        id={id}
        disabled={disabled}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        placeholder={t("placeholderPersonnalise")}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
      />
    );
  }

  const groupeCommunes = t("groupeAgglomeration", { agglomeration });
  const groupeAutres = communes.length > 0 ? t("groupeAutres") : undefined;
  const options: OptionCombobox[] = [
    ...communes.map((nom) => ({ valeur: nom, libelle: nom, groupe: groupeCommunes })),
    ...autres.map((nom) => ({ valeur: nom, libelle: nom, groupe: groupeAutres })),
  ];

  return (
    <Combobox
      options={options}
      valeur={valeur}
      onChange={onChange}
      placeholder={t("choisir")}
      placeholderRecherche={t("rechercher")}
      aucunResultat={t("aucunResultat")}
      libelleSaisieLibre={(saisie) => t("utiliserSaisie", { saisie })}
      {...props}
    />
  );
}
