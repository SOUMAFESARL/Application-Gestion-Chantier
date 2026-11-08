/**
 * Les types du domaine Journal de chantier — miroir de `backend/apps/chantier/`.
 *
 * Le journal s'articule autour de l'arbre du découpage (feuilles attendues et leurs 3 modes
 * de mesure), du pointage nominatif par équipe (`EquipeChantier`), du calendrier ouvré de
 * l'entreprise et d'un circuit de signatures gouverné par les permissions (`REDACTION` →
 * `VALIDATION` → `APPROBATION`), sans aucun intitulé de rôle figé dans les statuts.
 */

import type { ModeExecutionLot, UniteActivite } from "@/features/projets/types";

/* ------------------------------------------------------------------ *
 * Statuts et circuit de validation.
 * ------------------------------------------------------------------ */

/**
 * Le cycle d'un rapport : `BROUILLON` → `SOUMIS` → `VALIDE` → `APPROUVE`.
 * Un rejet à la validation ou à l'approbation le renvoie au rédacteur (`REJETE`).
 */
export type StatutRapport = "BROUILLON" | "SOUMIS" | "VALIDE" | "APPROUVE" | "REJETE";

/**
 * Ce qu'on sait d'un chantier pour un jour ouvré : un statut de rapport, ou son absence.
 * Un brouillon n'existe que pour son auteur ; pour le reste de l'entreprise il vaut `NON_SOUMIS`.
 */
export type SituationRapport = Exclude<StatutRapport, "BROUILLON"> | "NON_SOUMIS";

/** Les trois étapes fonctionnelles d'un rapport ; la synthèse porte `VALIDATION` et `APPROBATION`. */
export type RoleSignataire = "REDACTION" | "VALIDATION" | "APPROBATION";

export type EtapeSignable = "VALIDATION" | "APPROBATION";

export type EtatEtape = "SIGNE" | "EN_ATTENTE" | "A_VENIR" | "REJETE";

export type EtatSignataire = EtatEtape | "RETIRE";

export interface SignataireAttendu {
  utilisateurId: string;
  nom: string;
  etat: EtatSignataire;
  signeLe: string | null;
  commentaire: string | null;
}

/** Une étape du circuit : qui signe, quand, et avant quelle échéance. */
export interface EtapeCircuit {
  role: RoleSignataire;
  signataire: string;
  etat: EtatEtape;
  signeLe: string | null;
  echeance: string | null;
  commentaire: string | null;
  signataires: SignataireAttendu[];
  sansSignataire: boolean;
}

/* ------------------------------------------------------------------ *
 * Le groupe de l'arbre (lot) et l'entrée de journal.
 * ------------------------------------------------------------------ */

export interface ChantierJournal {
  projetId: string;
  projetNom: string;
  projetReference: string;
  redacteur: string;
}

export interface LotJournal {
  id: string;
  code: string;
  nom: string;
  modeExecution: ModeExecutionLot;
  modeExecutionLibelle: string;
  projetId: string;
  projetNom: string;
  projetReference: string;
  redacteur: string;
}

export interface EntreeJournal {
  id: string;
  reference: string | null;
  date: string;
  chantier: ChantierJournal;
  lots: LotJournal[];
  situation: SituationRapport;
  effectifPresent: number | null;
  effectifPrevu: number | null;
  avancement: number | null;
  avancementTheorique: number | null;
  incidents: number | null;
  blocages: number | null;
  photos: number | null;
  soumisLe: string | null;
  dernierRapportLe: string | null;
  relanceLe: string | null;
  noteRedacteur: string | null;
  circuit: EtapeCircuit[];
}

export interface Journal {
  aujourdhui: string;
  estJourOuvre: boolean;
  joursSaisissables: string[];
  luLe: string;
  entrees: EntreeJournal[];
}

/* ------------------------------------------------------------------ *
 * Le rapport journalier dans son détail.
 * ------------------------------------------------------------------ */

export type Meteo = "ENSOLEILLE" | "NUAGEUX" | "PLUVIEUX" | "ORAGEUX" | "BRUMEUX";
export type ConditionsTravail = "FAVORABLES" | "DIFFICILES" | "ARRET";
export type ModeMesureFeuille = "QUANTITE" | "POURCENTAGE" | "JALON";

export interface ConditionsMeteo {
  matin: Meteo | "";
  apresMidi: Meteo | "";
  conditions: ConditionsTravail | "";
}

