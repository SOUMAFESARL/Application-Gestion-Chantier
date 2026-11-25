"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Projet } from "@/features/projets/types";
import { formaterDate, formaterJourMoisNumerique, formaterPourcentage } from "@/lib/format";

import { lireArbre, lireCourbe } from "../adaptateur";
import { cleArbre, cleCourbe } from "../cles";
import {
  casesAvecCourbe,
  etatAvancement,
  pointsCourbe,
  tachesEnDepassement,
  tachesIndisponibles,
  trouverCase,
} from "../regles";
import type { CaseArbre, CourbeAvancement } from "../types";

const PROJET_ENTIER = "projet";
const JOUR_MS = 86_400_000;

/** Les teintes des séries : celles de la charte des graphiques (`app/globals.css`). */
const TEINTE_PREVU = "var(--color-graphique-3)";
const TEINTE_REEL = "var(--color-graphique-1)";
const TEINTE_GRILLE = "var(--color-neutral-200)";
const TEINTE_REPERE = "var(--color-neutral-500)";
const TEINTE_ESTIMEE = "var(--color-avertissement)";
/** Les traits des séries : la variable que `ChartStyle` pose pour chaque clé de configuration. */
const TRAIT_PREVU = "var(--color-prevu)";
const TRAIT_REEL = "var(--color-reel)";
const POINTILLE = "4 4";
const POINTILLE_FIN = "2 2";

