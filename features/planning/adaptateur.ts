/**
 * Adaptateur HTTP du domaine Planning (Gantt, dépendances et import MS Project `.xml`).
 *
 * Seul fichier du domaine à parler au client `api`. Tous les types de transport `Charge*`
 * en `snake_case` restent privés ; seules des structures de `types.ts` (`camelCase`) en sortent.
 *
 * Routes consommées :
 *   GET    /projets/{id}/planning/
 *   POST   /projets/{id}/planning/ms-project/analyser/
 *   POST   /projets/{id}/planning/ms-project/importer/
 *   GET    /elements/{id}/dependances/
 *   POST   /elements/{id}/dependances/
 *   DELETE /dependances/{id}/
 *   POST   /elements/{id}/reprogrammer/
 */

import { api, ErreurApi } from "@/lib/api";

import type {
  AccesCasePlanning,
  AnalyseMsProject,
  AvertissementMsProject,
  CasePlanning,
  DependanceMsProject,
  DependancePlanning,
  DependancesElement,
  EtatImportMsProject,
  LienCaseElement,
  LienDependanceCree,
  ModeMesurePlanning,
  NiveauMsProject,
  PlanningGantt,
  ResultatImportMsProject,
  TacheMsProject,
} from "./types";

/* ------------------------------------------------------------------ *
 * Charges de transport (`snake_case`, privées au fichier).
 * ------------------------------------------------------------------ */

interface ChargeEtatImportMsProject {
  autorise?: boolean;
  decoupage_existant?: boolean;
  remplacement_requis?: boolean;
  motif_blocage?: string | null;
}

interface ChargeCasePlanning {
  id: string;
  libelle: string;
  numero?: string | null;
  niveau?: string | null;
  debut?: string | null;
  fin?: string | null;
  debut_prevu?: string | null;
  fin_prevue?: string | null;
  debut_baseline?: string | null;
  fin_baseline?: string | null;
  avancement?: number | string | null;
  avancement_temporel?: number | string | null;
  delta_retard?: number | string | null;
  statut?: string;
  acces?: AccesCasePlanning;
  est_feuille?: boolean;
  mode_mesure?: string | null;
  enfants?: ChargeCasePlanning[];
}

interface ChargeDependancePlanning {
  id: string;
  predecesseur_id: string;
  successeur_id: string;
  respectee?: boolean | null;
}

interface ChargePlanningGantt {
  aujourdhui: string;
  projet_debut?: string | null;
  projet_fin?: string | null;
  import_ms_project?: ChargeEtatImportMsProject | null;
  cases?: ChargeCasePlanning[];
  dependances?: ChargeDependancePlanning[];
}

interface ChargeLienCaseElement {
  lien_id: string;
  id: string;
  visible?: boolean;
  libelle?: string | null;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  respectee?: boolean | null;
}

interface ChargeDependancesElement {
  element_id: string;
  predecesseurs?: ChargeLienCaseElement[];
  successeurs?: ChargeLienCaseElement[];
}

interface ChargeLienDependanceCree {
  id: string;
  predecesseur: {
    id: string;
    libelle: string;
    date_fin_prevue?: string | null;
  };
  successeur: {
    id: string;
    libelle: string;
    date_debut_prevue?: string | null;
  };
  respectee?: boolean | null;
}

interface ChargeAvertissementMsProject {
  code: string;
  message: string;
}

interface ChargeNiveauMsProject {
  ordre: number;
  libelle: string;
}

interface ChargeTacheMsProject {
  uid: string;
  numero?: string | null;
  libelle: string;
  niveau_ordre: number;
  niveau?: string | null;
  debut?: string | null;
  fin?: string | null;
  duree_heures?: number | string | null;
  est_jalon?: boolean;
  est_feuille?: boolean;
  pourcentage_xml?: number | string | null;
  enfants?: ChargeTacheMsProject[];
}

interface ChargeDependanceMsProject {
  predecesseur_uid: string;
  predecesseur_libelle: string;
  successeur_uid: string;
  successeur_libelle: string;
  type?: string;
  respectee?: boolean | null;
}

interface ChargeStatistiquesMsProject {
  total_taches?: number;
  feuilles?: number;
  jalons?: number;
  dependances_retenues?: number;
  dependances_ignorees?: number;
}

