"use client";

import { CheckCircle, ClockCountdown } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import styles from "./BadgeEssai.module.css";

export interface BadgeEssaiProps {
  joursRestants?: number | null;
  estExpire?: boolean;
  court?: boolean;
  statut?: "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "RESILIE";
  nomPlan?: string;
}

/**
 * Badge de statut d'abonnement / essai gratuit — Maquette M10, US-016 & T-025.
 * Quand l'abonnement est payé (statut ACTIF), le décompte d'essai disparaît
 * complètement pour afficher le badge officiel du forfait.
 */
export function BadgeEssai({
  joursRestants,
  estExpire = false,
  court = false,
  statut = "ESSAI",
  nomPlan,
}: BadgeEssaiProps) {
  const t = useTranslations("abonnement");

  // CAS ABONNEMENT ACTIF PAYÉ : Aucune mention d'essai ni de jours restants
  if (statut === "ACTIF") {
    return (
      <span className={`${styles.badge} ${styles.vert} ${court ? styles.court : ""}`}>
        <CheckCircle size={court ? 14 : 16} weight="fill" />
        <span>{court ? (nomPlan || "Actif") : `Forfait ${nomPlan || "Actif"}`}</span>
      </span>
    );
  }

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
