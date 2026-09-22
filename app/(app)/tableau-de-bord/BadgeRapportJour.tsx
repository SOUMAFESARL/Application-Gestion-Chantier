"use client";

import { CheckCircle, ClockCountdown } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import type { StatutRapportJour } from "@/features/tableauDeBord/types";

/** L'heure de dépôt affichée tant que le serveur ne la renvoie pas. */
const HEURE_DEPOT_PROVISOIRE = "17:30";

interface Props {
  statut: StatutRapportJour;
}

/**
 * L'état du rapport journalier d'un chantier.
 *
 * Troisième motif qui existait en double entre la colonne de tableau et la
 * carte mobile.
 */
export function BadgeRapportJour({ statut }: Props) {
  const t = useTranslations("tableauDeBord.chantiers");

  if (statut === "SOUMIS") {
    return (
      <Badge variante="succes">
        <CheckCircle size={12} weight="bold" />
        <span>{t("rapportSoumis", { heure: HEURE_DEPOT_PROVISOIRE })}</span>
      </Badge>
    );
  }

  return (
    <Badge variante="avertissement">
      <ClockCountdown size={12} weight="bold" />
      <span>{t("rapportEnAttente")}</span>
    </Badge>
  );
}
