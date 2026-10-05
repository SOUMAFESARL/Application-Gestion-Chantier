/**
 * Les types du domaine Journal de chantier — module 2 du CDC, miroir de
 * `backend/apps/chantier/`.
 *
 * Deux documents, et une ligne qui les relie :
 *
 * - le **rapport journalier** (`RAP-…`) couvre **un lot sur un jour**. Il est
 *   saisi par le chef de chantier, puis signé CC → CT → CP ; une fois
 *   approuvé par le CP il est immuable — c'est lui qui alimente l'avancement
 *   et les bons de paiement ;
 * - la **synthèse périodique** (`SYNT-…`) couvre **plusieurs lots sur
 *   plusieurs jours**. Elle n'est pas saisie : Django l'agrège à la demande
 *   depuis les rapports journaliers, puis elle est signée CT → CP ;
 * - l'**entrée de journal** est la ligne « tel lot, tel jour » : un rapport
 *   quand il existe, son absence quand il manque. Une absence est une donnée
 *   (elle se trace, se relance, apparaît dans la synthèse), pas un trou.
 *
 * Aucune forme HTTP ici : les charges utiles restent privées à
 * `adaptateur.ts`.
 */

import type { ModeExecutionLot, UniteActivite } from "@/features/projets/types";

/* ------------------------------------------------------------------ *
 * Statuts et circuit de validation.
 * ------------------------------------------------------------------ */

/**
 * Le cycle d'un rapport : BROUILLON → SOUMIS → VALIDE_CT → APPROUVE_CP.
 * Un rejet (CT ou CP) le renvoie au chef de chantier, qui le corrige.
 */
export type StatutRapport = "BROUILLON" | "SOUMIS" | "VALIDE_CT" | "APPROUVE_CP" | "REJETE";

/**
 * Ce qu'on sait d'un lot pour un jour : un statut de rapport, ou son absence.
 * Un brouillon n'en fait pas partie : tant que le chef de chantier ne l'a pas
 * soumis, il n'existe que pour lui — pour le reste de l'entreprise, le
 * rapport n'est pas soumis (`versSituation`, adaptateur).
 */
export type SituationRapport = Exclude<StatutRapport, "BROUILLON"> | "NON_SOUMIS";

/** Les trois signataires d'un rapport journalier ; la synthèse n'a que CT et CP. */
export type RoleSignataire = "CC" | "CT" | "CP";

export type EtatEtape = "SIGNE" | "EN_ATTENTE" | "A_VENIR" | "REJETE";

/** Une étape du circuit : qui signe, quand, et avant quand il aurait dû. */
export interface EtapeCircuit {
  role: RoleSignataire;
  signataire: string;
  etat: EtatEtape;
  signeLe: string | null;
  /** L'échéance de l'étape en attente (24 h pour le CT). */
  echeance: string | null;
  /** Le motif d'un rejet. */
  commentaire: string | null;
}

/* ------------------------------------------------------------------ *
 * Le lot et l'entrée de journal.
 * ------------------------------------------------------------------ */

/** Un lot tel que le journal le voit : son chantier et son chef de chantier. */
export interface LotJournal {
  id: string;
  code: string;
  nom: string;
  modeExecution: ModeExecutionLot;
  projetId: string;
  projetNom: string;
  projetReference: string;
  chefChantier: string;
}

