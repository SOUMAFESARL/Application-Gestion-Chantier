/**
 * Règles métier pures du domaine Gestion Documentaire (GED / F6) — couche 2.
 *
 * Zéro React, zéro réseau, zéro chaîne française en dur : toute erreur ou motif
 * est retourné sous forme de code discriminant traduit côté écran.
 */

import { peutCode } from "@/features/habilitations/regles";
import type { Droits } from "@/features/habilitations/types";
import { ErreurApi } from "@/lib/api";

import type {
  ActionPermissionGed,
  CategorieDocumentGed,
  CriteresDocumentsGed,
  DocumentGed,
  LienPartageGed,
  OrigineDocumentGed,
  StatutLienPartageGed,
} from "./types";

/** Les 6 catégories documentaires dans l'ordre du registre backend. */
export const CATEGORIES_GED: readonly CategorieDocumentGed[] = [
  "PLANS",
  "CONTRATS",
  "RAPPORTS",
  "ADMINISTRATIF",
  "PHOTOS",
  "DIVERS",
] as const;

/** Les origines possibles d'un document GED. */
export const ORIGINES_GED: readonly OrigineDocumentGed[] = [
  "MANUEL",
  "F1_CONTRAT",
  "F2_RAPPORT",
  "F9_BRV",
] as const;

/** Extensions autorisées au dépôt GED (F6 + compatibilité F2 .doc/.xls). */
export const EXTENSIONS_AUTORISEES_GED = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
] as const;

/** Valeur prête pour l'attribut HTML `accept` de `<input type="file">`. */
export const ACCEPT_FICHIERS_GED = EXTENSIONS_AUTORISEES_GED.join(",");

/** Taille maximale par fichier : 50 Mo. */
export const TAILLE_MAX_DOCUMENT_GED = 50 * 1024 * 1024;

/** Durée de validité d'un lien de partage externe : 72 heures. */
export const DUREE_PARTAGE_HEURES = 72;

/** Critères vierges de la liste GED. */
export const CRITERES_DOCUMENTS_GED_VIDES: CriteresDocumentsGed = {
  recherche: "",
  projetId: "",
  categorie: "",
  origine: "",
  referencesUniquement: false,
  dateDebut: "",
  dateFin: "",
};

/** Code d'erreur retourné lors de la validation d'un fichier GED. */
export type ErreurFichierGed = "extension" | "taille" | "vide";

/**
 * Valide un fichier avant dépôt ou nouvelle version :
 * - fichier non vide (> 0 octet) ;
 * - extension dans `.pdf`, `.jpg`, `.jpeg`, `.png`, `.doc`, `.docx`, `.xls`, `.xlsx` ;
 * - taille <= 50 Mo.
 */
export function validerFichierGed(fichier: File): ErreurFichierGed | null {
  if (fichier.size <= 0) return "vide";

  const nom = fichier.name.trim().toLowerCase();
  const dernierPoint = nom.lastIndexOf(".");
  const extension = dernierPoint >= 0 ? nom.slice(dernierPoint) : "";
  if (!(EXTENSIONS_AUTORISEES_GED as readonly string[]).includes(extension)) {
    return "extension";
  }

  if (fichier.size > TAILLE_MAX_DOCUMENT_GED) {
    return "taille";
  }

  return null;
}

/** Extrait l'extension en majuscules sans point (« PDF », « DOCX »), ou `""`. */
export function extraireExtensionFichier(nomFichier: string | null | undefined): string {
  if (!nomFichier) return "";
  const propre = nomFichier.trim();
  const index = propre.lastIndexOf(".");
  if (index <= 0 || index === propre.length - 1) return "";
  return propre.slice(index + 1).toUpperCase();
}

