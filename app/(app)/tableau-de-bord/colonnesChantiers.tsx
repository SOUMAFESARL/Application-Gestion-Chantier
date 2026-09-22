"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import type { Colonne } from "@/components/ui/Tableau";
import { estEnRetard } from "@/features/projets/regles";
import type { LigneChantier } from "@/features/tableauDeBord/types";

import { BadgeRapportJour } from "./BadgeRapportJour";
import { CelluleBudget } from "./CelluleBudget";
import { JaugeAvancement, LegendeAvancement } from "./JaugeAvancement";
import { PROJET_DETAIL } from "./classes";

/**
 * Les colonnes du tableau de suivi des chantiers.
 *
 * Sorties du corps du composant de page, où elles occupaient cent cinquante
 * lignes entre la déclaration des états et le premier `return`. Chaque cellule
 * s'appuie désormais sur les mêmes briques que la vue carte.
 */
export function useColonnesChantiers(
  onDefinirBudget: (chantier: LigneChantier) => void,
): Colonne<LigneChantier>[] {
  const t = useTranslations("tableauDeBord.chantiers");

  return [
    {
      cle: "projet",
      entete: t("colProjet"),
      figee: true,
      largeurMinimale: "220px",
      rendu: (chantier) => (
        <div>
          <Link href={`/projets/${chantier.id}`} className="font-bold text-neutral-900 no-underline hover:text-primary-600 hover:underline">
            {chantier.nom}
          </Link>
          <div className={PROJET_DETAIL}>
            {t("detailProjet", {
              client: chantier.clientNom,
              ville: chantier.ville,
              quartier: chantier.quartier || t("villeDefaut"),
            })}
          </div>
        </div>
      ),
    },
    {
      cle: "statut",
      entete: t("colStatut"),
      largeurMinimale: "125px",
      rendu: (chantier) => (
        <Badge variante={estEnRetard(chantier.ecart) ? "avertissement" : "succes"}>
          {chantier.statut === "EN_COURS" ? t("enCours") : t("rapportEnAttente")}
        </Badge>
      ),
    },
    {
      cle: "avancement",
      entete: t("colAvancement"),
      largeurMinimale: "185px",
      rendu: (chantier) => (
        <div className="min-w-[170px]">
          <div className="mb-0.5 flex justify-between text-xs text-neutral-600">
            <LegendeAvancement
              avancementReel={chantier.avancementReel}
              avancementTheorique={chantier.avancementTheorique}
              ecart={chantier.ecart}
            />
          </div>
          <JaugeAvancement
            avancementReel={chantier.avancementReel}
            avancementTheorique={chantier.avancementTheorique}
            ecart={chantier.ecart}
          />
        </div>
      ),
    },
    {
      cle: "budget",
      entete: t("colBudget"),
      largeurMinimale: "165px",
      rendu: (chantier) => (
        <CelluleBudget chantier={chantier} onDefinirBudget={onDefinirBudget} />
      ),
    },
    {
      cle: "rapport",
      entete: t("colRapport"),
      largeurMinimale: "145px",
      rendu: (chantier) => <BadgeRapportJour statut={chantier.rapportJourStatut} />,
    },
    {
      cle: "sante",
      entete: t("colSante"),
      largeurMinimale: "90px",
      rendu: (chantier) => (
        <Badge variante="succes">
          <span>{chantier.indiceSante}/100</span>
        </Badge>
      ),
    },
  ];
}