/** Une ligne « tel lot, tel jour » — rapport déposé ou attendu. */
export interface EntreeJournal {
  /** L'identifiant du rapport ; pour une absence, celui de la ligne attendue. */
  id: string;
  /** `RAP-2026-001-L03-042` — `null` tant qu'aucun rapport n'existe. */
  reference: string | null;
  /** Le jour couvert, `AAAA-MM-JJ`. */
  date: string;
  lot: LotJournal;
  situation: SituationRapport;
  effectifPresent: number | null;
  effectifPrevu: number | null;
  /** L'avancement du lot au soir de ce jour, en %. */
  avancementLot: number | null;
  avancementTheorique: number | null;
  incidents: number | null;
  blocages: number | null;
  photos: number | null;
  soumisLe: string | null;
  /** Pour une absence : le dernier jour où ce lot a eu un rapport. */
  dernierRapportLe: string | null;
  /** La dernière relance envoyée pour cette ligne. */
  relanceLe: string | null;
  /** La note du chef de chantier, telle qu'il l'a écrite. */
  noteChefChantier: string | null;
  circuit: EtapeCircuit[];
}

/** Le journal d'une période : toutes les lignes, et l'heure de lecture. */
export interface Journal {
  /** Le jour du serveur, `AAAA-MM-JJ` — pas celui du poste. */
  aujourdhui: string;
  luLe: string;
  entrees: EntreeJournal[];
}

/* ------------------------------------------------------------------ *
 * Le rapport journalier dans son détail.
 * ------------------------------------------------------------------ */

export type Meteo = "ENSOLEILLE" | "NUAGEUX" | "PLUVIEUX" | "ORAGEUX" | "BRUMEUX";
export type ConditionsTravail = "FAVORABLES" | "DIFFICILES" | "ARRET";

export interface ConditionsMeteo {
  matin: Meteo;
  apresMidi: Meteo;
  temperatureMin: number;
  temperatureMax: number;
  humidite: number;
  vent: string;
  conditions: ConditionsTravail;
  /** La prévision du lendemain, quand elle change l'organisation du chantier. */
  prevision: string | null;
}

/** Une catégorie d'ouvriers présents — lot en régie directe seulement. */
export interface LigneEffectif {
  categorie: string;
  prevus: number;
  presents: number;
  heures: number;
  observation: string | null;
}

/** La production d'un tâcheron — lot en sous-traitance informelle seulement. */
export interface LigneProduction {
  intervenant: string;
  activite: string;
  unite: string;
  /** En centimes de FCFA, comme tout montant du produit. */
  prixUnitaire: number;
  quantiteJour: number;
  cumul: number;
}

export interface LigneActivite {
  libelle: string;
  unite: string;
  quantitePrevue: number;
  /** Le cumul à la veille. */
  cumulVeille: number;
  quantiteJour: number;
  /** L'avancement attendu à cette date par le planning, en %. */
  avancementTheorique: number;
  observation: string | null;
}

/**
 * `stockDebut` et `seuilAlerte` à `null` : un matériau saisi librement par le
 * chef de chantier, sans fiche au stock — on sait ce qui a été consommé, pas
 * ce qui reste.
 */
export interface LigneMateriau {
  designation: string;
  unite: string;
  stockDebut: number | null;
  livre: number;
  utilise: number;
  seuilAlerte: number | null;
}

export type Conformite = "CONFORME" | "PARTIELLE" | "NON_CONFORME";

export interface Livraison {
  fournisseur: string;
  designation: string;
  quantite: string;
  bonLivraison: string;
  heure: string;
  conformite: Conformite;
  observation: string | null;
}

export type EtatEquipement = "BON" | "ENTRETIEN" | "PANNE";
export type ProprieteEquipement = "ENTREPRISE" | "LOCATION";

export interface LigneEquipement {
  designation: string;
  reference: string;
  propriete: ProprieteEquipement;
  utilisation: string;
  operateur: string;
  etat: EtatEquipement;
  observation: string | null;
}

export type TypeIncident = "QUALITE" | "SECURITE" | "MATERIEL" | "APPROVISIONNEMENT" | "ADMINISTRATIF";
export type GraviteIncident = "MINEUR" | "SIGNIFICATIF" | "GRAVE";

export interface Incident {
  numero: string;
  type: TypeIncident;
  description: string;
  gravite: GraviteIncident;
  decidePar: RoleSignataire;
  action: string;
  resolu: boolean;
}

