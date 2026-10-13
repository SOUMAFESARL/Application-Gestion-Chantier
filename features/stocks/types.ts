/**
 * Les types du domaine Stock de chantier — F9, spécification v1.2.
 *
 * Le cycle : une **demande d'approvisionnement** (DA) exprime un besoin du
 * terrain ; la direction y répond par un ou plusieurs **bons de commande**
 * (BC), un par livraison attendue ; chaque arrivée de camion est une
 * **livraison**, validée (CT, puis CP pour un équipement) et justifiée (BL
 * signé) avant de devenir un **bon de réception validé** (BRV) ; le stock
 * n'est que le cumul de **mouvements** immuables, corrigés au besoin par un
 * **inventaire** physique.
 *
 * F9 ne gère que des **quantités** : ni prix, ni valorisation (§1.3).
 */

/**
 * Matériau consommé, ou équipement — le second suit un circuit à deux niveaux
 * (RG-STK-04). C'est la nature **du circuit** : une livraison est l'une ou
 * l'autre, quelle que soit la nature libre portée par l'article.
 */
export type NatureArticle = "MATERIAU" | "EQUIPEMENT";

export type CategorieArticle =
  | "LIANTS"
  | "GRANULATS"
  | "ACIERS"
  | "MACONNERIE"
  | "BOIS_COFFRAGE"
  | "PLOMBERIE"
  | "ELECTRICITE"
  | "FINITIONS"
  | "EQUIPEMENT";

/**
 * Un article du référentiel, commun à tous les projets de l'entreprise (F9-1).
 * Catégorie et nature sont **ouvertes** : un code connu (`CategorieArticle`,
 * `NatureArticle`) se traduit, une valeur ajoutée par l'entreprise s'affiche
 * telle quelle. Seule la nature `EQUIPEMENT` change le circuit de réception.
 */
export interface Materiau {
  id: string;
  code: string;
  designation: string;
  categorie: CategorieArticle | (string & {});
  nature: NatureArticle | (string & {});
  /** L'unité de mesure, telle qu'elle se compte sur le chantier : « sac », « m³ ». */
  unite: string;
  /** Proposé au premier approvisionnement d'un lot (RG-STK-09). */
  seuilDefaut: number;
  actif: boolean;
}

/** Une personne citée par un document — le serveur la nomme, l'écran ne la devine pas. */
export interface Personne {
  id: string;
  nom: string;
}

/** Un lot, tel que le stock le cite. */
export interface LotStock {
  id: string;
  code: string;
  nom: string;
  projetId: string;
  projetNom: string;
}

/* ------------------------------------------------------------------ *
 * F9-2 — La demande d'approvisionnement.
 * ------------------------------------------------------------------ */

export type StatutDemande =
  | "EN_ATTENTE"
  | "COMMANDEE_PARTIELLEMENT"
  | "COMMANDEE"
  | "SOLDEE"
  | "ANNULEE";

export interface LigneDemande {
  materiauId: string;
  quantiteDemandee: number;
  /** Le cumul des quantités passées en BC — calculé par le serveur. */
  quantiteCommandee: number;
}

/** Une modification journalisée (RG-STK-08) : qui, quand, quels champs. */
export interface ModificationDemande {
  le: string;
  par: Personne;
  champs: ChampDemande[];
}

export type ChampDemande = "lot" | "dateSouhaitee" | "observation" | "lignes";

export interface DemandeAppro {
  id: string;
  reference: string;
  projetId: string;
  lotId: string;
  emetteur: Personne;
  emiseLe: string;
  /** Date ISO courte. */
  dateSouhaitee: string;
  observation: string;
  statut: StatutDemande;
  lignes: LigneDemande[];
  modifications: ModificationDemande[];
  /** Obligatoire à l'annulation par la direction. */
  annulation: Motive | null;
  /** Une DA résiduelle naît de la clôture d'un BC partiel (RG-STK-07). */
  residuelleDe: string | null;
}

/** Un geste qui exige un motif : annulation, clôture, rejet. */
export interface Motive {
  motif: string;
  par: Personne;
  le: string;
}

/* ------------------------------------------------------------------ *
 * F9-3 — Le bon de commande.
 * ------------------------------------------------------------------ */

export type StatutCommande =
  | "EMIS"
  | "EN_ATTENTE_LIVRAISON"
  | "RECU_PARTIELLEMENT"
  | "LIVRE"
  | "ANNULE";

/** Issu d'une DA (standard), ou passé en urgence sans DA (RG-STK-06). */
export type OrigineCommande = "DEMANDE" | "COMMANDE_DIRECTE";

