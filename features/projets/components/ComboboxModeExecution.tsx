"use client";

import { useTranslations } from "next-intl";
import { useMemo, type ComponentProps } from "react";

import { Combobox, type OptionCombobox } from "@/components/ui/combobox";

import { estModeExecutionBase } from "../regles";
import { REFERENTIEL_MODES_EXECUTION, useReferentiel } from "../referentiels";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  /** Le code du mode choisi ; vide tant que rien n'est choisi. */
  valeur: string;
  onChange: (valeur: string) => void;
  /**
   * Le libellé du mode que porte déjà le lot : un mode retiré de la liste
   * depuis reste affiché, sous son nom, au lieu de son code.
   */
  libelleActuel?: string;
}

/**
 * Le mode d'exécution d'un lot, choisi dans le référentiel `modes-execution`
 * (plateforme et entreprise) et enregistré par son code. Les modes se rangent
 * sous le mode de base auquel ils se rattachent.
 *
 * La liste est fermée : un mode ne s'ajoute pas d'ici, parce qu'il exige son
 * mode de base — il s'ajoute dans « Listes de l'entreprise ».
 *
 * Il ne porte ni libellé ni message : c'est `FormItem` qui les pose.
 */
export function ComboboxModeExecution({ valeur, onChange, libelleActuel, ...props }: Props) {
  const t = useTranslations("projets.referentiels");
  const { entrees } = useReferentiel(REFERENTIEL_MODES_EXECUTION);

  const options = useMemo<OptionCombobox[]>(() => {
    const liste: OptionCombobox[] = entrees.map((entree) => ({
      valeur: entree.code,
      libelle: entree.libelle,
      groupe: estModeExecutionBase(entree.groupe) ? t(`modesBase.${entree.groupe}`) : entree.groupe || undefined,
    }));
    if (valeur && libelleActuel && !liste.some((option) => option.valeur === valeur)) {
      liste.push({ valeur, libelle: libelleActuel, groupe: t("modeRetire") });
    }
    return liste;
  }, [entrees, valeur, libelleActuel, t]);

  return (
    <Combobox
      options={options}
      valeur={valeur}
      onChange={onChange}
      placeholder={t("selectionner")}
      placeholderRecherche={t("rechercherMode")}
      aucunResultat={t("aucun")}
      {...props}
    />
  );
}
