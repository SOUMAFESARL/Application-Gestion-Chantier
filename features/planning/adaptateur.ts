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
import { UNITE_AVANCEMENT } from "@/lib/format";

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
  OptionsAjoutDependance,
  OptionsImportMsProject,
  PlanningGantt,
  ResultatImportMsProject,
  TacheMsProject,
  TypeDependance,
} from "./types";

/* ------------------------------------------------------------------ *
 * Charges de transport (`snake_case`, privées au fichier).
 * ------------------------------------------------------------------ */

interface ChargeEtatImportMsProject {
  autorise?: boolean;
  decoupage_existant?: boolean;
  remplacement_requis?: boolean;
  motif_blocage?: string | null;
  peut_voir_montants?: boolean;
  peut_chiffrer?: boolean;
}

interface ChargeCasePlanning {
  id: string;
  libelle: string;
  code?: string | null;
  numero?: string | null;
  niveau?: string | null;
  montant?: number | string | null;
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
  type_lien?: string | null;
  decalage_jours?: number | string | null;
  respectee?: boolean | null;
}

interface ChargePlanningGantt {
  aujourdhui: string;
  projet_debut?: string | null;
  projet_fin?: string | null;
  unite_avancement?: string | null;
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
  type_lien?: string | null;
  decalage_jours?: number | string | null;
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
  type_lien?: string | null;
  decalage_jours?: number | string | null;
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
  code?: string | null;
  libelle: string;
  niveau_ordre: number;
  niveau?: string | null;
  debut?: string | null;
  fin?: string | null;
  debut_baseline?: string | null;
  fin_baseline?: string | null;
  duree_heures?: number | string | null;
  est_jalon?: boolean;
  est_feuille?: boolean;
  est_actif?: boolean;
  pourcentage_xml?: number | string | null;
  cout_brut?: number | string | null;
  cout_fcfa?: number | string | null;
  enfants?: ChargeTacheMsProject[];
}

interface ChargeDependanceMsProject {
  predecesseur_uid: string;
  predecesseur_libelle: string;
  successeur_uid: string;
  successeur_libelle: string;
  type?: string | null;
  decalage_jours?: number | string | null;
  respectee?: boolean | null;
}

interface ChargeStatistiquesMsProject {
  total_taches?: number;
  feuilles?: number;
  jalons?: number;
  inactives?: number;
  taches_chiffrees?: number;
  dependances_retenues?: number;
  dependances_ignorees?: number;
}

