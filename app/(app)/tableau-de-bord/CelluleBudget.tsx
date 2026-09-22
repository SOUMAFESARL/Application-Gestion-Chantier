"use client";

import { useTranslations } from "next-intl";

import { niveauBudget, ratioConsommationBudget } from "@/features/projets/regles";
import type { LigneChantier } from "@/features/tableauDeBord/types";
import { formaterMontantCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { MONTANT_TAB, PROJET_DETAIL } from "./classes";


interface Props {
  chantier: LigneChantier;
  onDefinirBudget: (chantier: LigneChantier) => void;
}

const RATIO_BADGE =
  "inline-flex w-fit items-center rounded-full border px-1.5 py-px text-[11px] font-semibold";

/**
 * Le ton du badge selon le niveau d'alerte budgétaire.
 *
 * Les trois lisaient `--color-semantic-*-text` et `--color-semantic-*-border`,
 * qui n'existent pas dans `tokens.css` : seul le fond, déclaré avec une valeur
 * de repli, s'appliquait vraiment. Ils passent aux jetons sémantiques de la
 * charte, qui portent le fond **et** l'encre.
 */
const TON_PAR_NIVEAU = {
  depassement: "border-erreur/30 bg-erreur-fond text-erreur",
  alerte: "border-avertissement/30 bg-avertissement-fond text-avertissement",
  conforme: "border-succes/30 bg-succes-fond text-succes",
} as const;

/**
 * Le budget d'un chantier : consommé sur initial, et son ratio.
 *
 * Comme la jauge, cette cellule existait en double — colonne de tableau et
 * carte mobile — et les deux copies ne se gardaient pas de la même façon d'un
 * budget non défini. Le calcul est désormais dans `regles.ratioConsommation-
 * Budget`, et l'affichage ici.
 */
export function CelluleBudget({ chantier, onDefinirBudget }: Props) {
  const t = useTranslations("tableauDeBord.chantiers");

  if (chantier.budgetInitial === null) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-neutral-500 italic">{t("budgetNonDefini")}</span>
        <button
          type="button"
          className="cursor-pointer rounded-sm border border-dashed border-primary-300 bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600 transition-all hover:border-primary-500 hover:bg-primary-100 hover:text-primary-700"
          onClick={() => onDefinirBudget(chantier)}
        >
          {t("definirBudget")}
        </button>
      </div>
    );
  }

  const ratio = ratioConsommationBudget(chantier.budgetInitial, chantier.budgetConsomme);
  const niveau = niveauBudget(ratio) ?? "conforme";
  const tauxAffiche = ratio ?? 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <span className={MONTANT_TAB}>{formaterMontantCourt(chantier.budgetConsomme)}</span>
        <span className={PROJET_DETAIL}>/ {formaterMontantCourt(chantier.budgetInitial)}</span>
      </div>
      <span className={cn(RATIO_BADGE, TON_PAR_NIVEAU[niveau])}>
        {niveau === "depassement"
          ? t("ratioDepassement", { taux: tauxAffiche })
          : t("ratioConsommation", { taux: tauxAffiche })}
      </span>
    </div>
  );
}