function enTimestamp(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function versIsoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * L'onglet Avancement de la fiche projet (lot 12, décision P9) : la **courbe en S** — le prévu
 * tiré des dates et des montants, le réel relevé chaque nuit — et la **fin estimée** au rythme
 * des quatre dernières semaines, affichée seulement. Pour le projet entier, toute case active de
 * niveau 1 (même sans enfant) ou toute case parente active d'un autre niveau.
 */
export function OngletAvancement({ projet }: { projet: Projet }) {
  const t = useTranslations("decoupage.avancement");
  const [caseId, setCaseId] = useState<string | null>(null);

  const arbre = useQuery({
    queryKey: cleArbre(projet.id),
    queryFn: ({ signal }) => lireArbre(projet.id, signal),
    enabled: projet.decoupageCree,
  });

  const casesCourbe = useMemo(
    () => (arbre.data ? casesAvecCourbe(arbre.data.cases) : []),
    [arbre.data],
  );

  const caseSelectionneeId = useMemo(
    () => (caseId && casesCourbe.some((une) => une.id === caseId) ? caseId : null),
    [caseId, casesCourbe],
  );

  const courbe = useQuery({
    queryKey: cleCourbe(projet.id, caseSelectionneeId),
    queryFn: ({ signal }) => lireCourbe(projet.id, caseSelectionneeId, signal),
    enabled: projet.decoupageCree,
  });

  if (!projet.decoupageCree) {
    return <EtatVide titre={t("sansDecoupage")} description={t("sansDecoupageDescription")} />;
  }
  if (arbre.isPending) return <EtatChargement />;
  if (arbre.isError) return <EtatErreur onReessayer={() => void arbre.refetch()} />;

  const cases = arbre.data.cases;
  const caseSelectionnee = trouverCase(cases, caseSelectionneeId);
  const perimetreCases = caseSelectionnee ? [caseSelectionnee] : cases;
  const depassements = tachesEnDepassement(perimetreCases);
  const indisponibles = tachesIndisponibles(perimetreCases);
  const cibleAvancement = caseSelectionnee ?? arbre.data;
  const etat = etatAvancement(cibleAvancement);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <Tuile titre={t("physique")}>
          {etat === "indisponible" ? (
            <span className="text-base text-neutral-500">{t("indisponible")}</span>
          ) : (
            <span className="flex items-center gap-2">
              {formaterPourcentage(cibleAvancement.avancement)}
              {etat === "partiel" && <Badge variante="avertissement">{t("partiel")}</Badge>}
            </span>
          )}
        </Tuile>
        <Tuile titre={t("finEstimee")}>
          {courbe.data?.finEstimee ? (
            formaterDate(courbe.data.finEstimee)
          ) : (
            <span className="text-base text-neutral-500">{t("pasDEstimation")}</span>
          )}
        </Tuile>
        <Tuile titre={t("rythme")}>
          {courbe.data?.rythmeParSemaine !== null && courbe.data?.rythmeParSemaine !== undefined ? (
            t("rythmeValeur", { valeur: formaterPourcentage(courbe.data.rythmeParSemaine) })
          ) : (
            <span className="text-base text-neutral-500">{t("pasDeRythme")}</span>
          )}
        </Tuile>
      </section>

      {etat === "partiel" && indisponibles.length > 0 && (
        <Alert variant="avertissement">
          <AlertDescription>{t("partielExplication", { nombre: indisponibles.length })}</AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-neutral-900">
            <TrendingUp size={18} aria-hidden="true" />
            {t("courbe")}
          </h2>
          <Select
            value={caseSelectionneeId ?? PROJET_ENTIER}
            onValueChange={(v) => setCaseId(v === PROJET_ENTIER ? null : v)}
          >
            <SelectTrigger className="w-72 max-sm:w-full" aria-label={t("choisirCase")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROJET_ENTIER}>{t("projetEntier")}</SelectItem>
              {casesCourbe.map((une) => (
                <SelectItem key={une.id} value={une.id}>
                  {t("caseNumerotee", { numero: une.numero ?? "", libelle: une.libelle })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <p className="m-0 text-xs text-neutral-500">{t("courbeAide")}</p>
        {courbe.isPending && <EtatChargement />}
        {courbe.isError && <EtatErreur onReessayer={() => void courbe.refetch()} />}
        {courbe.isSuccess && <Graphique courbe={courbe.data} />}
      </section>

      <ListeTaches
        titre={t("depassements", { nombre: depassements.length })}
        vide={t("aucunDepassement")}
        taches={depassements}
        detail={(une) => t("depassement", { valeur: une.depassement ?? 0 })}
      />
    </div>
  );
}

function Tuile({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 shadow-sm">
      <span className="text-sm text-neutral-600">{titre}</span>
      <span className="text-2xl font-semibold text-neutral-900 tabular-nums">{children}</span>
    </div>
  );
}

function ListeTaches({
  titre,
  vide,
  taches,
  detail,
}: {
  titre: string;
  vide: string;
  taches: CaseArbre[];
  detail: (une: CaseArbre) => string;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 shadow-sm">
      <h3 className="m-0 text-base font-semibold text-neutral-900">{titre}</h3>
      {taches.length === 0 ? (
        <p className="m-0 text-sm text-neutral-500">{vide}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-neutral-100 p-0">
          {taches.map((une) => (
            <li key={une.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-mono text-xs text-neutral-500">{une.numero}</span>
              <span className="min-w-0 flex-1 text-sm text-neutral-900">{une.libelle}</span>
              <span className="text-xs text-neutral-600">{detail(une)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Graphique({ courbe }: { courbe: CourbeAvancement }) {
  const t = useTranslations("decoupage.avancement");
  const points = useMemo(() => pointsCourbe(courbe), [courbe]);
  const aPrevu = useMemo(() => courbe.prevu.some((p) => p.valeur !== null), [courbe.prevu]);
  const aReel = useMemo(() => courbe.reel.some((p) => p.valeur !== null), [courbe.reel]);
  const prevuPartiel = useMemo(
    () => aPrevu && courbe.prevu.some((p) => p.valeur === null),
    [aPrevu, courbe.prevu],
  );

  const donnees = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        timestamp: enTimestamp(point.date),
      })),
    [points],
  );

  const domaine = useMemo(() => {
    const timestamps = donnees.map((d) => d.timestamp).filter(Number.isFinite);
    if (courbe.debut) timestamps.push(enTimestamp(courbe.debut));
    if (courbe.finPrevue) timestamps.push(enTimestamp(courbe.finPrevue));
    if (courbe.finContractuelle) timestamps.push(enTimestamp(courbe.finContractuelle));
    if (timestamps.length === 0) return null;

    const minBase = Math.min(...timestamps);
    let maxBase = Math.max(...timestamps);
    const etendueBase = Math.max(maxBase - minBase, 180 * JOUR_MS);

    let afficherFinEstimee = false;
    if (courbe.finEstimee) {
      const tsEstimee = enTimestamp(courbe.finEstimee);
      if (Number.isFinite(tsEstimee) && tsEstimee <= maxBase + etendueBase) {
        afficherFinEstimee = true;
        maxBase = Math.max(maxBase, tsEstimee);
      }
    }

    if (minBase === maxBase) {
      return {
        min: minBase - 7 * JOUR_MS,
        max: maxBase + 7 * JOUR_MS,
        afficherFinEstimee,
      };
    }

    return { min: minBase, max: maxBase, afficherFinEstimee };
  }, [donnees, courbe.debut, courbe.finPrevue, courbe.finContractuelle, courbe.finEstimee]);

  if (points.length === 0 || !domaine) {
    return (
      <p className="m-0 py-8 text-center text-sm text-neutral-500">
        {!courbe.debut && !courbe.finPrevue ? t("pasDePointsSansDates") : t("pasDePoints")}
      </p>
    );
  }

  const configuration = {
    ...(aPrevu ? { prevu: { label: t("prevu"), color: TEINTE_PREVU } } : {}),
    ...(aReel ? { reel: { label: t("reel"), color: TEINTE_REEL } } : {}),
  } satisfies ChartConfig;

  const tsFinPrevue = courbe.finPrevue ? enTimestamp(courbe.finPrevue) : null;
  const tsFinContractuelle =
    courbe.finContractuelle && courbe.finContractuelle !== courbe.finPrevue
      ? enTimestamp(courbe.finContractuelle)
      : null;
  const tsFinEstimee =
    domaine.afficherFinEstimee && courbe.finEstimee ? enTimestamp(courbe.finEstimee) : null;

  return (
    <div className="flex flex-col gap-3">
      {!aPrevu && aReel && (
        <Alert variant="information">
          <AlertDescription>{t("alerteDatesAbsentes")}</AlertDescription>
        </Alert>
      )}
      {prevuPartiel && (
        <Alert variant="information">
          <AlertDescription>{t("alerteDatesPartielles")}</AlertDescription>
        </Alert>
      )}

      <ChartContainer config={configuration} className="aspect-auto h-72 w-full">
        <LineChart data={donnees} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke={TEINTE_GRILLE} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={[domaine.min, domaine.max]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
            tickFormatter={(valeur: number) => formaterJourMoisNumerique(versIsoDate(valeur))}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v} %`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formaterEtiquette={(valeur) =>
                  typeof valeur === "number"
                    ? formaterDate(versIsoDate(valeur))
                    : formaterDate(String(valeur))
                }
                formaterValeur={(valeur) => formaterPourcentage(valeur ?? null)}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {tsFinPrevue !== null && (
            <ReferenceLine
              x={tsFinPrevue}
              stroke={TEINTE_REPERE}
              strokeDasharray={POINTILLE}
              label={t("repereFinPrevue")}
            />
          )}
          {tsFinContractuelle !== null && (
            <ReferenceLine
              x={tsFinContractuelle}
              stroke={TEINTE_REPERE}
              strokeDasharray={POINTILLE_FIN}
              label={t("repereFinContractuelle")}
            />
          )}
          {tsFinEstimee !== null && (
            <ReferenceLine
              x={tsFinEstimee}
              stroke={TEINTE_ESTIMEE}
              strokeDasharray={POINTILLE}
              label={t("repereFinEstimee")}
            />
          )}
          {aPrevu && (
            <Line
              dataKey="prevu"
              type="monotone"
              stroke={TRAIT_PREVU}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
          {aReel && (
            <Line
              dataKey="reel"
              type="monotone"
              stroke={TRAIT_REEL}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          )}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
