"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Cell, Label, Pie, PieChart, Sector } from "recharts";
import type { PieSectorDataItem } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { partDuParc, repartitionParc } from "@/features/administration";
import type { ClientPlateforme } from "@/features/administration";

import { TEINTE_ETAT_COMMERCIAL, TEINTE_SEPARATION } from "./tons";

/**
 * Le parc client en trois parts : abonné, en essai, sans abonnement.
 *
 * **Trois parts et pas cinq.** `StatutAbonnement` en compte cinq, mais un
 * impayé, un suspendu et un résilié répondent la même chose à la question que
 * pose ce camembert — celle-là ne rapporte rien aujourd'hui. Leur différence
 * compte pour la relance, qui a sa propre liste (« À traiter ») ; ici elle
 * aurait donné trois miettes illisibles à côté de deux parts.
 *
 * Le total au centre est ce qui fait tenir le camembert : sans lui, une part
 * ne se lit qu'en proportion, et « 40 % » d'un parc inconnu ne dit rien.
 */
export function GraphiqueParcClients({ clients }: { clients: ClientPlateforme[] }) {
  const t = useTranslations("administration");

  const parts = useMemo(() => repartitionParc(clients), [clients]);
  const total = clients.length;

  const configuration = {
    ABONNEMENT_ACTIF: {
      label: t("graphiques.etat.ABONNEMENT_ACTIF"),
      color: TEINTE_ETAT_COMMERCIAL.ABONNEMENT_ACTIF,
    },
    ESSAI: {
      label: t("graphiques.etat.ESSAI"),
      color: TEINTE_ETAT_COMMERCIAL.ESSAI,
    },
    SANS_ABONNEMENT: {
      label: t("graphiques.etat.SANS_ABONNEMENT"),
      color: TEINTE_ETAT_COMMERCIAL.SANS_ABONNEMENT,
    },
  } satisfies ChartConfig;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t("graphiques.parcTitre")}</CardTitle>
        <CardDescription>{t("graphiques.parcSousTitre")}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {total === 0 ? (
          <p className="flex h-64 items-center justify-center text-center text-sm text-neutral-600">
            {t("graphiques.aucuneDonnee")}
          </p>
        ) : (
          <>
            <ChartContainer
              config={configuration}
              className="mx-auto aspect-square h-56 w-full"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent cleSerie="etat" masquerEtiquette />}
                />
                <Pie
                  data={parts}
                  dataKey="nombre"
                  nameKey="etat"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke={TEINTE_SEPARATION}
                  strokeWidth={3}
                  activeShape={({ outerRadius = 0, ...reste }: PieSectorDataItem) => (
                    <Sector {...reste} outerRadius={outerRadius + 8} />
                  )}
                >
                  {parts.map((part) => (
                    <Cell key={part.etat} fill={TEINTE_ETAT_COMMERCIAL[part.etat]} />
                  ))}

                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;
                      const cx = Number(viewBox.cx ?? 0);
                      const cy = Number(viewBox.cy ?? 0);
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan
                            x={cx}
                            y={cy - 4}
                            className="fill-neutral-900 text-3xl font-bold tabular-nums"
                          >
                            {total}
                          </tspan>
                          <tspan x={cx} y={cy + 20} className="fill-neutral-600 text-xs">
                            {t("graphiques.parcTotal", { nombre: total })}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="flex flex-col gap-2">
              {parts.map((part) => (
                <li
                  key={part.etat}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2 text-neutral-700">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[2px] bg-(--teinte-part)"
                      style={
                        {
                          "--teinte-part": TEINTE_ETAT_COMMERCIAL[part.etat],
                        } as CSSProperties
                      }
                    />
                    <span className="truncate">{t(`graphiques.etat.${part.etat}`)}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
                    {t("graphiques.partLegende", {
                      nombre: part.nombre,
                      part: partDuParc(part.nombre, total),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
