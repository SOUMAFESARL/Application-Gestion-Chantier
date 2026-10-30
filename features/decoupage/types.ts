/**
 * Les types du domaine Découpage — l'arbre de cases d'un projet (décisions v1.2).
 *
 * Le serveur (`apps/projets`, vues `decoupage.py`) a remplacé le couple Lot → Activité par un
 * **arbre d'éléments** : phase, ouvrage, lot, activité sont le même objet, rangé à un niveau du
 * **gabarit** du projet. Aucun comportement ne dépend du libellé d'un niveau : ce qui varie
 * dépend de la position (feuille ou parent) ou d'un réglage explicite (« alerter à ce niveau »).
 *
 * Domaine à part de `features/projets` parce que son adaptateur porte une famille de routes
 * entière (`/decoupage/*`, `/projets/{id}/arbre/`, `/elements/*`) : les mêler aux projets aurait
 * doublé un fichier qui en compte déjà 1 700 lignes.
 *
 * Tous les montants sont en **centimes**, comme partout dans le frontend.
 */

/** Une liste ou un modèle se désigne par son origine et son identifiant, jamais par son nom. */
export type OrigineReference = "PLATEFORME" | "ENTREPRISE";

export interface ReferenceListe {
  origine: OrigineReference;
  id: string;
  libelle: string;
}

export interface ValeurListe {
  id: string;
  libelle: string;
  groupe: string;
  origine: OrigineReference;
}

export interface ListeValeurs extends ReferenceListe {
  description: string;
  /** Vrai pour une liste de l'entreprise ; une liste de la plateforme se complète seulement. */
  modifiable: boolean;
  valeurs: ValeurListe[];
}

/** Un modèle de découpage, tel que la liste des modèles le résume. */
export interface ResumeModele {
  origine: OrigineReference;
  id: string;
  nom: string;
  /** « Nom (personnalisé) » pour la copie d'un modèle de la plateforme. */
  nomAffiche: string;
  description: string;
  typesProjet: string[];
  /** Les libellés de ses niveaux, dans l'ordre. */
  niveaux: string[];
  nombreLignes: number;
  /** Conçu pour le type du projet demandé. */
  pourCeType: boolean;
  /** Celui qui pré-remplit le tableau d'un projet de ce type. */
  parDefaut: boolean;
}

/** Les unités de mesure d'une feuille (`UniteMesure` du serveur). */
export const UNITES_MESURE = ["M2", "ML", "M3", "KG", "U", "FORFAIT"] as const;
export type UniteMesure = (typeof UNITES_MESURE)[number];

/** Les modes de mesure d'une feuille (§9). */
export const MODES_MESURE = ["QUANTITE", "POURCENTAGE", "JALON"] as const;
export type ModeMesure = (typeof MODES_MESURE)[number];

/* ------------------------------------------------------------------ *
 * Le tableau de démarrage (§5, §6).
 * ------------------------------------------------------------------ */

/** Un niveau du gabarit, tel qu'on le saisit (avant que le projet n'en ait). */
export interface NiveauGabarit {
  libelle: string;
  liste: ReferenceListe | null;
  /** « Alerter à ce niveau » : les alertes de retard se calculent sur les cases de ce niveau. */
  alerter: boolean;
}

/**
 * Une ligne du tableau : **une ligne = une feuille**. Ses cellules suivent les niveaux, dans
 * l'ordre ; une cellule vide en fin de ligne est permise, au milieu elle est interdite (C-1).
 */
export interface LigneTableau {
  /** Identifiant local, pour que React garde la saisie en place ; jamais envoyé. */
  cle: string;
  cellules: string[];
  unite: UniteMesure | null;
  quantite: number | null;
  /** En centimes. */
  montant: number | null;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface ModeleApplique {
  origine: OrigineReference;
  id: string;
  nom: string;
}

export interface TableauDemarrage {
  /** Le modèle qui a pré-rempli le tableau ; `null` quand aucun n'existe. */
  modele: ModeleApplique | null;
  niveaux: NiveauGabarit[];
  lignes: LigneTableau[];
}

/** Les règles de cohérence : C-1 à C-4 bloquent, C-5 à C-7 avertissent (§6). */
export type RegleTableau = "C-1" | "C-2" | "C-3" | "C-4" | "C-5" | "C-6" | "C-7" | "SANS_EFFET";

/** Un constat de la vérification. Le message vient du serveur et se lit tel quel. */
export interface ConstatTableau {
  regle: RegleTableau | (string & {});
  /** Le numéro de ligne (1 = première ligne envoyée), quand le constat en vise une. */
  ligne: number | null;
  /** Le rang du niveau (1 = premier), quand le constat en vise un. */
  niveau: number | null;
  /** C-7 : un avertissement discret (une coquille possible), pas une alerte. */
  discret: boolean;
  message: string;
}

export interface VerdictTableau {
  bloquants: ConstatTableau[];
  avertissements: ConstatTableau[];
  apercu: { cases: number; feuilles: number; niveaux: number };
}

/** Ce que l'import d'un fichier Excel ou CSV rend : un tableau, et sa vérification. */
export interface TableauImporte {
  niveaux: NiveauGabarit[];
  lignes: LigneTableau[];
  verification: VerdictTableau;
}

export interface ResultatApplication {
  casesCreees: number;
  /** Les numéros des lignes dont la feuille existait déjà (ajout en masse). */
  lignesDejaPresentes: number[];
}

/**
 * Le refus d'une application : des bloquants à corriger, ou des avertissements à confirmer.
 * Tiré des `details` de l'erreur `regle_metier` par l'adaptateur.
 */
export interface RefusTableau {
  bloquants: ConstatTableau[];
  avertissements: ConstatTableau[];
  confirmationRequise: boolean;
}
