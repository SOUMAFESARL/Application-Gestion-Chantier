"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { toast } from "sonner";

import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { ErreurApi } from "@/lib/api";

import {
  ajouterAuReferentiel,
  cleReferentiel,
  useReferentiel,
  type CategorieReferentiel,
} from "../referentiels";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  categorie: CategorieReferentiel;
  /** Le type de projet s'enregistre par son code ; le nom d'un lot, par son libellé. */
  valeurPar: "code" | "libelle";
  valeur: string;
  onChange: (valeur: string) => void;
}

/**
 * Un choix dans un référentiel dynamique (types de projet, noms de lot). Un
 * libellé absent de la liste s'y ajoute sur place — « Ajouter « … » » — et
 * devient aussitôt proposé à toute l'entreprise.
 */
export function ComboboxReferentiel({ categorie, valeurPar, valeur, onChange, ...props }: Props) {
  const t = useTranslations("projets.referentiels");
  const cache = useQueryClient();
  const { entrees } = useReferentiel(categorie);

  const options: OptionCombobox[] = entrees.map((entree) => ({
    valeur: entree[valeurPar],
    libelle: entree.libelle,
    groupe:
      entree.groupe || (entree.origine === "ENTREPRISE" ? t("groupeEntreprise") : undefined),
  }));

  const ajout = useMutation({
    mutationFn: (libelle: string) => ajouterAuReferentiel(categorie, libelle),
    onSuccess: (entree) => {
      void cache.invalidateQueries({ queryKey: cleReferentiel(categorie) });
      onChange(entree[valeurPar]);
    },
    onError: (cause) =>
      toast.error(cause instanceof ErreurApi ? cause.message : t("erreurAjout")),
  });

  function choisir(choix: string) {
    if (options.some((option) => option.valeur === choix)) {
      onChange(choix);
    } else if (choix.trim()) {
      ajout.mutate(choix);
    }
  }

  return (
    <Combobox
      options={options}
      valeur={valeur}
      onChange={choisir}
      placeholder={t("selectionner")}
      placeholderRecherche={t("rechercher")}
      aucunResultat={t("aucun")}
      libelleSaisieLibre={(saisie) => t("ajouter", { saisie })}
      {...props}
      disabled={props.disabled || ajout.isPending}
    />
  );
}
