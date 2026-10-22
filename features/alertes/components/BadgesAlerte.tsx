"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import { tonNiveau, tonStatut } from "@/features/alertes/regles";
import type { NiveauAlerte, StatutAlerte } from "@/features/alertes/types";

/**
 * Les deux pastilles d'une alerte, partagées par la liste et le détail : la
 * même alerte ne doit pas changer de couleur en passant de l'une à l'autre.
 * La teinte vient de `regles.ts` ; le libellé est toujours écrit en toutes
 * lettres à côté (charte §8.4).
 */

export function BadgeNiveauAlerte({ niveau }: { niveau: NiveauAlerte }) {
  const t = useTranslations("alertes");
  return <Badge variante={tonNiveau(niveau)}>{t(`niveau.${niveau}`)}</Badge>;
}

export function BadgeEtatAlerte({ statut }: { statut: StatutAlerte }) {
  const t = useTranslations("alertes");
  return <Badge variante={tonStatut(statut)}>{t(`statut.${statut}`)}</Badge>;
}
