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
  /** L'identifiant de l'affectation active qui lie la personne à ce projet. */
  affectationId?: string | null;
}

/** Le maître d'ouvrage, tel qu'il apparaît sur la fiche chantier. */
export interface ClientProjet {
  /** `null` : le serveur ne donne le maître d'ouvrage qu'en clair, sans fiche tiers. */
  id: string | null;
  raisonSociale: string;
  telephone: string | null;
  email: string | null;
  ville: string | null;
}

/**
 * La durée d'un projet, lue de deux façons qui ne se remplacent pas : en
 * **calendaire** (années, mois, et les jours qui restent après le dernier mois
 * plein), comme on l'écrit dans un marché ; et en **jours ouvrés**, ce que le
 * chantier aura réellement pour travailler.
 */
export interface DureeProjet {
  annees: number;
  mois: number;
  jours: number;
  joursOuvres: number;
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
  /** Le droit de modifier le nom : réservé au DG et à l'administrateur (US 3.2). */
  peutRenommer: boolean;
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
  /** Écart temporel − physique en points (positif = retard). null si non calculé. */
  deltaRetard: number | null;
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
  /** La durée contractuelle en jours ouvrés. `null` : pas encore fixée. */
  dureeJoursOuvres: number | null;
  /** La durée calendaire et ouvrée du projet calculée par le serveur. `null` si non calculée ou dates incomplètes. */
  duree: DureeProjet | null;
  /** Le maître d'œuvre, en clair. `null` : pas de maîtrise d'œuvre désignée. */
  maitreOeuvre: string | null;
  /**
   * L'équipe d'encadrement et de gestion du projet. Vide à la création : le
   * DG désigne le chef de projet depuis la fiche, et l'équipe se complète
   * ensuite.
   */
  chefProjet: Intervenant | null;
  /**
   * Le compte courant peut-il retirer, désactiver ou changer le chef de projet ?
   * Renvoyé par le serveur sur l'affectation : seuls le DG et les rôles qui affectent
   * les membres le peuvent. Faux tant que le serveur ne l'a pas dit.
   */
  chefProjetModifiable: boolean;
  conducteursTravaux: Intervenant[];
  chefsChantier: ChefChantierProjet[];
  autresMembres: AutreMembreProjet[];
  /** Le contrat du marché et ses avenants, joints à la création. */
  contrats: ContratProjet[];
  /** La structure du chantier, comptée par le serveur, quand la réponse la joint. */
  statistiques: StatistiquesProjet | null;
  /**
   * Vrai dès que le tableau de démarrage a été appliqué : l'arbre de cases existe. Faux, l'onglet
   * Découpage propose le tableau de démarrage ; vrai, il montre l'arbre.
   */
  decoupageCree: boolean;
}

/**
 * Les chiffres de structure d'un chantier, recomptés par le serveur sur l'arbre de cases
 * (`GET /projets/{id}/statistiques/`).
 */
export interface StatistiquesProjet {
  /** Les cases actives de l'arbre. */
  cases: number;
  /** Les tâches (feuilles) actives. */
  taches: number;
  /** L'avancement physique, pondéré par les montants ; `null` quand il est indisponible. */
  avancement: number | null;
  /** Vrai quand des tâches ne sont pas encore mesurables. */
  avancementPartiel: boolean;
  /** Les tâches dont la fin prévue est passée sans qu'elles soient terminées. */
  enRetard: number;
}

