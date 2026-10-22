"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODES_EXECUTION_BASE } from "@/features/projets/regles";
import { cn } from "@/lib/utils";

interface Props {
  /** Le code du mode de base choisi ; vide tant que rien n'est choisi. */
  valeur: string;
  onChange: (valeur: string) => void;
  disabled?: boolean;
  /** Message d'erreur. Sa présence bascule le champ en état d'erreur. */
  erreur?: string;
}

/**
 * Le mode de base auquel se rattache un mode d'exécution : Régie,
 * Sous-traitance structurée ou Sous-traitance informelle. Le choix est
 * obligatoire et limité à ces trois-là — le rapport journalier ne raisonne
 * que sur eux.
 */
export function SelecteurModeBase({ valeur, onChange, disabled, erreur }: Props) {
  const t = useTranslations("projets.referentiels");
  const identifiant = useId();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-neutral-800" htmlFor={identifiant}>
        {t("modeBase.libelle")}
        <span className="ml-0.5 text-erreur" aria-hidden="true">
          *
        </span>
      </label>
      <Select value={valeur} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={identifiant}
          className={cn("h-[var(--input-height-md)] w-full bg-card")}
          aria-required
          aria-invalid={erreur ? true : undefined}
        >
          <SelectValue placeholder={t("modeBase.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {MODES_EXECUTION_BASE.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {t(`modesBase.${mode}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className={cn("text-xs", erreur ? "font-medium text-erreur" : "text-neutral-600")}>
        {erreur ?? t("modeBase.aide")}
      </p>
    </div>
  );
}
