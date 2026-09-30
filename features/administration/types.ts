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

import type { CodePlan as CodePlanCatalogue } from "@/features/abonnement/types";
import type { AccesModule } from "@/features/roles/types";

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
  /** Vide tant que l'agent n'en a pas renseigné — la connexion ne le renvoie pas. */
  telephone: string;
  /** L'URL de la photo de profil, ou `null` : l'avatar retombe alors sur les initiales. */
  photo: string | null;
  role: RoleAdministrateur;
}

/**
 * Le changement de mot de passe de l'agent connecté.
 *
 * **L'ancien mot de passe est exigé** : une session laissée ouverte sur un
 * poste partagé ne doit pas suffire à s'approprier le compte. La confirmation
 * n'y figure pas — c'est une vérification d'écran, le serveur n'a rien à
 * comparer.
 */
export interface DemandeChangementMotDePasse {
  actuel: string;
  nouveau: string;
}

/**
 * Ce qu'un agent peut changer de son propre profil.
 *
 * **Le rôle n'y est pas** : on ne s'accorde pas soi-même la supervision. Il se
 * change depuis la gestion des comptes, par un autre superviseur.
 */
export interface DemandeModificationProfil {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
}

/**
 * Un compte d'agent, vu depuis la gestion des comptes du back-office.
 *
 * Un compte suspendu n'est pas supprimé : ses actions passées restent
 * attribuées dans le journal d'audit, ce qu'une suppression effacerait.
 */
export type StatutCompteAdministrateur = "ACTIF" | "SUSPENDU";

export interface CompteAdministrateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  nomComplet: string;
  telephone: string;
  role: RoleAdministrateur;
  statut: StatutCompteAdministrateur;
  creeLe: Date;
  /** `null` pour un compte créé qui ne s'est encore jamais connecté. */
  derniereConnexion: Date | null;
}

/** La création d'un compte d'agent — le mot de passe est choisi par l'invité. */
export interface DemandeCreationAdministrateur {
  prenom: string;
  nom: string;
  email: string;
  role: RoleAdministrateur;
}

/**
 * Un module du catalogue de la plateforme — Projets, Finance, QHSE…
 *
 * **Le catalogue, pas le droit d'accès.** Le back-office décrit ici ce que le
 * produit contient ; ce qu'un utilisateur peut y faire se décide dans chaque
 * entreprise, par ses rôles (`features/roles`), avec le vocabulaire fixe
 * lecture / saisie / validation.
 *
 * `accesParDefaut` n'y déroge pas : c'est une **valeur de départ**, dans ce
 * même vocabulaire, que le serveur pose sur les rôles non système d'une
 * entreprise quand le module lui arrive (ou quand elle crée un rôle). Chaque
 * entreprise la change ensuite comme elle l'entend ; la modifier ici ne
 * réécrit pas les rôles existants.
 *
 * `code` est l'identifiant stable que le serveur et les rôles des entreprises
 * utilisent (`projets`, `finance`…) : dérivé du libellé à la création, il ne
 * change plus ensuite, même si le libellé est renommé — sans quoi chaque
 * renommage orphelinerait les permissions déjà accordées.
 */
export type StatutModule = "ACTIF" | "INACTIF";

export interface ModulePlateforme {
  id: string;
  code: string;
  libelle: string;
  description: string;
  /** Vide : « Aucun » — le module arrive fermé, chaque entreprise l'ouvre. */
  accesParDefaut: AccesModule[];
  statut: StatutModule;
  creeLe: Date;
}

/** Ce que le back-office saisit d'un module : le code, lui, vient du serveur. */
export interface DemandeModule {
  libelle: string;
  description: string;
  accesParDefaut: AccesModule[];
}

/**
 * Les tarifs et l'identité de la plateforme appartiennent au domaine
 * `plateforme`, que l'espace entreprise lit aussi : le back-office les écrit,
 * il n'en est pas le propriétaire.
 */
export type { AvantagePlan, IdentitePlateforme, TarifPlan } from "@/features/plateforme/types";

/**
 * L'état d'une entreprise cliente, vu de la plateforme.
 *
 * `EN_ATTENTE` est le client qui s'est inscrit sans jamais activer son
 * compte : son schéma existe, personne ne s'y est connecté. Le distinguer
 * d'un client actif sans utilisateur est le seul moyen de voir les
 * inscriptions qui n'aboutissent pas.
 *
 * `ESSAI` est le client en période d'essai : Django le porte sur le client
 * lui-même, pas seulement sur son abonnement.
 */
export type StatutClient = "EN_ATTENTE" | "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";

/** L'état de l'abonnement, indépendant de celui du client. */
export type StatutAbonnement = "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "RESILIE";

/**
 * Les trois plans commercialisés — **ceux du catalogue de vente de l'espace
 * entreprise**, pas une liste à part : le back-office change le plan qu'un
 * client a souscrit sur la page de tarifs, il n'en invente pas d'autres.
 */
export type CodePlan = CodePlanCatalogue;

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
