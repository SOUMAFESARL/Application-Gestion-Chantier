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
  useDroitsReferentiels,
  useReferentiel,
  type CategorieReferentielLibre,
} from "../referentiels";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  categorie: CategorieReferentielLibre;
  /** Le type de projet s'enregistre par son code ; le nom d'un lot, par son libellé. */
  valeurPar: "code" | "libelle";
  valeur: string;
  onChange: (valeur: string) => void;
}

/**
 * Un choix dans un référentiel dynamique (types de projet, noms de lot). Un
 * libellé absent de la liste peut s'y ajouter sur place — « Ajouter « … » » —
 * et devient aussitôt proposé à toute l'entreprise. Cet ajout n'est offert
 * qu'à qui en a le droit, et c'est le serveur qui le dit
 * (`GET /referentiels/droits/`, `peut_ajouter`) : sans lui, aucune saisie libre
 * n'est proposée et aucune requête ne part.
 */
export function ComboboxReferentiel({ categorie, valeurPar, valeur, onChange, ...props }: Props) {
  const t = useTranslations("projets.referentiels");
  const cache = useQueryClient();
  const { entrees } = useReferentiel(categorie);
  const { droits } = useDroitsReferentiels();

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
    } else if (droits.peutAjouter && choix.trim()) {
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
      libelleSaisieLibre={droits.peutAjouter ? (saisie) => t("ajouter", { saisie }) : undefined}
      {...props}
      disabled={props.disabled || ajout.isPending}
    />
  );
}