export type NiveauBlocage = "MINEUR" | "SIGNIFICATIF" | "BLOQUANT";
export type NatureBlocage =
  | "APPROVISIONNEMENT"
  | "METEO"
  | "MAIN_OEUVRE"
  | "TECHNIQUE"
  | "ADMINISTRATIF"
  | "SECURITE";

export interface Blocage {
  numero: string;
  nature: NatureBlocage;
  niveau: NiveauBlocage;
  description: string;
  impact: string;
  escalade: RoleSignataire | null;
}

export interface Photo {
  /** L'image elle-même ; `null` quand le serveur n'en sert que les métadonnées. */
  url: string | null;
  legende: string;
  heure: string;
  latitude: number;
  longitude: number;
  gpsConfirme: boolean;
}

export interface Prevision {
  activite: string;
  equipe: string;
  objectif: string;
  prerequis: string;
}

/** Les intervenants nommés sur le document. */
export interface IntervenantsRapport {
  chefChantier: string;
  conducteurTravaux: string;
  chefProjet: string;
}

/**
 * Le rapport journalier complet — le document que le CC a signé.
 *
 * Les sections suivent le mode d'exécution du lot, **tel que le serveur le
 * renvoie** : `effectifs` n'existe qu'en régie directe, `production` qu'en
 * sous-traitance informelle. Un `null` veut dire « section sans objet pour
 * ce lot », un tableau vide « rien à signaler ce jour ».
 */
export interface RapportJournalier extends EntreeJournal {
  localisation: string;
  intervenants: IntervenantsRapport;
  heureDebut: string;
  heureFin: string;
  meteo: ConditionsMeteo;
  effectifs: LigneEffectif[] | null;
  production: LigneProduction[] | null;
  activites: LigneActivite[];
  materiaux: LigneMateriau[];
  livraisons: Livraison[];
  equipements: LigneEquipement[];
  listeIncidents: Incident[];
  listeBlocages: Blocage[];
  listePhotos: Photo[];
  previsions: Prevision[];
}

/* ------------------------------------------------------------------ *
 * La synthèse périodique.
 * ------------------------------------------------------------------ */

export type TypePeriode = "HEBDOMADAIRE" | "MENSUELLE" | "PERSONNALISEE";

/** Ce que l'écran demande : un chantier, une période. */
export interface DemandeSynthese {
  projetId: string;
  type: TypePeriode;
  debut: string;
  fin: string;
}

export interface ProgressionPeriode {
  debut: number;
  fin: number;
  gain: number;
  objectif: number;
  theorique: number;
}

export interface ActiviteSynthese {
  libelle: string;
  unite: string;
  quantitePrevue: number;
  avancementDebut: number;
  avancementFin: number;
  objectifGain: number;
}

export interface LotSynthese {
  lot: LotJournal;
  activites: ActiviteSynthese[];
}

export interface EffectifSynthese {
  categorie: string;
  prevuParJour: number;
  presenceMoyenne: number;
  heures: number;
  absences: number;
  observation: string | null;
}

/** Les stocks à `null` : un matériau saisi librement, sans fiche au stock (voir `LigneMateriau`). */
export interface MateriauSynthese {
  designation: string;
  unite: string;
  stockDebut: number | null;
  consomme: number;
  livre: number;
  stockFin: number | null;
  seuilAlerte: number | null;
}

export interface IncidentSynthese extends Incident {
  date: string;
  lotCode: string;
}

export interface Appreciation {
  auteur: string;
  redigeeLe: string;
  texte: string;
}

export interface ObjectifSuivant {
  lotCode: string;
  activite: string;
  objectif: string;
  cible: number;
  prerequis: string;
}

