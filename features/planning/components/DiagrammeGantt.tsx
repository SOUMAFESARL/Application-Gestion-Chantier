"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Diamond,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { Badge, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { MenuExport, type ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { ABSENT, formaterDate, formaterEcartAvancement, formaterPourcentage } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  aplatirArbrePlanning,
  calculerBornesGantt,
  calculerFlechesDependances,
  calculerGeometrieBarre,
  calculerPositionAujourdhui,
  collecterIdsParents,
  construireLignesExportPlanning,
  datesEffectivesCase,
  ECHELLES_GANTT,
  estCaseEnRetard,
  filtrerArbrePlanning,
  formaterEtiquetteDependance,
  genererGraduationsGantt,
  HAUTEUR_ENTETE_GANTT,
  HAUTEUR_LIGNE_GANTT,
} from "../regles";
import type {
  CasePlanning,
  EchelleGantt,
  GeometrieBarreGantt,
  LigneExportPlanning,
  LigneGantt,
  PlanningGantt,
} from "../types";

const VIEWBOX_MARQUEUR = "0 0 8 8";
const CHEMIN_MARQUEUR = "M 0 1 L 7 4 L 0 7 Z";
const POINTILLES_AUJOURDHUI = "4 3";
const POINTILLES_DEPENDANCE = "3 3";
const ORIENTATION_AUTO = "auto";
const ANCRAGE_DEBUT = "start";
const ANCRAGE_MILIEU = "middle";
const LIGNE_BASE_CENTRE = "central";
const LARGEUR_COLONNE_ARBRE = 320;

interface EtatInfobulle {
  ligne: LigneGantt;
  geometrie: GeometrieBarreGantt;
  clientX: number;
  clientY: number;
}

export interface PropsDiagrammeGantt {
  planning: PlanningGantt;
  /** Nom du projet utilisé pour le titre et le nom de fichier de l'export CSV/PDF. */
  nomProjet?: string;
  /** Mode aperçu sans édition au clic (ex. prévisualisation d'un import MS Project). */
  lectureSeule?: boolean;
  /** Masque le menu d'export CSV/PDF (utile dans la modale d'aperçu). */
  masquerExport?: boolean;
  /** Échelle initiale (par défaut `SEMAINE`). */
  echelleInitiale?: EchelleGantt;
  /** Hauteur de la zone défilante (`normal` sur écran dédié, `compact` en aperçu). */
  taille?: "normal" | "compact";
  /** Identifiant de la tâche actuellement ouverte dans le tiroir d'édition. */
  caseSelectionneeId?: string | null;
  /** Appelé au clic sur une case accessible en mode interactif. */
  onSelectionnerCase?: (caseItem: CasePlanning) => void;
  /** Boutons supplémentaires placés dans la barre d'outils du Gantt. */
  actionsBarreOutils?: ReactNode;
}

function cheminEnveloppeParent(x: number, yHaut: number, largeur: number): string {
  const xFin = x + largeur;
  const hBarre = 7;
  const hPatte = 13;
  const lPatte = Math.min(6, largeur / 3);
  return (
    `M ${x} ${yHaut} ` +
    `L ${xFin} ${yHaut} ` +
    `L ${xFin} ${yHaut + hPatte} ` +
    `L ${xFin - lPatte} ${yHaut + hBarre} ` +
    `L ${x + lPatte} ${yHaut + hBarre} ` +
    `L ${x} ${yHaut + hPatte} Z`
  );
}

function cheminLosange(cx: number, cy: number, rayon: number): string {
  return (
    `M ${cx} ${cy - rayon} ` +
    `L ${cx + rayon} ${cy} ` +
    `L ${cx} ${cy + rayon} ` +
    `L ${cx - rayon} ${cy} Z`
  );
}

function cheminTriangleTheorique(cx: number, yHaut: number): string {
  return `M ${cx - 4} ${yHaut - 4} L ${cx + 4} ${yHaut - 4} L ${cx} ${yHaut} Z`;
}

function estTerminee(item: CasePlanning): boolean {
  return item.statut === "TERMINE" || item.statut === "CLOTURE" || item.avancement === 100;
}

/**
 * Diagramme de Gantt SVG interactif avec panneau d'arborescence synchronisé.
 *
 * Un seul conteneur défilant porte la colonne gauche en `sticky left-0` et l'en-tête
 * temporel en `sticky top-0` : l'alignement vertical entre lignes de l'arbre et barres SVG
 * reste exact au pixel près sans synchronisation JavaScript sujette aux décalages.
 */