/** Un document de contrat joint au projet, servi par le serveur. */
export interface ContratProjet {
  id: string;
  nom: string;
  /** En octets. */
  taille: number;
  typeContenu: string;
  url: string;
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

/** Le lot dont un chef de chantier a la charge, tel que le serveur le résout. */
export interface LotAffecte {
  id: string;
  code: string;
  libelle: string;
}

/**
 * Un chef de chantier, et le lot ou la zone dont il a la charge s'il est précisé.
 * Le lot prime sur la zone ; ni l'un ni l'autre : tout le chantier.
 */
export interface ChefChantierProjet {
  intervenant: Intervenant;
  /** Un lot du projet. `null` : pas de lot (ancienne affectation à zone libre, ou tout le chantier). */
  lot: LotAffecte | null;
  /** « Bâtiment B »… la zone libre des affectations antérieures au choix d'un lot. */
  zone: string | null;
  affectationId?: string | null;
}

/** Un autre membre de l'encadrement — financier, ingénieur, documentaliste… */
export interface AutreMembreProjet {
  intervenant: Intervenant;
  fonction: FonctionAutreMembre;
  /** Le rôle tenu sur le projet : VI (ancien « autre membre ») ou tout rôle de portée Projet. */
  roleCode: string;
  roleLibelle: string;
  affectationId?: string | null;
}

/**
 * L'arrivée d'une personne dans l'équipe d'encadrement. `intervenant` vient
 * de la liste des utilisateurs du compte : le serveur n'en lit que l'`id`.
 * Désigner un chef de projet remplace le précédent.
 */
export type AjoutEncadrement =
  | { fonction: "CHEF_PROJET" | "CONDUCTEUR_TRAVAUX"; intervenant: Intervenant }
  /** `lotId` : un lot du projet. `null` : tout le chantier. */
  | { fonction: "CHEF_CHANTIER"; intervenant: Intervenant; lotId: string | null }
  /** Tout autre rôle de portée Projet, par son code (QSE, VI…) — décision du 16/10/2026. */
  | { fonction: "AUTRE_MEMBRE"; intervenant: Intervenant; roleCode: string };

/** Le planning contractuel, fixé par le chef de projet après la création. */
export interface PlanningProjet {
  /** Absente : la date déjà fixée ne se réécrit pas, elle se reprogramme (RG-11). */
  dateDebutPrevue?: string;
  /** Absente : la date déjà fixée ne se réécrit pas, elle se reprogramme (RG-11). */
  dateFinPrevue?: string;
}

/** Un chantier attribué à un collaborateur, et ce qu'il y fait (une personne, une fonction par projet). */
export interface AffectationProjet {
  projet: Projet;
  fonction: FonctionProjet;
}

/**
 * La nature d'un projet, choisie à sa création : un type prédéfini, ou un
 * libellé saisi librement quand aucun ne convient — enregistré tel quel,
 * comme une localité absente du référentiel. `string & {}` garde
 * l'autocomplétion des codes connus.
 */
export type TypeProjet = TypeProjetPredefini | (string & {});

/**
 * Les types que l'application sait nommer. `AUTRE` ne se propose plus — la
 * saisie libre l'a remplacé — mais reste lisible sur les projets existants.
 */
export type TypeProjetPredefini =
  | "BATIMENT_RESIDENTIEL"
  | "BATIMENT_TERTIAIRE"
  | "INDUSTRIEL"
  | "GENIE_CIVIL"
  | "VRD"
  | "REHABILITATION"
  | "AUTRE";

/**
 * Le mode de base d'un lot, tel que le journal le lit : le rapport journalier
 * raisonne sur ces trois-là seuls, quel que soit le mode que le lot porte.
 */
export type ModeExecutionLot =
  | "REGIE_DIRECTE"
  | "SOUS_TRAITANCE_STRUCTUREE"
  | "SOUS_TRAITANCE_INFORMELLE";

/**
 * Les trois modes d'exécution de base, sous le code du serveur. Tout mode du
 * référentiel (`modes-execution`) se rattache à l'un d'eux : c'est son groupe.
 */
export type ModeExecutionBase = "REGIE" | "SOUS_TRAITANCE_STRUCTUREE" | "SOUS_TRAITANCE_INFORMELLE";

/** Une entrée du référentiel des modes d'exécution, pour reconnaître un mode écrit en clair. */
export interface EntreeModeExecution {
  code: string;
  libelle: string;
}

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
  /** Absent si l'utilisateur n'a pas le droit de renommer le projet (DG / AD uniquement, US 3.2). */
  nom?: string;
  typeProjet: TypeProjet;
  ville: string;
  maitreOuvrage: string;
  maitreOeuvre?: string;
  /** Absentes : le planning déjà enregistré ne change pas. */
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
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
 * Le statut qu'on **déclare** sur un lot ou une activité, à sa création ou
 * sa modification. Le retard n'en fait pas partie : il ne se déclare pas, il
 * se constate.
 */
export type StatutDeclare = "NON_DEMARRE" | "EN_COURS" | "TERMINE" | "BLOQUE";

/**
 * L'état affiché d'une activité (voir `statutActivite` dans `regles.ts`) :
 * le statut déclaré, sauf quand les dates le contredisent — une activité ne
 * se déclare pas « en retard », elle l'est.
 */
export type StatutActivite = "A_VENIR" | "EN_COURS" | "EN_RETARD" | "TERMINE" | "BLOQUE";

/** Une équipe de chantier, telle qu'on l'affecte à une activité. */
export interface EquipeChantier {
  id: string;
  nom: string;
  /** Le nombre de personnes de l'équipe. */
  effectif: number;
  /** L'identifiant de la ligne d'affectation portée par l'activité. */
  affectationId?: string;
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

/**
 * Un collaborateur que l'on peut mettre dans une équipe du chantier : il est
 * affecté au projet. Une personne peut tenir plusieurs équipes du même projet,
 * d'où la liste de celles où elle est déjà.
 */
export interface CandidatEquipe {
  id: string;
  nomComplet: string;
  /** Le code du rôle qu'il tient sur le projet (`CP`, `CT`, `CC`…) ; vide si le serveur ne le dit pas. */
  roleProjet: string;
  /** Les équipes du projet dont il est déjà membre. */
  equipes: { id: string; nom: string }[];
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
  /** En centimes. `null` : pas de budget propre — facultatif, le lot porte le sien. */
  budget: number | null;
  /** `null` : activité pas encore planifiée — les dates se fixent plus tard. */
  dateDebutPrevue: string | null;
  dateFinPrevue: string | null;
  /** Un pourcentage, de 0 à 100, alimenté par le journal de chantier. */
  avancement: number;
  /** La quantité cumulée réalisée, telle que le serveur la tient ; `null` si non communiquée. */
  quantiteRealisee: number | null;
  /** Calculé par le serveur à partir des dépendances. */
  surCheminCritique: boolean;
  /** L'activité qui doit être terminée avant que celle-ci commence. */
  dependanceId: string | null;
  /** Le collaborateur qui répond de l'activité ; `null` : aucun désigné. */
  responsableId: string | null;
  /** `null` : équipe encore à affecter. */
  equipe: EquipeChantier | null;
  statut: StatutDeclare;
}

/** Une activité sur la frise : ses dates contractuelles et son avancement physique. */
export interface ActivitePlanning {
  id: string;
  libelle: string;
  /** Dates contractuelles (baseline si complète, sinon prévues). `null` : non planifiée. */
  debut: string | null;
  fin: string | null;
  /** Avancement physique en pourcentage. */
  avancement: number;
  statut: StatutDeclare;
}

/** Un lot sur la frise, avec ses indicateurs d'avancement. */
export interface LotPlanning {
  id: string;
  code: string;
  libelle: string;
  debut: string | null;
  fin: string | null;
  /** Avancement physique en pourcentage. */
  avancement: number;
  /** Avancement temporel en pourcentage. `null` si le lot n'est pas planifié. */
  avancementTemporel: number | null;
  /** Avancement temporel − physique en points (positif = retard). `null` si non calculé. */
  deltaRetard: number | null;
  activites: ActivitePlanning[];
}

/** Ce que le serveur renvoie pour dessiner la frise d'un chantier. */
export interface DonneesPlanning {
  /** Le jour du serveur, en ISO court. */
  aujourdhui: string;
  lots: LotPlanning[];
}

/** Un lot d'un chantier, avec ses activités. */
export interface Lot {
  id: string;
  projetId: string;
  /** `03` : l'ordre du lot dans le chantier. */
  code: string;
  nom: string;
  /** Le code d'une entrée du référentiel des modes d'exécution (`REGIE` pour la régie). */
  modeExecution: string;
  /** Le libellé du mode, tel que le serveur le résout — à afficher à la lecture. */
  modeExecutionLibelle: string;
  typeBordereau: TypeBordereau;
  /**
   * En centimes. `null` tant qu'il n'est pas défini. Le budget se tient
   * d'abord au lot — c'est l'unité du marché ; celui d'une activité est facultatif.
   */
  budget: number | null;
  /** Les dates saisies sur le lot ; celles de ses activités priment à l'affichage. */
  dateDebut: string | null;
  dateFin: string | null;
  statut: StatutDeclare;
  /** Avancement physique du lot en pourcentage. `null` si non calculé. */
  avancement: number | null;
  /** Avancement temporel en pourcentage. `null` si non calculé. */
  avancementTemporel: number | null;
  /** Écart temporel − physique en points (positif = retard). `null` si non calculé. */
  deltaRetard: number | null;
  activites: Activite[];
}

/** Ce qu'il faut fournir pour ajouter un lot à un chantier existant. */
export interface CreationLotProjet {
  nom: string;
  /** Le code d'une entrée du référentiel des modes d'exécution. */
  modeExecution: string;
  typeBordereau: TypeBordereau;
  /** En centimes. */
  budget?: number;
  dateDebut?: string;
  dateFin?: string;
  /** Absent (un import) : `NON_DEMARRE`. */
  statut?: StatutDeclare;
}

/** Ce qu'il faut fournir pour ajouter (ou modifier) une activité. */
export interface SaisieActiviteDomaine {
  lotId: string;
  libelle: string;
  quantitePrevue: number | null;
  unite: UniteActivite | null;
  /** En centimes. */
  budget?: number | null;
  dateDebutPrevue?: string | null;
  dateFinPrevue?: string | null;
  responsableId: string | null;
  equipeId: string | null;
  statut: StatutDeclare;
}

/**
 * Ce qu'une ligne d'un fichier de lots importé ne permet pas de reprendre
 * tel quel. Des codes, pas des phrases : le libellé appartient à l'écran.
 * Aucun n'interdit l'import — la valeur fautive est laissée vide, ou la
 * ligne décochée d'office.
 */
export type AnomalieImportLot =
  | "BUDGET_INVALIDE"
  /** Le budget du lot dépasse celui du projet. */
  | "BUDGET_DEPASSE_PROJET"
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
  modeExecution: string | null;
  typeBordereau: TypeBordereau | null;
  /** En centimes. */
  budget: number | null;
  dateDebut: string | null;
  dateFin: string | null;
  anomalies: AnomalieImportLot[];
}

/* ------------------------------------------------------------------ *
 * Reprogrammation des dates et historique (US 3.8, RG-11).
 * ------------------------------------------------------------------ */

/** Motif dynamique de report de dates. */
export interface MotifReport {
  id: string;
  code: string;
  libelle: string;
  description?: string | null;
  ordre?: number;
}

/** Ce qu'il faut fournir pour reprogrammer un projet, un lot ou une activité. */
export interface Reprogrammation {
  dateDebutPrevue?: string | null;
  dateFinPrevue: string;
  motifId: string;
  justification: string;
}

/** Résultat synthétique renvoyé après une reprogrammation réussie. */
export interface ResultatReprogrammation {
  id: string;
  typeObjet: "PROJET" | "LOT" | "ACTIVITE";
  dateDebutPrevue: string;
  dateFinPrevue: string;
  dateDebutBaseline: string | null;
  dateFinBaseline: string | null;
  joursDeriveBaseline: number;
  alerteDg: boolean;
}

/** Événement de report dans l'historique des dates. */
export interface EvenementDate {
  id: string;
  typeObjet: "PROJET" | "LOT" | "ACTIVITE";
  champ: string;
  avant: string | null;
  apres: string | null;
  ecartJours: number | null;
  motif: string;
  justification: string;
  auteur: string;
  objet: string;
  objetId?: string | null;
  projetId?: string | null;
  projetNom?: string | null;
  le: Date;
}

/* ------------------------------------------------------------------ *
 * Mise à jour manuelle de l'avancement d'une activité (F3).
 * ------------------------------------------------------------------ */

/** La mise à jour saisie : la nouvelle quantité cumulée réalisée, et sa raison. */
export interface MiseAJourAvancement {
  quantiteRealisee: number;
  commentaire: string;
}

/** Une ligne de l'historique des mises à jour manuelles d'une activité. */
export interface EvenementAvancement {
  id: string;
  auteur: string;
  quantiteAvant: number | null;
  quantiteApres: number | null;
  avancementAvant: number | null;
  avancementApres: number | null;
  commentaire: string;
  le: Date;
}

/* ------------------------------------------------------------------ *
 * Santé du projet (indice de santé et audit).
 * ------------------------------------------------------------------ */

export type EtatCalculSante = "NON_DEMARRE" | "ACTIF" | "FIGE";
export type BadgeSante = "VERT" | "ORANGE" | "ROUGE";

/** Détail du calcul de la santé d'un projet. */
export interface SanteProjet {
  projetId: string;
  statut: string;
  etatCalcul: EtatCalculSante;
  score: number | null;
  badge: BadgeSante | null;
  badgeBrut: BadgeSante | null;
  avancementPhysique: number;
  avancementTemporel: number;
  retardPts: number;
  seuilRetard: number;
  penaliteDelais: number;
  blocagesCritiques: number;
  blocagesMajeurs: number;
  blocagesModeres: number;
  penaliteBlocages: number;
  tauxReporting: number;
  penaliteReporting: number;
  plancherApplique: boolean;
  formuleAppliquee: string;
  avertissements: string[];
  calculeLe: string | null;
}

/** Snapshot historique d'un calcul d'indice de santé. */
export interface InstantaneSante {
  id: string;
  score: number;
  badge: BadgeSante;
  penaliteDelais: number;
  penaliteBlocages: number;
  penaliteReporting: number;
  retardPts: number;
  avancementPhysique: number;
  avancementTemporel: number;
  tauxReporting: number;
  calculeLe: string;
}

/* ------------------------------------------------------------------ *
 * Affectations des collaborateurs (décisions v1.2, §13bis ; décision P13).
 * ------------------------------------------------------------------ */

/** Une case du périmètre d'une affectation, avec le chemin qui y mène. */
export interface CasePerimetre {
  id: string;
  libelle: string;
  niveau: string;
  /** Les intitulés des ancêtres puis de la case : « Bâtiment A › Gros œuvre ». */
  chemin: string[];
}

/**
 * Un collaborateur affecté au projet : **son rôle sur ce projet** (qui peut différer de son rôle
 * sur la plateforme) et **son périmètre** — des cases de l'arbre, ou tout le projet.
 */
export interface AffectationCollaborateur {
  id: string;
  utilisateur: { id: string; nomComplet: string; email: string | null; telephone: string | null };
  roleProjet: string;
  roleProjetLibelle: string;
  rolePlateforme: string;
  /** Vide : tout le projet. */
  perimetres: CasePerimetre[];
  dateDebut: string | null;
  dateFin: string | null;
  estActif: boolean;
  /** Faux quand le compte courant ne peut pas gérer cette affectation (le chef de projet). */
  modifiable: boolean;
}

export interface SaisieAffectation {
  utilisateurId: string;
  /** Le code du rôle sur ce projet ; vide : celui du collaborateur sur la plateforme. */
  roleProjet: string;
  /** Vide : tout le projet. */
  perimetresIds: string[];
  dateDebut?: string | null;
  dateFin?: string | null;
}

/** Le remplacement d'un titulaire : l'ancien est clos ce jour, le nouveau reprend le rôle. */
export interface Remplacement {
  roleProjet: string;
  utilisateurId: string;
  /** Qui est remplacé ; inutile pour un rôle unique par projet. */
  affectationRemplaceeId: string | null;
  perimetresIds: string[];
  dateChangement?: string | null;
}
