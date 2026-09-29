/**
 * Les types du domaine Tableau de bord — vue du Directeur Général.
 *
 * Le tableau de bord ne renvoie pas des chantiers complets : il renvoie des
 * **lignes de pilotage**, c'est-à-dire ce qu'il faut pour décider, et rien de
 * plus. D'où un type distinct de `Projet` plutôt qu'un `Partial<Projet>` :
 * un type partiel dirait « les mêmes champs, parfois absents », alors que la
 * réalité est « d'autres champs, tous présents » — dont l'indice de santé et
 * la marge, que la fiche chantier ne porte pas.
 *
 * **Ce que le DG ne voit plus ici** (docs/PLAN_INTERFACES_DG.md §1.1) : le
 * rapport journalier, les réceptions de matériaux, le comptage des effectifs.
 * Ce sont des contrôles de saisie terrain, pas des décisions de direction.
 *
 * **Les indicateurs ne sont pas transmis, ils sont déduits.** Les quatre
 * tuiles, la liste « à surveiller » et le graphique dérivent des lignes par
 * `regles.ts` : un chiffre envoyé à part finirait par ne plus correspondre au
 * tableau qu'il résume.
 */

import type { StatutProjet } from "@/features/projets/types";

/* ------------------------------------------------------------------ *
 * Le portefeuille.
 * ------------------------------------------------------------------ */

/**
 * Le niveau de l'indice de santé — CDC module 1, « Indice de Santé du
 * Projet » : vert, orange, rouge. Les seuils sont dans `regles.ts`.
 */
export type NiveauSante = "BON" | "VIGILANCE" | "CRITIQUE";

/** Une ligne du portefeuille de chantiers. */
export interface LigneChantier {
  id: string;
  reference: string;
  nom: string;
  clientNom: string;
  ville: string;
  quartier: string;
  statut: StatutProjet;
  chefProjetNom: string;
  /** Un pourcentage, de 0 à 100. */
  avancementReel: number;
  /** Un pourcentage, de 0 à 100. */
  avancementTheorique: number;
  /**
   * L'écart d'avancement, en points. Négatif quand le chantier glisse.
   * Calculé par le serveur, qui seul connaît le planning détaillé.
   */
  ecart: number;
  /** En centimes. `null` tant que le budget n'est pas défini. */
  budgetInitial: number | null;
  /** En centimes. */
  budgetConsomme: number;
  /**
   * Le montant du marché signé avec le maître d'ouvrage, avenants compris —
   * ce que le chantier rapporte. En centimes, `null` tant qu'il n'est pas saisi.
   */
  montantMarche: number | null;
  /**
   * La marge prévisionnelle à terminaison, en pourcentage du marché.
   * Négative quand le chantier coûtera plus qu'il ne rapporte.
   */
  margePrevisionnelle: number | null;
  /** Date ISO (`AAAA-MM-JJ`). */
  dateFinPrevue: string | null;
  /** De 0 à 100 — calculé par le serveur (délais, coûts, sécurité, qualité). */
  indiceSante: number;
}

/* ------------------------------------------------------------------ *
 * Ce qui attend le DG.
 * ------------------------------------------------------------------ */

/** Ce que le DG signe : paiements, achats au-delà de son seuil, avenants. */
export type TypeValidation = "BON_PAIEMENT" | "DEMANDE_ACHAT" | "AVENANT";

export interface ElementAValider {
  id: string;
  type: TypeValidation;
  reference: string;
  /** Le bénéficiaire, l'article acheté ou l'objet de l'avenant. */
  objet: string;
  chantierNom: string;
  /** En centimes. Pour un avenant, son impact sur le marché. */
  montant: number;
  demandeur: string;
  /** Date ISO. */
  demandeLe: string;
}

/* ------------------------------------------------------------------ *
 * Les événements qui remontent.
 * ------------------------------------------------------------------ */

/**
 * Les alertes **événementielles** — CDC module 3 « alertes financières
 * automatiques », modules 8 et 9.
 *
 * Celles qui se lisent dans les chiffres d'un chantier (budget à 80 %,
 * dépassement, marge négative, retard) n'en font pas partie : elles sont
 * déduites des lignes par `motifsAttention`, et s'afficheraient sinon deux
 * fois.
 */
export type TypeAlerte =
  | "PAIEMENT_RETARD"
  | "DEPENSE_INHABITUELLE"
  | "DEPENSE_SEUIL"
  | "INCIDENT_SECURITE"
  | "ECHEANCE_CONTRAT"
  | "RUPTURE_STOCK"
  | "INTEMPERIES";

export type GraviteAlerte = "CRITIQUE" | "ATTENTION";

export interface AlertePilotage {
  id: string;
  type: TypeAlerte;
  gravite: GraviteAlerte;
  chantierId: string | null;
  chantierNom: string | null;
  /** Le fournisseur, l'article, la ville… — une donnée, pas un libellé. */
  sujet: string;
  /** En centimes, quand l'alerte porte sur un montant. */
  montant: number | null;
  /** Un nombre de jours (retard de paiement, échéance), quand il y a lieu. */
  jours: number | null;
  /** Date ISO. */
  survenueLe: string;
}

/** Ce qui arrive dans les semaines qui viennent. */
export type TypeEcheance =
  | "RECEPTION_TRAVAUX"
  | "LIVRAISON_CHANTIER"
  | "FIN_CONTRAT"
  | "CAUTION"
  | "SITUATION_TRAVAUX";

export interface Echeance {
  id: string;
  type: TypeEcheance;
  /** Une donnée du chantier (« Lot gros œuvre », « Caution de bonne fin »). */
  libelle: string;
  chantierId: string | null;
  chantierNom: string;
  /** Date ISO (`AAAA-MM-JJ`). */
  date: string;
}

/** La sécurité et la qualité, à l'échelle de l'entreprise — CDC module 8. */
export interface SyntheseQhse {
  joursSansAccident: number;
  accidentsMois: number;
  presqueAccidentsMois: number;
  nonConformitesOuvertes: number;
  /** Celles dont l'action corrective a dépassé son délai. */
  nonConformitesEnRetard: number;
}

/* ------------------------------------------------------------------ *
 * L'écran.
 * ------------------------------------------------------------------ */

export interface TableauDeBord {
  chantiers: LigneChantier[];
  validations: ElementAValider[];
  alertes: AlertePilotage[];
  echeances: Echeance[];
  qhse: SyntheseQhse;
}

/** Le résultat d'une validation. */
export interface ResultatValidation {
  id: string;
  valideLe: string | null;
}
