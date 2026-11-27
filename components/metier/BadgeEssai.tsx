"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  dureeRestanteDepuisDate,
  dureeRestanteDepuisJours,
  estDureeSinguliere,
} from "@/features/abonnement/regles";
import { formaterDureeCalendaire } from "@/lib/format";
import { cn } from "@/lib/utils";

const SOCLE =
  "inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1 text-[13px] leading-none font-semibold whitespace-nowrap no-underline transition-all";

/** En version courte, le badge se glisse dans une ligne de tableau. */
const COURT = "px-2 py-0.5 text-[11px]";

const VERT = "border-succes/20 bg-succes-fond text-succes";
const AMBRE = "border-avertissement/20 bg-avertissement-fond text-avertissement";
const ROUGE = "border-erreur/20 bg-erreur-fond text-erreur";

export interface BadgeEssaiProps {
  dateFin?: string | null;
  joursRestants?: number | null;
  estExpire?: boolean;
  court?: boolean;
}

/**
 * Badge de compteur d'abonnement / essai gratuit — Maquette M10, US-016 & T-025.
 * La couleur n'est jamais seule : icône + texte explicite.
 */
export function BadgeEssai({
  dateFin,
  joursRestants,
  estExpire = false,
  court = false,
}: BadgeEssaiProps) {
  const t = useTranslations("abonnement");
  const duree =
    dureeRestanteDepuisDate(dateFin) ?? dureeRestanteDepuisJours(joursRestants ?? 14);

  if (estExpire || duree.totalJours <= 0) {
    return (
      <span className={cn(SOCLE, ROUGE, court && COURT)}>
        <Timer size={court ? 14 : 16} />
        <span>{court ? t("expireCourt") : t("expire")}</span>
      </span>
    );
  }

  const estAlerte = duree.totalJours <= 3;
  const ton = estAlerte ? AMBRE : VERT;

  if (court) {
    const partiesCourtes = [
      duree.annees > 0 && t("uniteAnCourt", { n: duree.annees }),
      duree.mois > 0 && t("uniteMoisCourt", { n: duree.mois }),
      duree.jours > 0 && t("uniteJourCourt", { n: duree.jours }),
    ].filter((partie): partie is string => Boolean(partie));

    return (
      <span className={cn(SOCLE, ton, COURT)}>
        <Timer size={14} />
        <span>{partiesCourtes.join(" ")}</span>
      </span>
    );
  }

  const libelleDuree = formaterDureeCalendaire(duree);
  const singulier = estDureeSinguliere(duree);
  const cle = estAlerte
    ? singulier
      ? "dureeRestanteAlerteSingulier"
      : "dureeRestanteAlertePluriel"
    : singulier
      ? "dureeRestanteSingulier"
      : "dureeRestantePluriel";

  return (
    <span className={cn(SOCLE, ton)}>
      <Timer size={16} />
      <span>{t(cle, { duree: libelleDuree })}</span>
    </span>
  );
}
