"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { pointsBudget } from "@/features/tableauDeBord";
import type { LigneChantier } from "@/features/tableauDeBord";
import { formaterMontant, formaterMontantCourt } from "@/lib/format";

import {
  BLOC,
  BLOC_CORPS,
  BLOC_ENTETE,
  BLOC_SOUS_TITRE,
  BLOC_TITRE,
  BLOC_VIDE,
  TEINTE_CONSOMME,
  TEINTE_CURSEUR,
  TEINTE_DEPASSEMENT,
  TEINTE_GRILLE,
  TEINTE_PREVU,
} from "./classes";

/** La hauteur d'une rangée de barres : assez pour deux barres et un nom lisible. */
const HAUTEUR_RANGEE = 56;
const HAUTEUR_AXE = 32;
/** Les noms de chantier sont longs ; au-delà, ils sont coupés et repris par l'infobulle. */
const LARGEUR_NOMS = 150;
const LONGUEUR_NOM = 22;

const abreger = (nom: string) => (nom.length > LONGUEUR_NOM ? `${nom.slice(0, LONGUEUR_NOM - 1)}…` : nom);

/**
 * Le budget prévu et le dépensé, chantier par chantier — CDC module 3,
 * « comparer en permanence ce qui était budgété et ce qui a réellement été
 * dépensé ».
 *
 * **Des barres horizontales**, parce que ce qu'on compare ce sont des
 * chantiers, pas des périodes : leurs noms se lisent en ligne, sans rotation.
 * La barre du dépensé passe au rouge quand elle dépasse le prévu — c'est la
 * seule chose que l'œil doit attraper, il n'a pas à comparer deux longueurs.
 */
export function GraphiqueBudgets({ chantiers }: { chantiers: LigneChantier[] }) {
  const t = useTranslations("tableauDeBord.graphique");
  const points = pointsBudget(chantiers);

  const configuration = {
    prevu: { label: t("prevu"), color: TEINTE_PREVU },
    consomme: { label: t("consomme"), color: TEINTE_CONSOMME },
  } satisfies ChartConfig;

  return (
    <section className={BLOC}>
      <header className={BLOC_ENTETE}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {(["prevu", "consomme"] as const).map((cle) => (
            <span key={cle} className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[2px] bg-(--teinte-serie)"
                style={{ "--teinte-serie": configuration[cle].color } as CSSProperties}
              />
              {configuration[cle].label}
            </span>
          ))}
        </div>
      </header>

      <div className={BLOC_CORPS}>
        {points.length === 0 ? (
          <p className={BLOC_VIDE}>{t("aucun")}</p>
        ) : (
          <ChartContainer
            config={configuration}
            className="aspect-auto w-full"
            style={{ height: points.length * HAUTEUR_RANGEE + HAUTEUR_AXE }}
          >
            <BarChart data={points} layout="vertical" margin={{ left: 0, right: 12 }} barGap={2}>
              <CartesianGrid horizontal={false} stroke={TEINTE_GRILLE} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(valeur: number) => formaterMontantCourt(valeur)}
              />
              <YAxis
                type="category"
                dataKey="nom"
                width={LARGEUR_NOMS}
                tickLine={false}
                axisLine={false}
                tickFormatter={abreger}
              />
              <ChartTooltip
                cursor={{ fill: TEINTE_CURSEUR }}
                content={
                  <ChartTooltipContent
                    formaterValeur={(valeur) => formaterMontant(Number(valeur ?? 0))}
                  />
                }
              />
              <Bar dataKey="prevu" fill={TEINTE_PREVU} radius={[0, 4, 4, 0]} barSize={14} />
              <Bar dataKey="consomme" radius={[0, 4, 4, 0]} barSize={14}>
                {points.map((point) => (
                  <Cell
                    key={point.id}
                    fill={point.consomme > point.prevu ? TEINTE_DEPASSEMENT : TEINTE_CONSOMME}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
