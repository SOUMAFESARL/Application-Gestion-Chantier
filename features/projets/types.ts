/**
 * Les types du domaine Projets — plan de refonte, lot 4, couche 1.
 *
 * **Aucun type HTTP ici.** Ce que le serveur envoie (`budget_initial_montant`,
 * `avancement_theorique`, des dates en chaîne) est la forme d'un transport,
 * pas celle du métier : elle change quand le serveur change, et un écran qui
 * la connaît change avec lui. La traduction se fait une seule fois, dans
 * `adaptateur.ts`, et c'est le seul fichier du domaine à savoir que le
 * serveur parle en `snake_case`.
 *
 * Les montants restent en **centimes**, entiers, comme côté serveur : c'est
 * l'unité dans laquelle on peut additionner sans perdre un franc. Le passage
 * en francs est un acte d'affichage, et il appartient à `lib/format`.
 */

/** L'état d'un chantier, tel que le serveur le nomme. */
export type StatutProjet =
  | "EN_ATTENTE"
  | "EN_COURS"
  | "EN_RETARD"
  | "CRITIQUE"
  | "SUSPENDU"
  | "TERMINE"
  | "ARCHIVE";

/** Un chef de projet ou un conducteur de travaux, vu depuis une fiche. */
export interface Intervenant {
  id: string;
  nom: string;
  prenom: string;
  nomComplet: string;
  email: string;
  telephone: string;
  /** `INVITE` tant que la personne n'a pas activé son compte. */
  statut: "INVITE" | "ACTIF" | null;
  /**
   * Le lien WhatsApp est **construit par le serveur**, qui connaît le format
   * attendu par l'opérateur du pays. On ne le recalcule pas ici ; on se
   * contente d'un repli quand le serveur ne l'a pas fourni.
   */
  lienWhatsApp: string | null;
}

/** Le maître d'ouvrage, tel qu'il apparaît sur la fiche chantier. */
export interface ClientProjet {
  id: string;
  raisonSociale: string;
  telephone: string | null;
  email: string | null;
  ville: string | null;
}

/**
 * Un chantier dans son détail.
 *
 * `budgetInitial` est `null` quand le budget n'a **pas encore été défini** —
 * ce qui n'est pas la même chose que zéro, et l'interface doit les distinguer
 * (voir `ABSENT` dans `lib/format`).
 */
export interface Projet {
  id: string;
  reference: string;
  nom: string;
  description: string;
  /** `null` pour un projet ouvert avant que le type ne soit demandé. */
  typeProjet: TypeProjet | null;
  client: ClientProjet;
  ville: string;
  quartier: string;
  statut: StatutProjet;
  /** Un pourcentage, de 0 à 100. */
  avancementReel: number;
  /** Un pourcentage, de 0 à 100. */
  avancementTheorique: number;
  /** L'indice de santé calculé par le serveur, de 0 à 100. `null` : pas encore calculé. */
  indiceSante: number | null;
  /** En centimes. `null` tant que le budget n'est pas défini. */
  budgetInitial: number | null;
  /** En centimes. */
  budgetConsomme: number;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  dateDebutReelle: string | null;
  dateFinReelle: string | null;
  chefProjet: Intervenant | null;
  conducteurTravaux: Intervenant | null;
}

/** La nature d'un projet, choisie à sa création. */
export type TypeProjet =
  | "BATIMENT_RESIDENTIEL"
  | "BATIMENT_TERTIAIRE"
  | "INDUSTRIEL"
  | "GENIE_CIVIL"
  | "VRD"
  | "REHABILITATION"
  | "AUTRE";

/** Qui exécute un lot : l'entreprise elle-même, ou un sous-traitant. */
export type ModeExecutionLot =
  | "REGIE_DIRECTE"
  | "SOUS_TRAITANCE_STRUCTUREE"
  | "SOUS_TRAITANCE_INFORMELLE";

/** Comment le lot est rémunéré. */
export type TypeBordereau = "FORFAIT_GLOBAL" | "PRIX_UNITAIRE";

/** Un lot déclaré à la création du projet — ses activités viennent après. */
export interface CreationLot {
  /** `L-01`, `L-02`… : l'ordre de saisie. */
  numero: string;
  nom: string;
  modeExecution: ModeExecutionLot;
  typeBordereau: TypeBordereau;
  dateDebut?: string;
  dateFin?: string;
}

/** Les affectations de l'équipe projet, par identifiant de collaborateur. */
export interface EquipeProjet {
  chefProjetId: string;
  conducteurTravauxId: string;
  /** Au moins un. */
  chefsChantierIds: string[];
  directeurFinancierId?: string;
  visiteursIds: string[];
  bailleursIds: string[];
}

/** Ce qu'il faut fournir pour ouvrir un projet — les trois étapes du tiroir. */
export interface CreationProjet {
  nom: string;
  /** Absente : le serveur engendre la référence. */
  reference?: string;
  typeProjet: TypeProjet;
  ville: string;
  /** Le maître d'ouvrage, en clair : entreprise ou particulier. */
  maitreOuvrage: string;
  maitreOeuvre?: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  /** En centimes. */
  budgetInitial: number;
  description?: string;
  lots: CreationLot[];
  equipe: EquipeProjet;
}

/** La portée d'un relevé météo : l'entreprise, ou un chantier précis. */
export type PorteeMeteo = "ENTREPRISE" | "CHANTIER";

export type ConditionMeteo =
  | "DEGAGE"
  | "ECLAIRCIES"
  | "NUAGEUX"
  | "COUVERT"
  | "BROUILLARD"
  | "BRUINE"
  | "PLUIE"
  | "AVERSES"
  | "ORAGE"
  | "VARIABLE";

export type AlerteMeteo = "VIGILANCE_PLUIE" | "INTEMPERIES" | "ORAGE";

/**
 * Pourquoi la météo manque. C'est un **code**, pas une phrase : l'écran en
 * tire une consigne (« renseigner la ville »), ce qu'un message serveur
 * reformulé ne permettrait plus.
 */
export type RaisonMeteoIndisponible =
  | "VILLE_ABSENTE"
  | "PAYS_NON_COUVERT"
  | "VILLE_INCONNUE"
  | "SERVICE_INDISPONIBLE";

/**
 * Une alerte intempéries sur un chantier.
 *
 * `ville` et `condition` sont facultatives parce que le serveur les renvoie
 * selon l'origine de l'alerte — le relevé d'un chantier les porte, l'alerte
 * agrégée du portefeuille non. L'écran comble le manque avec la météo
 * courante, ce qu'il ne pourrait pas faire si le type les exigeait.
 */
export interface AlerteIntemperies {
  projet: string;
  description: string;
  ville: string | null;
  condition: ConditionMeteo | string | null;
}

export interface MeteoProjet {
  disponible: boolean;
  ville: string;
  temperature: number | null;
  portee: PorteeMeteo | null;
  condition: ConditionMeteo | string | null;
  codeWmo: number | null;
  /** Le chantier peut-il tourner aujourd'hui. */
  praticable: boolean;
  alerte: AlerteMeteo | string | null;
  releveLe: string | null;
  raison: RaisonMeteoIndisponible | string | null;
  description: string;
  alerteIntemperies: AlerteIntemperies | null;
}
