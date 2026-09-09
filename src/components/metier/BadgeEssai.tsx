"use client";

import { ClockCountdown } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import styles from "./BadgeEssai.module.css";

export interface BadgeEssaiProps {
  joursRestants?: number | null;
  estExpire?: boolean;
  court?: boolean;
}

/**
 * Badge de compteur d'essai gratuit — Maquette M10, US-016 & T-025.
 * La couleur n'est jamais seule : icône + texte explicite.
 */
export function BadgeEssai({ joursRestants, estExpire = false, court = false }: BadgeEssaiProps) {
  const t = useTranslations("abonnement");

  if (estExpire || joursRestants === 0) {
    return (
      <span className={`${styles.badge} ${styles.rouge} ${court ? styles.court : ""}`}>
        <ClockCountdown size={court ? 14 : 16} weight="fill" />
        <span>{court ? t("expireCourt") : t("expire")}</span>
      </span>
    );
  }

  const jours = joursRestants ?? 14;
  const estAlerte = jours <= 3;
  const classeTon = estAlerte ? styles.ambre : styles.vert;

  return (
    <span className={`${styles.badge} ${classeTon} ${court ? styles.court : ""}`}>
      <ClockCountdown size={court ? 14 : 16} weight="fill" />
      <span>
        {court
          ? t("joursRestantsCourt", { jours })
          : estAlerte
            ? t("joursRestantsAlerte", { jours })
            : t("joursRestants", { jours })}
      </span>
    </span>
  );
}
