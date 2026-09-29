"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import {
  CRITERES_JOURNAL_INITIAUX,
  aUnDocument,
  criteresActifs,
  filtrerEntrees,
  tauxPresence,
} from "@/features/chantier";
import type { CriteresJournal, EntreeJournal, FenetreHistorique, Journal, SituationRapport } from "@/features/chantier";
import { ABSENT, formaterDate, formaterJourMoisNumerique } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BadgeSituation } from "./composants";

const colonne = aideColonnes<EntreeJournal>();

const SITUATIONS: SituationRapport[] = ["NON_SOUMIS", "SOUMIS", "VALIDE_CT", "APPROUVE_CP", "REJETE"];
const FENETRES: FenetreHistorique[] = ["SEMAINE", "MOIS", "TOUT"];

/**
 * L'onglet « Historique » : tous les rapports, absences comprises — une
 * absence est une ligne, elle se voit et s'exporte.
 *
 * Le tableau est le `TableauListe` commun (règle 9) ; le filtrage vit dans
 * `filtrerEntrees`. L'export sort les valeurs brutes (règle 10).
 */
export function HistoriqueRapports({ journal }: { journal: Journal }) {
  const t = useTranslations("journal.historique");
  const tSituation = useTranslations("journal.situation");
  const [criteres, setCriteres] = useState<CriteresJournal>(CRITERES_JOURNAL_INITIAUX);

  const lignes = useMemo(
    () => filtrerEntrees(journal.entrees, criteres, journal.aujourdhui),
    [journal, criteres],
  );

  const chantiers = useMemo(() => {
    const connus = new Map<string, string>();
    for (const entree of journal.entrees) connus.set(entree.lot.projetId, entree.lot.projetNom);
    return [...connus.entries()]
      .map(([valeur, libelle]) => ({ valeur, libelle }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle));
  }, [journal]);

  const exporter = useMemo<ExportTableau<EntreeJournal>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("export.date"), valeur: (entree) => entree.date },
        { entete: t("export.reference"), valeur: (entree) => entree.reference },
        { entete: t("export.chantier"), valeur: (entree) => entree.lot.projetNom },
        { entete: t("export.lot"), valeur: (entree) => `${entree.lot.code} ${entree.lot.nom}` },
        { entete: t("export.chefChantier"), valeur: (entree) => entree.lot.chefChantier },
        { entete: t("export.presents"), valeur: (entree) => entree.effectifPresent },
        { entete: t("export.prevus"), valeur: (entree) => entree.effectifPrevu },
        { entete: t("export.avancement"), valeur: (entree) => entree.avancementLot },
        { entete: t("export.theorique"), valeur: (entree) => entree.avancementTheorique },
        { entete: t("export.incidents"), valeur: (entree) => entree.incidents },
        { entete: t("export.blocages"), valeur: (entree) => entree.blocages },
        { entete: t("export.statut"), valeur: (entree) => tSituation(entree.situation) },
        { entete: t("export.soumisLe"), valeur: (entree) => entree.soumisLe },
      ],
    }),
    [t, tSituation],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("date", {
          header: t("colonnes.date"),
          cell: ({ getValue }) => (
            <span className="tabular-nums" title={formaterDate(getValue())}>
              {formaterJourMoisNumerique(getValue())}
            </span>
          ),
        }),
        colonne.display({
          id: "lot",
          header: t("colonnes.lot"),
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span className="font-medium text-neutral-900">
                {t("lot", { code: row.original.lot.code, nom: row.original.lot.nom })}
              </span>
              <span className="text-xs text-neutral-600">{row.original.lot.projetNom}</span>
            </span>
          ),
        }),
        colonne.display({
          id: "chef",
          header: t("colonnes.chefChantier"),
          meta: { classe: "text-neutral-700" },
          cell: ({ row }) => row.original.lot.chefChantier,
        }),
        colonne.display({
          id: "effectifs",
          header: t("colonnes.effectifs"),
          cell: ({ row }) => {
            const { effectifPresent, effectifPrevu } = row.original;
            if (effectifPresent === null) return ABSENT;
            return (
              <span className="tabular-nums">
                {t("effectifs", {
                  presents: effectifPresent,
                  prevus: effectifPrevu ?? 0,
                  taux: tauxPresence(effectifPresent, effectifPrevu) ?? 0,
                })}
              </span>
            );
          },
        }),
        colonne.accessor("avancementLot", {
          header: t("colonnes.avancement"),
          cell: ({ getValue }) =>
            getValue() === null ? ABSENT : <span className="tabular-nums">{t("pourcent", { valeur: getValue() ?? 0 })}</span>,
        }),
        colonne.accessor("incidents", {
          header: t("colonnes.incidents"),
          cell: ({ getValue }) => (
            <span className={cn("tabular-nums", (getValue() ?? 0) > 0 && "font-semibold text-avertissement")}>
              {getValue() ?? ABSENT}
            </span>
          ),
        }),
        colonne.accessor("blocages", {
          header: t("colonnes.blocages"),
          cell: ({ getValue }) => (
            <span className={cn("tabular-nums", (getValue() ?? 0) > 0 && "font-semibold text-erreur")}>
              {getValue() ?? ABSENT}
            </span>
          ),
        }),
        colonne.accessor("situation", {
          header: t("colonnes.statut"),
          cell: ({ getValue }) => <BadgeSituation situation={getValue()} />,
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) =>
            aUnDocument(row.original) ? (
              <Button variant="ghost" size="icon-sm" asChild>
                <Link
                  href={`/rapports/${row.original.id}`}
                  aria-label={t("voir", { reference: row.original.reference ?? "" })}
                  title={t("voir", { reference: row.original.reference ?? "" })}
                >
                  <Eye />
                </Link>
              </Button>
            ) : null,
        }),
      ]),
    [t],
  );

  const actifs = criteresActifs(criteres);

  return (
    <TableauListe
      colonnes={colonnes}
      donnees={lignes}
      cleLigne={(entree) => entree.id}
      messageVide={actifs ? t("aucunResultat") : t("aucuneLigne")}
      filtresActifs={actifs}
      onReinitialiser={() => setCriteres(CRITERES_JOURNAL_INITIAUX)}
      cleCriteres={`${criteres.recherche}|${criteres.projetId}|${criteres.situation}|${criteres.fenetre}`}
      exporter={exporter}
      outils={
        <>
          <RechercheTableau
            valeur={criteres.recherche}
            onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
            libelle={t("recherche")}
            placeholder={t("recherchePlaceholder")}
          />
          <FiltreTableau
            valeur={criteres.projetId}
            onChangement={(projetId) => setCriteres({ ...criteres, projetId })}
            libelle={t("filtreChantier")}
            libelleTous={t("filtreChantierTous")}
            options={chantiers}
          />
          <FiltreTableau
            valeur={criteres.situation}
            onChangement={(situation) => setCriteres({ ...criteres, situation })}
            libelle={t("filtreStatut")}
            libelleTous={t("filtreStatutTous")}
            options={SITUATIONS.map((situation) => ({ valeur: situation, libelle: tSituation(situation) }))}
          />
          <FiltreTableau
            // « Tout » est l'entrée qui retire le filtre : la liste la veut vide.
            valeur={criteres.fenetre === "TOUT" ? "" : criteres.fenetre}
            onChangement={(fenetre) => setCriteres({ ...criteres, fenetre: fenetre || "TOUT" })}
            libelle={t("filtrePeriode")}
            libelleTous={t("fenetre.TOUT")}
            options={FENETRES.filter((fenetre) => fenetre !== "TOUT").map((fenetre) => ({
              valeur: fenetre,
              libelle: t(`fenetre.${fenetre}`),
            }))}
          />
        </>
      }
    />
  );
}
