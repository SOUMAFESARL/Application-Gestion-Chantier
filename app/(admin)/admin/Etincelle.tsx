"use client";

import { Line, LineChart } from "recharts";

import type { TonVariation } from "@/features/administration";

import { TEINTE_VARIATION } from "./tons";

/**
 * La mini-courbe d'une tuile d'indicateur.
 *
 * **Sans axes, sans grille, sans infobulle**, et c'est ce qui la définit :
 * elle ne donne pas de valeurs, elle donne une forme. Les chiffres sont déjà
 * là, à côté — les répéter en petit n'ajouterait rien et se lirait mal.
 *
 * Sa taille est **fixe** et non responsive : un `ResponsiveContainer` mesure
 * son parent après le premier rendu, ce qui coûte un saut de mise en page sur
 * cinq tuiles alignées, pour une courbe de quatre-vingts pixels.
 */
export function Etincelle({
  points,
  ton,
}: {
  points: number[];
  ton: TonVariation;
}) {
  if (points.length < 2) return null;

  const donnees = points.map((valeur, rang) => ({ rang, valeur }));

  return (
    <LineChart
      width={68}
      height={30}
      data={donnees}
      margin={{ top: 4, right: 3, bottom: 4, left: 3 }}
    >
      <Line
        dataKey="valeur"
        type="natural"
        stroke={TEINTE_VARIATION[ton]}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
