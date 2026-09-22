/**
 * Les types du domaine Tableau de bord — plan de refonte, lot 4, couche 1.
 *
 * Le tableau de bord ne renvoie pas des chantiers complets : il renvoie des
 * **lignes de pilotage**, c'est-à-dire ce qu'il faut pour décider, et rien de
 * plus. D'où un type distinct de `Projet` plutôt qu'un `Partial<Projet>` :
 * un type partiel dirait « les mêmes champs, parfois absents », alors que la
 * réalité est « d'autres champs, tous présents » — dont l'indice de santé,
 * que la fiche chantier ne porte pas.
 */

import type { AlerteIntemperies } from "@/features/projets/types";

/** L'état du rapport journalier d'un chantier. */
export type StatutRapportJour = "SOUMIS" | "EN_ATTENTE" | string;

/** Une ligne de la liste des chantiers, sur le tableau de bord. */
export interface LigneChantier {
  id: string;
  reference: string;
  nom: string;
  description: string;
  clientNom: string;
  ville: string;
  quartier: string;
  statut: string;
  /** Un pourcentage, de 0 à 100. */
  avancementReel: number;
  /** Un pourcentage, de 0 à 100. */
  avancementTheorique: number;
  /**
   * L'écart d'avancement, en points.
   *
   * Il est **calculé par le serveur** et repris tel quel : lui seul connaît
   * le planning détaillé dont il dérive. `regles.ecartAvancement` sert quand
   * on ne dispose que des deux avancements — sur la fiche chantier, ou pour
   * un chantier qui vient d'être créé.
   */
  ecart: number;
  /** En centimes. `null` tant que le budget n'est pas défini. */
  budgetInitial: number | null;
  /** En centimes. */
  budgetConsomme: number;
  rapportJourStatut: StatutRapportJour;
  /** De 0 à 100. */
  indiceSante: number;
  chefProjetNom: string;
  conducteurTravauxNom: string;
}

/** Le détail de l'indice de santé, par axe. */
export interface DetailSante {
  securite: number;
  delais: number;
  budget: number;
}

export interface EffectifsSurSite {
  total: number;
  regie: number;
  tacherons: number;
}

export interface RapportsJournaliers {
  soumis: number;
  attendus: number;
}

/** Les compteurs d'en-tête du tableau de bord. */
export interface MetriquesPilotage {
  chantiersActifs: number;
  chantiersConformes: number;
  chantiersEnRetard: number;
  santeGlobale: number;
  santeDetails: DetailSante;
  /** En centimes. */
  budgetTotal: number;
  /** En centimes. */
  budgetEngage: number;
  bonsASignerNombre: number;
  /** En centimes. */
  bonsASignerMontant: number;
  effectifsSurSite: EffectifsSurSite;
  rapportsJournaliers: RapportsJournaliers;
}

/** Un bon de paiement en attente de signature. */
export interface BonAPayer {
  id: string;
  reference: string;
  beneficiaire: string;
  corpsEtat: string;
  /** En centimes. */
  montant: number;
  statut: string;
}

export interface ReceptionMateriau {
  id: string;
  projet: string;
  description: string;
  conforme: boolean;
  dateReception: string | null;
}

/** La météo telle que l'affiche le bandeau du tableau de bord. */
export interface MeteoPilotage {
  ville: string;
  temperature: number;
  description: string;
  praticable: boolean;
  alerteIntemperies: AlerteIntemperies | null;
}

export interface TableauDeBord {
  metriques: MetriquesPilotage;
  chantiers: LigneChantier[];
  bonsAPayer: BonAPayer[];
  receptionsMateriaux: ReceptionMateriau[];
  meteo: MeteoPilotage;
  alerteIntemperies: AlerteIntemperies | null;
  /**
   * L'entreprise n'a aucun chantier — ce qui n'est pas la même chose qu'une
   * liste vide par filtrage. L'écran d'accueil n'est pas le même.
   */
  aucunChantier: boolean;
}

/** Le résultat d'une signature de bon de paiement. */
export interface SignatureBon {
  succes: boolean;
  id: string;
  numero: string | null;
  statut: string;
  signeLe: string | null;
}