interface ChargeAnalyseMsProject {
  etat_import?: ChargeEtatImportMsProject | null;
  projet_xml?: {
    titre?: string | null;
    date_debut?: string | null;
    date_fin?: string | null;
  } | null;
  niveaux?: ChargeNiveauMsProject[];
  taches?: ChargeTacheMsProject[];
  dependances?: ChargeDependanceMsProject[];
  statistiques?: ChargeStatistiquesMsProject | null;
  avertissements?: ChargeAvertissementMsProject[];
}

interface ChargeResultatImportMsProject {
  elements_crees?: number;
  niveaux_crees?: number;
  dependances_creees?: number;
  remplacement_effectue?: boolean;
  avertissements?: ChargeAvertissementMsProject[];
  planning: ChargePlanningGantt;
}

interface ChargeSuccesseurDecalage {
  id: string;
  libelle: string;
  date_debut_avant?: string | null;
  date_fin_avant?: string | null;
  date_debut_apres?: string | null;
  date_fin_apres?: string | null;
  jours?: number;
}

/** Un successeur FS devant être décalé lors de la reprogrammation d'une tâche. */
export interface SuccesseurADecaler {
  id: string;
  libelle: string;
  dateDebutAvant: string | null;
  dateFinAvant: string | null;
  dateDebutApres: string | null;
  dateFinApres: string | null;
  jours: number;
}

/** Saisie d'une reprogrammation de tâche depuis le panneau Gantt. */
export interface SaisieReprogrammationGantt {
  dateDebutPrevue?: string | null;
  dateFinPrevue: string;
  motifId: string;
  justification: string;
  prolonger?: boolean;
  decalerSuccesseurs?: string[];
}

export interface ResultatReprogrammationGantt {
  dateDebutPrevue: string | null;
  dateFinPrevue: string;
  alerteDg: boolean;
}

/* ------------------------------------------------------------------ *
 * Traductions serveur → domaine (`vers*`).
 * ------------------------------------------------------------------ */

const MODES_MESURE_VALIDES: readonly ModeMesurePlanning[] = ["QUANTITE", "POURCENTAGE", "JALON"];

function versNombre(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(nombre) ? nombre : null;
}

function versModeMesure(valeur: string | null | undefined): ModeMesurePlanning | null {
  return (MODES_MESURE_VALIDES as readonly string[]).includes(valeur ?? "")
    ? (valeur as ModeMesurePlanning)
    : null;
}

function versEtatImport(charge: ChargeEtatImportMsProject | null | undefined): EtatImportMsProject {
  return {
    autorise: charge?.autorise ?? false,
    decoupageExistant: charge?.decoupage_existant ?? false,
    remplacementRequis: charge?.remplacement_requis ?? false,
    motifBlocage: charge?.motif_blocage ?? null,
  };
}

function versCasePlanning(charge: ChargeCasePlanning): CasePlanning {
  const enfants = (charge.enfants ?? []).map(versCasePlanning);
  const debut = charge.debut ?? null;
  const fin = charge.fin ?? null;
  return {
    id: charge.id,
    libelle: charge.libelle,
    numero: charge.numero ?? null,
    niveau: charge.niveau ?? null,
    debut,
    fin,
    debutPrevu: charge.debut_prevu !== undefined ? charge.debut_prevu : debut,
    finPrevue: charge.fin_prevue !== undefined ? charge.fin_prevue : fin,
    debutBaseline: charge.debut_baseline ?? null,
    finBaseline: charge.fin_baseline ?? null,
    avancement: versNombre(charge.avancement),
    avancementTemporel: versNombre(charge.avancement_temporel),
    deltaRetard: versNombre(charge.delta_retard),
    statut: charge.statut ?? "PLANIFIE",
    acces: charge.acces === "CHEMIN" ? "CHEMIN" : "COMPLET",
    estFeuille: charge.est_feuille ?? enfants.length === 0,
    modeMesure: versModeMesure(charge.mode_mesure),
    enfants,
  };
}

function versDependancePlanning(charge: ChargeDependancePlanning): DependancePlanning {
  return {
    id: charge.id,
    predecesseurId: charge.predecesseur_id,
    successeurId: charge.successeur_id,
    respectee: charge.respectee ?? null,
  };
}

