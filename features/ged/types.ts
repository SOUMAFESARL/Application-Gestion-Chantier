/**
 * Types du domaine Gestion Documentaire (GED / F6) — couche 1.
 *
 * Aucun identifiant `snake_case` ni aucune forme HTTP ne traverse ce fichier :
 * toute traduction depuis le contrat REST vit dans `adaptateur.ts`.
 */

/** Les 6 catégories documentaires BTP validées (F6). */
export type CategorieDocumentGed =
  | "PLANS"
  | "CONTRATS"
  | "RAPPORTS"
  | "ADMINISTRATIF"
  | "PHOTOS"
  | "DIVERS";

/** Origine d'un document dans le classeur GED. */
export type OrigineDocumentGed = "MANUEL" | "F1_CONTRAT" | "F2_RAPPORT" | "F9_BRV";

/** Les 3 actions de permission par catégorie (`ged.<action>_<categorie>`). */
export type ActionPermissionGed = "voir" | "deposer" | "supprimer";

/** Auteur ou utilisateur référencé dans la GED. */
export interface AuteurGed {
  id: string;
  nomComplet: string;
}

/** Liaison traçable vers l'objet source d'un document archivé automatiquement. */
export interface SourceLiaisonGed {
  typeSource: string;
  objetId: string;
  sousType?: "CONTRAT" | "ORDRE_SERVICE" | "AVENANT" | string | null;
}

/** Une version horodatée d'un document GED (v1, v2, …). */
export interface VersionDocumentGed {
  id: string;
  numeroVersion: number;
  numero: string;
  nomFichier: string;
  taille: number;
  mimeType: string;
  hashSha256: string;
  commentaire: string;
  auteur: AuteurGed | null;
  creeLe: string;
  estActive: boolean;
}

/** Un document du classeur GED d'un chantier. */
export interface DocumentGed {
  id: string;
  projetId: string;
  projetNom: string;
  projetReference: string;
  categorie: CategorieDocumentGed;
  nom: string;
  description: string;
  estReference: boolean;
  estAutomatique: boolean;
  origine: OrigineDocumentGed;
  sourceLiaison: SourceLiaisonGed | null;
  versionActive: VersionDocumentGed | null;
  nombreVersions: number;
  /** Présent sur le détail (`GET /ged/documents/{id}/`), trié par `numeroVersion DESC`. */
  versions?: VersionDocumentGed[];
  createur: AuteurGed | null;
  creeLe: string;
  modifieLe: string;
  /** Flags SSOT calculés par le serveur (partage & audit réservés AD / DG / DO / CP). */
  peutPartager?: boolean;
  peutVoirHistorique?: boolean;
  peutSupprimer?: boolean;
}

/** Actions tracées dans le journal d'audit documentaire. */
export type ActionAuditGed =
  | "CONSULTATION"
  | "TELECHARGEMENT"
  | "DEPOT"
  | "NOUVELLE_VERSION"
  | "EPINGLAGE"
  | "PARTAGE"
  | "REVOCATION_PARTAGE"
  | "SUPPRESSION"
  | (string & {});

/** Une entrée du journal des consultations, dépôts, partages et suppressions. */
export interface EvenementAuditGed {
  id: string;
  action: ActionAuditGed;
  actionLibelle: string;
  utilisateur: AuteurGed | null;
  details: string;
  creeLe: string;
  documentId?: string;
  documentNom?: string;
}

/** État calculé d'un lien de partage temporaire 72 h. */
export type StatutLienPartageGed = "actif" | "expire" | "revoque";

/** Un lien de partage externe temporaire (72 h) rattaché à un document. */
export interface LienPartageGed {
  id: string;
  jeton: string;
  urlPublique: string;
  destinataire: string;
  note: string;
  creePar: AuteurGed | null;
  creeLe: string;
  expireLe: string;
  revoque: boolean;
  consultations: number;
}

/** Métadonnées servies publiquement sur `/partage/[jeton]` sans authentification. */
export interface DocumentPartagePublic {
  jeton: string;
  expireLe: string;
  destinataire: string;
  note: string;
  entrepriseNom: string;
  projetNom: string;
  projetReference: string;
  document: {
    nom: string;
    categorie: CategorieDocumentGed;
    description: string;
    version: string;
    nomFichier: string;
    taille: number;
    mimeType: string;
    hashSha256: string;
    deposeLe: string;
  };
}

/** Critères de recherche et de filtrage combinés de la liste GED. */
export interface CriteresDocumentsGed {
  recherche: string;
  projetId: string;
  categorie: CategorieDocumentGed | "";
  origine: OrigineDocumentGed | "";
  referencesUniquement: boolean;
  /** Date ISO `YYYY-MM-DD` (incluse). */
  dateDebut: string;
  /** Date ISO `YYYY-MM-DD` (incluse). */
  dateFin: string;
}

/** Données nécessaires pour déposer un nouveau document (v1). */
export interface SaisieDepotDocumentGed {
  projetId: string;
  categorie: CategorieDocumentGed;
  nom: string;
  description: string;
  commentaire: string;
  estReference: boolean;
  fichier: File;
}

/** Données nécessaires pour publier une nouvelle version (vN+1). */
export interface SaisieNouvelleVersionGed {
  fichier: File;
  commentaire: string;
  estReference?: boolean;
}

/** Données facultatives pour générer un lien de partage externe 72 h. */
export interface SaisiePartageExterneGed {
  destinataire: string;
  note: string;
}
