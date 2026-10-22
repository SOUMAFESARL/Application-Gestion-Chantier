"use client";

import { useTranslations } from "next-intl";
import { Fragment, useMemo } from "react";

import { EtatVide } from "@/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  etendueDonneesPlanning,
  libelleDelta,
  moisPlanning,
  niveauRetardPlanning,
  positionAvancementPlanning,
  positionJourPlanning,
  positionMarqueurTemporel,
  positionPlanning,
  SEUIL_RETARD_CRITIQUE_PLANNING,
  SEUIL_RETARD_MODERE_PLANNING,
  type NiveauRetardPlanning,
} from "@/features/projets/regles";
import type { DonneesPlanning } from "@/features/projets/types";
import { formaterDate, formaterMoisCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC } from "./classes";

/** La colonne des libellés, puis la frise. */
const GRILLE = "grid grid-cols-[16rem_minmax(0,1fr)]";

/** La barre d'avancement physique prend la teinte du retard de son lot. */
const AVANCEMENT_RETARD: Record<NiveauRetardPlanning, string> = {
  DANS_LES_DELAIS: "bg-succes",
  MODERE: "bg-avertissement",
  CRITIQUE: "bg-erreur",
};

/** Le seuil (points) que la légende d'un niveau affiche ; `null` quand le niveau n'en a pas. */
const SEUIL_LEGENDE: Record<NiveauRetardPlanning, number | null> = {
  DANS_LES_DELAIS: null,
  MODERE: SEUIL_RETARD_MODERE_PLANNING,
  CRITIQUE: SEUIL_RETARD_CRITIQUE_PLANNING,
};

/** Ce que l'infobulle d'une barre dit de son lot ou de son activité. */
interface Survol {
  libelle: string;
  debut: string | null;
  fin: string | null;
  avancement: number;
  avancementTemporel: number | null;
  deltaRetard: number | null;
}

/**
 * Les lots et activités du chantier sur une frise : une barre de durée
 * (dates contractuelles) et, par-dessus, l'avancement physique — teinté par le
 * retard du lot —, un trait « aujourd'hui » et, par lot, un marqueur de
 * l'avancement temporel.
 *
 * C'est une **lecture** du planning, pas un outil de planification : on n'y
 * déplace rien. Les données viennent de `GET /projets/{id}/planning/`, toutes
 * les positions de `regles.ts` — le composant ne fait aucune arithmétique de
 * dates. Cliquer un lot l'ouvre dans l'onglet Structure.
 */
