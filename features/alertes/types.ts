/**
 * Les types du domaine Alertes de retard — SFD F3 §5.4 et §10.
 *
 * Une alerte naît d'un écart entre l'avancement temporel et l'avancement réel
 * d'un lot (ou de la santé du projet entier, quand elle ne porte sur aucun lot).
 * Ces types disent ce que l'écran manipule ; la forme du serveur, elle, reste
 * dans `adaptateur.ts`.
 */

/** La gravité du retard : de quoi dépend la liste des destinataires, côté serveur. */
export type NiveauAlerte = "MODERE" | "ELEVE" | "CRITIQUE";

/** Le cycle de vie : une alerte s'ouvre, passe en cours, puis se résout ou s'ignore. */
export type StatutAlerte = "OUVERTE" | "EN_COURS" | "RESOLUE" | "IGNOREE";

/**
 * Le filtre d'état de l'écran : un statut précis, ou « ouvertes » — qui réunit
 * `OUVERTE` et `EN_COURS`, les deux états où l'alerte attend encore quelqu'un.
 */
export type FiltreEtatAlerte = "OUVERTES" | StatutAlerte;

/** Le ton d'une pastille : les deux teintes de la charte qu'un niveau peut prendre. */
export type TonAlerte = "avertissement" | "erreur";

/** Le ton de la pastille d'état : où en est l'alerte, pas sa gravité. */
export type TonStatutAlerte = "information" | "primaire" | "succes" | "neutre";

export interface ProjetAlerte {
  id: string;
  reference: string;
  nom: string;
}

export interface LotAlerte {
  id: string;
  code: string;
  libelle: string;
}

/** Ce que le serveur a relevé sur les sept derniers jours du chantier. */
export interface CausesAlerte {
  /** Le total des écarts entre l'effectif prévu et l'effectif présent. */
  absences: number;
  /** Le titre de chaque blocage encore ouvert ou pris en charge. */
  blocagesOuverts: string[];
  /** Le nombre d'incidents déclarés aux rapports journaliers. */
  incidents: number;
}

export interface AlerteRetard {
  id: string;
  projet: ProjetAlerte;
  /** `null` : une alerte de niveau projet, qui ne porte sur aucun lot. */
  lot: LotAlerte | null;
  niveau: NiveauAlerte;
  /** Les points d'avancement perdus sur l'avancement temporel ; `null` s'il n'est pas calculé. */
  deltaPts: number | null;
  indiceSante: number | null;
  /** Une date ISO courte (`2026-10-14`). */
  dateDetection: string;
  statut: StatutAlerte;
  causes: CausesAlerte;
  actionsRecommandees: string[];
  /** Vide tant que l'alerte n'est pas résolue. */
  commentaireResolution: string;
  /** Le nom complet de la personne qui a clôturé l'alerte. */
  resoluePar: string | null;
  resolueLe: string | null;
}