function versPlanningGantt(charge: ChargePlanningGantt): PlanningGantt {
  return {
    aujourdhui: charge.aujourdhui,
    projetDebut: charge.projet_debut ?? null,
    projetFin: charge.projet_fin ?? null,
    importMsProject: versEtatImport(charge.import_ms_project),
    cases: (charge.cases ?? []).map(versCasePlanning),
    dependances: (charge.dependances ?? []).map(versDependancePlanning),
  };
}

function versLienCase(charge: ChargeLienCaseElement): LienCaseElement {
  return {
    lienId: charge.lien_id,
    id: charge.id,
    visible: charge.visible ?? true,
    libelle: charge.libelle ?? null,
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    respectee: charge.respectee ?? null,
  };
}

function versAvertissement(charge: ChargeAvertissementMsProject): AvertissementMsProject {
  return {
    code: charge.code,
    message: charge.message,
  };
}

function versNiveauMsProject(charge: ChargeNiveauMsProject): NiveauMsProject {
  return {
    ordre: charge.ordre,
    libelle: charge.libelle,
  };
}

function versTacheMsProject(charge: ChargeTacheMsProject): TacheMsProject {
  const enfants = (charge.enfants ?? []).map(versTacheMsProject);
  return {
    uid: charge.uid,
    numero: charge.numero ?? null,
    libelle: charge.libelle,
    niveauOrdre: charge.niveau_ordre,
    niveau: charge.niveau ?? null,
    debut: charge.debut ?? null,
    fin: charge.fin ?? null,
    dureeHeures: versNombre(charge.duree_heures),
    estJalon: charge.est_jalon ?? false,
    estFeuille: charge.est_feuille ?? enfants.length === 0,
    pourcentageXml: versNombre(charge.pourcentage_xml),
    enfants,
  };
}

