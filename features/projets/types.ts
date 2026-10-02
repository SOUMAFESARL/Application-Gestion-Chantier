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
  /** `null` tant que le planning contractuel n'est pas fixé : il ne se demande plus à la création. */
  dateDebutPrevue: string | null;
  dateFinPrevue: string | null;
  dateDebutReelle: string | null;
  dateFinReelle: string | null;
  /** Le maître d'œuvre, en clair. `null` : pas de maîtrise d'œuvre désignée. */
  maitreOeuvre: string | null;
  /**
   * L'équipe d'encadrement et de gestion du projet. Vide à la création : le
   * DG désigne le chef de projet depuis la fiche, et l'équipe se complète
   * ensuite.
   */
  chefProjet: Intervenant | null;
  conducteursTravaux: Intervenant[];
  chefsChantier: ChefChantierProjet[];
  autresMembres: AutreMembreProjet[];
}

/**
 * La place qu'un collaborateur tient dans l'équipe d'encadrement et de
 * gestion d'un projet. Un seul chef de projet ; les autres places en
 * acceptent plusieurs.
 */
export type FonctionProjet =
  | "CHEF_PROJET"
  | "CONDUCTEUR_TRAVAUX"
  | "CHEF_CHANTIER"
  | "AUTRE_MEMBRE";

/** Ce que fait un « autre membre » de l'encadrement. */
export type FonctionAutreMembre =
  | "FINANCIER"
  | "INGENIEUR"
  | "DOCUMENTALISTE"
  | "METREUR"
  | "QHSE"
  | "AUTRE";

/** Un chef de chantier, et la zone ou le lot dont il a la charge s'il est précisé. */
export interface ChefChantierProjet {
  intervenant: Intervenant;
  /** « Lot 02 — Gros œuvre », « Bâtiment B »… `null` : tout le chantier. */
  zone: string | null;
}

/** Un autre membre de l'encadrement — financier, ingénieur, documentaliste… */
export interface AutreMembreProjet {
  intervenant: Intervenant;
  fonction: FonctionAutreMembre;
}

/**
 * L'arrivée d'une personne dans l'équipe d'encadrement. `intervenant` vient
 * de la liste des utilisateurs du compte : le serveur n'en lit que l'`id`.
 * Désigner un chef de projet remplace le précédent.
 */
export type AjoutEncadrement =
  | { fonction: "CHEF_PROJET" | "CONDUCTEUR_TRAVAUX"; intervenant: Intervenant }
  | { fonction: "CHEF_CHANTIER"; intervenant: Intervenant; zone: string | null }
  | { fonction: "AUTRE_MEMBRE"; intervenant: Intervenant; fonctionMembre: FonctionAutreMembre };

/** Le planning contractuel, fixé par le chef de projet après la création. */
export interface PlanningProjet {
  dateDebutPrevue: string;
  dateFinPrevue: string;
}

