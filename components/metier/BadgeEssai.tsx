"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const SOCLE =
  "inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1 text-[13px] leading-none font-semibold whitespace-nowrap no-underline transition-all";

/** En version courte, le badge se glisse dans une ligne de tableau. */
const COURT = "px-2 py-0.5 text-[11px]";

const VERT = "border-succes/20 bg-succes-fond text-succes";
const AMBRE = "border-avertissement/20 bg-avertissement-fond text-avertissement";
const ROUGE = "border-erreur/20 bg-erreur-fond text-erreur";

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
      <span className={cn(SOCLE, ROUGE, court && COURT)}>
        <Timer size={court ? 14 : 16} />
        <span>{court ? t("expireCourt") : t("expire")}</span>
      </span>
    );
  }

  const jours = joursRestants ?? 14;
  const estAlerte = jours <= 3;
  const ton = estAlerte ? AMBRE : VERT;

  return (
    <span className={cn(SOCLE, ton, court && COURT)}>
      <Timer size={court ? 14 : 16} />
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
