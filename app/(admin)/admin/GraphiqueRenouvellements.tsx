"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EtatErreur } from "@/components/ui";
import { cumulEvolution, FENETRES_EVOLUTION, fenetreEvolution } from "@/features/administration";
import type { FenetreEvolution } from "@/features/administration";
import { lireEvolutionAbonnements } from "@/features/administration/adaptateur";
import { formaterDate } from "@/lib/format";

import { CLES_ADMINISTRATION } from "./cles";
import { TEINTE_CURSEUR, TEINTE_GRILLE } from "./tons";

/**
 * Les teintes des deux séries, et les dégradés qui les remplissent.
 *
 * `var(--color-renouveles)` n'est pas un jeton de la charte : c'est la
 * variable que `ChartStyle` pose sur le conteneur à partir de la clé de
 * configuration du même nom. La série suit donc sa couleur sans que ce
 * fichier ne répète une valeur.
 */
const TEINTE_RENOUVELES = "var(--color-graphique-1)";
const TEINTE_NON_RENOUVELES = "var(--color-graphique-2)";
const TRAIT_RENOUVELES = "var(--color-renouveles)";
const TRAIT_NON_RENOUVELES = "var(--color-nonRenouveles)";
const DEGRADE_RENOUVELES = "degradeRenouveles";
const DEGRADE_NON_RENOUVELES = "degradeNonRenouveles";
const REMPLISSAGE_RENOUVELES = `url(#${DEGRADE_RENOUVELES})`;
const REMPLISSAGE_NON_RENOUVELES = `url(#${DEGRADE_NON_RENOUVELES})`;

/**
 * Les renouvellements d'abonnements, jour par jour.
 *
 * **Deux séries empilées, et non une seule courbe.** Un total de
 * renouvellements ne veut rien dire tant qu'on ignore combien d'abonnements
 * sont tombés le même jour : c'est le rapport entre les deux qui dit si le
 * parc tient. L'empilement donne en plus la hauteur totale — le nombre
 * d'échéances traitées — sans troisième série à lire.
 *
 * La fenêtre se change **sans nouvel appel** : le serveur renvoie les trois
 * mois, `fenetreEvolution` découpe. Changer de période est un geste qu'on
 * répète dix fois de suite, et dix allers-retours réseau sur une connexion de
 * chantier se voient.
 */
export function GraphiqueRenouvellements() {
  const t = useTranslations("administration");
  const [fenetre, setFenetre] = useState<FenetreEvolution>(90);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.evolution(),
    queryFn: ({ signal }) => lireEvolutionAbonnements(signal),
  });

  const points = useMemo(
    () => fenetreEvolution(requete.data ?? [], fenetre),
    [requete.data, fenetre],
  );

  const donnees = useMemo(
    () =>
      points.map((point) => ({
        jour: point.date.toISOString().slice(0, 10),
        renouveles: point.renouveles,
        nonRenouveles: point.nonRenouveles,
      })),
    [points],
  );

  const cumul = useMemo(() => cumulEvolution(points), [points]);

  const configuration = {
    renouveles: {
      label: t("graphiques.renouveles"),
      color: TEINTE_RENOUVELES,
    },
    nonRenouveles: {
      label: t("graphiques.nonRenouveles"),
      color: TEINTE_NON_RENOUVELES,
    },
  } satisfies ChartConfig;

  const libelleFenetre: Record<FenetreEvolution, string> = {
    90: t("graphiques.periode90"),
    30: t("graphiques.periode30"),
    7: t("graphiques.periode7"),
  };

  const libelleFenetreCourt: Record<FenetreEvolution, string> = {
    90: t("graphiques.periode90Court"),
    30: t("graphiques.periode30Court"),
    7: t("graphiques.periode7Court"),
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t("graphiques.evolutionTitre")}</CardTitle>
        <CardAction>
          <div
            role="group"
            aria-label={t("graphiques.periode")}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
          >
            {FENETRES_EVOLUTION.map((valeur) => {
              const active = valeur === fenetre;
              return (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setFenetre(valeur)}
                  aria-pressed={active}
                  title={libelleFenetre[valeur]}
                  className={`rounded-md border-0 px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-neutral-0 text-neutral-900 shadow-sm"
                      : "bg-transparent text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {libelleFenetreCourt[valeur]}
                </button>
              );
            })}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[2px] bg-(--teinte-serie)"
              style={{ "--teinte-serie": TEINTE_RENOUVELES } as CSSProperties}
            />
            {t("graphiques.totalRenouveles", { nombre: cumul.renouveles })}
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[2px] bg-(--teinte-serie)"
              style={{ "--teinte-serie": TEINTE_NON_RENOUVELES } as CSSProperties}
            />
            {t("graphiques.totalNonRenouveles", { nombre: cumul.nonRenouveles })}
          </span>
        </div>

        {requete.isPending && <Skeleton className="h-64 w-full rounded-lg" />}

        {requete.isError && (
          <EtatErreur
            message={t("erreurs.chargement")}
            onReessayer={() => void requete.refetch()}
          />
        )}

        {requete.isSuccess &&
          (donnees.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-neutral-600">
              {t("graphiques.aucuneDonnee")}
            </p>
          ) : (
            <ChartContainer config={configuration} className="aspect-auto h-64 w-full">
              <AreaChart data={donnees} margin={{ left: 4, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id={DEGRADE_RENOUVELES} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TRAIT_RENOUVELES} stopOpacity={0.75} />
                    <stop offset="95%" stopColor={TRAIT_RENOUVELES} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id={DEGRADE_NON_RENOUVELES} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TRAIT_NON_RENOUVELES} stopOpacity={0.6} />
                    <stop
                      offset="95%"
                      stopColor={TRAIT_NON_RENOUVELES}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} stroke={TEINTE_GRILLE} />

                <XAxis
                  dataKey="jour"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  tickFormatter={(valeur: string) =>
                    `${valeur.slice(8, 10)}/${valeur.slice(5, 7)}`
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={32}
                  allowDecimals={false}
                />

                <ChartTooltip
                  cursor={{ stroke: TEINTE_CURSEUR }}
                  content={
                    <ChartTooltipContent
                      formaterEtiquette={(valeur) => formaterDate(String(valeur))}
                    />
                  }
                />

                <Area
                  dataKey="nonRenouveles"
                  type="natural"
                  stackId="abonnements"
                  stroke={TRAIT_NON_RENOUVELES}
                  fill={REMPLISSAGE_NON_RENOUVELES}
                  strokeWidth={2}
                />
                <Area
                  dataKey="renouveles"
                  type="natural"
                  stackId="abonnements"
                  stroke={TRAIT_RENOUVELES}
                  fill={REMPLISSAGE_RENOUVELES}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ))}
      </CardContent>
    </Card>
  );
}