/** Les chiffres de tête de la synthèse. */
export interface ChiffresSynthese {
  joursOuvres: number;
  rapportsAttendus: number;
  rapportsRecus: number;
  rapportsValides: number;
  effectifsPresents: number;
  effectifsPrevus: number;
  heures: number;
  livraisons: number;
  livraisonsPartielles: number;
  incidents: number;
  incidentsMajeurs: number;
  blocages: number;
}

export interface SynthesePeriodique {
  reference: string;
  type: TypePeriode;
  debut: string;
  fin: string;
  genereLe: string;
  projetId: string;
  projetNom: string;
  projetReference: string;
  localisation: string;
  chefProjet: string;
  conducteurTravaux: string;
  lots: LotJournal[];
  chiffres: ChiffresSynthese;
  progression: ProgressionPeriode;
  /** Toutes les lignes de la période, absences comprises. */
  recapitulatif: EntreeJournal[];
  avancement: LotSynthese[];
  effectifs: EffectifSynthese[];
  materiaux: MateriauSynthese[];
  incidents: IncidentSynthese[];
  /** Rédigée par le CT à la clôture de la période ; `null` avant. */
  appreciation: Appreciation | null;
  objectifs: ObjectifSuivant[];
  circuit: EtapeCircuit[];
}

/* ------------------------------------------------------------------ *
 * La saisie du rapport journalier — l'écran du chef de chantier.
 * ------------------------------------------------------------------ */

/**
 * Les sections propres au mode d'exécution du lot. Le contexte, les
 * incidents, le blocage, les photos, les prévisions et la note sont communs à
 * tous les modes et ne figurent donc pas ici.
 *
 * **Le serveur les donne, l'écran ne les déduit pas** (SFD F2, RG-F2-07) : si
 * le mode d'un lot est corrigé avant son premier rapport, le formulaire suit
 * sans mise à jour de l'application.
 */
export type SectionSaisie =
  | "EFFECTIFS"
  | "PRESENCE_SOUS_TRAITANT"
  | "PRODUCTION"
  | "AVANCEMENT"
  | "MATERIAUX"
  | "LIVRAISONS"
  | "EQUIPEMENTS";

/** Une journée sans travaux (SFD §4.4) : comptée dans le taux de remise, sans avancement ni consommation. */
export type MotifArret = "INTEMPERIES" | "JOUR_FERIE" | "AUTRE";

/** Le blocage se déclare en un choix unique ; « aucun » est une réponse, pas un oubli. */
export type NiveauBlocageSaisi = "AUCUN" | NiveauBlocage;

export type PresenceSousTraitant = "PRESENT" | "PARTIEL" | "ABSENT";
export type QualiteExecution = "CONFORME" | "NON_CONFORME";

/**
 * Comment une activité se déclare au jour le jour : par la quantité réalisée
 * (régie directe, sous-traitance structurée) ou par la production des
 * tâcherons (sous-traitance informelle) — selon le mode de **son** lot.
 */
export type SuiviActivite = "AVANCEMENT" | "PRODUCTION";

/** Une activité d'un lot du chantier, telle que le chef de chantier la renseigne ce jour. */
export interface ActivitePreparee {
  activiteId: string;
  /** Le lot de l'activité : le rapport couvre tout le chantier, l'écran les regroupe par lot. */
  lotId: string;
  suivi: SuiviActivite;
  code: string;
  libelle: string;
  /** `null` : activité suivie au pourcentage — sa quantité prévue vaut alors 100. */
  unite: UniteActivite | null;
  quantitePrevue: number;
  /** Le cumul réalisé à la veille, calculé par le serveur. */
  cumulVeille: number;
  /** L'avancement attendu ce jour par le planning, en %. */
  avancementTheorique: number;
}

/**
 * Un matériau du stock du chantier (bon de réception valide, RG-F2-06). La
 * saisie ne s'y limite plus : sa désignation et son unité sont seulement
 * proposées au chef de chantier.
 */
export interface MateriauDisponible {
  materiauId: string;
  designation: string;
  unite: string;
  stockDebut: number;
  seuilAlerte: number;
}