export function DiagrammeGantt({
  planning,
  nomProjet,
  lectureSeule = false,
  masquerExport = false,
  echelleInitiale = "SEMAINE",
  taille = "normal",
  caseSelectionneeId = null,
  onSelectionnerCase,
  actionsBarreOutils,
}: PropsDiagrammeGantt) {
  const t = useTranslations("planning");
  const prefixeId = useId();
  const conteneurRef = useRef<HTMLDivElement | null>(null);

  const [echelle, setEchelle] = useState<EchelleGantt>(echelleInitiale);
  const [recherche, setRecherche] = useState("");
  const [retardsUniquement, setRetardsUniquement] = useState(false);
  const [noeudsReplies, setNoeudsReplies] = useState<Set<string>>(() => new Set());
  const [survolId, setSurvolId] = useState<string | null>(null);
  const [infobulle, setInfobulle] = useState<EtatInfobulle | null>(null);

  const tousIdsParents = useMemo(() => collecterIdsParents(planning.cases), [planning.cases]);

  const casesFiltrees = useMemo(
    () => filtrerArbrePlanning(planning.cases, { recherche, retardsUniquement }),
    [planning.cases, recherche, retardsUniquement],
  );

  // En présence d'une recherche ou d'un filtre retard, on déplie toutes les branches correspondantes.
  const filtreActif = recherche.trim().length > 0 || retardsUniquement;
  const noeudsDeplies = useMemo(() => {
    if (filtreActif) return new Set(collecterIdsParents(casesFiltrees));
    const resultat = new Set<string>();
    for (const id of tousIdsParents) {
      if (!noeudsReplies.has(id)) resultat.add(id);
    }
    return resultat;
  }, [casesFiltrees, filtreActif, noeudsReplies, tousIdsParents]);

  const lignes = useMemo(
    () => aplatirArbrePlanning(casesFiltrees, noeudsDeplies),
    [casesFiltrees, noeudsDeplies],
  );

  const nombreRetardsTotal = useMemo(() => {
    let compteur = 0;
    function compter(liste: readonly CasePlanning[]) {
      for (const item of liste) {
        if (item.estFeuille && estCaseEnRetard(item)) compteur += 1;
        compter(item.enfants);
      }
    }
    compter(planning.cases);
    return compteur;
  }, [planning.cases]);

  const bornes = useMemo(
    () =>
      calculerBornesGantt(
        planning.cases,
        planning.aujourdhui,
        planning.projetDebut,
        planning.projetFin,
        echelle,
      ),
    [planning.cases, planning.aujourdhui, planning.projetDebut, planning.projetFin, echelle],
  );

  const graduations = useMemo(() => genererGraduationsGantt(bornes, echelle), [bornes, echelle]);

  const geometrieParId = useMemo(() => {
    const carte = new Map<string, GeometrieBarreGantt>();
    for (const ligne of lignes) {
      const geo = calculerGeometrieBarre(ligne.caseItem, bornes);
      if (geo) carte.set(ligne.caseItem.id, geo);
    }
    return carte;
  }, [lignes, bornes]);

  const fleches = useMemo(
    () => calculerFlechesDependances(planning.dependances, lignes, geometrieParId, HAUTEUR_LIGNE_GANTT),
    [planning.dependances, lignes, geometrieParId],
  );

  const xAujourdhui = useMemo(
    () => calculerPositionAujourdhui(planning.aujourdhui, bornes),
    [planning.aujourdhui, bornes],
  );

  const hauteurCorps = Math.max(HAUTEUR_LIGNE_GANTT, lignes.length * HAUTEUR_LIGNE_GANTT);

  const toutReplie = tousIdsParents.length > 0 && noeudsReplies.size >= tousIdsParents.length;

  const basculerNoeud = useCallback((id: string) => {
    setNoeudsReplies((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }, []);

  const basculerTout = useCallback(() => {
    if (toutReplie) {
      setNoeudsReplies(new Set());
    } else {
      setNoeudsReplies(new Set(tousIdsParents));
    }
  }, [toutReplie, tousIdsParents]);

  const centrerSurAujourdhui = useCallback(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur || xAujourdhui === null) return;
    const largeurVisibleFrise = Math.max(200, conteneur.clientWidth - LARGEUR_COLONNE_ARBRE);
    const cibleScroll = Math.max(0, xAujourdhui - largeurVisibleFrise / 2);
    conteneur.scrollTo({ left: cibleScroll, behavior: "smooth" });
  }, [xAujourdhui]);

  const lignesExport = useMemo(() => construireLignesExportPlanning(lignes), [lignes]);

  const configurationExport = useMemo<ExportTableau<LigneExportPlanning>>(
    () => ({
      titre: nomProjet
        ? t("export.titreProjet", { projet: nomProjet })
        : t("export.titreDefaut"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("export.colonnes.numero"), valeur: (ligne) => ligne.numero },
        { entete: t("export.colonnes.libelle"), valeur: (ligne) => ligne.libelle },
        { entete: t("export.colonnes.niveau"), valeur: (ligne) => ligne.niveau },
        { entete: t("export.colonnes.type"), valeur: (ligne) => t(`export.types.${ligne.type}`) },
        { entete: t("export.colonnes.debut"), valeur: (ligne) => ligne.debut },
        { entete: t("export.colonnes.fin"), valeur: (ligne) => ligne.fin },
        { entete: t("export.colonnes.debutBaseline"), valeur: (ligne) => ligne.debutBaseline },
        { entete: t("export.colonnes.finBaseline"), valeur: (ligne) => ligne.finBaseline },
        { entete: t("export.colonnes.avancement"), valeur: (ligne) => ligne.avancement },
        {
          entete: t("export.colonnes.avancementTemporel"),
          valeur: (ligne) => ligne.avancementTemporel,
        },
        { entete: t("export.colonnes.deltaRetard"), valeur: (ligne) => ligne.deltaRetard },
        {
          entete: t("export.colonnes.statut"),
          valeur: (ligne) =>
            t.has(`statuts.${ligne.statut}`) ? t(`statuts.${ligne.statut}`) : ligne.statut,
        },
      ],
    }),
    [nomProjet, t],
  );

  const surEntreeBarre = useCallback(
    (evenement: MouseEvent<SVGGElement>, ligne: LigneGantt, geometrie: GeometrieBarreGantt) => {
      setSurvolId(ligne.caseItem.id);
      setInfobulle({
        ligne,
        geometrie,
        clientX: evenement.clientX,
        clientY: evenement.clientY,
      });
    },
    [],
  );

  const surMouvementBarre = useCallback((evenement: MouseEvent<SVGGElement>) => {
    setInfobulle((courant) =>
      courant
        ? { ...courant, clientX: evenement.clientX, clientY: evenement.clientY }
        : null,
    );
  }, []);

  const surSortieBarre = useCallback(() => {
    setSurvolId(null);
    setInfobulle(null);
  }, []);

  const ouvrirTache = useCallback(
    (caseItem: CasePlanning) => {
      if (lectureSeule || caseItem.acces !== "COMPLET" || !onSelectionnerCase) return;
      onSelectionnerCase(caseItem);
    },
    [lectureSeule, onSelectionnerCase],
  );

  const idMarqueurOk = `${prefixeId}-fleche-ok`;
  const idMarqueurKo = `${prefixeId}-fleche-ko`;
  const idMarqueurNeutre = `${prefixeId}-fleche-neutre`;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-solid border-neutral-200 bg-neutral-0 shadow-sm">
      {/* Barre d'outils du Gantt */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {/* Recherche */}
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder={t("barreOutils.recherchePlaceholder")}
              aria-label={t("barreOutils.recherche")}
              className="h-9 bg-neutral-0 pr-8 pl-9 text-sm"
            />
            {recherche && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setRecherche("")}
                aria-label={t("barreOutils.effacerRecherche")}
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Filtre retards */}
          <Button
            type="button"
            variant={retardsUniquement ? "default" : "outline"}
            size="sm"
            aria-pressed={retardsUniquement}
            onClick={() => setRetardsUniquement((v) => !v)}
            className={cn(
              "h-9 gap-1.5",
              retardsUniquement && "bg-erreur text-neutral-0 hover:bg-erreur/90",
            )}
          >
            <AlertTriangle className="size-4" aria-hidden="true" />
            <span>{t("barreOutils.filtreRetards")}</span>
            {nombreRetardsTotal > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                  retardsUniquement
                    ? "bg-neutral-0/20 text-neutral-0"
                    : "bg-erreur-fond text-erreur",
                )}
              >
                {nombreRetardsTotal}
              </span>
            )}
          </Button>

          {/* Replier / Déplier tout */}
          {tousIdsParents.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={basculerTout}
              disabled={filtreActif}
              className="h-9 gap-1.5"
              title={toutReplie ? t("barreOutils.deplierTout") : t("barreOutils.replierTout")}
            >
              {toutReplie ? (
                <ChevronsUpDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronsDownUp className="size-4" aria-hidden="true" />
              )}
              <span className="max-md:hidden">
                {toutReplie ? t("barreOutils.deplierTout") : t("barreOutils.replierTout")}
              </span>
            </Button>
          )}
        </div>

        {/* Zoom + Aujourd'hui + Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t("barreOutils.echelleAria")}
            className="inline-flex items-center rounded-md border border-solid border-neutral-200 bg-neutral-0 p-0.5"
          >
            {ECHELLES_GANTT.map((option) => {
              const active = echelle === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setEchelle(option)}
                  className={cn(
                    "cursor-pointer rounded border-0 px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary-500 text-neutral-0 shadow-xs"
                      : "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  )}
                >
                  {t(`echelles.${option}`)}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={centrerSurAujourdhui}
            disabled={xAujourdhui === null}
            className="h-9 gap-1.5"
          >
            <Crosshair className="size-4" aria-hidden="true" />
            <span>{t("barreOutils.aujourdhui")}</span>
          </Button>

          {!masquerExport && (
            <MenuExport exporter={configurationExport} lignes={lignesExport} />
          )}

          {actionsBarreOutils}
        </div>
      </div>

      {/* Corps du Gantt : état vide filtré ou vue synchronisée arbre + frise SVG */}
      {lignes.length === 0 ? (
        <EtatVide
          titre={t("gantt.aucunResultatTitre")}
          description={t("gantt.aucunResultatDescription")}
          action={
            filtreActif ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecherche("");
                  setRetardsUniquement(false);
                }}
              >
                {t("barreOutils.reinitialiserFiltres")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          ref={conteneurRef}
          className={cn(
            "relative w-full overflow-auto bg-neutral-0",
            taille === "compact" ? "max-h-[380px]" : "max-h-[68vh]",
          )}
        >
          <div
            className="relative flex flex-col"
            style={{ width: LARGEUR_COLONNE_ARBRE + bornes.largeurTotalePx }}
          >
            {/* En-tête collant en haut */}
            <div
              className="sticky top-0 z-30 flex border-0 border-b border-solid border-neutral-200 bg-neutral-50"
              style={{ height: HAUTEUR_ENTETE_GANTT }}
            >
              {/* Coin supérieur gauche (collant à gauche et en haut) */}
              <div
                className="sticky left-0 z-40 flex shrink-0 items-center justify-between border-0 border-r border-solid border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold tracking-wide text-neutral-600 uppercase"
                style={{ width: LARGEUR_COLONNE_ARBRE, height: HAUTEUR_ENTETE_GANTT }}
              >
                <span>{t("gantt.colonneTache")}</span>
                <span>{t("gantt.colonneAvancement")}</span>
              </div>

              {/* Bandeau double niveau de graduations */}
              <div
                className="relative shrink-0 bg-neutral-50"
                style={{ width: bornes.largeurTotalePx, height: HAUTEUR_ENTETE_GANTT }}
              >
                {/* Niveau supérieur (Mois/Année ou Année) */}
                <div className="relative h-6 border-0 border-b border-solid border-neutral-200">
                  {graduations.groupes.map((groupe) => (
                    <div
                      key={groupe.cle}
                      className="absolute top-0 bottom-0 flex items-center overflow-hidden border-0 border-r border-solid border-neutral-200 px-2 text-xs font-semibold whitespace-nowrap text-neutral-700"
                      style={{ left: groupe.x, width: groupe.largeur }}
                    >
                      <span className="truncate">{groupe.libelle}</span>
                    </div>
                  ))}
                </div>

                {/* Niveau inférieur (Jours / Semaines / Mois / Trimestres) */}
                <div className="relative h-7">
                  {graduations.cellules.map((cellule) => (
                    <div
                      key={cellule.cle}
                      className={cn(
                        "absolute top-0 bottom-0 flex flex-col items-center justify-center overflow-hidden border-0 border-r border-solid border-neutral-200 text-[11px] leading-tight whitespace-nowrap",
                        cellule.estWeekEnd
                          ? "bg-neutral-100 text-neutral-400"
                          : "text-neutral-600",
                      )}
                      style={{ left: cellule.x, width: cellule.largeur }}
                    >
                      <span className="font-medium tabular-nums">{cellule.libelle}</span>
                      {cellule.sousLibelle && cellule.largeur >= 26 && (
                        <span className="text-[10px] text-neutral-400 tabular-nums">
                          {cellule.sousLibelle}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Repère « Aujourd'hui » dans l'en-tête */}
                {xAujourdhui !== null && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary-600"
                    style={{ left: xAujourdhui }}
                  />
                )}
              </div>
            </div>

            {/* Zone synchronisée : Panneau arbre à gauche + SVG Gantt à droite */}
            <div className="relative flex">
              {/* Panneau arbre gauche (sticky left-0) */}
              <div
                className="sticky left-0 z-20 shrink-0 border-0 border-r border-solid border-neutral-200 bg-neutral-0 shadow-xs"
                style={{ width: LARGEUR_COLONNE_ARBRE }}
              >
                {lignes.map((ligne) => {
                  const item = ligne.caseItem;
                  const interactive = !lectureSeule && item.acces === "COMPLET" && Boolean(onSelectionnerCase);
                  const selectionnee = caseSelectionneeId === item.id;
                  const survolee = survolId === item.id;
                  const dates = datesEffectivesCase(item);
                  const decale = Math.min(ligne.profondeur, 6) * 16;

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setSurvolId(item.id)}
                      onMouseLeave={() => setSurvolId(null)}
                      onClick={() => interactive && ouvrirTache(item)}
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      onKeyDown={(evenement) => {
                        if (interactive && (evenement.key === "Enter" || evenement.key === " ")) {
                          evenement.preventDefault();
                          ouvrirTache(item);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 border-0 border-b border-solid border-neutral-100 px-2.5 text-sm transition-colors",
                        interactive && "cursor-pointer",
                        ligne.indexLigne % 2 === 1 && "bg-neutral-50/60",
                        survolee && "bg-primary-50/70",
                        selectionnee && "bg-primary-50 ring-1 ring-inset ring-primary-300",
                        item.acces === "CHEMIN" && "text-neutral-400",
                      )}
                      style={{ height: HAUTEUR_LIGNE_GANTT }}
                    >
                      {/* Indentation + bouton replier/déplier */}
                      <div
                        className="flex min-w-0 flex-1 items-center gap-1"
                        style={{ paddingLeft: decale }}
                      >
                        {ligne.aEnfants ? (
                          <button
                            type="button"
                            onClick={(evenement) => {
                              evenement.stopPropagation();
                              basculerNoeud(item.id);
                            }}
                            aria-label={
                              ligne.depliee
                                ? t("gantt.replierNoeud", { libelle: item.libelle })
                                : t("gantt.deplierNoeud", { libelle: item.libelle })
                            }
                            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900"
                          >
                            {ligne.depliee ? (
                              <ChevronDown className="size-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="size-3.5" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          <span className="flex size-5 shrink-0 items-center justify-center">
                            {ligne.estJalon ? (
                              <Diamond
                                className="size-3 fill-avertissement text-avertissement"
                                aria-hidden="true"
                              />
                            ) : (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  ligne.estEnRetard
                                    ? "bg-erreur"
                                    : estTerminee(item)
                                      ? "bg-succes"
                                      : "bg-primary-400",
                                )}
                                aria-hidden="true"
                              />
                            )}
                          </span>
                        )}

                        {item.numero && (
                          <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                            {item.numero}
                          </span>
                        )}

                        <span
                          title={item.libelle}
                          className={cn(
                            "truncate",
                            !item.estFeuille
                              ? "font-semibold text-neutral-900"
                              : "font-normal text-neutral-800",
                            item.acces === "CHEMIN" && "font-normal text-neutral-400 italic",
                          )}
                        >
                          {item.libelle}
                        </span>
                      </div>

                      {/* Indicateur compact à droite : avancement ou alerte sans dates */}
                      <div className="flex shrink-0 items-center gap-1.5 pl-1">
                        {ligne.estEnRetard && (
                          <span
                            className="size-2 rounded-full bg-erreur"
                            title={t("gantt.enRetard")}
                            aria-label={t("gantt.enRetard")}
                          />
                        )}
                        {item.acces === "COMPLET" ? (
                          dates.debut || dates.fin ? (
                            <span className="min-w-9 text-right text-xs font-medium text-neutral-600 tabular-nums">
                              {item.avancement !== null
                                ? formaterPourcentage(item.avancement, planning.uniteAvancement)
                                : ABSENT}
                            </span>
                          ) : (
                            <Badge variante="neutre">{t("gantt.sansDatesCourt")}</Badge>
                          )
                        ) : (
                          <span className="text-xs text-neutral-400">{ABSENT}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Frise SVG dynamique */}
              <div
                className="relative shrink-0"
                style={{ width: bornes.largeurTotalePx, height: hauteurCorps }}
              >
                <svg
                  width={bornes.largeurTotalePx}
                  height={hauteurCorps}
                  role="img"
                  aria-label={t("gantt.diagrammeAria")}
                  className="block select-none"
                >
                  <defs>
                    <marker
                      id={idMarqueurOk}
                      viewBox={VIEWBOX_MARQUEUR}
                      refX={7}
                      refY={4}
                      markerWidth={6}
                      markerHeight={6}
                      orient={ORIENTATION_AUTO}
                    >
                      <path d={CHEMIN_MARQUEUR} className="fill-succes" />
                    </marker>
                    <marker
                      id={idMarqueurKo}
                      viewBox={VIEWBOX_MARQUEUR}
                      refX={7}
                      refY={4}
                      markerWidth={6}
                      markerHeight={6}
                      orient={ORIENTATION_AUTO}
                    >
                      <path d={CHEMIN_MARQUEUR} className="fill-erreur" />
                    </marker>
                    <marker
                      id={idMarqueurNeutre}
                      viewBox={VIEWBOX_MARQUEUR}
                      refX={7}
                      refY={4}
                      markerWidth={6}
                      markerHeight={6}
                      orient={ORIENTATION_AUTO}
                    >
                      <path d={CHEMIN_MARQUEUR} className="fill-neutral-400" />
                    </marker>
                  </defs>

                  {/* Fond des colonnes (week-ends + filets verticaux) */}
                  <g aria-hidden="true">
                    {graduations.cellules.map((cellule) => (
                      <g key={cellule.cle}>
                        {cellule.estWeekEnd && (
                          <rect
                            x={cellule.x}
                            y={0}
                            width={cellule.largeur}
                            height={hauteurCorps}
                            className="fill-neutral-100/80"
                          />
                        )}
                        <line
                          x1={cellule.x + cellule.largeur}
                          y1={0}
                          x2={cellule.x + cellule.largeur}
                          y2={hauteurCorps}
                          className="stroke-neutral-200/70"
                          strokeWidth={1}
                        />
                      </g>
                    ))}
                  </g>

                  {/* Bandes horizontales synchronisées (alternance + survol + sélection) */}
                  <g aria-hidden="true">
                    {lignes.map((ligne) => {
                      const y = ligne.indexLigne * HAUTEUR_LIGNE_GANTT;
                      const selectionnee = caseSelectionneeId === ligne.caseItem.id;
                      const survolee = survolId === ligne.caseItem.id;
                      return (
                        <g key={ligne.caseItem.id}>
                          {(selectionnee || survolee || ligne.indexLigne % 2 === 1) && (
                            <rect
                              x={0}
                              y={y}
                              width={bornes.largeurTotalePx}
                              height={HAUTEUR_LIGNE_GANTT}
                              className={cn(
                                selectionnee
                                  ? "fill-primary-50/90"
                                  : survolee
                                    ? "fill-primary-50/50"
                                    : "fill-neutral-50/50",
                              )}
                            />
                          )}
                          <line
                            x1={0}
                            y1={y + HAUTEUR_LIGNE_GANTT}
                            x2={bornes.largeurTotalePx}
                            y2={y + HAUTEUR_LIGNE_GANTT}
                            className="stroke-neutral-100"
                            strokeWidth={1}
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* Flèches de dépendances (FS, SS, FF, SF + décalage) */}
                  <g>
                    {fleches.map((fleche) => {
                      const estViole = fleche.respectee === false;
                      const estOk = fleche.respectee === true;
                      const marqueur = estViole
                        ? `url(#${idMarqueurKo})`
                        : estOk
                          ? `url(#${idMarqueurOk})`
                          : `url(#${idMarqueurNeutre})`;
                      const etiquetteComplete = formaterEtiquetteDependance(
                        fleche.typeLien,
                        fleche.decalageJours,
                      );
                      const largeurEtiquette = Math.max(24, fleche.etiquette.length * 5.6 + 8);
                      return (
                        <g key={fleche.id}>
                          <title>{etiquetteComplete}</title>
                          <path
                            d={fleche.cheminSvg}
                            fill="none"
                            strokeWidth={estViole ? 1.8 : 1.4}
                            strokeDasharray={
                              fleche.respectee === null ? POINTILLES_DEPENDANCE : undefined
                            }
                            markerEnd={marqueur}
                            className={cn(
                              estViole
                                ? "stroke-erreur"
                                : estOk
                                  ? "stroke-succes"
                                  : "stroke-neutral-400",
                            )}
                          />
                          {fleche.etiquette !== "" && (
                            <g className="pointer-events-none">
                              <rect
                                x={fleche.xEtiquette - largeurEtiquette / 2}
                                y={fleche.yEtiquette - 7}
                                width={largeurEtiquette}
                                height={14}
                                rx={3}
                                strokeWidth={0.75}
                                className="fill-neutral-0/95 stroke-neutral-200"
                              />
                              <text
                                x={fleche.xEtiquette}
                                y={fleche.yEtiquette}
                                textAnchor={ANCRAGE_MILIEU}
                                dominantBaseline={LIGNE_BASE_CENTRE}
                                className={cn(
                                  "text-[9px] font-semibold",
                                  estViole
                                    ? "fill-erreur"
                                    : estOk
                                      ? "fill-succes"
                                      : "fill-neutral-600",
                                )}
                              >
                                {fleche.etiquette}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* Ligne verticale « Aujourd'hui » */}
                  {xAujourdhui !== null && (
                    <line
                      x1={xAujourdhui}
                      y1={0}
                      x2={xAujourdhui}
                      y2={hauteurCorps}
                      strokeWidth={1.5}
                      strokeDasharray={POINTILLES_AUJOURDHUI}
                      className="stroke-primary-600"
                      aria-hidden="true"
                    />
                  )}

                  {/* Barres et jalons des tâches */}
                  <g>
                    {lignes.map((ligne) => {
                      const item = ligne.caseItem;
                      const geo = geometrieParId.get(item.id);
                      if (!geo) return null;

                      const yLigne = ligne.indexLigne * HAUTEUR_LIGNE_GANTT;
                      const yCentre = yLigne + HAUTEUR_LIGNE_GANTT / 2;
                      const interactive =
                        !lectureSeule && item.acces === "COMPLET" && Boolean(onSelectionnerCase);
                      const terminee = estTerminee(item);

                      return (
                        <g
                          key={item.id}
                          className={cn(interactive && "cursor-pointer")}
                          onMouseEnter={(evenement) => surEntreeBarre(evenement, ligne, geo)}
                          onMouseMove={surMouvementBarre}
                          onMouseLeave={surSortieBarre}
                          onClick={() => interactive && ouvrirTache(item)}
                        >
                          {/* Repère baseline (dates d'origine) sous la barre */}
                          {geo.xDebutBaseline !== null && geo.largeurBaseline !== null && (
                            <rect
                              x={geo.xDebutBaseline}
                              y={yLigne + 31}
                              width={geo.largeurBaseline}
                              height={4}
                              rx={2}
                              className="fill-neutral-400/75"
                            />
                          )}

                          {/* Cas 1 : Barre enveloppe de tâche parente */}
                          {!item.estFeuille && (
                            <g>
                              <path
                                d={cheminEnveloppeParent(geo.x, yLigne + 11, geo.largeur)}
                                className="fill-secondary-700"
                              />
                              {geo.largeurAvancement > 0 && (
                                <rect
                                  x={geo.x}
                                  y={yLigne + 11}
                                  width={geo.largeurAvancement}
                                  height={5}
                                  rx={1}
                                  className={cn(
                                    ligne.estEnRetard
                                      ? "fill-erreur"
                                      : terminee
                                        ? "fill-succes"
                                        : "fill-primary-500",
                                  )}
                                />
                              )}
                              {geo.xMarqueurTheorique !== null && (
                                <line
                                  x1={geo.xMarqueurTheorique}
                                  y1={yLigne + 8}
                                  x2={geo.xMarqueurTheorique}
                                  y2={yLigne + 22}
                                  strokeWidth={1.75}
                                  className="stroke-neutral-900"
                                />
                              )}
                            </g>
                          )}

                          {/* Cas 2 : Jalon (losange) */}
                          {item.estFeuille && geo.estJalon && (
                            <path
                              d={cheminLosange(geo.x, yCentre, 8)}
                              strokeWidth={1.5}
                              className={cn(
                                ligne.estEnRetard
                                  ? "fill-erreur stroke-neutral-900"
                                  : terminee
                                    ? "fill-succes stroke-neutral-900"
                                    : "fill-avertissement stroke-primary-800",
                              )}
                            />
                          )}

                          {/* Cas 3 : Barre de tâche feuille */}
                          {item.estFeuille && !geo.estJalon && (
                            <g>
                              <rect
                                x={geo.x}
                                y={yLigne + 10}
                                width={geo.largeur}
                                height={18}
                                rx={4}
                                strokeWidth={1}
                                className={cn(
                                  ligne.estEnRetard
                                    ? "fill-erreur-fond stroke-erreur/40"
                                    : terminee
                                      ? "fill-succes-fond stroke-succes/40"
                                      : "fill-primary-100 stroke-primary-300",
                                )}
                              />
                              {geo.largeurAvancement > 0 && (
                                <rect
                                  x={geo.x}
                                  y={yLigne + 10}
                                  width={Math.min(geo.largeur, geo.largeurAvancement)}
                                  height={18}
                                  rx={4}
                                  className={cn(
                                    ligne.estEnRetard
                                      ? "fill-erreur"
                                      : terminee
                                        ? "fill-succes"
                                        : "fill-primary-500",
                                  )}
                                />
                              )}
                              {geo.xMarqueurTheorique !== null && (
                                <g>
                                  <line
                                    x1={geo.xMarqueurTheorique}
                                    y1={yLigne + 9}
                                    x2={geo.xMarqueurTheorique}
                                    y2={yLigne + 29}
                                    strokeWidth={2}
                                    className="stroke-neutral-900"
                                  />
                                  <path
                                    d={cheminTriangleTheorique(geo.xMarqueurTheorique, yLigne + 10)}
                                    className="fill-neutral-900"
                                  />
                                </g>
                              )}
                            </g>
                          )}

                          {/* Étiquette d'avancement discrète à droite de la barre */}
                          {item.avancement !== null && (
                            <text
                              x={(geo.estJalon ? geo.x + 12 : geo.x + geo.largeur + 6)}
                              y={yCentre}
                              textAnchor={ANCRAGE_DEBUT}
                              dominantBaseline={LIGNE_BASE_CENTRE}
                              className="fill-neutral-600 text-[11px] font-medium"
                            >
                              {formaterPourcentage(item.avancement, planning.uniteAvancement)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Légende compacte */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-0 border-t border-solid border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-xs bg-secondary-700" aria-hidden="true" />
          {t("legende.parent")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-xs border border-solid border-primary-300 bg-primary-500" aria-hidden="true" />
          {t("legende.avancementPhysique")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-neutral-900" aria-hidden="true" />
          {t("legende.marqueurTheorique")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-neutral-400" aria-hidden="true" />
          {t("legende.baseline")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 bg-avertissement" aria-hidden="true" />
          {t("legende.jalon")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-succes" aria-hidden="true" />
          {t("legende.lienRespecte")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-erreur" aria-hidden="true" />
          {t("legende.lienNonRespecte")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 border-0 border-l-2 border-dashed border-primary-600" aria-hidden="true" />
          {t("legende.aujourdhui")}
        </span>
      </div>

      {/* Infobulle flottante détaillée au survol d'une barre ou d'un jalon */}
      {infobulle && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 w-72 rounded-lg border border-solid border-neutral-200 bg-neutral-900 p-3 text-xs text-neutral-0 shadow-lg"
          style={{
            left: Math.min(
              typeof window !== "undefined" ? window.innerWidth - 304 : infobulle.clientX + 14,
              infobulle.clientX + 14,
            ),
            top: Math.max(12, infobulle.clientY - 12),
          }}
        >
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <span className="font-semibold text-neutral-0">
              {infobulle.ligne.caseItem.numero ? `${infobulle.ligne.caseItem.numero} ` : ""}
              {infobulle.ligne.caseItem.libelle}
            </span>
            {infobulle.ligne.caseItem.niveau && (
              <span className="shrink-0 rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-200">
                {infobulle.ligne.caseItem.niveau}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1 text-neutral-200">
            <div className="flex justify-between gap-2">
              <span className="text-neutral-400">{t("infobulle.periode")}</span>
              <span className="font-medium tabular-nums">
                {t("infobulle.intervalle", {
                  debut: formaterDate(infobulle.geometrie.debutIso),
                  fin: formaterDate(infobulle.geometrie.finIso),
                })}
              </span>
            </div>

            {infobulle.ligne.caseItem.debutBaseline && infobulle.ligne.caseItem.finBaseline && (
              <div className="flex justify-between gap-2">
                <span className="text-neutral-400">{t("infobulle.baseline")}</span>
                <span className="tabular-nums">
                  {t("infobulle.intervalle", {
                    debut: formaterDate(infobulle.ligne.caseItem.debutBaseline),
                    fin: formaterDate(infobulle.ligne.caseItem.finBaseline),
                  })}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <span className="text-neutral-400">{t("infobulle.avancementPhysique")}</span>
              <span className="font-semibold tabular-nums">
                {formaterPourcentage(infobulle.ligne.caseItem.avancement, planning.uniteAvancement)}
              </span>
            </div>

            {infobulle.ligne.caseItem.avancementTemporel !== null && (
              <div className="flex justify-between gap-2">
                <span className="text-neutral-400">{t("infobulle.avancementTemporel")}</span>
                <span className="tabular-nums">
                  {formaterPourcentage(
                    infobulle.ligne.caseItem.avancementTemporel,
                    planning.uniteAvancement,
                  )}
                </span>
              </div>
            )}

            {infobulle.ligne.caseItem.deltaRetard !== null && (
              <div className="flex justify-between gap-2">
                <span className="text-neutral-400">{t("infobulle.ecart")}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    infobulle.ligne.estEnRetard ? "text-primary-300" : "text-neutral-0",
                  )}
                >
                  {formaterEcartAvancement(infobulle.ligne.caseItem.deltaRetard, {
                    unite: planning.uniteAvancement,
                  })}
                </span>
              </div>
            )}
          </div>

          {!lectureSeule && infobulle.ligne.caseItem.acces === "COMPLET" && onSelectionnerCase && (
            <p className="mt-2 mb-0 border-0 border-t border-solid border-neutral-700 pt-1.5 text-[11px] text-neutral-400">
              {t("infobulle.indiceEdition")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
