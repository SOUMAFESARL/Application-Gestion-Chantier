"use client";

import { useTranslations } from "next-intl";

import { niveauSante } from "@/features/tableauDeBord";
import { cn } from "@/lib/utils";

import { PASTILLE_SANTE, TEXTE_SANTE } from "./classes";

/**
 * L'indice de santé d'un chantier : la pastille de couleur, le score, et le
 * niveau **écrit en toutes lettres** — charte §8.4, une couleur seule ne se
 * lit pas pour un daltonien ni sur un écran de chantier en plein soleil.
 *
 * Elle remplace un badge qui s'affichait vert quel que soit l'indice.
 */
export function PastilleSante({ indice, compacte = false }: { indice: number; compacte?: boolean }) {
  const t = useTranslations("tableauDeBord.sante");
  const niveau = niveauSante(indice);

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", PASTILLE_SANTE[niveau])} />
      <span className={cn("text-sm font-semibold tabular-nums", TEXTE_SANTE[niveau])}>{indice}</span>
      {!compacte && <span className="text-xs text-neutral-600">{t(niveau)}</span>}
    </span>
  );
}