/** Ce que le rapport précédent du lot permet de ne pas ressaisir. */
export interface ReprisesRapport {
  effectifs: { categorie: string; prevus: number }[];
  equipements: Pick<LigneEquipement, "designation" | "reference" | "propriete" | "operateur">[];
  intervenants: { intervenant: string; activiteId: string; prixUnitaire: number }[];
}

/** Le point d'un lot travaillé ce jour : ce qui s'y est passé, au-delà des quantités. */
export interface PointLot {
  lotId: string;
  observation: string;
}

/**
 * Ce que le chef de chantier déclare d'un geste dans la rubrique « Événements
 * chantier » — la liste du cahier « Journal de chantier intelligent » §2.
 */
export type NatureEvenement =
  | "INCIDENT"
  | "DIFFICULTE_TECHNIQUE"
  | "NON_CONFORMITE"
  | "RETARD"
  | "INTEMPERIE"
  | "ARRET_TRAVAUX"
  | "INSTRUCTION"
  | "EVENEMENT_PARTICULIER";

/** Un événement du chantier tel que le chef de chantier le déclare. */
export interface IncidentSaisi {
  /** Identifiant local de la ligne : il suit l'alerte immédiate envoyée pour elle. */
  cle: string;
  nature: NatureEvenement;
  /** La catégorie HSE / qualité que lit la synthèse ; choisie pour un incident, déduite de la nature sinon. */
  type: TypeIncident;
  /** La plage de l'événement (« pluie de 14 h à 15 h 30 ») — facultative. */
  heureDebut: string;
  heureFin: string;
  gravite: GraviteIncident;
  decidePar: RoleSignataire;
  description: string;
  action: string;
}

/**
 * Un matériau consommé, tel que le chef de chantier le déclare : désignation
 * et unité libres, sans lien obligé avec une fiche du stock.
 */
export interface MateriauConsomme {
  designation: string;
  quantite: number | null;
  unite: string;
}

/** Une rupture constatée ou un besoin urgent — ce que l'approvisionnement doit lire le jour même. */
export interface BesoinMateriau {
  nature: "RUPTURE" | "URGENT";
  designation: string;
  quantite: string;
  observation: string;
}

/** Un document joint au rapport. */
export interface PieceJointe {
  cle: string;
  nom: string;
  type: string;
  /** En octets. */
  taille: number;
  /** Le fichier en `data:` — le serveur le remplace par son URL à l'envoi. */
  url: string;
}