export interface LigneCommande {
  materiauId: string;
  quantiteCommandee: number;
  /** Ce qui est entré en stock : la somme des BRV validés. */
  quantiteLivree: number;
}

export interface ClotureCommande extends Motive {
  /** La DA résiduelle engendrée pour le reliquat. */
  demandeResiduelle: string;
}

export interface BonCommande {
  id: string;
  reference: string;
  origine: OrigineCommande;
  demandeId: string | null;
  demandeReference: string | null;
  projetId: string;
  lotId: string;
  fournisseur: string;
  emetteur: Personne;
  emisLe: string;
  dateLivraisonPrevue: string;
  statut: StatutCommande;
  lignes: LigneCommande[];
  /** Transmis au chantier : le magasinier et le CT sont notifiés. */
  transmisLe: string | null;
  annulation: Motive | null;
  cloture: ClotureCommande | null;
}

/* ------------------------------------------------------------------ *
 * F9-4 — La réception et le BRV.
 * ------------------------------------------------------------------ */

export type StatutLivraison =
  | "EN_ATTENTE_VALIDATION_CT"
  | "EN_ATTENTE_VALIDATION_CP"
  | "VALIDE_WORKFLOW"
  | "VALIDE_AVEC_JUSTIFICATIF"
  | "REJETE";

export interface LigneLivraison {
  materiauId: string;
  /** Le reste à livrer du BC au moment de la réception. */
  quantiteAttendue: number;
  quantiteRecue: number;
  /** Fixée par le CT à la validation ; `null` avant. */
  quantiteValidee: number | null;
  conforme: boolean;
  /** Obligatoire pour une ligne non conforme. */
  motif: string;
}

export interface Validation {
  par: Personne;
  le: string;
  commentaire: string;
}

/** Le BL fournisseur signé, photographié et déposé — la condition 2 de RG-STK-01. */
export interface Justificatif {
  nom: string;
  taille: number;
  type: string;
  /** SHA-256 calculé à la réception du fichier (RG-STK-13). */
  hash: string;
  deposeLe: string;
  deposePar: Personne;
  /** Aperçu ; `null` quand le fichier est trop lourd pour être rejoué. */
  url: string | null;
}

export interface PhotoLivraison {
  nom: string;
  url: string;
}

export interface Livraison {
  id: string;
  reference: string;
  bonCommandeId: string;
  bonCommandeReference: string;
  projetId: string;
  lotId: string;
  /** Équipement dès qu'une ligne en porte un : le circuit CT → CP s'impose. */
  nature: NatureArticle;
  magasinier: Personne;
  recueLe: string;
  observation: string;
  /** Cinq au plus. */
  photos: PhotoLivraison[];
  validationCT: Validation | null;
  validationCP: Validation | null;
  /** Condition 1 de RG-STK-01 : le circuit est allé au bout. */
  workflowValide: boolean;
  /** Condition 2. */
  justificatif: Justificatif | null;
  /** Attribué à l'entrée en stock, séquentiel. */
  numeroBrv: string | null;
  statut: StatutLivraison;
  lignes: LigneLivraison[];
  /** Rejet par le CT ou le CP — un bon de retour est engendré. */
  rejet: (Motive & { bonRetour: string }) | null;
  /** Saisie sans réseau, synchronisée ensuite (RG-STK-12). */
  saisieHorsLigne: boolean;
}

/* ------------------------------------------------------------------ *
 * F9-5 — Les mouvements.
 * ------------------------------------------------------------------ */

export type TypeMouvement = "ENTREE" | "SORTIE" | "TRANSFERT" | "INVENTAIRE";
export type SourceMouvement = "BRV" | "F2" | "MANUEL" | "INVENTAIRE" | "TRANSFERT";

/** Une écriture du journal du stock — immuable (RG-STK-05). */
export interface MouvementStock {
  id: string;
  projetId: string;
  lotId: string;
  materiauId: string;
  type: TypeMouvement;
  source: SourceMouvement;
  /** Signée : positive pour ce qui entre dans le lot, négative pour ce qui en sort. */
  quantite: number;
  /** La pièce qui le fonde : BRV, rapport F2, transfert, inventaire. */
  reference: string;
  auteur: Personne;
  horodatage: string;
  motif: string | null;
  /** Le mouvement qu'il corrige, le cas échéant. */
  corrige: string | null;
}

export type PorteeTransfert = "INTER_LOTS" | "INTER_CHANTIERS";

export interface Transfert {
  id: string;
  reference: string;
  portee: PorteeTransfert;
  materiauId: string;
  quantite: number;
  source: { projetId: string; lotId: string };
  destination: { projetId: string; lotId: string };
  auteur: Personne;
  le: string;
  motif: string;
  justificatif: Justificatif;
}