/** Propose un titre lisible depuis un nom de fichier (sans extension, `_`/`-` → espaces). */
export function nomDocumentDepuisFichier(nomFichier: string): string {
  return nomFichier
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *
 * Habilitations GED (miroir strict de `apps/ged/permissions.py`).
 * ------------------------------------------------------------------ */

/** Construit le code de permission normalisé `ged.<action>_<categorie>`. */
export function codePermissionGed(
  action: ActionPermissionGed,
  categorie: CategorieDocumentGed,
): string {
  return `ged.${action}_${categorie.toLowerCase()}`;
}

/** Le compte peut-il voir la catégorie donnée ? */
export function peutVoirCategorie(
  droits: Droits | null,
  categorie: CategorieDocumentGed,
): boolean {
  return peutCode(droits, codePermissionGed("voir", categorie));
}

/** Le compte peut-il déposer ou mettre à jour des documents dans la catégorie donnée ? */
export function peutDeposerCategorie(
  droits: Droits | null,
  categorie: CategorieDocumentGed,
): boolean {
  return peutCode(droits, codePermissionGed("deposer", categorie));
}

/** Catégories visibles pour ce compte dans l'ordre du registre. */
export function categoriesVisiblesGed(droits: Droits | null): CategorieDocumentGed[] {
  return CATEGORIES_GED.filter((categorie) => peutVoirCategorie(droits, categorie));
}

/** Catégories dans lesquelles ce compte peut déposer un document. */
export function categoriesDeposablesGed(droits: Droits | null): CategorieDocumentGed[] {
  return CATEGORIES_GED.filter((categorie) => peutDeposerCategorie(droits, categorie));
}

/** Le compte a-t-il accès en consultation à la GED ? */
export function peutConsulterGed(droits: Droits | null): boolean {
  return peutCode(droits, "ged.lire") || categoriesVisiblesGed(droits).length > 0;
}

/** Le compte peut-il télécharger un document GED ? */
export function peutTelechargerGed(droits: Droits | null): boolean {
  return peutCode(droits, "ged.telecharger");
}

/**
 * Suppression autorisée uniquement sur un document manuel (`!estAutomatique`)
 * avec la permission `ged.supprimer_<categorie>` (le serveur vérifie aussi AD/CP).
 */
export function peutSupprimerDocument(
  droits: Droits | null,
  document: Pick<DocumentGed, "estAutomatique" | "categorie">,
): boolean {
  if (document.estAutomatique) return false;
  return peutCode(droits, codePermissionGed("supprimer", document.categorie));
}

/** Explique pourquoi un document ne peut pas être supprimé (pour l'info-bulle). */
export function motifRefusSuppressionDocument(
  droits: Droits | null,
  document: Pick<DocumentGed, "estAutomatique" | "categorie">,
): "automatique" | "permission" | null {
  if (document.estAutomatique) return "automatique";
  if (!peutCode(droits, codePermissionGed("supprimer", document.categorie))) return "permission";
  return null;
}

/** Épingler ou désépingler un document comme référence exige `ged.deposer_<categorie>`. */
export function peutEpinglerDocument(
  droits: Droits | null,
  document: Pick<DocumentGed, "categorie">,
): boolean {
  return peutDeposerCategorie(droits, document.categorie);
}

/** Ajouter une nouvelle version est interdit sur les pièces archivées automatiquement. */
export function peutAjouterVersionDocument(
  droits: Droits | null,
  document: Pick<DocumentGed, "estAutomatique" | "categorie">,
): boolean {
  if (document.estAutomatique) return false;
  return peutDeposerCategorie(droits, document.categorie);
}

/** Partager un lien externe 72 h exige la lecture sur la catégorie et un droit de téléchargement ou dépôt. */
export function peutPartagerDocument(
  droits: Droits | null,
  document: Pick<DocumentGed, "categorie">,
): boolean {
  return (
    peutVoirCategorie(droits, document.categorie) &&
    (peutTelechargerGed(droits) || peutDeposerCategorie(droits, document.categorie))
  );
}

/* ------------------------------------------------------------------ *
 * Filtrage, comptage et tri des documents.
 * ------------------------------------------------------------------ */

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function horodatageDocument(document: DocumentGed): number {
  const brut = document.versionActive?.creeLe || document.modifieLe || document.creeLe;
  const temps = Date.parse(brut);
  return Number.isNaN(temps) ? 0 : temps;
}

function dateIsoCourte(valeur: string | null | undefined): string {
  if (!valeur) return "";
  return valeur.slice(0, 10);
}

/**
 * Tri réglementaire GED :
 * 1. Documents de référence épinglés en tête (`estReference DESC`) ;
 * 2. Date de dernière mise à jour décroissante.
 */
export function trierDocumentsGed(documents: readonly DocumentGed[]): DocumentGed[] {
  return [...documents].sort((a, b) => {
    if (a.estReference !== b.estReference) {
      return a.estReference ? -1 : 1;
    }
    return horodatageDocument(b) - horodatageDocument(a);
  });
}

/**
 * Filtre et trie les documents GED selon tous les critères combinés :
 * recherche texte, catégorie, origine, projet, références uniquement et plage de dates.
 */
export function filtrerDocumentsGed(
  documents: readonly DocumentGed[],
  criteres: CriteresDocumentsGed,
): DocumentGed[] {
  const terme = normaliserTexte(criteres.recherche);

  const filtres = documents.filter((doc) => {
    if (criteres.projetId && doc.projetId !== criteres.projetId) return false;
    if (criteres.categorie && doc.categorie !== criteres.categorie) return false;
    if (criteres.origine && doc.origine !== criteres.origine) return false;
    if (criteres.referencesUniquement && !doc.estReference) return false;

    if (criteres.dateDebut || criteres.dateFin) {
      const jourDoc = dateIsoCourte(doc.versionActive?.creeLe || doc.creeLe);
      if (!jourDoc) return false;
      if (criteres.dateDebut && jourDoc < criteres.dateDebut) return false;
      if (criteres.dateFin && jourDoc > criteres.dateFin) return false;
    }

    if (terme) {
      const champs = [
        doc.nom,
        doc.description,
        doc.versionActive?.nomFichier ?? "",
        doc.versionActive?.commentaire ?? "",
        doc.projetNom,
        doc.projetReference,
        doc.createur?.nomComplet ?? "",
        doc.versionActive?.auteur?.nomComplet ?? "",
      ];
      const correspond = champs.some((champ) => normaliserTexte(champ).includes(terme));
      if (!correspond) return false;
    }

    return true;
  });

  return trierDocumentsGed(filtres);
}

/** Indique si au moins un filtre utilisateur est actif dans la barre d'outils. */
export function criteresGedActifs(
  criteres: CriteresDocumentsGed,
  projetIdFixe?: string,
): boolean {
  return Boolean(
    criteres.recherche.trim() ||
      (!projetIdFixe && criteres.projetId) ||
      criteres.origine ||
      criteres.referencesUniquement ||
      criteres.dateDebut ||
      criteres.dateFin,
  );
}

/** Compte le nombre de documents par catégorie pour les compteurs d'onglets. */
export function compterParCategorieGed(
  documents: readonly DocumentGed[],
): Record<CategorieDocumentGed, number> {
  const compteurs: Record<CategorieDocumentGed, number> = {
    PLANS: 0,
    CONTRATS: 0,
    RAPPORTS: 0,
    ADMINISTRATIF: 0,
    PHOTOS: 0,
    DIVERS: 0,
  };
  for (const doc of documents) {
    compteurs[doc.categorie] += 1;
  }
  return compteurs;
}

/* ------------------------------------------------------------------ *
 * Liaisons inter-modules, partages 72 h et empreintes SHA-256.
 * ------------------------------------------------------------------ */

/** Route applicative vers l'écran source d'un document archivé automatiquement. */
export function lienSourceDocument(
  doc: Pick<DocumentGed, "origine" | "projetId" | "sourceLiaison">,
): string | null {
  switch (doc.origine) {
    case "F1_CONTRAT": {
      if (!doc.projetId) return "/projets";
      const typeSource = (doc.sourceLiaison?.typeSource ?? "").toUpperCase();
      if (typeSource.includes("AVENANT")) {
        return `/projets/${doc.projetId}/avenants`;
      }
      return `/projets/${doc.projetId}/configuration`;
    }
    case "F2_RAPPORT":
      return "/rapports";
    case "F9_BRV":
      return "/stocks";
    case "MANUEL":
    default:
      return null;
  }
}

/** Détermine si un lien de partage 72 h est expiré ou révoqué. */
export function partageEstExpire(
  partage: Pick<LienPartageGed, "expireLe" | "revoque">,
  maintenant: Date = new Date(),
): boolean {
  if (partage.revoque) return true;
  const echeance = Date.parse(partage.expireLe);
  if (Number.isNaN(echeance)) return true;
  return echeance <= maintenant.getTime();
}

/** Statut synthétique d'un lien de partage 72 h (`actif` | `expire` | `revoque`). */
export function statutLienPartage(
  partage: Pick<LienPartageGed, "expireLe" | "revoque">,
  maintenant: Date = new Date(),
): StatutLienPartageGed {
  if (partage.revoque) return "revoque";
  return partageEstExpire(partage, maintenant) ? "expire" : "actif";
}

/** Abrège une empreinte SHA-256 pour l'affichage en tableau (`a3f19c02e4b1…`). */
export function formaterEmpreinteCourte(
  sha256: string | null | undefined,
  longueur = 12,
): string {
  if (!sha256) return "";
  const propre = sha256.trim();
  if (propre.length <= longueur) return propre;
  return `${propre.slice(0, longueur)}…`;
}

/** Construit l'URL absolue à copier dans le presse-papiers pour un lien de partage. */
export function urlCompletePartage(urlPublique: string, origineNavigateur?: string): string {
  if (!urlPublique) return "";
  if (/^https?:\/\//i.test(urlPublique)) return urlPublique;
  const chemin = urlPublique.startsWith("/") ? urlPublique : `/${urlPublique}`;
  if (!origineNavigateur) return chemin;
  return `${origineNavigateur.replace(/\/$/, "")}${chemin}`;
}

/**
 * Détecte une indisponibilité de l'API GED (routes backend non encore déployées : 404 / 503)
 * pour basculer sur un état informatif gracieux avec bouton Réessayer.
 */
export function estApiGedIndisponible(erreur: unknown): boolean {
  if (!(erreur instanceof ErreurApi)) return false;
  return (
    erreur.statut === 404 ||
    erreur.statut === 501 ||
    erreur.statut === 503 ||
    erreur.code === "introuvable" ||
    erreur.code === "service_indisponible"
  );
}