export interface PhotoSaisie {
  cle: string;
  /** L'image compressée, en `data:` — le serveur la remplace par son URL à l'envoi. */
  url: string;
  legende: string;
  /** L'heure de prise de vue, en UTC. */
  priseLe: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Le rapport tel que le chef de chantier le remplit. Un brouillon peut être
 * incomplet : les nombres non renseignés valent `null`, et c'est la
 * soumission, pas l'enregistrement, qui exige les champs obligatoires.
 */
export interface SaisieRapport {
  projetId: string;
  /** `AAAA-MM-JJ`, de J-2 à J. */
  date: string;
  heureDebut: string;
  heureFin: string;
  /** Journée d'arrêt : intempéries, jour férié… `null` : journée travaillée. */
  arret: { motif: MotifArret; precision: string } | null;
  meteo: {
    matin: Meteo;
    apresMidi: Meteo;
    conditions: ConditionsTravail;
    temperatureMin: number | null;
    temperatureMax: number | null;
    humidite: number | null;
    vent: string;
    prevision: string;
  };
  effectifs: {
    categorie: string;
    /** Le personnel affecté à la catégorie. */
    prevus: number | null;
    presents: number | null;
    /** Les arrivées en retard, parmi les présents. */
    retards: number | null;
    heures: number | null;
    observation: string;
  }[];
  presenceSousTraitant: {
    presence: PresenceSousTraitant;
    motif: string;
    qualite: QualiteExecution;
    observation: string;
  } | null;
  production: { intervenant: string; activiteId: string; quantiteJour: number | null; prixUnitaire: number | null }[];
  /**
   * Les lots suivis à l'avancement sur lesquels on a travaillé ce jour, et le
   * point du chef de chantier sur chacun. Le rapport couvre le chantier : c'est
   * ici qu'il dit lot par lot où il en est. Seules les activités de ces lots
   * figurent dans `activites`.
   */
  lotsTravailles: PointLot[];
  /** `localisation` : la zone, le bâtiment, le niveau où l'activité a avancé. */
  activites: { activiteId: string; quantiteJour: number | null; localisation: string; observation: string }[];
  materiaux: MateriauConsomme[];
  livraisons: (Omit<Livraison, "observation"> & { observation: string })[];
  besoins: BesoinMateriau[];
  /** `dureeArret` : les heures d'immobilisation d'un engin en panne ou en entretien. */
  equipements: (Omit<LigneEquipement, "observation"> & { observation: string; dureeArret: number | null })[];
  incidents: IncidentSaisi[];
  blocage: { niveau: NiveauBlocageSaisi; nature: NatureBlocage | null; description: string; impact: string };
  photos: PhotoSaisie[];
  piecesJointes: PieceJointe[];
  previsions: Prevision[];
  note: string;
}

/** Un rapport déjà commencé pour ce chantier et ce jour — il n'en existe qu'un (RG-F2-01). */
export interface RapportExistant {
  id: string;
  statut: StatutRapport;
  saisie: SaisieRapport;
  enregistreLe: string;
  /** Le motif du CT quand il a rejeté le rapport. */
  commentaireRejet: string | null;
  /** Les alertes immédiates déjà parties (`BLOCAGE`, ou la clé d'un incident). */
  alertesEnvoyees: string[];
}

/** Le chantier tel que la saisie le voit. */
export interface ProjetSaisie {
  id: string;
  nom: string;
  reference: string;
  chefChantier: string;
}

/**
 * Tout ce qu'il faut pour ouvrir le formulaire d'un chantier pour un jour.
 *
 * Le rapport couvre **tous les lots en cours** du chantier : `sections` est
 * la réunion des sections de leurs modes d'exécution, et chaque activité dit
 * à quel lot elle appartient et comment elle se déclare.
 */
export interface PreparationSaisie {
  /** Le jour du serveur. */
  aujourdhui: string;
  projet: ProjetSaisie;
  /** Les lots en cours, avec leur mode d'exécution. */
  lots: LotJournal[];
  sections: SectionSaisie[];
  activites: ActivitePreparee[];
  materiaux: MateriauDisponible[];
  reprises: ReprisesRapport;
  rapport: RapportExistant | null;
}

/** Un rapport du chef de chantier sur un chantier, quel que soit son statut. */
export interface RapportDuJour {
  id: string;
  date: string;
  statut: StatutRapport;
  enregistreLe: string;
}

/** Les rapports d'un chef de chantier sur un chantier, et le jour du serveur. */
export interface RapportsProjet {
  aujourdhui: string;
  rapports: RapportDuJour[];
}

/**
 * Un rapport attendu et pas encore remis : jamais commencé, resté en
 * brouillon, ou rejeté. Au-delà de J-2, il ne se rédige plus (`redigeable`).
 */
export interface RapportEnAttente {
  date: string;
  etat: "A_REDIGER" | "BROUILLON" | "REJETE";
  rapportId: string | null;
  enregistreLe: string | null;
  redigeable: boolean;
}

/** Une alerte qui part dès la sélection, avant la soumission (RG-F2-11). */
export type AlerteImmediate =
  | { type: "BLOCAGE_BLOQUANT"; description: string }
  | { type: "INCIDENT_GRAVE"; cle: string; description: string };
