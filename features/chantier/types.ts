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

import type { ModeExecutionLot } from "@/features/projets/types";

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

export interface LigneMateriau {
  designation: string;
  unite: string;
  stockDebut: number;
  livre: number;
  utilise: number;
  seuilAlerte: number;
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

export interface MateriauSynthese {
  designation: string;
  unite: string;
  stockDebut: number;
  consomme: number;
  livre: number;
  stockFin: number;
  seuilAlerte: number;
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
