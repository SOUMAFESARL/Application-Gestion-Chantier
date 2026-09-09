"use client";

import { useTranslations } from "next-intl";
import type { NiveauAcces } from "../types";
import { NIVEAU_ACCES } from "../types";
import styles from "./SelecteurNiveau.module.css";

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
  const classeNiveau = styles[`niveau${valeur}`] || "";
  const classeSurcharge = estSurcharge ? styles.surcharge : "";

  const libelles: Record<NiveauAcces, string> = {
    0: t("niveauAucun"),
    1: t("niveauLecture"),
    2: t("niveauEcriture"),
    3: t("niveauValidation"),
  };

  if (lectureSeule || !onChange) {
    return (
      <span
        className={`${styles.select} ${classeNiveau} ${classeSurcharge}`}
        title={estSurcharge ? t("surchargeChantier") : undefined}
      >
        {libelles[valeur]}
      </span>
    );
  }

  return (
    <div className={styles.selecteur}>
      <select
        value={valeur}
        aria-label={libelleAria}
        disabled={lectureSeule}
        onChange={(e) => onChange(Number(e.target.value) as NiveauAcces)}
        className={`${styles.select} ${classeNiveau} ${classeSurcharge}`}
      >
        <option value={NIVEAU_ACCES.AUCUN}>{t("niveauAucun")}</option>
        <option value={NIVEAU_ACCES.LECTURE}>{t("niveauLecture")}</option>
        <option value={NIVEAU_ACCES.ECRITURE}>{t("niveauEcriture")}</option>
        <option value={NIVEAU_ACCES.VALIDATION}>{t("niveauValidation")}</option>
      </select>
    </div>
  );
}
