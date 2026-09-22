"use client";

import { useTranslations } from "next-intl";

import { ecartSigne as formaterEcart, estEnRetard, largeurJauge } from "@/features/projets/regles";
import { cn } from "@/lib/utils";

import { JAUGE_CIBLE, JAUGE_PISTE, JAUGE_REMPLI } from "./classes";


interface Props {
  avancementReel: number;
  avancementTheorique: number;
  ecart: number;
}

/**
 * La jauge d'avancement d'un chantier : le réalisé, et le repère du prévu.
 *
 * Elle était écrite **deux fois** dans le tableau de bord — une fois pour la
 * colonne du tableau, une fois pour la carte mobile — avec à chaque fois son
 * propre calcul de retard et de largeur. Deux copies d'une jauge finissent
 * par ne plus placer le repère au même endroit.
 */
export function JaugeAvancement({ avancementReel, avancementTheorique, ecart }: Props) {
  const t = useTranslations("tableauDeBord.chantiers");
  const enRetard = estEnRetard(ecart);
  const libellePrevu = t("prevu", { taux: avancementTheorique, ecart: formaterEcart(ecart) });

  return (
    <div className={JAUGE_PISTE}>
      <div
        className={cn(JAUGE_REMPLI, enRetard ? "bg-avertissement" : "bg-primary-500")}
        style={{ width: `${largeurJauge(avancementReel)}%` }}
      />
      <div
        className={JAUGE_CIBLE}
        style={{ left: `${largeurJauge(avancementTheorique)}%` }}
        title={libellePrevu}
      />
    </div>
  );
}

/** La légende chiffrée qui surmonte la jauge — réalisé à gauche, prévu à droite. */
export function LegendeAvancement({
  avancementReel,
  avancementTheorique,
  ecart,
}: Props) {
  const t = useTranslations("tableauDeBord.chantiers");

  return (
    <>
      <span style={{ fontWeight: 600 }}>{t("reel", { taux: avancementReel })}</span>
      <span style={{ color: "var(--color-neutral-500, #8A8680)" }}>
        {t("prevu", { taux: avancementTheorique, ecart: formaterEcart(ecart) })}
      </span>
    </>
  );
}
