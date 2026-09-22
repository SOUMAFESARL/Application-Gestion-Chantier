"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { estEnRetard } from "@/features/projets/regles";
import type { LigneChantier } from "@/features/tableauDeBord/types";

import { BadgeRapportJour } from "./BadgeRapportJour";
import { CelluleBudget } from "./CelluleBudget";
import { JaugeAvancement, LegendeAvancement } from "./JaugeAvancement";

/** Les intitules en capitales de la carte : section et blocs du pied. */
const ETIQUETTE =
  "text-[11px] font-semibold tracking-[0.03em] text-neutral-500 uppercase";

interface Props {
  chantier: LigneChantier;
  onDefinirBudget: (chantier: LigneChantier) => void;
}

/**
 * La carte d'un chantier, affichée à la place du tableau sur petit écran.
 *
 * Elle réemploie les trois mêmes briques que la vue tableau — jauge, budget,
 * rapport du jour — au lieu d'en tenir une seconde version. C'est tout
 * l'intérêt du découpage : les deux vues d'un même chantier ne peuvent plus
 * afficher deux choses différentes.
 */
export function CarteChantierMobile({ chantier, onDefinirBudget }: Props) {
  const t = useTranslations("tableauDeBord.chantiers");
  const enRetard = estEnRetard(chantier.ecart);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-0 p-4 shadow-[0_1px_3px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] hover:border-primary-300 hover:shadow-[0_2px_8px_rgb(0_0_0/0.06)]">
      <div className="flex items-start justify-between gap-2 max-sm:flex-col max-sm:items-start">
        <div className="flex flex-col gap-0.5">
          <Link href={`/projets/${chantier.id}`} className="text-[15px] leading-[1.3] font-bold text-neutral-900 no-underline hover:text-primary-600 hover:underline">
            {chantier.nom}
          </Link>
          <span className="text-xs text-neutral-500">
            {t("detailProjet", {
              client: chantier.clientNom,
              ville: chantier.ville,
              quartier: chantier.quartier || t("villeDefaut"),
            })}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 max-sm:justify-start">
          <Badge variante={enRetard ? "avertissement" : "succes"}>
            {chantier.statut === "EN_COURS" ? t("enCours") : t("rapportEnAttente")}
          </Badge>
          <Badge variante="succes">
            <span>{chantier.indiceSante}/100</span>
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-sm border border-neutral-100 bg-neutral-50 px-3 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className={ETIQUETTE}>{t("labelAvancement")}</span>
          <div className="flex items-center gap-2 text-xs text-neutral-800">
            <LegendeAvancement
              avancementReel={chantier.avancementReel}
              avancementTheorique={chantier.avancementTheorique}
              ecart={chantier.ecart}
            />
          </div>
        </div>
        <JaugeAvancement
          avancementReel={chantier.avancementReel}
          avancementTheorique={chantier.avancementTheorique}
          ecart={chantier.ecart}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1 max-sm:grid-cols-1 max-sm:gap-2.5">
        <div className="flex flex-col gap-1">
          <span className={ETIQUETTE}>{t("labelBudget")}</span>
          <CelluleBudget chantier={chantier} onDefinirBudget={onDefinirBudget} />
        </div>

        <div className="flex flex-col gap-1">
          <span className={ETIQUETTE}>{t("labelRapport")}</span>
          <BadgeRapportJour statut={chantier.rapportJourStatut} />
        </div>
      </div>

      <Link href={`/projets/${chantier.id}`} className="flex min-h-10 items-center justify-between rounded-sm border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-primary-600 no-underline transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700">
        <span>{t("consulterChantier")}</span>
        <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  );
}