export interface MeteoSuggeree {
  matin: Meteo;
  apresMidi: Meteo;
  conditions: ConditionsTravail;
  sourceAuto: boolean;
}

/** Conservé uniquement pour afficher les rapports historiques antérieurs à la refonte équipes. */
export interface LigneEffectif {
  categorie: string;
  prevus: number;
  presents: number;
  heures: number;
  observation: string | null;
}

export type QualiteExecution = "CONFORME" | "NON_CONFORME";

/** La présence figée d'une équipe dans le document du rapport journalier. */
export interface PresenceEquipeRapport {
  equipeId: string;
  nom: string;
  entreprise: string;
  presence: "PRESENT" | "PARTIEL" | "ABSENT";
  membres: number;
  presents: string[];
  absents: string[];
  retards: string[];
  heures: number | null;
  qualite: QualiteExecution | null;
  observation: string;
}

export interface LigneActivite {
  activiteId: string;
  libelle: string;
  modeMesure: ModeMesureFeuille;
  unite: string | null;
  quantitePrevue: number;
  cumulVeille: number;
  quantiteJour: number;
  pourcentageVeille: number;
  pourcentageJour: number | null;
  jalonAtteint: boolean;
  avancementTheorique: number;
  equipesNoms: string[];
  localisation: string;
  observation: string | null;
}

export interface TravauxLot {
  lot: LotJournal;
  avancement: number;
  avancementTheorique: number;
  observation: string | null;
  activites: LigneActivite[];
}

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
  quantite: number | null;
  unite: string;
  bonLivraison: string;
  heure: string;
  conformite: Conformite;
  observation: string | null;
}

export interface BesoinRapport {
  nature: "RUPTURE" | "URGENT";
  designation: string;
  quantite: number | null;
  unite: string;
  observation: string | null;
}

export type EtatEquipement = "BON" | "ENTRETIEN" | "PANNE";
export type ProprieteEquipement = "ENTREPRISE" | "LOCATION";

export interface LigneEquipement {
  cle: string;
  designation: string;
  reference: string;
  propriete: ProprieteEquipement | "";
  heuresUtilisation: number | null;
  usage: string;
  operateur: string;
  etat: EtatEquipement | "";
  dureeArret: number | null;
  observation: string | null;
}

export type TypeIncident =
  | "QUALITE"
  | "SECURITE"
  | "MATERIEL"
  | "APPROVISIONNEMENT"
  | "ADMINISTRATIF";
export type GraviteIncident = "MINEUR" | "SIGNIFICATIF" | "GRAVE";

export type NatureEvenement =
  | "INCIDENT_SECURITE"
  | "NON_CONFORMITE"
  | "INCIDENT_MATERIEL"
  | "DIFFICULTE_TECHNIQUE"
  | "VISITE_INSTRUCTION"
  | "EVENEMENT_PARTICULIER";

export type DecideurIncident =
  | RoleSignataire
  | "MAITRE_OEUVRE"
  | "BUREAU_CONTROLE"
  | "CLIENT"
  | "AUTORITE";

export interface Incident {
  numero: string;
  nature: NatureEvenement;
  type: TypeIncident | "";
  heureDebut: string;
  heureFin: string;
  description: string;
  gravite: GraviteIncident | "";
  decidePar: DecideurIncident | "";
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
  cle: string;
  blocageId: string | null;
  elementId: string | null;
  elementLibelle: string | null;
  titre: string;
  nature: NatureBlocage | "";
  niveau: NiveauBlocage;
  description: string;
  impact: string;
  escalade: RoleSignataire | null;
}

export interface Photo {
  url: string | null;
  elementId: string | null;
  elementLibelle: string | null;
  legende: string;
  heure: string;
  latitude: number | null;
  longitude: number | null;
  gpsConfirme: boolean;
}

export interface DocumentRapport {
  nom: string;
  type: string;
  taille: number;
  url: string | null;
}

export interface Prevision {
  activiteId: string | null;
  equipeId: string | null;
  activite: string;
  equipe: string;
  objectif: string;
  prerequis: string;
}

export interface IntervenantsRapport {
  redacteur: string;
  validateurs: string;
  approbateurs: string;
}

