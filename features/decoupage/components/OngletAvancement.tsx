"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCheck, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { formaterDate, formaterPourcentage } from "@/lib/format";

import { lireArbre, lireCourbe } from "../adaptateur";
import { cleArbre, cleCourbe } from "../cles";
import {
  casesAvecCourbe,
  etatAvancement,
  pointsCourbe,
  tachesACloturer,
  tachesEnDepassement,
  tachesIndisponibles,
} from "../regles";
import type { CaseArbre } from "../types";
import { FenetreGeste, type GesteOuvert } from "./FenetreGeste";

const PROJET_ENTIER = "projet";

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

/**
 * L'onglet Avancement de la fiche projet (lot 12, décision P9) : la **courbe en S** — le prévu
 * tiré des dates et des montants, le réel relevé chaque nuit — et la **fin estimée** au rythme
 * des quatre dernières semaines, affichée seulement. Pour le projet entier ou une case.
 *
 * Autour : l'avancement « partiel » ou « indisponible » plutôt qu'un faux 0 %, les tâches en
 * dépassement (le réalisé passe le prévu), et celles à 100 % que le serveur propose de clôturer
 * — il ne clôture jamais seul.
 */
export function OngletAvancement({ projet }: { projet: Projet }) {
  const t = useTranslations("decoupage.avancement");
  const { peutSurProjet } = useDroits();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [geste, setGeste] = useState<GesteOuvert | null>(null);

  const arbre = useQuery({ queryKey: cleArbre(projet.id), queryFn: ({ signal }) => lireArbre(projet.id, signal), enabled: projet.decoupageCree });
  const courbe = useQuery({
    queryKey: cleCourbe(projet.id, caseId),
    queryFn: ({ signal }) => lireCourbe(projet.id, caseId, signal),
    enabled: projet.decoupageCree,
  });

  if (!projet.decoupageCree) return <EtatVide titre={t("sansDecoupage")} description={t("sansDecoupageDescription")} />;
  if (arbre.isPending) return <EtatChargement />;
  if (arbre.isError) return <EtatErreur onReessayer={() => void arbre.refetch()} />;

  const cases = arbre.data.cases;
  const aCloturer = tachesACloturer(cases);
  const depassements = tachesEnDepassement(cases);
  const indisponibles = tachesIndisponibles(cases);
  const etat = etatAvancement(arbre.data);
  const peutMesurer = peutSurProjet(PERMISSIONS.MESURER, projet);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <Tuile titre={t("physique")}>
          {etat === "indisponible" ? (
            <span className="text-base text-neutral-500">{t("indisponible")}</span>
          ) : (
            <span className="flex items-center gap-2">
              {formaterPourcentage(arbre.data.avancement)}
              {etat === "partiel" && <Badge variante="avertissement">{t("partiel")}</Badge>}
            </span>
          )}
        </Tuile>
        <Tuile titre={t("finEstimee")}>
          {courbe.data?.finEstimee ? formaterDate(courbe.data.finEstimee) : <span className="text-base text-neutral-500">{t("pasDEstimation")}</span>}
        </Tuile>
        <Tuile titre={t("rythme")}>
          {courbe.data?.rythmeParSemaine !== null && courbe.data?.rythmeParSemaine !== undefined ? (
            t("rythmeValeur", { valeur: courbe.data.rythmeParSemaine })
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
          <Select value={caseId ?? PROJET_ENTIER} onValueChange={(v) => setCaseId(v === PROJET_ENTIER ? null : v)}>
            <SelectTrigger className="w-72 max-sm:w-full" aria-label={t("choisirCase")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROJET_ENTIER}>{t("projetEntier")}</SelectItem>
              {casesAvecCourbe(cases).map((une) => (
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

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <ListeTaches
          titre={t("aCloturer", { nombre: aCloturer.length })}
          vide={t("aucuneACloturer")}
          taches={aCloturer}
          detail={() => t("cent")}
          action={(une) => (
            <BoutonPermis
              size="sm"
              variant="outline"
              permis={peutMesurer}
              permission={PERMISSIONS.MESURER}
              onClick={() => setGeste({ geste: "cloturer", cible: une })}
            >
              <CheckCheck />
              {t("cloturer")}
            </BoutonPermis>
          )}
        />
        <ListeTaches
          titre={t("depassements", { nombre: depassements.length })}
          vide={t("aucunDepassement")}
          taches={depassements}
          detail={(une) => t("depassement", { valeur: une.depassement ?? 0 })}
        />
      </div>

      <FenetreGeste projet={projet} ouvert={geste} onFermer={() => setGeste(null)} />
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
  action,
}: {
  titre: string;
  vide: string;
  taches: CaseArbre[];
  detail: (une: CaseArbre) => string;
  action?: (une: CaseArbre) => ReactNode;
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
              {action?.(une)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Graphique({ courbe }: { courbe: Parameters<typeof pointsCourbe>[0] & { finPrevue: string | null; finContractuelle: string | null; finEstimee: string | null } }) {
  const t = useTranslations("decoupage.avancement");
  const points = pointsCourbe(courbe);
  if (points.length === 0) return <p className="m-0 py-8 text-center text-sm text-neutral-500">{t("pasDePoints")}</p>;

  const configuration = {
    prevu: { label: t("prevu"), color: TEINTE_PREVU },
    reel: { label: t("reel"), color: TEINTE_REEL },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={configuration} className="aspect-auto h-72 w-full">
      <LineChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} stroke={TEINTE_GRILLE} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={(valeur: string) => `${valeur.slice(8, 10)}/${valeur.slice(5, 7)}`}
        />
        <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 100]} tickFormatter={(v: number) => `${v} %`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formaterEtiquette={(valeur) => formaterDate(String(valeur))}
              formaterValeur={(valeur) => formaterPourcentage(valeur ?? null)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {courbe.finPrevue && <ReferenceLine x={courbe.finPrevue} stroke={TEINTE_REPERE} strokeDasharray={POINTILLE} label={t("repereFinPrevue")} />}
        {courbe.finContractuelle && courbe.finContractuelle !== courbe.finPrevue && (
          <ReferenceLine x={courbe.finContractuelle} stroke={TEINTE_REPERE} strokeDasharray={POINTILLE_FIN} label={t("repereFinContractuelle")} />
        )}
        {courbe.finEstimee && <ReferenceLine x={courbe.finEstimee} stroke={TEINTE_ESTIMEE} strokeDasharray={POINTILLE} label={t("repereFinEstimee")} />}
        <Line dataKey="prevu" type="monotone" stroke={TRAIT_PREVU} strokeWidth={2} dot={false} connectNulls />
        <Line dataKey="reel" type="monotone" stroke={TRAIT_REEL} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </ChartContainer>
  );
}