/** Un chantier attribué à un collaborateur, et ce qu'il y fait. */
export interface AffectationProjet {
  projet: Projet;
  /** Au moins une : un chef de projet peut aussi y conduire les travaux. */
  fonctions: FonctionProjet[];
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

/**
 * Ce qu'il faut fournir pour ouvrir un projet — son identification.
 * Ni planning, ni budget, ni lots, ni équipe : ils se fixent ensuite, depuis
 * le projet ouvert.
 */
export interface CreationProjet {
  nom: string;
  /** Absente : le serveur engendre la référence. */
  reference?: string;
  typeProjet: TypeProjet;
  ville: string;
  /** Le maître d'ouvrage, en clair : entreprise ou particulier. */
  maitreOuvrage: string;
  maitreOeuvre?: string;
  /** Facultatifs à la création : absents, le chef de projet les fixe ensuite. */
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
  /** En centimes. */
  budgetInitial?: number;
  description?: string;
  /** Le contrat du marché et ses avenants, en PDF. */
  contrats?: File[];
}

/**
 * Ce que la modification d'un projet peut changer.
 *
 * La même identification que la création, référence exceptée (unique,
 * engendrée à la création). La modification est un `PATCH` : le planning, le
 * budget, les lots et l'équipe, qu'elle ne renvoie pas, restent inchangés.
 */
export interface ModificationProjet {
  nom: string;
  typeProjet: TypeProjet;
  ville: string;
  maitreOuvrage: string;
  maitreOeuvre?: string;
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

/* ------------------------------------------------------------------ *
 * Lots et activités — la structure d'un chantier.
 * ------------------------------------------------------------------ */

/**
 * L'unité dans laquelle une activité se mesure. Liste fermée : une quantité
 * se cumule d'un rapport journalier à l'autre, ce qu'une unité saisie en
 * clair (« m2 », « m² », « M2 ») ne permettrait plus.
 */
export type UniteActivite = "M" | "ML" | "M2" | "M3" | "KG" | "T" | "U" | "ENS" | "FFT";

/**
 * L'état d'une activité. Il est **calculé** (voir `statutActivite` dans
 * `regles.ts`) à partir des dates et de l'avancement, jamais saisi : une
 * activité ne se déclare pas « en retard », elle l'est.
 */
export type StatutActivite = "A_VENIR" | "EN_COURS" | "EN_RETARD" | "TERMINE";

/** Une équipe de chantier, telle qu'on l'affecte à une activité. */
export interface EquipeChantier {
  id: string;
  nom: string;
  /** Le nombre de personnes de l'équipe. */
  effectif: number;
}

/** Qui compose une équipe : des salariés de l'entreprise, ou un sous-traitant. */
export type NatureEquipe = "INTERNE" | "SOUS_TRAITANT";

/**
 * La place d'une personne dans son équipe. `CHEF_EQUIPE` n'appartient qu'au
 * chef (`Equipe.chef`) : une équipe n'en a qu'un.
 */
export type RoleMembreEquipe =
  | "CHEF_EQUIPE"
  | "OUVRIER_QUALIFIE"
  | "OUVRIER"
  | "MANOEUVRE"
  | "CONDUCTEUR_ENGIN"
  | "APPRENTI";

/** Une personne d'une équipe de chantier. */
export interface MembreEquipe {
  id: string;
  prenom: string;
  nom: string;
  role: RoleMembreEquipe;
  /**
   * Le collaborateur de l'entreprise que cette personne est, s'il en est un.
   * `null` : une personne saisie sur le chantier, sans compte — un ouvrier
   * journalier, le compagnon d'un sous-traitant.
   */
  collaborateurId: string | null;
}

/** Une personne à ajouter à une équipe : l'identifiant vient du serveur. */
export type SaisieMembreEquipe = Omit<MembreEquipe, "id">;

/**
 * Une équipe constituée sur un chantier, dans son détail.
 *
 * Elle prolonge `EquipeChantier` — la forme courte qu'une activité porte —
 * sans la remplacer : une activité n'a besoin que du nom et de l'effectif de
 * son équipe, pas de la liste de ses membres. `effectif` compte le chef.
 */
export interface Equipe extends EquipeChantier {
  projetId: string;
  nature: NatureEquipe;
  /** Le corps d'état : « Maçonnerie / coffrage », « Électricité »… */
  specialite: string;
  /** `null` : chef d'équipe pas encore désigné. */
  chef: MembreEquipe | null;
  /** Les autres membres, chef exclu. */
  membres: MembreEquipe[];
}

/** Ce qu'il faut fournir pour constituer une équipe sur un chantier. */
export interface CreationEquipe {
  nom: string;
  nature: NatureEquipe;
  specialite: string;
  chef: SaisieMembreEquipe;
  membres: SaisieMembreEquipe[];
}

/** Une tâche mesurable du chantier, rattachée à un lot. */
export interface Activite {
  id: string;
  lotId: string;
  /** `03.02` : le code du lot, puis le rang de l'activité dans le lot. */
  code: string;
  libelle: string;
  /** `null` : activité suivie au pourcentage, sans quantité. */
  quantitePrevue: number | null;
  unite: UniteActivite | null;
  /** `null` : activité pas encore planifiée — les dates se fixent plus tard. */
  dateDebutPrevue: string | null;
  dateFinPrevue: string | null;
  /** Un pourcentage, de 0 à 100, alimenté par le journal de chantier. */
  avancement: number;
  /** Calculé par le serveur à partir des dépendances. */
  surCheminCritique: boolean;
  /** L'activité qui doit être terminée avant que celle-ci commence. */
  dependanceId: string | null;
  /** `null` : équipe encore à affecter. */
  equipe: EquipeChantier | null;
}

/** Un lot d'un chantier, avec ses activités. */
export interface Lot {
  id: string;
  projetId: string;
  /** `03` : l'ordre du lot dans le chantier. */
  code: string;
  nom: string;
  modeExecution: ModeExecutionLot;
  typeBordereau: TypeBordereau;
  /**
   * En centimes. `null` tant qu'il n'est pas défini. Le budget se tient au
   * lot — c'est l'unité du marché —, pas à l'activité.
   */
  budget: number | null;
  /** Les dates saisies sur le lot ; celles de ses activités priment à l'affichage. */
  dateDebut: string | null;
  dateFin: string | null;
  activites: Activite[];
}

/** Ce qu'il faut fournir pour ajouter un lot à un chantier existant. */
export interface CreationLotProjet {
  nom: string;
  modeExecution: ModeExecutionLot;
  typeBordereau: TypeBordereau;
  /** En centimes. */
  budget?: number;
  dateDebut?: string;
  dateFin?: string;
}

/** Ce qu'il faut fournir pour ajouter (ou modifier) une activité. */
export interface SaisieActiviteDomaine {
  lotId: string;
  libelle: string;
  quantitePrevue: number | null;
  unite: UniteActivite | null;
  dateDebutPrevue: string | null;
  dateFinPrevue: string | null;
  dependanceId: string | null;
  equipeId: string | null;
}

/**
 * Ce qu'une ligne d'un fichier de lots importé ne permet pas de reprendre
 * tel quel. Des codes, pas des phrases : le libellé appartient à l'écran.
 * Aucun n'interdit l'import — la valeur fautive est laissée vide, ou la
 * ligne décochée d'office.
 */
export type AnomalieImportLot =
  | "BUDGET_INVALIDE"
  | "DATE_INVALIDE"
  | "DATES_INCOHERENTES"
  /** Un intitulé de corps d'état (« LOTS TECHNIQUES »), pas un lot. */
  | "INTITULE_FAMILLE"
  /** Un lot du même nom existe déjà sur le chantier. */
  | "DEJA_PRESENT"
  /** Le même nom figure plus haut dans le fichier. */
  | "EN_DOUBLE";

/** Une ligne d'un fichier de lots, lue et interprétée. */
export interface LigneImportLot {
  /** Le numéro de la ligne dans le tableur, pour que l'utilisateur la retrouve. */
  ligne: number;
  nom: string;
  /** `null` : absent ou non reconnu — le choix par défaut de l'import s'applique. */
  modeExecution: ModeExecutionLot | null;
  typeBordereau: TypeBordereau | null;
  /** En centimes. */
  budget: number | null;
  dateDebut: string | null;
  dateFin: string | null;
  anomalies: AnomalieImportLot[];
}