export type MotifArret =
  | "INTEMPERIES"
  | "INCIDENT_SECURITE"
  | "RUPTURE_APPROVISIONNEMENT"
  | "INJONCTION_ADMINISTRATIVE"
  | "GREVE_SOCIAL"
  | "AUTRE";

export interface RapportJournalier extends EntreeJournal {
  localisation: string;
  intervenants: IntervenantsRapport;
  heureDebut: string;
  heureFin: string;
  arret: { motif: MotifArret; precision: string } | null;
  meteo: ConditionsMeteo;
  /** Repli de lecture pour les rapports antérieurs à la généralisation des équipes. */
  effectifs: LigneEffectif[] | null;
  equipes: PresenceEquipeRapport[];
  travaux: TravauxLot[];
  materiaux: LigneMateriau[];
  livraisons: Livraison[];
  besoins: BesoinRapport[];
  equipements: LigneEquipement[];
  listeIncidents: Incident[];
  listeBlocages: Blocage[];
  listePhotos: Photo[];
  documents: DocumentRapport[];
  previsions: Prevision[];
}

/* ------------------------------------------------------------------ *
 * La synthèse périodique.
 * ------------------------------------------------------------------ */

export type TypePeriode = "HEBDOMADAIRE" | "MENSUELLE" | "PERSONNALISEE";

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
  modeMesure: ModeMesureFeuille;
  unite: string | null;
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
  stockDebut: number | null;
  consomme: number;
  livre: number;
  stockFin: number | null;
  seuilAlerte: number | null;
}