function versDependanceMsProject(charge: ChargeDependanceMsProject): DependanceMsProject {
  return {
    predecesseurUid: charge.predecesseur_uid,
    predecesseurLibelle: charge.predecesseur_libelle,
    successeurUid: charge.successeur_uid,
    successeurLibelle: charge.successeur_libelle,
    type: charge.type ?? "FS",
    respectee: charge.respectee ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Fonctions d'accès aux données (verbes à l'infinitif).
 * ------------------------------------------------------------------ */

/** Lit le planning complet d'un projet (arborescence, dates, avancements, dépendances, éligibilité import). */
export async function lirePlanningGantt(
  projetId: string,
  signal?: AbortSignal,
): Promise<PlanningGantt> {
  const charge = await api.lire<ChargePlanningGantt>(
    `/projets/${projetId}/planning/`,
    undefined,
    signal,
  );
  return versPlanningGantt(charge);
}

/** Lit les prédécesseurs et successeurs directs d'une tâche feuille. */
export async function lireDependancesElement(
  elementId: string,
  signal?: AbortSignal,
): Promise<DependancesElement> {
  const charge = await api.lire<ChargeDependancesElement>(
    `/elements/${elementId}/dependances/`,
    undefined,
    signal,
  );
  return {
    elementId: charge.element_id,
    predecesseurs: (charge.predecesseurs ?? []).map(versLienCase),
    successeurs: (charge.successeurs ?? []).map(versLienCase),
  };
}

/** Crée une dépendance Fin → Début : `elementId` démarre après la fin de `predecesseurId`. */
export async function ajouterDependanceElement(
  elementId: string,
  predecesseurId: string,
): Promise<LienDependanceCree> {
  const charge = await api.creer<ChargeLienDependanceCree>(
    `/elements/${elementId}/dependances/`,
    { predecesseur_id: predecesseurId },
  );
  return {
    id: charge.id,
    predecesseur: {
      id: charge.predecesseur.id,
      libelle: charge.predecesseur.libelle,
      dateFinPrevue: charge.predecesseur.date_fin_prevue ?? null,
    },
    successeur: {
      id: charge.successeur.id,
      libelle: charge.successeur.libelle,
      dateDebutPrevue: charge.successeur.date_debut_prevue ?? null,
    },
    respectee: charge.respectee ?? null,
  };
}

/** Supprime logiquement une dépendance entre deux tâches. */
export async function supprimerDependance(dependanceId: string): Promise<void> {
  await api.supprimer(`/dependances/${dependanceId}/`);
}

/** Extrait la liste des successeurs à décaler lorsqu'une reprogrammation lève `successeurs_a_decaler`. */
export function successeursADecalerRequis(erreur: unknown): SuccesseurADecaler[] | null {
  if (!(erreur instanceof ErreurApi) || erreur.code !== "successeurs_a_decaler") return null;
  const details = erreur.details as unknown as { successeurs?: ChargeSuccesseurDecalage[] };
  return (details.successeurs ?? []).map((item) => ({
    id: item.id,
    libelle: item.libelle,
    dateDebutAvant: item.date_debut_avant ?? null,
    dateFinAvant: item.date_fin_avant ?? null,
    dateDebutApres: item.date_debut_apres ?? null,
    dateFinApres: item.date_fin_apres ?? null,
    jours: item.jours ?? 0,
  }));
}

/** Reprogramme les dates prévisionnelles d'une case (avec confirmation optionnelle de prolongation et décalage). */
export async function reprogrammerTacheGantt(
  elementId: string,
  saisie: SaisieReprogrammationGantt,
): Promise<ResultatReprogrammationGantt> {
  const corps: Record<string, unknown> = {
    date_debut_prevue: saisie.dateDebutPrevue || undefined,
    date_fin_prevue: saisie.dateFinPrevue,
    motif_id: saisie.motifId,
    justification: saisie.justification,
    prolonger: saisie.prolonger ?? false,
  };
  if (saisie.decalerSuccesseurs !== undefined) {
    corps.decaler_successeurs = saisie.decalerSuccesseurs;
  }
  const charge = await api.creer<{
    date_debut_prevue?: string | null;
    date_fin_prevue: string;
    alerte_dg?: boolean;
  }>(`/elements/${elementId}/reprogrammer/`, corps);
  return {
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue,
    alerteDg: charge.alerte_dg ?? false,
  };
}

/** Analyse un export XML MS Project sans rien écrire en base et renvoie l'aperçu complet. */
export async function analyserImportMsProject(
  projetId: string,
  fichier: File,
): Promise<AnalyseMsProject> {
  const corps = new FormData();
  corps.append("fichier", fichier, fichier.name);
  const charge = await api.creer<ChargeAnalyseMsProject>(
    `/projets/${projetId}/planning/ms-project/analyser/`,
    corps,
  );
  return {
    etatImport: versEtatImport(charge.etat_import),
    projetXml: {
      titre: charge.projet_xml?.titre ?? null,
      dateDebut: charge.projet_xml?.date_debut ?? null,
      dateFin: charge.projet_xml?.date_fin ?? null,
    },
    niveaux: (charge.niveaux ?? []).map(versNiveauMsProject),
    taches: (charge.taches ?? []).map(versTacheMsProject),
    dependances: (charge.dependances ?? []).map(versDependanceMsProject),
    statistiques: {
      totalTaches: charge.statistiques?.total_taches ?? 0,
      feuilles: charge.statistiques?.feuilles ?? 0,
      jalons: charge.statistiques?.jalons ?? 0,
      dependancesRetenues: charge.statistiques?.dependances_retenues ?? 0,
      dependancesIgnorees: charge.statistiques?.dependances_ignorees ?? 0,
    },
    avertissements: (charge.avertissements ?? []).map(versAvertissement),
  };
}

/** Exécute l'import définitif d'un fichier XML MS Project dans le découpage et le planning du projet. */
export async function importerMsProject(
  projetId: string,
  fichier: File,
  confirmerRemplacement: boolean,
): Promise<ResultatImportMsProject> {
  const corps = new FormData();
  corps.append("fichier", fichier, fichier.name);
  corps.append("confirmer_remplacement", confirmerRemplacement ? "true" : "false");
  const charge = await api.creer<ChargeResultatImportMsProject>(
    `/projets/${projetId}/planning/ms-project/importer/`,
    corps,
  );
  return {
    elementsCrees: charge.elements_crees ?? 0,
    niveauxCrees: charge.niveaux_crees ?? 0,
    dependancesCreees: charge.dependances_creees ?? 0,
    remplacementEffectue: charge.remplacement_effectue ?? false,
    avertissements: (charge.avertissements ?? []).map(versAvertissement),
    planning: versPlanningGantt(charge.planning),
  };
}