export function PlanningLots({
  planning,
  onChoisirLot,
  onChoisirActivite,
}: {
  planning: DonneesPlanning;
  onChoisirLot: (lotId: string) => void;
  onChoisirActivite: (activiteId: string) => void;
}) {
  const t = useTranslations("projets.lotsActivites");

  const etendue = useMemo(() => etendueDonneesPlanning(planning.lots), [planning.lots]);

  if (!etendue) {
    return (
      <div className={BLOC}>
        <EtatVide titre={t("aucunLotTitre")} description={t("planning.aucuneDate")} />
      </div>
    );
  }

  const mois = moisPlanning(etendue);
  const repereJour = positionJourPlanning(planning.aujourdhui, etendue);

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
            <div className={cn(GRILLE, "pointer-events-none absolute inset-0 z-10")} aria-hidden="true">
              <span />
              <span className="relative">
                <span
                  className="absolute top-0 bottom-0 border-0 border-l-2 border-dashed border-erreur"
                  style={{ left: `${repereJour}%` }}
                />
              </span>
            </div>
          )}

          {planning.lots.map((lot) => {
            const niveau = niveauRetardPlanning(lot.deltaRetard);
            const barreLot = lot.debut && lot.fin ? positionPlanning(lot.debut, lot.fin, etendue) : null;
            const marqueur =
              barreLot && lot.avancementTemporel !== null
                ? positionMarqueurTemporel(barreLot, lot.avancementTemporel)
                : null;
            return (
              <Fragment key={lot.id}>
                <div className={cn(GRILLE, "border-0 border-b border-solid border-neutral-100 bg-neutral-50")}>
                  <button
                    type="button"
                    onClick={() => onChoisirLot(lot.id)}
                    title={t("planning.ouvrirLot", { libelle: lot.libelle })}
                    className="cursor-pointer truncate border-0 bg-transparent px-4 py-2 text-left text-sm font-semibold text-neutral-900 hover:text-primary"
                  >
                    <span className="mr-1.5 font-mono text-xs text-neutral-500">{lot.code}</span>
                    {lot.libelle}
                  </button>
                  <span className="relative">
                    {barreLot && (
                      <BarreAvancement
                        position={barreLot}
                        avancement={lot.avancement}
                        teinte={AVANCEMENT_RETARD[niveau]}
                        epaisse={false}
                        marqueur={marqueur}
                        onClick={() => onChoisirLot(lot.id)}
                        survol={{
                          libelle: `${lot.code} ${lot.libelle}`,
                          debut: lot.debut,
                          fin: lot.fin,
                          avancement: lot.avancement,
                          avancementTemporel: lot.avancementTemporel,
                          deltaRetard: lot.deltaRetard,
                        }}
                      />
                    )}
                  </span>
                </div>

                {lot.activites.map((activite) => {
                  const barreActivite =
                    activite.debut && activite.fin
                      ? positionPlanning(activite.debut, activite.fin, etendue)
                      : null;
                  return (
                    <div
                      key={activite.id}
                      className={cn(GRILLE, "border-0 border-b border-solid border-neutral-100")}
                    >
                      <span className="truncate py-2 pr-4 pl-8 text-sm text-neutral-800">
                        {activite.libelle}
                      </span>
                      <span className="relative">
                        {barreActivite ? (
                          <BarreAvancement
                            position={barreActivite}
                            avancement={activite.avancement}
                            teinte={AVANCEMENT_RETARD[niveau]}
                            epaisse
                            marqueur={null}
                            onClick={() => onChoisirActivite(activite.id)}
                            survol={{
                              libelle: activite.libelle,
                              debut: activite.debut,
                              fin: activite.fin,
                              avancement: activite.avancement,
                              avancementTemporel: null,
                              deltaRetard: null,
                            }}
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
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-neutral-200" aria-hidden="true" />
            {t("planning.legende.duree")}
          </li>
          {(["DANS_LES_DELAIS", "MODERE", "CRITIQUE"] as const).map((niveau) => {
            const seuil = SEUIL_LEGENDE[niveau];
            return (
              <li key={niveau} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", AVANCEMENT_RETARD[niveau])} aria-hidden="true" />
                {seuil === null ? t(`planning.legende.${niveau}`) : t(`planning.legende.${niveau}`, { seuil })}
              </li>
            );
          })}
          <li className="flex items-center gap-1.5">
            <span className="h-3 border-0 border-l-2 border-dashed border-information" aria-hidden="true" />
            {t("planning.legende.temporel")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 border-0 border-l-2 border-dashed border-erreur" aria-hidden="true" />
            {t("planning.aujourdhui")}
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Une barre de durée (teinte neutre), l'avancement physique par-dessus, et
 * le marqueur de l'avancement temporel quand le lot en a un. L'infobulle
 * donne les trois chiffres : physique, temporel, retard.
 */
function BarreAvancement({
  position,
  avancement,
  teinte,
  epaisse,
  marqueur,
  survol,
  onClick,
}: {
  position: { gauche: number; largeur: number };
  avancement: number;
  teinte: string;
  /** Les barres d'activité sont plus épaisses que celle de leur lot. */
  epaisse: boolean;
  marqueur: number | null;
  survol: Survol;
  onClick: () => void;
}) {
  const t = useTranslations("projets.lotsActivites");
  const hauteur = epaisse ? "h-4" : "h-3";
  const physique = positionAvancementPlanning(position, avancement);
  const delta = libelleDelta(survol.deltaRetard);
  const libelle = t("planning.barre", {
    libelle: survol.libelle,
    debut: survol.debut ? formaterDate(survol.debut) : "",
    fin: survol.fin ? formaterDate(survol.fin) : "",
    avancement,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={libelle}
          className="absolute inset-y-0 w-full cursor-pointer border-0 bg-transparent p-0"
        >
          <span
            className={cn("absolute top-1/2 -translate-y-1/2 rounded-sm bg-neutral-200", hauteur)}
            style={{ left: `${position.gauche}%`, width: `${position.largeur}%` }}
          />
          <span
            className={cn("absolute top-1/2 -translate-y-1/2 rounded-sm", hauteur, teinte)}
            style={{ left: `${physique.gauche}%`, width: `${physique.largeur}%` }}
          />
          {marqueur !== null && (
            <span
              className="absolute top-1/2 h-5 -translate-y-1/2 border-0 border-l-2 border-dashed border-information"
              style={{ left: `${marqueur}%` }}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col gap-0.5">
        <span className="font-semibold">{survol.libelle}</span>
        <span>{t("planning.infobulle.physique", { valeur: avancement })}</span>
        {survol.avancementTemporel !== null && (
          <span>{t("planning.infobulle.temporel", { valeur: survol.avancementTemporel })}</span>
        )}
        {delta && <span>{t(delta.cle, delta.params)}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
