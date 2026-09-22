"use client";

import { SquaresFour, Table } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Carte } from "@/components/ui/Carte";
import { Tableau } from "@/components/ui/Tableau";
import type { LigneChantier } from "@/features/tableauDeBord/types";
import { cn } from "@/lib/utils";

import { CarteChantierMobile } from "./CarteChantierMobile";
import { useColonnesChantiers } from "./colonnesChantiers";

/**
 * Comment la liste des chantiers est présentée.
 *
 * `auto` laisse le CSS décider selon la largeur ; les deux autres forcent la
 * vue, quel que soit l'écran. C'est un choix d'affichage, pas une donnée
 * métier — il reste donc ici, au plus près de ce qu'il commande.
 */
type ModeVue = "auto" | "tableau" | "cartes";

/**
 * Le mode d'affichage decide directement des classes, en React.
 *
 * L'ancienne feuille le faisait par cascade : une classe `forceTableau` posee
 * sur le panneau, et six regles `:not(.forceTableau):not(.forceCartes)` qui en
 * deduisaient, a distance, ce que chaque enfant devait montrer. Le meme
 * arbitrage tient ici en trois tables — la regle se lit a l'endroit ou elle
 * s'applique, et `auto` redevient ce qu'il a toujours voulu dire : « ce que la
 * largeur commande », soit `md` (768 px).
 */
const VUE_TABLEAU: Record<ModeVue, string> = {
  auto: "hidden w-full md:block",
  tableau: "block w-full",
  cartes: "hidden",
};

const VUE_CARTES: Record<ModeVue, string> = {
  auto: "flex flex-col gap-3 p-4 md:hidden",
  tableau: "hidden",
  cartes: "flex flex-col gap-3 p-4",
};

const BTN_VUE =
  "inline-flex cursor-pointer appearance-none items-center gap-1.5 rounded-sm border-0 bg-transparent px-2.5 py-1 text-xs leading-none font-medium text-neutral-600 transition-all hover:text-neutral-900";

/** La pastille blanche du bouton actif — le meme relief aux trois modes. */
const BTN_ACTIF = "bg-neutral-0 font-semibold text-primary-600 shadow-[0_1px_3px_rgb(0_0_0/0.08)]";
const BTN_ACTIF_DES_MD =
  "md:bg-neutral-0 md:font-semibold md:text-primary-600 md:shadow-[0_1px_3px_rgb(0_0_0/0.08)]";
const BTN_ACTIF_SOUS_MD =
  "max-md:bg-neutral-0 max-md:font-semibold max-md:text-primary-600 max-md:shadow-[0_1px_3px_rgb(0_0_0/0.08)]";

interface Props {
  chantiers: LigneChantier[];
  onDefinirBudget: (chantier: LigneChantier) => void;
}

/** Le panneau de suivi des chantiers, en vue tableau ou en vue cartes. */
export function PanneauChantiers({ chantiers, onDefinirBudget }: Props) {
  const t = useTranslations("tableauDeBord.chantiers");
  const [modeVue, setModeVue] = useState<ModeVue>("auto");
  const colonnes = useColonnesChantiers(onDefinirBudget);

  return (
    // `p-0` aux deux ruptures : `Carte` declare son rembourrage jusqu'en `md`,
    // et ce panneau colle son tableau aux bords.
    <Carte className="overflow-hidden p-0 md:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-base font-bold text-neutral-900">{t("titre")}</div>
          <div className="text-xs text-neutral-500">{t("sousTitre")}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variante="neutre">{t("compteur", { n: chantiers.length })}</Badge>
          <div
            className="inline-flex items-center gap-0.5 rounded-sm bg-neutral-100 p-[3px]"
            role="group"
            aria-label={t("titre")}
          >
            <button
              type="button"
              className={cn(
                BTN_VUE,
                modeVue === "tableau" && BTN_ACTIF,
                modeVue === "auto" && BTN_ACTIF_DES_MD,
              )}
              onClick={() => setModeVue("tableau")}
              title={t("vueTableau")}
              aria-pressed={modeVue === "tableau"}
            >
              <Table size={15} weight={modeVue === "tableau" ? "bold" : "regular"} />
              <span className="max-md:hidden">{t("vueTableau")}</span>
            </button>
            <button
              type="button"
              className={cn(
                BTN_VUE,
                modeVue === "cartes" && BTN_ACTIF,
                modeVue === "auto" && BTN_ACTIF_SOUS_MD,
              )}
              onClick={() => setModeVue("cartes")}
              title={t("vueCartes")}
              aria-pressed={modeVue === "cartes"}
            >
              <SquaresFour size={15} weight={modeVue === "cartes" ? "bold" : "regular"} />
              <span className="max-md:hidden">{t("vueCartes")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Affichage Tableau (Tablette et Bureau par défaut) */}
      <div className={VUE_TABLEAU[modeVue]}>
        <Tableau<LigneChantier>
          colonnes={colonnes}
          lignes={chantiers}
          cleLigne={(chantier) => chantier.id}
          sansBordure
        />
      </div>

      {/* Affichage Cartes Chantiers (Mobile par défaut) */}
      <div className={VUE_CARTES[modeVue]}>
        {chantiers.map((chantier) => (
          <CarteChantierMobile
            key={chantier.id}
            chantier={chantier}
            onDefinirBudget={onDefinirBudget}
          />
        ))}
      </div>
    </Carte>
  );
}
