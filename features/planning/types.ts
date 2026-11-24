/**
 * Types du domaine Planning (diagramme de Gantt & import MS Project `.xml`).
 *
 * Toutes les formes de transport (`snake_case`) restent privées dans `adaptateur.ts`.
 */

/** Niveau de visibilité d'une case dans le périmètre de la personne connectée. */
export type AccesCasePlanning = "COMPLET" | "CHEMIN";

/** Mode de mesure d'une tâche feuille dans le découpage. */
export type ModeMesurePlanning = "QUANTITE" | "POURCENTAGE" | "JALON";

/** Échelle temporelle disponible pour le zoom du diagramme de Gantt. */
export type EchelleGantt = "JOUR" | "SEMAINE" | "MOIS" | "TRIMESTRE";

/** État d'éligibilité du projet à l'import d'un planning MS Project `.xml`. */
export interface EtatImportMsProject {
  autorise: boolean;
  decoupageExistant: boolean;
  remplacementRequis: boolean;
  motifBlocage: string | null;
}

/** Une case (parent ou tâche feuille) dans l'arbre du planning. */
export interface CasePlanning {
  id: string;
  libelle: string;
  numero: string | null;
  niveau: string | null;
  /** Dates contractuelles (baseline si complète, sinon prévues). */
  debut: string | null;
  fin: string | null;
  /** Dates prévues courantes (après éventuelles reprogrammations). */
  debutPrevu: string | null;
  finPrevue: string | null;
  /** Dates d'origine (baseline). */
  debutBaseline: string | null;
  finBaseline: string | null;
  /** Avancement physique en pourcentage (0 à 100), ou `null` si non calculable. */
  avancement: number | null;
  /** Avancement temporel théorique en pourcentage (0 à 100), ou `null`. */
  avancementTemporel: number | null;
  /** Écart temporel − physique en points de pourcentage (> 0 : retard). */
  deltaRetard: number | null;
  statut: string;
  acces: AccesCasePlanning;
  estFeuille: boolean;
  modeMesure: ModeMesurePlanning | null;
  enfants: CasePlanning[];
}

/** Une dépendance Fin → Début entre deux tâches feuilles du planning. */
export interface DependancePlanning {
  id: string;
  predecesseurId: string;
  successeurId: string;
  /** `false` si le successeur démarre avant la fin du prédécesseur ; `null` si une date manque. */
  respectee: boolean | null;
}

/** Réponse complète du planning Gantt d'un projet (`GET /projets/{id}/planning/`). */
export interface PlanningGantt {
  aujourdhui: string;
  projetDebut: string | null;
  projetFin: string | null;
  importMsProject: EtatImportMsProject;
  cases: CasePlanning[];
  dependances: DependancePlanning[];
}

/* ------------------------------------------------------------------ *
 * Dépendances détaillées d'un élément (`GET/POST /elements/{id}/dependances/`).
 * ------------------------------------------------------------------ */

export interface LienCaseElement {
  lienId: string;
  id: string;
  visible: boolean;
  libelle: string | null;
  dateDebutPrevue: string | null;
  dateFinPrevue: string | null;
  respectee: boolean | null;
}

export interface DependancesElement {
  elementId: string;
  predecesseurs: LienCaseElement[];
  successeurs: LienCaseElement[];
}

export interface LienDependanceCree {
  id: string;
  predecesseur: {
    id: string;
    libelle: string;
    dateFinPrevue: string | null;
  };
  successeur: {
    id: string;
    libelle: string;
    dateDebutPrevue: string | null;
  };
  respectee: boolean | null;
}

/* ------------------------------------------------------------------ *
 * Import MS Project `.xml` (analyse & import définitif).
 * ------------------------------------------------------------------ */

export interface AvertissementMsProject {
  code: string;
  message: string;
}

export interface ProjetXmlApercu {
  titre: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface NiveauMsProject {
  ordre: number;
  libelle: string;
}

export interface TacheMsProject {
  uid: string;
  numero: string | null;
  libelle: string;
  niveauOrdre: number;
  niveau: string | null;
  debut: string | null;
  fin: string | null;
  dureeHeures: number | null;
  estJalon: boolean;
  estFeuille: boolean;
  pourcentageXml: number | null;
  enfants: TacheMsProject[];
}

export interface DependanceMsProject {
  predecesseurUid: string;
  predecesseurLibelle: string;
  successeurUid: string;
  successeurLibelle: string;
  type: string;
  respectee: boolean | null;
}

export interface StatistiquesMsProject {
  totalTaches: number;
  feuilles: number;
  jalons: number;
  dependancesRetenues: number;
  dependancesIgnorees: number;
}

export interface AnalyseMsProject {
  etatImport: EtatImportMsProject;
  projetXml: ProjetXmlApercu;
  niveaux: NiveauMsProject[];
  taches: TacheMsProject[];
  dependances: DependanceMsProject[];
  statistiques: StatistiquesMsProject;
  avertissements: AvertissementMsProject[];
}

export interface ResultatImportMsProject {
  elementsCrees: number;
  niveauxCrees: number;
  dependancesCreees: number;
  remplacementEffectue: boolean;
  avertissements: AvertissementMsProject[];
  planning: PlanningGantt;
}

/* ------------------------------------------------------------------ *
 * Types calculés pour le rendu et l'export du Gantt (`regles.ts`).
 * ------------------------------------------------------------------ */

export interface LigneGantt {
  caseItem: CasePlanning;
  profondeur: number;
  aEnfants: boolean;
  depliee: boolean;
  estJalon: boolean;
  estEnRetard: boolean;
  indexLigne: number;
}

export interface BornesGantt {
  debutIso: string;
  finIso: string;
  totalJours: number;
  largeurJourPx: number;
  largeurTotalePx: number;
}

export interface GroupeGraduationGantt {
  cle: string;
  libelle: string;
  x: number;
  largeur: number;
}

export interface GraduationGantt {
  cle: string;
  libelle: string;
  sousLibelle?: string;
  x: number;
  largeur: number;
  estWeekEnd?: boolean;
}

export interface GeometrieBarreGantt {
  x: number;
  largeur: number;
  estJalon: boolean;
  debutIso: string;
  finIso: string;
  xDebutBaseline: number | null;
  largeurBaseline: number | null;
  xMarqueurTheorique: number | null;
  largeurAvancement: number;
}

export interface FlecheGantt {
  id: string;
  predecesseurId: string;
  successeurId: string;
  cheminSvg: string;
  respectee: boolean | null;
}

export interface IndicateursPlanning {
  totalCases: number;
  totalFeuilles: number;
  feuillesPlanifiees: number;
  feuillesEnRetard: number;
  feuillesTerminees: number;
  jalons: number;
  dependancesTotal: number;
  dependancesNonRespectees: number;
  dateDebutMin: string | null;
  dateFinMax: string | null;
}

export type TypeLigneExportPlanning = "PARENT" | "FEUILLE" | "JALON";

export interface LigneExportPlanning {
  numero: string;
  libelle: string;
  niveau: string;
  statut: string;
  type: TypeLigneExportPlanning;
  debut: string;
  fin: string;
  debutBaseline: string;
  finBaseline: string;
  avancement: number | null;
  avancementTemporel: number | null;
  deltaRetard: number | null;
}
