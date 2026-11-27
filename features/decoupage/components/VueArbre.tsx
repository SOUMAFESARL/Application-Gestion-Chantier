"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, ExpandedState, OnChangeFn } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Eye,
  EyeOff,
  Plus,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";

import { RechercheRapideElements } from "@/components/metier/RechercheRapideElements";
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
import {
  budgetEnVigueur,
  depassementDecoupage,
  sourcePlafondBudget,
} from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterMontant, formaterPourcentage } from "@/lib/format";
import { cn } from "@/lib/utils";

import { exporterArbre, lireArbre } from "../adaptateur";
import { cleArbre } from "../cles";
import {
  aCriteresRechercheActifs,
  aplatirArbreDecoupagePourRecherche,
  CRITERES_RECHERCHE_ELEMENTS_VIDES,
  filtrerArbreParIds,
  rechercherElements,
  type CriteresRechercheElements,
  type ElementRecherchable,
} from "../rechercheRapide";
import {
  arbreDepliable,
  arbreToutDeplie,
  codeDistinctDuNumero,
  compterCasesDesactivees,
  filtrerCasesActives,
  trouverCase,
} from "../regles";
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
  const tRecherche = useTranslations("rechercheElements");
  const { peutSurProjet, voitMontants } = useDroits();
  const [caseOuverte, setCaseOuverte] = useState<string | null>(null);
  const [geste, setGeste] = useState<GesteOuvert | null>(null);
  const [reglages, setReglages] = useState(false);
  const [deplie, setDeplie] = useState<ExpandedState>(true);
  const [afficherDesactivees, setAfficherDesactivees] = useState(true);
  const [criteresRecherche, setCriteresRecherche] = useState<CriteresRechercheElements>(
    CRITERES_RECHERCHE_ELEMENTS_VIDES,
  );
  const [modeFiltreVue, setModeFiltreVue] = useState(false);
  const [elementSurligneId, setElementSurligneId] = useState<string | null>(null);
  const [demandeScroll, setDemandeScroll] = useState<{ id: string; nonce: number } | null>(null);

  const tableauConteneurRef = useRef<HTMLDivElement | null>(null);
  const timeoutSurligneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (timeoutSurligneRef.current) clearTimeout(timeoutSurligneRef.current);
    };
  }, []);

  useEffect(() => {
    if (!demandeScroll) return;
    const rafId = window.requestAnimationFrame(() => {
      const conteneur = tableauConteneurRef.current;
      if (!conteneur) return;
      const lignesElements = conteneur.querySelectorAll<HTMLElement>("[data-element-id]");
      for (const ligneEl of lignesElements) {
        if (ligneEl.dataset.elementId === demandeScroll.id) {
          ligneEl.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [demandeScroll]);

  const casesBrutes = useMemo(() => requete.data?.cases ?? [], [requete.data?.cases]);

  const elementsRecherchables = useMemo(
    () => aplatirArbreDecoupagePourRecherche(casesBrutes),
    [casesBrutes],
  );

  const resultatsRecherche = useMemo(
    () => rechercherElements(elementsRecherchables, criteresRecherche, { voitMontants }),
    [elementsRecherchables, criteresRecherche, voitMontants],
  );

  const idsCorrespondants = useMemo(
    () => new Set(resultatsRecherche.map((el) => el.id)),
    [resultatsRecherche],
  );

  const rechercheActive = useMemo(
    () => aCriteresRechercheActifs(criteresRecherche, { voitMontants }),
    [criteresRecherche, voitMontants],
  );

  const vueFiltreeActive = modeFiltreVue && rechercheActive;

  const surAccederElement = useCallback(
    (el: ElementRecherchable) => {
      if (!el.estActif && !afficherDesactivees) {
        setAfficherDesactivees(true);
      }
      if (el.cheminAncetresIds.length > 0) {
        setDeplie((precedent) => {
          if (precedent === true) return true;
          const suivant = { ...precedent };
          for (const ancetreId of el.cheminAncetresIds) {
            suivant[ancetreId] = true;
          }
          return suivant;
        });
      }
      if (timeoutSurligneRef.current) clearTimeout(timeoutSurligneRef.current);
      setElementSurligneId(el.id);
      timeoutSurligneRef.current = setTimeout(() => {
        setElementSurligneId(null);
      }, 3000);
      setDemandeScroll((precedent) => ({ id: el.id, nonce: (precedent?.nonce ?? 0) + 1 }));
    },
    [afficherDesactivees],
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const arbre = requete.data;
  const ouverte = trouverCase(arbre.cases, caseOuverte);
  const peutDecouper = peutSurProjet(PERMISSIONS.DECOUPER, projet);
  const nbDesactivees = compterCasesDesactivees(arbre.cases);
  const casesApresActives = afficherDesactivees ? arbre.cases : filtrerCasesActives(arbre.cases);
  const casesVisibles = vueFiltreeActive
    ? filtrerArbreParIds(casesApresActives, idsCorrespondants)
    : casesApresActives;
  const deplieEffectif: ExpandedState = vueFiltreeActive ? true : deplie;
  const depliable = arbreDepliable(casesVisibles);
  const toutDeplie = arbreToutDeplie(casesVisibles, deplieEffectif);
  const plafondBudget = budgetEnVigueur(projet);
  const sourcePlafond = sourcePlafondBudget(projet);
  const depassement = depassementDecoupage(projet);

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
          {nbDesactivees > 0 && (
            <Button
              variant="outline"
              size="sm"
              aria-pressed={afficherDesactivees}
              onClick={() => setAfficherDesactivees((v) => !v)}
            >
              {afficherDesactivees ? <EyeOff /> : <Eye />}
              {afficherDesactivees
                ? t("masquerDesactivees", { nombre: nbDesactivees })
                : t("afficherDesactivees", { nombre: nbDesactivees })}
            </Button>
          )}
          {depliable && (
            <Button
              variant="outline"
              size="sm"
              disabled={vueFiltreeActive}
              onClick={() => setDeplie(toutDeplie ? {} : true)}
            >
              {toutDeplie ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {toutDeplie ? t("toutReplier") : t("toutDeplier")}
            </Button>
          )}
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
            {t("ajouterRacine", {
              niveau: arbre.niveaux[0]?.libelle?.trim() || t("composantProjetDefaut"),
            })}
          </BoutonPermis>
        </div>
      </div>

      {!arbre.voitTout && (
        <Alert variant="information">
          <AlertDescription>{t("perimetreReduit")}</AlertDescription>
        </Alert>
      )}

      {voitMontants &&
        depassement !== null &&
        depassement > 0 &&
        plafondBudget !== null &&
        projet.budgetDecoupage !== null &&
        sourcePlafond !== null && (
          <Alert variant="avertissement">
            <TriangleAlert />
            <AlertDescription>
              {t(
                sourcePlafond === "CONTRACTUEL"
                  ? "alerteDepassementContractuel"
                  : "alerteDepassementPrevisionnel",
                {
                  decoupage: formaterMontant(projet.budgetDecoupage),
                  plafond: formaterMontant(plafondBudget),
                  ecart: formaterMontant(depassement),
                },
              )}
            </AlertDescription>
          </Alert>
        )}

      {reglages && <ReglagesNiveaux projet={projet} niveaux={arbre.niveaux} />}

      {arbre.cases.length > 0 && (
        <RechercheRapideElements
          elements={elementsRecherchables}
          criteres={criteresRecherche}
          onCriteresChange={setCriteresRecherche}
          voitMontants={voitMontants}
          onAccederElement={surAccederElement}
          modeFiltreVue={modeFiltreVue}
          onModeFiltreVueChange={setModeFiltreVue}
          resultatsPrecalcules={resultatsRecherche}
        />
      )}

      {casesVisibles.length === 0 ? (
        vueFiltreeActive ? (
          <EtatVide
            titre={tRecherche("aucunResultatVueFiltree")}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCriteresRecherche(CRITERES_RECHERCHE_ELEMENTS_VIDES);
                  setModeFiltreVue(false);
                }}
              >
                {tRecherche("reinitialiserFiltres")}
              </Button>
            }
          />
        ) : (
          <EtatVide titre={t("vide")} />
        )
      ) : (
        <TableauArbre
          cases={casesVisibles}
          deplie={deplieEffectif}
          onDeplieChange={setDeplie}
          onOuvrir={setCaseOuverte}
          elementSurligneId={elementSurligneId}
          conteneurRef={tableauConteneurRef}
        />
      )}

      <TiroirCase
        projet={projet}
        cible={ouverte}
        onFermer={() => setCaseOuverte(null)}
        onGeste={(gesteChoisi, cible) => setGeste({ geste: gesteChoisi, cible })}
      />
      <FenetreGeste projet={projet} niveaux={arbre.niveaux} ouvert={geste} onFermer={() => setGeste(null)} />
    </div>
  );
}

function TableauArbre({
  cases,
  deplie,
  onDeplieChange,
  onOuvrir,
  elementSurligneId,
  conteneurRef,
}: {
  cases: CaseArbre[];
  deplie: ExpandedState;
  onDeplieChange: OnChangeFn<ExpandedState>;
  onOuvrir: (id: string) => void;
  elementSurligneId: string | null;
  conteneurRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("decoupage.arbre");
  const { voitMontants } = useDroits();

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
                {codeDistinctDuNumero(une) && <Badge variante="neutre">{une.code}</Badge>}
                <span
                  className={cn(
                    "truncate",
                    une.estFeuille ? "text-neutral-800" : "font-semibold text-neutral-900",
                    une.acces === "CHEMIN" && "text-neutral-400",
                    !une.estActif && "font-normal text-neutral-500 line-through",
                  )}
                >
                  {une.libelle}
                </span>
                {!une.estActif && <Badge variante="neutre">{t("etats.desactivee")}</Badge>}
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
              <Periode
                debut={row.original.dateDebutPrevue}
                fin={row.original.dateFinPrevue}
                calculees={row.original.datesCalculees}
              />
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
      onExpandedChange: onDeplieChange,
    },
    (state) => ({ expanded: state.expanded }),
  );

  return (
    <div
      ref={conteneurRef}
      className="overflow-x-auto rounded-lg border border-solid border-neutral-200 bg-neutral-0"
    >
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
          {table.getExpandedRowModel().rows.map((ligne) => {
            const surlignee = elementSurligneId === ligne.original.id;
            return (
              <TableRow
                key={ligne.id}
                data-element-id={ligne.original.id}
                onClick={() => onOuvrir(ligne.original.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  ligne.depth === 0 && "bg-neutral-50",
                  !ligne.original.estActif && "bg-neutral-50/70 opacity-65",
                  surlignee && "bg-primary-50 opacity-100 ring-2 ring-inset ring-primary-500",
                )}
              >
                {ligne.getAllCells().map((cellule) => (
                  <TableCell key={cellule.id} className="py-2">
                    <table.FlexRender cell={cellule} />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