/** Le seuil d'alerte d'un matériau sur un lot (RG-STK-09). */
export interface SeuilLot {
  projetId: string;
  lotId: string;
  materiauId: string;
  seuil: number;
  reglePar: Personne;
  regleLe: string;
}

/* ------------------------------------------------------------------ *
 * F9-6 — L'inventaire physique.
 * ------------------------------------------------------------------ */

export type StatutInventaire = "EN_COURS" | "SOUMIS" | "VALIDE";

export interface LigneInventaire {
  materiauId: string;
  /** Figé à l'ouverture de la session. */
  stockTheorique: number;
  /** `null` : pas encore compté. */
  stockCompte: number | null;
}

export interface SessionInventaire {
  id: string;
  reference: string;
  projetId: string;
  lotId: string;
  magasinier: Personne;
  ouverteLe: string;
  soumiseLe: string | null;
  statut: StatutInventaire;
  validation: Validation | null;
  lignes: LigneInventaire[];
}

/* ------------------------------------------------------------------ *
 * La lecture d'ensemble.
 * ------------------------------------------------------------------ */

/** Tout ce que lisent les écrans du stock, en une fois. */
export interface DonneesStock {
  /** L'instant de la lecture — les délais d'alerte s'y comptent. */
  luLe: string;
  materiaux: Materiau[];
  lots: LotStock[];
  demandes: DemandeAppro[];
  commandes: BonCommande[];
  livraisons: Livraison[];
  mouvements: MouvementStock[];
  transferts: Transfert[];
  inventaires: SessionInventaire[];
  seuils: SeuilLot[];
}

/** L'état d'un matériau sur un lot, au regard de son seuil. */
export type EtatStock = "RUPTURE" | "ALERTE" | "OK";

export interface LigneStock {
  projetId: string;
  lotId: string;
  materiau: Materiau;
  stock: number;
  seuil: number;
  /** Le seuil n'est que celui du référentiel, pas encore accepté pour ce lot. */
  seuilPropose: boolean;
  etat: EtatStock;
  dernierMouvement: string | null;
}

/** Les alertes automatiques de RG-STK-11, calculées ici à la lecture. */
export type TypeAlerteStock =
  | "STOCK_SOUS_SEUIL"
  | "VALIDATION_CT_EN_RETARD"
  | "VALIDATION_CP_EN_RETARD"
  | "ECART_INVENTAIRE"
  | "INVENTAIRE_EN_RETARD";

export interface AlerteStock {
  type: TypeAlerteStock;
  critique: boolean;
  projetId: string;
  lotId: string;
  /** La pièce ou le matériau en cause, déjà nommé. */
  objet: string;
  /** Le chiffre qui déclenche : stock restant, heures, écart en %, jours. */
  valeur: number;
}

/* ------------------------------------------------------------------ *
 * Les écritures.
 * ------------------------------------------------------------------ */

export interface SaisieDemande {
  projetId: string;
  lotId: string;
  dateSouhaitee: string;
  observation: string;
  lignes: { materiauId: string; quantite: number }[];
}

export interface SaisieCommande {
  /** Absente : commande directe (RG-STK-06). */
  demandeId: string | null;
  projetId: string;
  lotId: string;
  fournisseur: string;
  dateLivraisonPrevue: string;
  transmettre: boolean;
  lignes: { materiauId: string; quantite: number }[];
}

export interface SaisieReception {
  bonCommandeId: string;
  observation: string;
  photos: PhotoLivraison[];
  /** Le BL signé peut suivre plus tard : il est la seconde condition, pas la première. */
  justificatif: File | null;
  lignes: { materiauId: string; quantiteRecue: number; conforme: boolean; motif: string }[];
}

export interface DecisionValidation {
  livraisonId: string;
  etape: "CT" | "CP";
  commentaire: string;
  /** Au CT : la quantité retenue par ligne (≤ reçue). */
  quantitesValidees?: Record<string, number>;
}

export interface SaisieMouvement {
  projetId: string;
  lotId: string;
  materiauId: string;
  /** Une consommation hors rapport, ou une correction d'erreur (RG-STK-05). */
  sens: "SORTIE" | "CORRECTION_ENTREE" | "CORRECTION_SORTIE";
  quantite: number;
  motif: string;
  corrige: string | null;
}

export interface SaisieTransfert {
  materiauId: string;
  quantite: number;
  source: { projetId: string; lotId: string };
  destination: { projetId: string; lotId: string };
  motif: string;
  justificatif: File;
}

export interface SaisieMateriau {
  code: string;
  designation: string;
  categorie: Materiau["categorie"];
  nature: Materiau["nature"];
  unite: string;
  seuilDefaut: number;
}
