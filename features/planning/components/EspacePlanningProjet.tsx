"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  GitBranch,
  Link2,
  Lock,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PERMISSIONS, useDroits } from "@/features/habilitations";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";
import { projetModifiable } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { ABSENT, formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { lirePlanningGantt } from "../adaptateur";
import { clePlanningGantt } from "../cles";
import {
  calculerIndicateursPlanning,
  collecterFeuilles,
  trouverCaseParId,
} from "../regles";
import { DiagrammeGantt } from "./DiagrammeGantt";
import { ModaleImportMsProject } from "./ModaleImportMsProject";
import { PanneauEditionTacheGantt } from "./PanneauEditionTacheGantt";

export interface PropsEspacePlanningProjet {
  projet: Projet;
  /** Affiche un accès direct vers l'onglet Découpage de la fiche projet. */
  afficherLienDecoupage?: boolean;
}

/**
 * Charge le projet depuis son cache React Query (`cleProjet`) puis affiche l'espace planning.
 * Utilisé par l'onglet `/projets/[id]/planning` où `CadreFicheProjet` a déjà peuplé ce cache.
 */
export function OngletPlanningProjet({ projetId }: { projetId: string }) {
  const requete = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  return <EspacePlanningProjet projet={requete.data} />;
}

/**
 * Espace complet du planning (diagramme de Gantt) d'un projet :
 * - KPIs synthétiques (tâches planifiées, retards, terminées, dépendances FS) ;
 * - Bouton d'import MS Project `.xml` avec verrou explicite lorsque le chantier est démarré ;
 * - État vide guidant vers la construction du découpage ou l'import MS Project `.xml` ;
 * - Diagramme de Gantt interactif, tiroir d'édition des dates/dépendances et modale d'import.
 */
export function EspacePlanningProjet({
  projet,
  afficherLienDecoupage = false,
}: PropsEspacePlanningProjet) {
  const t = useTranslations("planning");
  const { peutSurProjet } = useDroits();

  const [caseSelectionneeId, setCaseSelectionneeId] = useState<string | null>(null);
  const [modaleImportOuverte, setModaleImportOuverte] = useState(false);

  const requetePlanning = useQuery({
    queryKey: clePlanningGantt(projet.id),
    queryFn: ({ signal }) => lirePlanningGantt(projet.id, signal),
  });

  const planning = requetePlanning.data ?? null;

  const indicateurs = useMemo(
    () => (planning ? calculerIndicateursPlanning(planning) : null),
    [planning],
  );

  const toutesFeuilles = useMemo(
    () => (planning ? collecterFeuilles(planning.cases) : []),
    [planning],
  );

  const caseSelectionnee = useMemo(
    () => (planning && caseSelectionneeId ? trouverCaseParId(planning.cases, caseSelectionneeId) : null),
    [planning, caseSelectionneeId],
  );

  const peutImporter =
    projetModifiable(projet) &&
    (peutSurProjet(PERMISSIONS.DECOUPER, projet) || peutSurProjet(PERMISSIONS.PLANIFIER, projet));

  if (requetePlanning.isPending) {
    return <EtatChargement message={t("chargement")} />;
  }

  if (requetePlanning.isError || !planning || !indicateurs) {
    return (
      <EtatErreur
        message={t("erreurChargement")}
        onReessayer={() => void requetePlanning.refetch()}
      />
    );
  }

  const importAutorise = planning.importMsProject.autorise;
  const motifBlocage = planning.importMsProject.motifBlocage;

  const boutonImportMsProject = peutImporter ? (
    importAutorise ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setModaleImportOuverte(true)}
        className="gap-1.5"
      >
        <Upload className="size-4" aria-hidden="true" />
        <span>{t("actions.importerMsProject")}</span>
      </Button>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModaleImportOuverte(true)}
            className="gap-1.5 border-neutral-300 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Lock className="size-3.5" aria-hidden="true" />
            <span>{t("actions.importerMsProjectVerrouille")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {motifBlocage ?? t("importMsProject.verrouille.descriptionDefaut")}
        </TooltipContent>
      </Tooltip>
    )
  ) : null;

  // État vide : aucune case active dans le découpage du projet
  if (planning.cases.length === 0) {
    return (
      <div className="rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-6 shadow-sm">
        <EtatVide
          icone={<CalendarRange className="size-10 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />}
          titre={t("etatVide.titre")}
          description={t("etatVide.description")}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="sm">
                <Link href={`/projets/${projet.id}/decoupage`}>
                  <GitBranch className="size-4" aria-hidden="true" />
                  <span>{t("etatVide.allerDecoupage")}</span>
                </Link>
              </Button>
              {peutImporter && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModaleImportOuverte(true)}
                >
                  {importAutorise ? (
                    <FileCode2 className="size-4" aria-hidden="true" />
                  ) : (
                    <Lock className="size-4" aria-hidden="true" />
                  )}
                  <span>{t("actions.importerMsProject")}</span>
                </Button>
              )}
            </div>
          }
        />

        <ModaleImportMsProject
          projetId={projet.id}
          nomProjet={projet.nom}
          etatImport={planning.importMsProject}
          ouverte={modaleImportOuverte}
          onFermer={() => setModaleImportOuverte(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs synthétiques du planning */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TuileKpi
          libelle={t("kpis.tachesPlanifiees")}
          valeur={t("kpis.ratioPlanifiees", {
            planifiees: indicateurs.feuillesPlanifiees,
            total: indicateurs.totalFeuilles,
          })}
          detail={t("kpis.detailStructure", {
            cases: indicateurs.totalCases,
            jalons: indicateurs.jalons,
          })}
          icone={<CalendarRange className="size-4 text-primary-600" aria-hidden="true" />}
          ton="primaire"
        />

        <TuileKpi
          libelle={t("kpis.tachesEnRetard")}
          valeur={String(indicateurs.feuillesEnRetard)}
          detail={
            indicateurs.feuillesEnRetard > 0
              ? t("kpis.retardsDetectes")
              : t("kpis.aucunRetard")
          }
          icone={
            <AlertTriangle
              className={cn(
                "size-4",
                indicateurs.feuillesEnRetard > 0 ? "text-erreur" : "text-neutral-500",
              )}
              aria-hidden="true"
            />
          }
          ton={indicateurs.feuillesEnRetard > 0 ? "erreur" : "neutre"}
          alerte={indicateurs.feuillesEnRetard > 0}
        />

        <TuileKpi
          libelle={t("kpis.tachesTerminees")}
          valeur={String(indicateurs.feuillesTerminees)}
          detail={t("kpis.surFeuilles", { total: indicateurs.totalFeuilles })}
          icone={<CheckCircle2 className="size-4 text-succes" aria-hidden="true" />}
          ton={indicateurs.feuillesTerminees > 0 ? "succes" : "neutre"}
        />

        <TuileKpi
          libelle={t("kpis.dependances")}
          valeur={String(indicateurs.dependancesTotal)}
          detail={
            indicateurs.dependancesNonRespectees > 0
              ? t("kpis.dependancesEnConflit", {
                  nombre: indicateurs.dependancesNonRespectees,
                })
              : t("kpis.dependancesConformes")
          }
          icone={
            <Link2
              className={cn(
                "size-4",
                indicateurs.dependancesNonRespectees > 0 ? "text-erreur" : "text-secondary-600",
              )}
              aria-hidden="true"
            />
          }
          ton={indicateurs.dependancesNonRespectees > 0 ? "avertissement" : "secondaire"}
          alerte={indicateurs.dependancesNonRespectees > 0}
        />
      </div>

      {/* Bandeau d'actions du planning (horizon + import MS Project + lien découpage) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-solid border-neutral-200 bg-neutral-0 px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">{t("bandeau.horizon")}</span>
          <Badge variante="neutre">
            {indicateurs.dateDebutMin || indicateurs.dateFinMax
              ? t("infobulle.intervalle", {
                  debut: formaterDate(indicateurs.dateDebutMin),
                  fin: formaterDate(indicateurs.dateFinMax),
                })
              : ABSENT}
          </Badge>
          {!importAutorise && (
            <Badge variante="avertissement" icone={<Lock className="size-3" aria-hidden="true" />}>
              {t("bandeau.importVerrouilleBadge")}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {afficherLienDecoupage && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/projets/${projet.id}/decoupage`}>
                <span>{t("actions.voirDecoupage")}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          )}
          {boutonImportMsProject}
        </div>
      </div>

      {/* Diagramme de Gantt interactif */}
      <DiagrammeGantt
        planning={planning}
        nomProjet={projet.nom}
        caseSelectionneeId={caseSelectionneeId}
        onSelectionnerCase={(caseItem) => setCaseSelectionneeId(caseItem.id)}
      />

      {/* Tiroir d'édition des dates et dépendances */}
      <PanneauEditionTacheGantt
        projet={projet}
        cible={caseSelectionnee}
        toutesFeuilles={toutesFeuilles}
        uniteAvancement={planning.uniteAvancement}
        onFermer={() => setCaseSelectionneeId(null)}
      />

      {/* Modale d'import MS Project .xml */}
      <ModaleImportMsProject
        projetId={projet.id}
        nomProjet={projet.nom}
        etatImport={planning.importMsProject}
        ouverte={modaleImportOuverte}
        onFermer={() => setModaleImportOuverte(false)}
      />
    </div>
  );
}

const FOND_TUILE = {
  primaire: "border-primary-100 bg-primary-50",
  secondaire: "border-secondary-100 bg-secondary-50",
  succes: "border-succes/20 bg-succes-fond",
  erreur: "border-erreur/20 bg-erreur-fond",
  avertissement: "border-avertissement/20 bg-avertissement-fond",
  neutre: "border-neutral-200 bg-neutral-50",
} as const;

type TonTuile = keyof typeof FOND_TUILE;

function TuileKpi({
  libelle,
  valeur,
  detail,
  icone,
  ton,
  alerte = false,
}: {
  libelle: string;
  valeur: string;
  detail: string;
  icone: ReactNode;
  ton: TonTuile;
  alerte?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-solid p-4 shadow-xs",
        FOND_TUILE[ton],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral-700">{libelle}</span>
        {icone}
      </div>
      <span
        className={cn(
          "text-h3 font-bold tabular-nums",
          alerte && ton === "erreur"
            ? "text-erreur"
            : alerte && ton === "avertissement"
              ? "text-avertissement"
              : "text-neutral-900",
        )}
      >
        {valeur}
      </span>
      <span className="text-xs text-neutral-600">{detail}</span>
    </div>
  );
}
