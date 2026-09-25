"use client";

import { ArrowRight, LayoutGrid, Table2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge, Tableau } from "@/components/ui";
import type { Colonne } from "@/components/ui";
import { chantiersSuivis, trierParCriticite } from "@/features/tableauDeBord";
import type { LigneChantier } from "@/features/tableauDeBord";
import { cn } from "@/lib/utils";

import { BLOC, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE } from "./classes";
import { CelluleBudget, CelluleChantier, CelluleFin, CelluleMarge } from "./CellulesPortefeuille";
import { JaugeAvancement } from "./JaugeAvancement";
import { PastilleSante } from "./PastilleSante";

/**
 * `auto` laisse la largeur décider (`md`, 768 px) ; les deux autres forcent la
 * vue. Un choix d'affichage, pas une donnée métier — il reste ici.
 */
type ModeVue = "auto" | "tableau" | "cartes";

const VUE_TABLEAU: Record<ModeVue, string> = {
  auto: "hidden w-full md:block",
  tableau: "block w-full",
  cartes: "hidden",
};

const VUE_CARTES: Record<ModeVue, string> = {
  auto: "grid gap-3 p-4 sm:grid-cols-2 md:hidden",
  tableau: "hidden",
  cartes: "grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3",
};

const BTN_VUE =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900";
const BTN_ACTIF = "bg-neutral-0 text-neutral-900 shadow-sm";
const BTN_ACTIF_DES_MD = "md:bg-neutral-0 md:text-neutral-900 md:shadow-sm";
const BTN_ACTIF_SOUS_MD = "max-md:bg-neutral-0 max-md:text-neutral-900 max-md:shadow-sm";

const ETIQUETTE = "text-[11px] font-semibold tracking-wide text-neutral-500 uppercase";

/**
 * Le portefeuille de chantiers du DG, du plus critique au plus sain.
 *
 * Les colonnes sont celles d'un dirigeant : qui pilote, où en est
 * l'avancement, combien est dépensé, combien le chantier rapporte, quand il
 * doit finir, et sa santé **en couleur**. Le rapport du jour et la saisie du
 * budget sont partis : ce sont le travail du conducteur de travaux et de la
 * finance.
 */
export function PanneauPortefeuille({ chantiers }: { chantiers: LigneChantier[] }) {
  const t = useTranslations("tableauDeBord.portefeuille");
  const [modeVue, setModeVue] = useState<ModeVue>("auto");
  const lignes = trierParCriticite(chantiersSuivis(chantiers));

  const colonnes: Colonne<LigneChantier>[] = [
    {
      cle: "chantier",
      entete: t("colProjet"),
      figee: true,
      largeurMinimale: "240px",
      rendu: (chantier) => <CelluleChantier chantier={chantier} />,
    },
    {
      cle: "chef",
      entete: t("colChef"),
      largeurMinimale: "140px",
      secondaire: true,
      rendu: (chantier) =>
        chantier.chefProjetNom || <span className="text-neutral-400">{t("sansChef")}</span>,
    },
    {
      cle: "avancement",
      entete: t("colAvancement"),
      largeurMinimale: "190px",
      rendu: (chantier) => (
        <JaugeAvancement
          avancementReel={chantier.avancementReel}
          avancementTheorique={chantier.avancementTheorique}
          ecart={chantier.ecart}
        />
      ),
    },
    {
      cle: "budget",
      entete: t("colBudget"),
      largeurMinimale: "150px",
      rendu: (chantier) => <CelluleBudget chantier={chantier} />,
    },
    {
      cle: "marge",
      entete: t("colMarge"),
      largeurMinimale: "100px",
      rendu: (chantier) => <CelluleMarge chantier={chantier} />,
    },
    {
      cle: "fin",
      entete: t("colFin"),
      largeurMinimale: "120px",
      rendu: (chantier) => <CelluleFin chantier={chantier} />,
    },
    {
      cle: "sante",
      entete: t("colSante"),
      largeurMinimale: "150px",
      rendu: (chantier) => <PastilleSante indice={chantier.indiceSante} />,
    },
  ];

  return (
    <section className={cn(BLOC, "overflow-hidden")}>
      <header className={cn(BLOC_ENTETE, "flex-wrap border-b border-neutral-200 pb-4")}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variante="neutre">{t("compteur", { n: lignes.length })}</Badge>
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
            role="group"
            aria-label={t("titre")}
          >
            <button
              type="button"
              className={cn(BTN_VUE, modeVue === "tableau" && BTN_ACTIF, modeVue === "auto" && BTN_ACTIF_DES_MD)}
              onClick={() => setModeVue("tableau")}
              aria-pressed={modeVue === "tableau"}
              title={t("vueTableau")}
            >
              <Table2 className="size-3.5" aria-hidden="true" />
              <span className="max-md:hidden">{t("vueTableau")}</span>
            </button>
            <button
              type="button"
              className={cn(BTN_VUE, modeVue === "cartes" && BTN_ACTIF, modeVue === "auto" && BTN_ACTIF_SOUS_MD)}
              onClick={() => setModeVue("cartes")}
              aria-pressed={modeVue === "cartes"}
              title={t("vueCartes")}
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" />
              <span className="max-md:hidden">{t("vueCartes")}</span>
            </button>
          </div>
        </div>
      </header>

      <div className={VUE_TABLEAU[modeVue]}>
        <Tableau<LigneChantier>
          colonnes={colonnes}
          lignes={lignes}
          cleLigne={(chantier) => chantier.id}
          sansBordure
        />
      </div>

      <div className={VUE_CARTES[modeVue]}>
        {lignes.map((chantier) => (
          <article
            key={chantier.id}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <CelluleChantier chantier={chantier} />
              <PastilleSante indice={chantier.indiceSante} compacte />
            </div>
            <div className="rounded-md bg-neutral-50 px-3 py-2">
              <span className={ETIQUETTE}>{t("labelAvancement")}</span>
              <JaugeAvancement
                avancementReel={chantier.avancementReel}
                avancementTheorique={chantier.avancementTheorique}
                ecart={chantier.ecart}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1">
                <span className={ETIQUETTE}>{t("labelBudget")}</span>
                <CelluleBudget chantier={chantier} />
              </div>
              <div className="flex flex-col gap-1">
                <span className={ETIQUETTE}>{t("labelMarge")}</span>
                <CelluleMarge chantier={chantier} />
              </div>
              <div className="flex flex-col gap-1">
                <span className={ETIQUETTE}>{t("labelFin")}</span>
                <CelluleFin chantier={chantier} />
              </div>
            </div>
            <Link
              href={`/projets/${chantier.id}`}
              className="flex min-h-10 items-center justify-between rounded-md border border-neutral-200 px-3 text-xs font-semibold text-primary-600 no-underline transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <span>{t("consulter")}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