export interface IncidentSynthese extends Incident {
  date: string;
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

export type StatutSynthese =
  | "LIBRE"
  | "EN_COURS"
  | "A_REDIGER"
  | "BROUILLON"
  | "SOUMISE"
  | "APPROUVEE"
  | "REJETEE";

export interface RedactionSynthese {
  appreciation: string;
  objectifs: ObjectifSuivant[];
}

export interface SuiviSynthese {
  id: string;
  projetId: string;
  type: TypePeriode;
  debut: string;
  fin: string;
  statut: StatutSynthese;
}

export interface SynthesePeriodique {
  id: string | null;
  statut: StatutSynthese;
  redaction: RedactionSynthese | null;
  etapeASigner: EtapeSignable | null;
  reference: string;
  type: TypePeriode;
  debut: string;
  fin: string;
  genereLe: string;
  projetId: string;
  projetNom: string;
  projetReference: string;
  localisation: string;
  approbateurs: string;
  validateurs: string;
  lots: LotJournal[];
  chiffres: ChiffresSynthese;
  progression: ProgressionPeriode;
  recapitulatif: EntreeJournal[];
  avancement: LotSynthese[];
  effectifs: EffectifSynthese[];
  materiaux: MateriauSynthese[];
  incidents: IncidentSynthese[];
  appreciation: Appreciation | null;
  objectifs: ObjectifSuivant[];
  circuit: EtapeCircuit[];
}

/* ------------------------------------------------------------------ *
 * La saisie du rapport journalier.
 * ------------------------------------------------------------------ */

export type SectionSaisie =
  | "AVANCEMENT"
  | "MATERIAUX"
  | "LIVRAISONS"
  | "EQUIPEMENTS"
  | "EQUIPES";

/** Une feuille ouverte de l'arbre du projet, préparée pour la saisie du jour. */
export interface ActivitePreparee {
  activiteId: string;
  lotId: string;
  modeMesure: ModeMesureFeuille;
  code: string;
  libelle: string;
  cheminLibelle: string;
  unite: UniteActivite | null;
  quantitePrevue: number;
  cumulVeille: number;
  pourcentageVeille: number;
  avancementTheorique: number;
  equipesAffectees: string[];
  attendueCeJour: boolean;
}

export interface MateriauDisponible {
  materiauId: string;
  designation: string;
  unite: string;
  stockDebut: number;
  seuilAlerte: number;
}

export interface ReprisesRapport {
  equipements: {
    designation: string;
    reference: string;
    propriete: ProprieteEquipement | "";
    operateur: string;
    usage: string;
  }[];
  equipes: { equipeId: string; presents: string[] }[];
}

export interface MembreDuJour {
  personneId: string;
  nom: string;
  fonction: string;
  estChef: boolean;
}

export interface EquipeDuJour {
  equipeId: string;
  nom: string;
  nature: string;
  entreprise: string;
  corpsEtat: string;
  activites: string[];
  presence: boolean;
  attendue: boolean;
  qualite: boolean;
  membres: MembreDuJour[];
}

export interface PresenceEquipe {
  equipeId: string;
  presents: string[];
  retards: string[];
  heures: number | null;
  qualite: QualiteExecution | "";
  observation: string;
}

export interface PointLot {
  lotId: string;
  observation: string;
}

export interface IncidentSaisi {
  cle: string;
  nature: NatureEvenement;
  type: TypeIncident | "";
  heureDebut: string;
  heureFin: string;
  gravite: GraviteIncident | "";
  decidePar: DecideurIncident | "";
  description: string;
  action: string;
}

export interface BlocageSaisi {
  cle: string;
  blocageId: string | null;
  elementId: string | null;
  titre: string;
  niveau: NiveauBlocage;
  nature: NatureBlocage | "";
  description: string;
  impact: string;
}

export interface BlocageOuvert {
  id: string;
  titre: string;
  severite: string;
  statut: string;
  elementId: string | null;
  elementLibelle: string | null;
  ouvertLe: string;
}

export interface MateriauConsomme {
  designation: string;
  quantite: number | null;
  unite: string;
}

export interface BesoinMateriau {
  nature: "RUPTURE" | "URGENT";
  designation: string;
  quantite: number | null;
  unite: string;
  observation: string;
}

export interface PieceJointe {
  cle: string;
  nom: string;
  type: string;
  taille: number;
  url: string;
}

export interface PhotoSaisie {
  cle: string;
  elementId: string | null;
  url: string;
  legende: string;
  priseLe: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ActiviteSaisie {
  activiteId: string;
  equipeIds: string[];
  quantiteJour: number | null;
  pourcentageJour: number | null;
  jalonAtteint: boolean;
  localisation: string;
  observation: string;
}

export interface SaisieRapport {
  projetId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  arret: { motif: MotifArret; precision: string } | null;
  meteo: ConditionsMeteo;
  equipes: PresenceEquipe[];
  lotsTravailles: PointLot[];
  activites: ActiviteSaisie[];
  materiaux: MateriauConsomme[];
  livraisons: (Omit<Livraison, "observation"> & { observation: string })[];
  besoins: BesoinMateriau[];
  equipements: (Omit<LigneEquipement, "observation"> & { observation: string })[];
  incidents: IncidentSaisi[];
  blocages: BlocageSaisi[];
  photos: PhotoSaisie[];
  piecesJointes: PieceJointe[];
  previsions: Prevision[];
  noteRedacteur: string;
}

export interface RapportExistant {
  id: string;
  statut: StatutRapport;
  saisie: SaisieRapport;
  enregistreLe: string;
  commentaireRejet: string | null;
  alertesEnvoyees: string[];
}

export interface ProjetSaisie {
  id: string;
  nom: string;
  reference: string;
  redacteur: string;
}

export interface PreparationSaisie {
  aujourdhui: string;
  estJourOuvre: boolean;
  joursSaisissables: string[];
  /** Le premier jour qui attend un rapport sur ce chantier (début du chantier ou enregistrement). */
  premierJour: string | null;
  meteoSuggeree: MeteoSuggeree | null;
  previsionsVeille: Prevision[];
  blocagesOuverts: BlocageOuvert[];
  projet: ProjetSaisie;
  lots: LotJournal[];
  sections: SectionSaisie[];
  activites: ActivitePreparee[];
  materiaux: MateriauDisponible[];
  equipes: EquipeDuJour[];
  reprises: ReprisesRapport;
  rapport: RapportExistant | null;
}

export interface RapportDuJour {
  id: string;
  date: string;
  statut: StatutRapport;
  enregistreLe: string;
}

export interface RapportsProjet {
  aujourdhui: string;
  estJourOuvre: boolean;
  joursSaisissables: string[];
  rapports: RapportDuJour[];
}

export interface RapportEnAttente {
  date: string;
  etat: "A_REDIGER" | "BROUILLON" | "REJETE";
  rapportId: string | null;
  enregistreLe: string | null;
  redigeable: boolean;
}

export type AlerteImmediate =
  | { type: "BLOCAGE_BLOQUANT"; cle: string; description: string }
  | { type: "INCIDENT_GRAVE"; cle: string; description: string }
  | { type: "EQUIPEMENT_PANNE"; cle: string; description: string };
