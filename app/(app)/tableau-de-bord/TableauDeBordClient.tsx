"use client";

import { BuildingOffice, CheckCircle, FileText, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { TiroirCreationProjet } from "@/features/projets/components/TiroirCreationProjet";
import type { Projet } from "@/features/projets/types";
import {
  apresCreationChantier,
  apresDefinitionBudget,
  apresSignatureBon,
} from "@/features/tableauDeBord/regles";
import type { BonAPayer, LigneChantier, TableauDeBord } from "@/features/tableauDeBord/types";

import { BandeauIntemperies } from "./BandeauIntemperies";
import { BandeauKpis } from "./BandeauKpis";
import { ListeBonsAPayer } from "./ListeBonsAPayer";
import { ListeReceptions } from "./ListeReceptions";
import { ModalDefinirBudget } from "./ModalDefinirBudget";
import { PanneauChantiers } from "./PanneauChantiers";

interface TableauDeBordClientProps {
  donneesInitiales: TableauDeBord;
}

/**
 * Le tableau de bord de pilotage — maquette M10.
 *
 * Ce composant n'assemble plus que des sections et ne calcule plus rien : les
 * transitions d'état passent par `features/tableauDeBord/regles`, les données
 * arrivent déjà traduites par l'adaptateur, et chaque bloc de l'écran est un
 * composant qui se lit seul. Il portait auparavant 763 lignes, dont les
 * colonnes du tableau, les quatre tuiles de KPI, la carte mobile, la
 * signature des bons et trois copies du calcul de retard.
 */
export function TableauDeBordClient({ donneesInitiales }: TableauDeBordClientProps) {
  const t = useTranslations("tableauDeBord");
  const [donnees, setDonnees] = useState<TableauDeBord>(donneesInitiales);
  const [tiroirCreationOuvert, setTiroirCreationOuvert] = useState(false);
  const [chantierPourBudget, setChantierPourBudget] = useState<LigneChantier | null>(null);

  const handleBonSigne = (bon: BonAPayer) =>
    setDonnees((precedent) => apresSignatureBon(precedent, bon));

  const handleProjetCree = (projet: Projet) =>
    setDonnees((precedent) => apresCreationChantier(precedent, projet));

  const handleBudgetEnregistre = (chantierId: string, budgetInitial: number) =>
    setDonnees((precedent) => apresDefinitionBudget(precedent, chantierId, budgetInitial));

  const { metriques, chantiers, bonsAPayer, receptionsMateriaux, meteo } = donnees;
  const alerte = donnees.alerteIntemperies ?? meteo?.alerteIntemperies ?? null;

  return (
    <div className="mx-auto w-full max-w-[1400px] p-8 max-[640px]:p-4">
      {/* En-tête de pilotage & Actions rapides */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 max-[640px]:flex-col">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t("titre")}</h1>
          <p className="mt-0.5 text-[13px] text-neutral-600">{t("sousTitre")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-[640px]:w-full">
          <Link href="/rapports" style={{ textDecoration: "none" }}>
            <Bouton variante="secondaire" iconeGauche={<FileText size={16} weight="bold" />}>
              {t("actionRapport")}
            </Bouton>
          </Link>
          <Link href="/finance/bons-paiement" style={{ textDecoration: "none" }}>
            <Bouton variante="secondaire" iconeGauche={<CheckCircle size={16} weight="bold" />}>
              {t("actionMetres")}
            </Bouton>
          </Link>
          <Bouton
            variante="primaire"
            iconeGauche={<Plus size={16} weight="bold" />}
            onClick={() => setTiroirCreationOuvert(true)}
          >
            {t("actionNouveauProjet")}
          </Bouton>
        </div>
      </header>

      {/* Empty State valorisant — T-S1-04 */}
      {donnees.aucunChantier && (
        <Carte className="mb-8 flex flex-col items-center gap-3 border-dashed border-primary-300 bg-gradient-to-b from-neutral-0 to-neutral-50 px-8 py-16 text-center md:px-8 md:py-16">
          <div className="mb-2 flex size-[72px] items-center justify-center rounded-full bg-primary-50">
            <BuildingOffice
              size={40}
              weight="duotone"
              style={{ color: "var(--color-primary-500, #D4652A)" }}
            />
          </div>
          <Badge variante="neutre">{t("emptyState.badgeSansChantier")}</Badge>
          <h2 className="text-xl font-bold text-neutral-900">{t("emptyState.titre")}</h2>
          <p className="mb-2 max-w-[560px] text-sm leading-normal text-neutral-600">{t("emptyState.description")}</p>
          <Bouton
            variante="primaire"
            taille="lg"
            iconeGauche={<Plus size={20} weight="bold" />}
            onClick={() => setTiroirCreationOuvert(true)}
          >
            {t("emptyState.actionCreer")}
          </Bouton>
        </Carte>
      )}

      {/* Alerte Intempéries dynamique (RG-12) */}
      <BandeauIntemperies alerte={alerte} meteo={meteo} />

      {/* 4 Indicateurs clés (KPIs) BTP */}
      <BandeauKpis metriques={metriques} chantiers={chantiers} />

      {/* Grille principale 2 colonnes */}
      <div className="grid grid-cols-[2fr_1fr] items-start gap-8 max-lg:grid-cols-1">
        <PanneauChantiers chantiers={chantiers} onDefinirBudget={setChantierPourBudget} />

        {/* Colonne droite : Bons de paiement tâcherons & Matériaux */}
        <div className="flex flex-col gap-4">
          <ListeBonsAPayer
            bons={bonsAPayer}
            compteur={metriques.bonsASignerNombre}
            onBonSigne={handleBonSigne}
          />
          <ListeReceptions receptions={receptionsMateriaux} />
        </div>
      </div>

      <TiroirCreationProjet
        ouverte={tiroirCreationOuvert}
        onFermer={() => setTiroirCreationOuvert(false)}
        onProjetCree={handleProjetCree}
      />
      <ModalDefinirBudget
        ouverte={Boolean(chantierPourBudget)}
        projet={chantierPourBudget}
        onFermer={() => setChantierPourBudget(null)}
        onBudgetEnregistre={handleBudgetEnregistre}
      />
    </div>
  );
}