interface ChargeAnalyseMsProject {
  etat_import?: ChargeEtatImportMsProject | null;
  projet_xml?: {
    titre?: string | null;
    date_debut?: string | null;
    date_fin?: string | null;
    date_debut_baseline?: string | null;
    date_fin_baseline?: string | null;
    devise_code?: string | null;
    devise_symbole?: string | null;
    taux_conversion_suggere?: number | string | null;
    cout_total_brut?: number | string | null;
    cout_total_fcfa?: number | string | null;
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
  inactives_creees?: number;
  montants_importes?: boolean;
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
const TYPES_DEPENDANCE_VALIDES: readonly TypeDependance[] = ["FS", "SS", "FF", "SF"];

function versNombre(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(nombre) ? nombre : null;
}

function versEntier(valeur: number | string | null | undefined, defaut = 0): number {
  const nombre = versNombre(valeur);
  return nombre === null ? defaut : Math.trunc(nombre);
}

function versModeMesure(valeur: string | null | undefined): ModeMesurePlanning | null {
  return (MODES_MESURE_VALIDES as readonly string[]).includes(valeur ?? "")
    ? (valeur as ModeMesurePlanning)
    : null;
}

function versTypeDependance(valeur: string | null | undefined): TypeDependance {
  const normalise = (valeur ?? "").trim().toUpperCase();
  return (TYPES_DEPENDANCE_VALIDES as readonly string[]).includes(normalise)
    ? (normalise as TypeDependance)
    : "FS";
}

function versEtatImport(charge: ChargeEtatImportMsProject | null | undefined): EtatImportMsProject {
  return {
    autorise: charge?.autorise ?? false,
    decoupageExistant: charge?.decoupage_existant ?? false,
    remplacementRequis: charge?.remplacement_requis ?? false,
    motifBlocage: charge?.motif_blocage ?? null,
    peutVoirMontants: charge?.peut_voir_montants ?? false,
    peutChiffrer: charge?.peut_chiffrer ?? false,
  };
}

function versCasePlanning(charge: ChargeCasePlanning): CasePlanning {
  const enfants = (charge.enfants ?? []).map(versCasePlanning);
  const debut = charge.debut ?? null;
  const fin = charge.fin ?? null;
  return {
    id: charge.id,
    libelle: charge.libelle,
    code: charge.code ?? "",
    numero: charge.numero ?? null,
    niveau: charge.niveau ?? null,
    montant: versNombre(charge.montant),
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
    typeLien: versTypeDependance(charge.type_lien),
    decalageJours: versEntier(charge.decalage_jours, 0),
    respectee: charge.respectee ?? null,
  };
}

function versPlanningGantt(charge: ChargePlanningGantt): PlanningGantt {
  return {
    aujourdhui: charge.aujourdhui,
    projetDebut: charge.projet_debut ?? null,
    projetFin: charge.projet_fin ?? null,
    uniteAvancement: charge.unite_avancement ?? UNITE_AVANCEMENT,
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
    typeLien: versTypeDependance(charge.type_lien),
    decalageJours: versEntier(charge.decalage_jours, 0),
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
    code: charge.code ?? "",
    libelle: charge.libelle,
    niveauOrdre: charge.niveau_ordre,
    niveau: charge.niveau ?? null,
    debut: charge.debut ?? null,
    fin: charge.fin ?? null,
    debutBaseline: charge.debut_baseline ?? null,
    finBaseline: charge.fin_baseline ?? null,
    dureeHeures: versNombre(charge.duree_heures),
    estJalon: charge.est_jalon ?? false,
    estFeuille: charge.est_feuille ?? enfants.length === 0,
    estActif: charge.est_actif ?? true,
    pourcentageXml: versNombre(charge.pourcentage_xml),
    coutBrut: versNombre(charge.cout_brut),
    coutFcfa: versNombre(charge.cout_fcfa),
    enfants,
  };
}

function versDependanceMsProject(charge: ChargeDependanceMsProject): DependanceMsProject {
  return {
    predecesseurUid: charge.predecesseur_uid,
    predecesseurLibelle: charge.predecesseur_libelle,
    successeurUid: charge.successeur_uid,
    successeurLibelle: charge.successeur_libelle,
    type: versTypeDependance(charge.type),
    decalageJours: versEntier(charge.decalage_jours, 0),
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

/** Crée une dépendance typée (FS/SS/FF/SF) avec décalage signé entre deux tâches feuilles. */
export async function ajouterDependanceElement(
  elementId: string,
  predecesseurId: string,
  options?: OptionsAjoutDependance,
): Promise<LienDependanceCree> {
  const charge = await api.creer<ChargeLienDependanceCree>(
    `/elements/${elementId}/dependances/`,
    {
      predecesseur_id: predecesseurId,
      type_lien: options?.typeLien ?? "FS",
      decalage_jours: options?.decalageJours ?? 0,
    },
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
    typeLien: versTypeDependance(charge.type_lien),
    decalageJours: versEntier(charge.decalage_jours, 0),
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
      dateDebutBaseline: charge.projet_xml?.date_debut_baseline ?? null,
      dateFinBaseline: charge.projet_xml?.date_fin_baseline ?? null,
      deviseCode: charge.projet_xml?.devise_code?.trim().toUpperCase() || "XOF",
      deviseSymbole: charge.projet_xml?.devise_symbole?.trim() || "FCFA",
      tauxConversionSuggere: versNombre(charge.projet_xml?.taux_conversion_suggere),
      coutTotalBrut: versNombre(charge.projet_xml?.cout_total_brut),
      coutTotalFcfa: versNombre(charge.projet_xml?.cout_total_fcfa),
    },
    niveaux: (charge.niveaux ?? []).map(versNiveauMsProject),
    taches: (charge.taches ?? []).map(versTacheMsProject),
    dependances: (charge.dependances ?? []).map(versDependanceMsProject),
    statistiques: {
      totalTaches: charge.statistiques?.total_taches ?? 0,
      feuilles: charge.statistiques?.feuilles ?? 0,
      jalons: charge.statistiques?.jalons ?? 0,
      inactives: charge.statistiques?.inactives ?? 0,
      tachesChiffrees: charge.statistiques?.taches_chiffrees ?? 0,
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
  options: boolean | OptionsImportMsProject,
): Promise<ResultatImportMsProject> {
  const parametres: OptionsImportMsProject =
    typeof options === "boolean" ? { confirmerRemplacement: options } : options;
  const corps = new FormData();
  corps.append("fichier", fichier, fichier.name);
  corps.append("confirmer_remplacement", parametres.confirmerRemplacement ? "true" : "false");
  if (parametres.importerMontants !== undefined) {
    corps.append("importer_montants", parametres.importerMontants ? "true" : "false");
  }
  if (
    parametres.tauxConversion !== undefined &&
    Number.isFinite(parametres.tauxConversion) &&
    parametres.tauxConversion > 0
  ) {
    corps.append("taux_conversion", String(parametres.tauxConversion));
  }
  const charge = await api.creer<ChargeResultatImportMsProject>(
    `/projets/${projetId}/planning/ms-project/importer/`,
    corps,
  );
  return {
    elementsCrees: charge.elements_crees ?? 0,
    niveauxCrees: charge.niveaux_crees ?? 0,
    dependancesCreees: charge.dependances_creees ?? 0,
    inactivesCreees: charge.inactives_creees ?? 0,
    montantsImportes: charge.montants_importes ?? false,
    remplacementEffectue: charge.remplacement_effectue ?? false,
    avertissements: (charge.avertissements ?? []).map(versAvertissement),
    planning: versPlanningGantt(charge.planning),
  };
}
