"use client";

import * as React from "react";
import * as Recharts from "recharts";

import { cn } from "@/lib/utils";

/**
 * Primitive `chart` de shadcn (recharts), posée ici à la main.
 *
 * Trois écarts au fichier généré, tous voulus :
 *
 * 1. **Un seul thème.** Le fichier d'origine déclare `THEMES = { light, dark }`
 *    et émet deux blocs de variables, le second préfixé `.dark`. Il n'y a pas
 *    de mode sombre dans ce produit (arbitrage A3) : la moitié de ce CSS
 *    n'aurait jamais été atteinte, et la variante `dark:` n'étant même pas
 *    déclarée dans `globals.css`, elle ne compilerait pas.
 * 2. **Aucune couleur en dur.** Les séries prennent leur teinte d'un jeton
 *    (`var(--color-graphique-1)`…), déclaré dans `globals.css` à partir de la
 *    charte — règle 4 du plan de refonte. `ChartStyle` ne fait que nommer ces
 *    jetons par clé de série, sur le conteneur.
 * 3. **`config` porte les libellés**, qui viennent donc de `t("…")` côté
 *    écran : aucune chaîne affichée ne vit dans ce fichier.
 *
 * Le reste est le comportement d'origine : un conteneur responsive, une
 * infobulle et une légende qui lisent la même configuration.
 */

export interface ConfigurationSerie {
  /** Déjà traduit par l'écran — cette primitive n'appelle pas `t()`. */
  label?: React.ReactNode;
  icone?: React.ComponentType<{ className?: string }>;
  /** Une valeur CSS, donc un `var(--color-…)` de la charte. */
  color?: string;
}

export type ChartConfig = Record<string, ConfigurationSerie>;

interface ContexteGraphique {
  config: ChartConfig;
}

const ChartContext = React.createContext<ContexteGraphique | null>(null);

function useChart(): ContexteGraphique {
  const contexte = React.useContext(ChartContext);
  if (!contexte) {
    throw new Error("useChart hors ChartContainer");
  }
  return contexte;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof Recharts.ResponsiveContainer>["children"];
}) {
  const identifiantUnique = React.useId();
  const identifiant = `graphique-${id ?? identifiantUnique.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={identifiant}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted",
          "[&_.recharts-radial-bar-background-sector]:fill-muted",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          "[&_.recharts-layer]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle identifiant={identifiant} config={config} />
        <Recharts.ResponsiveContainer>{children}</Recharts.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

/**
 * Les couleurs des séries, nommées sur le conteneur.
 *
 * `config.actifs.color` devient `--color-actifs`, que recharts lit ensuite par
 * `fill="var(--color-actifs)"`. Passer par une variable plutôt que par la
 * valeur permet à une série de suivre la couleur de marque injectée à
 * l'exécution, comme le reste des utilitaires Tailwind du dépôt.
 */
function ChartStyle({
  identifiant,
  config,
}: {
  identifiant: string;
  config: ChartConfig;
}) {
  const teintes = Object.entries(config).filter(([, serie]) => serie.color);
  if (teintes.length === 0) return null;

  const declarations = teintes
    .map(([cle, serie]) => `  --color-${cle}: ${serie.color};`)
    .join("\n");

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${identifiant}] {\n${declarations}\n}`,
      }}
    />
  );
}

const ChartTooltip = Recharts.Tooltip;

interface EntreeInfobulle {
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
}

/**
 * L'infobulle.
 *
 * Elle ne formate rien elle-même : `formaterEtiquette` et `formaterValeur`
 * sont fournis par l'écran, qui seul sait s'il affiche un montant, un compte
 * ou une date — et qui seul a accès aux traductions.
 */
function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  indicateur = "point",
  masquerEtiquette = false,
  masquerIndicateur = false,
  cleSerie,
  formaterEtiquette,
  formaterValeur,
}: {
  active?: boolean;
  payload?: EntreeInfobulle[];
  label?: string | number;
  className?: string;
  indicateur?: "point" | "ligne";
  masquerEtiquette?: boolean;
  masquerIndicateur?: boolean;
  /**
   * Où lire la clé de série dans la donnée, quand ce n'est pas `dataKey`.
   *
   * Un camembert a une seule `dataKey` (la valeur) pour toutes ses parts : sa
   * série est portée par la donnée elle-même (`nameKey`). Sans ce détour, les
   * trois parts partageraient une entrée de configuration, donc un libellé.
   */
  cleSerie?: string;
  formaterEtiquette?: (valeur: string | number | undefined) => React.ReactNode;
  formaterValeur?: (valeur: number | string | undefined, cle: string) => React.ReactNode;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "grid min-w-40 items-start gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-md",
        className,
      )}
    >
      {!masquerEtiquette && (
        <p className="font-semibold text-neutral-900">
          {formaterEtiquette ? formaterEtiquette(label) : label}
        </p>
      )}
      <div className="grid gap-1.5">
        {payload.map((entree, rang) => {
          const depuisDonnee = cleSerie ? entree.payload?.[cleSerie] : undefined;
          const cle = String(depuisDonnee ?? entree.dataKey ?? entree.name ?? rang);
          const serie = config[cle];
          const teinte =
            entree.color ?? entree.fill ?? (entree.payload?.fill as string | undefined);

          return (
            <div key={cle} className="flex w-full items-center gap-2">
              {!masquerIndicateur && (
                <span
                  className={cn(
                    "shrink-0 rounded-[2px] bg-(--teinte-serie)",
                    indicateur === "point" ? "size-2.5" : "h-full w-1",
                  )}
                  style={{ "--teinte-serie": teinte } as React.CSSProperties}
                />
              )}
              <span className="flex-1 text-muted-foreground">
                {serie?.label ?? entree.name}
              </span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {formaterValeur ? formaterValeur(entree.value, cle) : entree.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = Recharts.Legend;

interface EntreeLegende {
  value?: string | number;
  dataKey?: string | number;
  color?: string;
}

function ChartLegendContent({
  payload,
  className,
}: {
  payload?: EntreeLegende[];
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-4 pt-3", className)}>
      {payload.map((entree, rang) => {
        const cle = String(entree.dataKey ?? entree.value ?? rang);
        const serie = config[cle];
        const Icone = serie?.icone;

        return (
          <div
            key={cle}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            {Icone ? (
              <Icone className="size-3" />
            ) : (
              <span
                className="size-2.5 shrink-0 rounded-[2px] bg-(--teinte-serie)"
                style={{ "--teinte-serie": entree.color } as React.CSSProperties}
              />
            )}
            {serie?.label ?? entree.value}
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  useChart,
};
