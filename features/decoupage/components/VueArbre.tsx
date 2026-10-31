"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, ExpandedState } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Download, Plus, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterPourcentage } from "@/lib/format";
import { cn } from "@/lib/utils";

import { exporterArbre, lireArbre } from "../adaptateur";
import { cleArbre } from "../cles";
import { trouverCase } from "../regles";
import type { CaseArbre } from "../types";
import { Ecart, Montant, Periode, Physique, Statut } from "./CellulesCase";
import { FenetreGeste, type GesteOuvert } from "./FenetreGeste";
import { ReglagesNiveaux } from "./ReglagesNiveaux";
import { TiroirCase } from "./TiroirCase";

const FONCTIONNALITES = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});
const colonne = createColumnHelper<typeof FONCTIONNALITES, CaseArbre>();

/**
 * L'onglet Découpage d'un projet découpé : l'arbre en tableau (décision P6) — élément, niveau,
 * dates, montant, avancement physique, temporel, écart, statut — et le tiroir de la case.
 *
 * Chaque ligne s'ouvre et se replie ; un clic l'ouvre dans le tiroir, où sont les gestes. Les
 * cases que la personne voit seulement parce qu'elles mènent à son périmètre (`CHEMIN`) sont en
 * retrait, sans leurs données. Ordinateur et tablette ; sur téléphone, le tableau défile et le
 * tiroir se lit sans gestes (P16).
 */
