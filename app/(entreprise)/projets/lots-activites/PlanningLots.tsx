"use client";

import { useTranslations } from "next-intl";
import { Fragment, useMemo } from "react";

import { EtatVide } from "@/components/ui";
import {
  avancementActivites,
  etenduePlanning,
  moisPlanning,
  periodeActivite,
  periodeLot,
  positionAujourdhui,
  positionPlanning,
  statutActivite,
} from "@/features/projets/regles";
import type { Lot } from "@/features/projets/types";
import { formaterDate, formaterMoisCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BARRE_STATUT, BLOC } from "./classes";

/** La colonne des libellés, puis la frise. */
const GRILLE = "grid grid-cols-[16rem_minmax(0,1fr)]";

/**
 * Les activités du chantier sur une frise : une barre par activité, teintée
 * par son statut, sous la barre de son lot.
 *
 * C'est une **lecture** du planning, pas un outil de planification : on n'y
 * déplace rien. Les dates se modifient dans le tiroir de l'activité, et la
 * frise suit. Toutes les positions viennent de `positionPlanning` — le
 * composant ne fait aucune arithmétique de dates.
 */
export function PlanningLots({ lots }: { lots: Lot[] }) {
  const t = useTranslations("projets.lotsActivites");

  const etendue = useMemo(() => etenduePlanning(lots), [lots]);

  if (!etendue) {
    return (
      <div className={BLOC}>
        <EtatVide titre={t("aucunLotTitre")} description={t("planning.aucuneDate")} />
      </div>
    );
  }

  const mois = moisPlanning(etendue);
  const repereJour = positionAujourdhui(etendue);

  return (
    <div className={cn(BLOC, "overflow-x-auto [scrollbar-width:thin]")}>
      <div className="min-w-[860px]">
        <div className={cn(GRILLE, "border-0 border-b border-solid border-neutral-200 bg-neutral-50")}>
          <span className="px-4 py-2.5 text-xs font-semibold tracking-wider text-neutral-600 uppercase">
            {t("colonnes.lotActivite")}
          </span>
          <div className="relative h-9">
            {mois.map((debutMois) => {
              const position = positionPlanning(debutMois, debutMois, etendue).gauche;
              return (
                <span
                  key={debutMois}
                  className="absolute top-0 flex h-full items-center border-0 border-l border-solid border-neutral-200 pl-1.5 text-xs text-neutral-500"
                  style={{ left: `${position}%` }}
                >
                  {formaterMoisCourt(debutMois)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative">
          {repereJour !== null && (
            <div className={cn(GRILLE, "pointer-events-none absolute inset-0")} aria-hidden="true">
              <span />
              <span className="relative">
                <span
                  className="absolute top-0 bottom-0 border-0 border-l-2 border-dashed border-erreur"
                  style={{ left: `${repereJour}%` }}
                />
              </span>
            </div>
          )}

          {lots.map((lot) => {
            const periode = periodeLot(lot);
            return (
              <Fragment key={lot.id}>
                <div className={cn(GRILLE, "border-0 border-b border-solid border-neutral-100 bg-neutral-50")}>
                  <span className="truncate px-4 py-2 text-sm font-semibold text-neutral-900">
                    <span className="mr-1.5 font-mono text-xs text-neutral-500">{lot.code}</span>
                    {lot.nom}
                  </span>
                  <span className="relative">
                    {periode.debut && periode.fin && (
                      <Barre
                        debut={periode.debut}
                        fin={periode.fin}
                        etendue={etendue}
                        className="h-2.5 bg-primary-200"
                        libelle={t("planning.barre", {
                          libelle: lot.nom,
                          debut: formaterDate(periode.debut),
                          fin: formaterDate(periode.fin),
                          avancement: avancementActivites(lot.activites),
                        })}
                      />
                    )}
                  </span>
                </div>

                {lot.activites.map((activite) => {
                  const periodeAct = periodeActivite(activite);
                  return (
                    <div
                      key={activite.id}
                      className={cn(GRILLE, "border-0 border-b border-solid border-neutral-100")}
                    >
                      <span className="truncate py-2 pr-4 pl-8 text-sm text-neutral-800">
                        <span className="mr-1.5 font-mono text-xs text-neutral-500">{activite.code}</span>
                        {activite.libelle}
                      </span>
                      <span className="relative">
                        {periodeAct ? (
                          <Barre
                            debut={periodeAct.debut}
                            fin={periodeAct.fin}
                            etendue={etendue}
                            className={cn("h-4", BARRE_STATUT[statutActivite(activite)])}
                            libelle={t("planning.barre", {
                              libelle: activite.libelle,
                              debut: formaterDate(periodeAct.debut),
                              fin: formaterDate(periodeAct.fin),
                              avancement: activite.avancement,
                            })}
                          />
                        ) : (
                          <span className="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-neutral-500 italic">
                            {t("planning.nonPlanifiee")}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>

        <ul className="m-0 flex list-none flex-wrap items-center gap-4 p-4 text-xs text-neutral-600">
          {(["TERMINE", "EN_COURS", "EN_RETARD", "A_VENIR"] as const).map((statut) => (
            <li key={statut} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", BARRE_STATUT[statut])} aria-hidden="true" />
              {t(`statutActivite.${statut}`)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-3 border-0 border-l-2 border-dashed border-erreur" aria-hidden="true" />
            {t("planning.aujourdhui")}
          </li>
        </ul>
      </div>
    </div>
  );
}

function Barre({
  debut,
  fin,
  etendue,
  className,
  libelle,
}: {
  debut: string;
  fin: string;
  etendue: { debut: string; fin: string };
  className: string;
  libelle: string;
}) {
  const { gauche, largeur } = positionPlanning(debut, fin, etendue);
  return (
    <span
      role="img"
      aria-label={libelle}
      title={libelle}
      className={cn("absolute top-1/2 -translate-y-1/2 rounded-sm", className)}
      style={{ left: `${gauche}%`, width: `${largeur}%` }}
    />
  );
}
