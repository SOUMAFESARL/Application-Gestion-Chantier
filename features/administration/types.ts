/**
 * Les types du domaine Administration — l'espace de l'éditeur du SaaS.
 *
 * **Ce domaine ne parle pas de BTP.** Là où `features/projets` décrit des
 * chantiers, celui-ci décrit des *clients* : des entreprises abonnées, leur
 * état de paiement, leur consommation. Un client ici est une société entière,
 * pas le maître d'ouvrage d'un chantier — les deux mots se ressemblent et
 * désignent deux choses sans rapport, d'où `ClientPlateforme`, nommé en toutes
 * lettres.
 *
 * **Aucun type HTTP ici** : ce que le serveur enverra (`raison_sociale`,
 * `montant_mensuel_centimes`, des dates en chaîne) est la forme d'un
 * transport. La traduction se fait une seule fois, dans `adaptateur.ts`.
 *
 * Les montants restent en **centimes**, entiers, comme partout ailleurs dans
 * le produit : c'est l'unité dans laquelle on additionne sans perdre un franc.
 */

/**
 * Ce qu'un agent de la plateforme a le droit de faire.
 *
 * Deux rôles, et la frontière est l'écriture : le support consulte pour
 * répondre à une demande, le superviseur suspend, réactive et change un plan.
 * **Ce n'est pas le RBAC des entreprises** (`features/roles`), qui découpe
 * douze modules BTP en quatre niveaux : ces deux modèles n'ont aucun point
 * commun et ne doivent pas se rejoindre un jour « pour factoriser ».
 */
export type RoleAdministrateur = "SUPERVISEUR" | "SUPPORT";

/** Qui est connecté au back-office. */
export interface ProfilAdministrateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  /** Prénom et nom déjà assemblés, ou l'adresse quand les deux manquent. */
  nomComplet: string;
  role: RoleAdministrateur;
}

/**
 * L'état d'une entreprise cliente, vu de la plateforme.
 *
 * `EN_ATTENTE` est le client qui s'est inscrit sans jamais activer son
 * compte : son schéma existe, personne ne s'y est connecté. Le distinguer
 * d'un client actif sans utilisateur est le seul moyen de voir les
 * inscriptions qui n'aboutissent pas.
 */
export type StatutClient = "EN_ATTENTE" | "ACTIF" | "SUSPENDU" | "RESILIE";

/** L'état de l'abonnement, indépendant de celui du client. */
export type StatutAbonnement = "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "RESILIE";

/** Les trois plans commercialisés. */
export type CodePlan = "DECOUVERTE" | "PRO" | "ENTREPRISE";

export interface AbonnementClient {
  statut: StatutAbonnement;
  plan: CodePlan;
  /** L'identifiant de la transaction de facturation, affiché tel quel — jamais recalculé côté client. */
  referenceTransaction: string;
  /** En centimes, comme tous les montants du produit. */
  montantMensuelCentimes: number;
  dateDebut: Date;
  dateFin: Date;
  /** `null` dès que l'essai est terminé ou n'a jamais eu lieu. */
  finEssai: Date | null;
  renouvellementAuto: boolean;
}

/**
 * Une entreprise cliente.
 *
 * `nbUtilisateurs` et `nbProjets` viennent du serveur, qui seul peut les
 * compter : ils vivent dans le schéma du client, où le back-office ne va pas
 * lire lui-même.
 */
export interface ClientPlateforme {
  id: string;
  raisonSociale: string;
  nomCommercial: string;
  /** Le sous-domaine, donc le schéma PostgreSQL. */
  slug: string;
  pays: string;
  ville: string;
  emailContact: string;
  telephoneContact: string;
  statut: StatutClient;
  creeLe: Date;
  /** `null` tant que personne ne s'est connecté — voir `EN_ATTENTE`. */
  activeLe: Date | null;
  nbUtilisateurs: number;
  nbProjets: number;
  abonnement: AbonnementClient;
}

/**
 * Ce qui demande une action de la plateforme, par ordre de gravité.
 *
 * `null` veut dire « rien à faire », et c'est le cas le plus fréquent : une
 * liste où tout est signalé ne signale plus rien.
 */
export type AlerteClient =
  | "IMPAYE"
  | "SUSPENDU"
  | "ESSAI_BIENTOT_EXPIRE"
  | "INSCRIPTION_SANS_SUITE"
  | null;

/** Le résumé chiffré de la plateforme, en tête du tableau de bord. */
export interface IndicateursPlateforme {
  nbClients: number;
  nbClientsActifs: number;
  nbClientsEnEssai: number;
  nbClientsImpayes: number;
  /** Revenu mensuel récurrent, en centimes. */
  revenuMensuelCentimes: number;
}

/** La demande de suspension d'un client — motif obligatoire. */
export interface DemandeSuspension {
  motif: string;
}

/**
 * Les trois états commerciaux d'une entreprise, vus de la plateforme.
 *
 * **Ce n'est ni `StatutClient` ni `StatutAbonnement`, et c'est le but.** Les
 * deux premiers décrivent un dossier ; celui-ci répond à la seule question que
 * pose un camembert de parc : cette entreprise rapporte-t-elle, est-elle
 * encore à convaincre, ou est-elle perdue ? `IMPAYE`, `SUSPENDU` et `RESILIE`
 * y tombent ensemble — leur différence compte pour la relance, pas pour la
 * répartition.
 */
export type EtatCommercial = "ESSAI" | "ABONNEMENT_ACTIF" | "SANS_ABONNEMENT";

/** Une part du camembert : un état, son effectif. */
export interface PartParcClient {
  etat: EtatCommercial;
  nombre: number;
}

/**
 * Les cinq chiffres de tête du back-office, nommés.
 *
 * Ce sont **les clés de traduction autant que les clés de données** : la tuile
 * « impayes » lit `tableauDeBord.impayes` et la tendance de même nom. Une
 * seule liste évite qu'un indicateur affiche le libellé d'un autre le jour où
 * l'ordre change.
 */
export type CleIndicateur =
  | "nbClients"
  | "clientsActifs"
  | "enEssai"
  | "impayes"
  | "revenuMensuel";

/**
 * L'historique récent d'un indicateur, et sa variation d'un mois sur l'autre.
 *
 * **Le dernier point vaut la valeur affichée.** C'est ce qui autorise à poser
 * la mini-courbe à côté du chiffre sans les commenter l'un par l'autre : la
 * courbe finit là où le chiffre commence.
 */
export interface TendanceIndicateur {
  cle: CleIndicateur;
  /** Du plus ancien au plus récent. */
  points: number[];
  /** En pourcentage entier, signé. */
  variationPourcent: number;
}

/**
 * Ce que vaut une variation pour l'œil : une bonne nouvelle, une mauvaise, ou
 * rien du tout.
 */
export type TonVariation = "FAVORABLE" | "DEFAVORABLE" | "NEUTRE";

/**
 * Un jour de l'historique des renouvellements.
 *
 * Deux séries, parce que la question posée est un rapport, pas un total : un
 * mois à 40 renouvellements ne veut rien dire tant qu'on ignore combien
 * d'abonnements sont tombés le même mois.
 */
export interface PointEvolutionAbonnements {
  date: Date;
  renouveles: number;
  nonRenouveles: number;
}
