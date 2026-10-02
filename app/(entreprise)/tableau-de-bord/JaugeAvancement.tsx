"use client";

import { useTranslations } from "next-intl";

import { ecartSigne, estEnRetard, largeurJauge } from "@/features/projets/regles";
import { cn } from "@/lib/utils";

import { JAUGE_CIBLE, JAUGE_PISTE, JAUGE_REMPLI } from "./classes";

interface Props {
  avancementReel: number;
  avancementTheorique: number;
  ecart: number;
}

/**
 * L'avancement d'un chantier : la légende chiffrée, puis la jauge — le réalisé
 * remplit la piste, le prévu y pose un repère.
 *
 * La vue tableau et la vue cartes posent **la même** jauge : deux copies d'une
 * jauge finissent par ne plus placer le repère au même endroit.
 */
export function JaugeAvancement({ avancementReel, avancementTheorique, ecart }: Props) {
  const t = useTranslations("tableauDeBord.portefeuille");
  const enRetard = estEnRetard(ecart);
  const prevu = t("prevu", { taux: avancementTheorique, ecart: ecartSigne(ecart) });

  return (
    <div className="min-w-[160px]">
      <div className="flex justify-between gap-2 text-xs">
        <span className="font-semibold text-neutral-800">{t("reel", { taux: avancementReel })}</span>
        <span className={enRetard ? "font-medium text-avertissement" : "text-neutral-500"}>
          {prevu}
        </span>
      </div>
      <div className={JAUGE_PISTE}>
        <div
          className={cn(JAUGE_REMPLI, enRetard ? "bg-avertissement" : "bg-primary-500")}
          style={{ width: `${largeurJauge(avancementReel)}%` }}
        />
        <div
          className={JAUGE_CIBLE}
          style={{ left: `${largeurJauge(avancementTheorique)}%` }}
          title={prevu}
        />
      </div>
    </div>
  );
}
