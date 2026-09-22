"use client";

import { useTranslations } from "next-intl";
import type { NiveauAcces } from "../types";
import { NIVEAU_ACCES } from "../types";
import { cn } from "@/lib/utils";

const PASTILLE = [
  "cursor-pointer rounded-sm border border-neutral-300 bg-neutral-0 px-2 py-1",
  "text-xs font-medium transition-all",
  "focus:border-primary-500 focus:shadow-[0_0_0_2px_var(--color-primary-100)] focus:outline-none",
].join(" ");

/**
 * Les tons des quatre niveaux d'acces.
 *
 * Les niveaux 2 et 3 lisaient `--color-warning-*` et `--color-success-*`, qui
 * n'existent nulle part dans `tokens.css` : sans valeur de repli, les trois
 * declarations tombaient et les deux niveaux s'affichaient sans aucun ton. Ils
 * passent aux jetons semantiques de la charte, qui eux existent.
 */
const TONS: Record<NiveauAcces, string> = {
  0: "border-neutral-200 bg-neutral-100 text-neutral-600",
  1: "border-secondary-200 bg-secondary-50 text-secondary-700",
  2: "border-avertissement/30 bg-avertissement-fond text-avertissement",
  3: "border-succes/30 bg-succes-fond text-succes",
};

/** Une permission redefinie au niveau du chantier porte un filet a gauche. */
const SURCHARGE = "border-l-[3px] border-l-primary-500 font-bold";

interface Props {
  valeur: NiveauAcces;
  onChange?: (nouveauNiveau: NiveauAcces) => void;
  lectureSeule?: boolean;
  estSurcharge?: boolean;
  libelleAria?: string;
}

export function SelecteurNiveau({
  valeur,
  onChange,
  lectureSeule = false,
  estSurcharge = false,
  libelleAria,
}: Props) {
  const t = useTranslations("roles");
  const classes = cn(PASTILLE, TONS[valeur], estSurcharge && SURCHARGE);

  const libelles: Record<NiveauAcces, string> = {
    0: t("niveauAucun"),
    1: t("niveauLecture"),
    2: t("niveauEcriture"),
    3: t("niveauValidation"),
  };

  if (lectureSeule || !onChange) {
    return (
      <span
        className={classes}
        title={estSurcharge ? t("surchargeChantier") : undefined}
      >
        {libelles[valeur]}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center">
      <select
        value={valeur}
        aria-label={libelleAria}
        disabled={lectureSeule}
        onChange={(e) => onChange(Number(e.target.value) as NiveauAcces)}
        className={classes}
      >
        <option value={NIVEAU_ACCES.AUCUN}>{t("niveauAucun")}</option>
        <option value={NIVEAU_ACCES.LECTURE}>{t("niveauLecture")}</option>
        <option value={NIVEAU_ACCES.ECRITURE}>{t("niveauEcriture")}</option>
        <option value={NIVEAU_ACCES.VALIDATION}>{t("niveauValidation")}</option>
      </select>
    </div>
  );
}