export function VueArbre({ projet }: { projet: Projet }) {
  const t = useTranslations("decoupage.arbre");
  const { peutSurProjet } = useDroits();
  const [caseOuverte, setCaseOuverte] = useState<string | null>(null);
  const [geste, setGeste] = useState<GesteOuvert | null>(null);
  const [reglages, setReglages] = useState(false);

  const requete = useQuery({
    queryKey: cleArbre(projet.id),
    queryFn: ({ signal }) => lireArbre(projet.id, signal),
  });

  const export_ = useMutation({
    mutationFn: async (format: "xlsx" | "csv") => {
      const fichier = await exporterArbre(projet.id, format);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(fichier);
      lien.download = `decoupage-${projet.reference || projet.id}.${format}`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    },
    onError: (erreur) =>
      toast.error(erreur instanceof ErreurApi && erreur.message ? erreur.message : t("erreurExport")),
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const arbre = requete.data;
  const ouverte = trouverCase(arbre.cases, caseOuverte);
  const peutDecouper = peutSurProjet(PERMISSIONS.DECOUPER, projet);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-neutral-600">
          {arbre.avancementDisponible
            ? t(arbre.avancementPartiel ? "avancementPartiel" : "avancementProjet", {
                valeur: formaterPourcentage(arbre.avancement),
              })
            : t("avancementIndisponible")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setReglages((v) => !v)} aria-expanded={reglages}>
            <Settings2 />
            {t("reglagesNiveaux")}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={export_.isPending}>
                <Download />
                {t("exporter")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => export_.mutate("xlsx")}>{t("exporterExcel")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => export_.mutate("csv")}>{t("exporterCsv")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <BoutonPermis
            size="sm"
            permis={peutDecouper}
            permission={PERMISSIONS.DECOUPER}
            onClick={() => setGeste({ geste: "ajouter", cible: null })}
          >
            <Plus />
            {t("ajouterRacine", { niveau: arbre.niveaux[0]?.libelle ?? "" })}
          </BoutonPermis>
        </div>
      </div>

      {!arbre.voitTout && (
        <Alert variant="information">
          <AlertDescription>{t("perimetreReduit")}</AlertDescription>
        </Alert>
      )}

      {reglages && <ReglagesNiveaux projet={projet} niveaux={arbre.niveaux} />}

      {arbre.cases.length === 0 ? (
        <EtatVide titre={t("vide")} />
      ) : (
        <TableauArbre cases={arbre.cases} onOuvrir={setCaseOuverte} />
      )}

      <TiroirCase
        projet={projet}
        cible={ouverte}
        onFermer={() => setCaseOuverte(null)}
        onGeste={(gesteChoisi, cible) => setGeste({ geste: gesteChoisi, cible })}
      />
      <FenetreGeste projet={projet} ouvert={geste} onFermer={() => setGeste(null)} />
    </div>
  );
}

function TableauArbre({ cases, onOuvrir }: { cases: CaseArbre[]; onOuvrir: (id: string) => void }) {
  const t = useTranslations("decoupage.arbre");
  const { voitMontants } = useDroits();
  const [deplie, setDeplie] = useState<ExpandedState>(true);

  const colonnes = useMemo(
    () =>
      [
        colonne.display({
          id: "element",
          header: () => t("colonnes.element"),
          cell: ({ row }) => {
            const une = row.original;
            return (
              <div className="flex min-w-64 items-center gap-1.5" style={{ paddingLeft: `calc(var(--spacing) * ${row.depth * 5})` }}>
                {row.getCanExpand() ? (
                  <button
                    type="button"
                    onClick={(evenement) => {
                      evenement.stopPropagation();
                      row.toggleExpanded();
                    }}
                    aria-label={row.getIsExpanded() ? t("replier") : t("deplier")}
                    aria-expanded={row.getIsExpanded()}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-neutral-500 hover:bg-neutral-100"
                  >
                    {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <span className="size-6 shrink-0" aria-hidden="true" />
                )}
                <span className="font-mono text-xs text-neutral-500 tabular-nums">{une.numero}</span>
                {une.code && <Badge variante="neutre">{une.code}</Badge>}
                <span
                  className={cn(
                    "truncate",
                    une.estFeuille ? "text-neutral-800" : "font-semibold text-neutral-900",
                    (!une.estActif || une.acces === "CHEMIN") && "text-neutral-400",
                    !une.estActif && "line-through",
                  )}
                >
                  {une.libelle}
                </span>
              </div>
            );
          },
        }),
        colonne.display({
          id: "niveau",
          header: () => t("colonnes.niveau"),
          cell: ({ row }) => <span className="text-neutral-600">{row.original.niveau.libelle ?? ABSENT}</span>,
        }),
        colonne.display({
          id: "dates",
          header: () => t("colonnes.dates"),
          cell: ({ row }) =>
            row.original.acces === "COMPLET" ? (
              <Periode debut={row.original.dateDebutPrevue} fin={row.original.dateFinPrevue} />
            ) : (
              ABSENT
            ),
        }),
        colonne.display({
          id: "montant",
          header: () => t("colonnes.montant"),
          cell: ({ row }) => <Montant une={row.original} voitMontants={voitMontants} />,
        }),
        colonne.display({
          id: "physique",
          header: () => t("colonnes.physique"),
          cell: ({ row }) => <Physique une={row.original} />,
        }),
        colonne.display({
          id: "temporel",
          header: () => t("colonnes.temporel"),
          cell: ({ row }) =>
            row.original.avancementTemporel === null ? ABSENT : formaterPourcentage(row.original.avancementTemporel),
        }),
        colonne.display({
          id: "ecart",
          header: () => t("colonnes.ecart"),
          cell: ({ row }) => <Ecart valeur={row.original.ecart} />,
        }),
        colonne.display({
          id: "statut",
          header: () => t("colonnes.statut"),
          cell: ({ row }) => <Statut une={row.original} />,
        }),
      ] as ColumnDef<typeof FONCTIONNALITES, CaseArbre>[],
    [t, voitMontants],
  );

  const table = useTable(
    {
      features: FONCTIONNALITES,
      columns: colonnes,
      data: cases,
      getRowId: (une) => une.id,
      getSubRows: (une) => une.enfants,
      state: { expanded: deplie },
      onExpandedChange: setDeplie,
    },
    (state) => ({ expanded: state.expanded }),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-solid border-neutral-200 bg-neutral-0">
      <Table className="min-w-max">
        <TableHeader>
          {table.getHeaderGroups().map((groupe) => (
            <TableRow key={groupe.id} className="hover:bg-transparent">
              {groupe.headers.map((entete) => (
                <TableHead key={entete.id} className="whitespace-nowrap">
                  {entete.isPlaceholder ? null : <table.FlexRender header={entete} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getExpandedRowModel().rows.map((ligne) => (
            <TableRow
              key={ligne.id}
              onClick={() => onOuvrir(ligne.original.id)}
              className={cn("cursor-pointer", ligne.depth === 0 && "bg-neutral-50")}
            >
              {ligne.getAllCells().map((cellule) => (
                <TableCell key={cellule.id} className="py-2">
                  <table.FlexRender cell={cellule} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
