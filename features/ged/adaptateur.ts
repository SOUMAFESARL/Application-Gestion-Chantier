/**
 * Adaptateur HTTP du domaine Gestion Documentaire (GED / F6) — couche 4.
 *
 * Seul fichier du domaine à parler aux clients HTTP (`api`, `apiPlateforme`, `appeler`).
 * Tous les types de transport `Charge*` en `snake_case` restent privés ; seules
 * des structures de `types.ts` (`camelCase`) en sortent.
 *
 * Contrat REST consommé (`API-Gestion-Chantier/docs/api-ged-contrat-frontend.md`) :
 *   GET    /ged/documents/
 *   POST   /ged/documents/
 *   GET    /ged/documents/{id}/
 *   PATCH  /ged/documents/{id}/
 *   DELETE /ged/documents/{id}/
 *   GET    /ged/documents/{id}/versions/
 *   POST   /ged/documents/{id}/versions/
 *   GET    /ged/documents/{id}/telecharger/
 *   GET    /ged/documents/{id}/versions/{versionId}/telecharger/
 *   GET    /ged/documents/{id}/historique/
 *   GET    /ged/documents/{id}/partages/
 *   POST   /ged/documents/{id}/partages/
 *   DELETE /ged/partages/{partageId}/
 *   GET    /public/partages/{jeton}/                  (anonyme, via `apiPlateforme`)
 *   GET    /public/partages/{jeton}/telecharger/      (anonyme, sans JWT)
 */

import { api, apiPlateforme, appeler, basePlateforme } from "@/lib/api";
import { appelerBlob } from "@/lib/api/client";

import { CATEGORIES_GED } from "./regles";
import type {
  AuteurGed,
  CategorieDocumentGed,
  DocumentGed,
  DocumentPartagePublic,
  EvenementAuditGed,
  LienPartageGed,
  OrigineDocumentGed,
  SaisieDepotDocumentGed,
  SaisieNouvelleVersionGed,
  SaisiePartageExterneGed,
  SourceLiaisonGed,
  VersionDocumentGed,
} from "./types";

/* ------------------------------------------------------------------ *
 * Charges de transport (`snake_case`, privées au fichier).
 * ------------------------------------------------------------------ */

interface ChargeListe<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

interface ChargeAuteur {
  id: string;
  nom_complet?: string;
  prenom?: string;
  nom?: string;
}

interface ChargeSourceLiaison {
  type_source?: string | null;
  objet_id?: string | null;
}

interface ChargeVersionDocument {
  id: string;
  numero_version?: number;
  numero?: string | null;
  nom_fichier?: string | null;
  taille?: number | string | null;
  mime_type?: string | null;
  hash_sha256?: string | null;
  commentaire?: string | null;
  auteur?: ChargeAuteur | null;
  cree_le?: string | null;
  est_active?: boolean;
}

interface ChargeDocumentGed {
  id: string;
  projet_id?: string | null;
  projet?: string | { id: string; nom?: string; reference?: string } | null;
  projet_nom?: string | null;
  projet_reference?: string | null;
  categorie?: string | null;
  nom?: string | null;
  description?: string | null;
  est_reference?: boolean;
  est_automatique?: boolean;
  origine?: string | null;
  source_liaison?: ChargeSourceLiaison | null;
  version_active?: ChargeVersionDocument | null;
  nombre_versions?: number | null;
  versions?: ChargeVersionDocument[] | null;
  createur?: ChargeAuteur | null;
  cree_le?: string | null;
  modifie_le?: string | null;
}

interface ChargeEvenementAudit {
  id: string;
  action?: string | null;
  action_libelle?: string | null;
  utilisateur?: ChargeAuteur | null;
  details?: string | null;
  cree_le?: string | null;
  document_id?: string | null;
  document_nom?: string | null;
}

interface ChargeLienPartage {
  id: string;
  jeton: string;
  url_publique?: string | null;
  destinataire?: string | null;
  note?: string | null;
  cree_par?: ChargeAuteur | null;
  cree_le?: string | null;
  expire_le: string;
  revoque?: boolean;
  consultations?: number | null;
}

interface ChargeDocumentPartagePublic {
  jeton: string;
  expire_le: string;
  destinataire?: string | null;
  note?: string | null;
  entreprise_nom?: string | null;
  projet_nom?: string | null;
  projet_reference?: string | null;
  document: {
    nom?: string | null;
    categorie?: string | null;
    description?: string | null;
    version?: string | null;
    nom_fichier?: string | null;
    taille?: number | string | null;
    mime_type?: string | null;
    hash_sha256?: string | null;
    depose_le?: string | null;
  };
}

/* ------------------------------------------------------------------ *
 * Traductions serveur → domaine (`vers*`).
 * ------------------------------------------------------------------ */

function aPlat<T>(charge: T[] | ChargeListe<T> | null | undefined): T[] {
  return Array.isArray(charge) ? charge : (charge?.results ?? []);
}

function versEntier(valeur: number | string | null | undefined): number {
  if (valeur === null || valeur === undefined || valeur === "") return 0;
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(nombre) ? Math.max(0, Math.round(nombre)) : 0;
}

function versCategorie(valeur: string | null | undefined): CategorieDocumentGed {
  const normalise = (valeur ?? "").toUpperCase();
  return (CATEGORIES_GED as readonly string[]).includes(normalise)
    ? (normalise as CategorieDocumentGed)
    : "DIVERS";
}

function versOrigine(
  valeur: string | null | undefined,
  estAutomatique?: boolean,
  typeSource?: string | null,
): OrigineDocumentGed {
  const brut = (valeur ?? typeSource ?? "").toUpperCase();
  if (brut === "F1_CONTRAT" || brut === "F1" || brut.startsWith("F1_")) return "F1_CONTRAT";
  if (brut === "F2_RAPPORT" || brut === "F2" || brut.startsWith("F2_")) return "F2_RAPPORT";
  if (brut === "F9_BRV" || brut === "F9" || brut.startsWith("F9_")) return "F9_BRV";
  if (brut === "MANUEL") return "MANUEL";
  return estAutomatique ? "F1_CONTRAT" : "MANUEL";
}

function versAuteur(charge: ChargeAuteur | null | undefined): AuteurGed | null {
  if (!charge) return null;
  const nomComplet =
    charge.nom_complet?.trim() || `${charge.prenom ?? ""} ${charge.nom ?? ""}`.trim();
  return {
    id: charge.id,
    nomComplet,
  };
}

function versSourceLiaison(
  charge: ChargeSourceLiaison | null | undefined,
): SourceLiaisonGed | null {
  if (!charge || !charge.type_source || !charge.objet_id) return null;
  return {
    typeSource: charge.type_source,
    objetId: charge.objet_id,
  };
}

function versVersionDocument(charge: ChargeVersionDocument): VersionDocumentGed {
  const numeroVersion = charge.numero_version ?? 1;
  return {
    id: charge.id,
    numeroVersion,
    numero: charge.numero?.trim() || `v${numeroVersion}`,
    nomFichier: charge.nom_fichier ?? "",
    taille: versEntier(charge.taille),
    mimeType: charge.mime_type ?? "",
    hashSha256: charge.hash_sha256 ?? "",
    commentaire: charge.commentaire ?? "",
    auteur: versAuteur(charge.auteur),
    creeLe: charge.cree_le ?? "",
    estActive: charge.est_active ?? false,
  };
}

function versDocumentGed(charge: ChargeDocumentGed): DocumentGed {
  const objetProjet =
    charge.projet && typeof charge.projet === "object" ? charge.projet : null;
  const projetId =
    charge.projet_id ??
    (typeof charge.projet === "string" ? charge.projet : objetProjet?.id) ??
    "";
  const versions = charge.versions
    ? charge.versions
        .map(versVersionDocument)
        .sort((a, b) => b.numeroVersion - a.numeroVersion)
    : undefined;
  const versionActive = charge.version_active
    ? { ...versVersionDocument(charge.version_active), estActive: true }
    : (versions?.find((v) => v.estActive) ?? versions?.[0] ?? null);
  const sourceLiaison = versSourceLiaison(charge.source_liaison);
  const estAutomatique = Boolean(charge.est_automatique);

  return {
    id: charge.id,
    projetId,
    projetNom: charge.projet_nom ?? objetProjet?.nom ?? "",
    projetReference: charge.projet_reference ?? objetProjet?.reference ?? "",
    categorie: versCategorie(charge.categorie),
    nom: charge.nom ?? "",
    description: charge.description ?? "",
    estReference: Boolean(charge.est_reference),
    estAutomatique,
    origine: versOrigine(charge.origine, estAutomatique, sourceLiaison?.typeSource),
    sourceLiaison,
    versionActive,
    nombreVersions: charge.nombre_versions ?? versions?.length ?? (versionActive ? 1 : 0),
    versions,
    createur: versAuteur(charge.createur),
    creeLe: charge.cree_le ?? versionActive?.creeLe ?? "",
    modifieLe: charge.modifie_le ?? versionActive?.creeLe ?? charge.cree_le ?? "",
  };
}

function versEvenementAudit(charge: ChargeEvenementAudit): EvenementAuditGed {
  return {
    id: charge.id,
    action: charge.action ?? "CONSULTATION",
    actionLibelle: charge.action_libelle ?? charge.action ?? "",
    utilisateur: versAuteur(charge.utilisateur),
    details: charge.details ?? "",
    creeLe: charge.cree_le ?? "",
    documentId: charge.document_id ?? undefined,
    documentNom: charge.document_nom ?? undefined,
  };
}

function versLienPartage(charge: ChargeLienPartage): LienPartageGed {
  return {
    id: charge.id,
    jeton: charge.jeton,
    urlPublique: charge.url_publique ?? `/partage/${charge.jeton}`,
    destinataire: charge.destinataire ?? "",
    note: charge.note ?? "",
    creePar: versAuteur(charge.cree_par),
    creeLe: charge.cree_le ?? "",
    expireLe: charge.expire_le,
    revoque: Boolean(charge.revoque),
    consultations: versEntier(charge.consultations),
  };
}

function versDocumentPartagePublic(charge: ChargeDocumentPartagePublic): DocumentPartagePublic {
  return {
    jeton: charge.jeton,
    expireLe: charge.expire_le,
    destinataire: charge.destinataire ?? "",
    note: charge.note ?? "",
    entrepriseNom: charge.entreprise_nom ?? "",
    projetNom: charge.projet_nom ?? "",
    projetReference: charge.projet_reference ?? "",
    document: {
      nom: charge.document.nom ?? "",
      categorie: versCategorie(charge.document.categorie),
      description: charge.document.description ?? "",
      version: charge.document.version ?? "v1",
      nomFichier: charge.document.nom_fichier ?? "",
      taille: versEntier(charge.document.taille),
      mimeType: charge.document.mime_type ?? "",
      hashSha256: charge.document.hash_sha256 ?? "",
      deposeLe: charge.document.depose_le ?? "",
    },
  };
}

/* ------------------------------------------------------------------ *
 * Fonctions d'accès aux données (verbes à l'infinitif).
 * ------------------------------------------------------------------ */

export interface ParametresListeDocumentsGed {
  projetId?: string;
  categorie?: CategorieDocumentGed | "";
  origine?: OrigineDocumentGed | "";
  estReference?: boolean;
  q?: string;
  dateDebut?: string;
  dateFin?: string;
}

/** Liste les documents GED accessibles à l'utilisateur, avec filtres facultatifs. */
export async function listerDocumentsGed(
  parametres?: ParametresListeDocumentsGed,
  signal?: AbortSignal,
): Promise<DocumentGed[]> {
  const charge = await api.lire<ChargeDocumentGed[] | ChargeListe<ChargeDocumentGed>>(
    "/ged/documents/",
    parametres
      ? {
          projet: parametres.projetId || undefined,
          categorie: parametres.categorie || undefined,
          origine: parametres.origine || undefined,
          est_reference: parametres.estReference ? "true" : undefined,
          q: parametres.q?.trim() || undefined,
          date_debut: parametres.dateDebut || undefined,
          date_fin: parametres.dateFin || undefined,
        }
      : undefined,
    signal,
  );
  return aPlat(charge).map(versDocumentGed);
}

/** Lit le détail complet d'un document GED (enrichi de ses versions) et journalise la consultation. */
export async function lireDocumentGed(
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentGed> {
  const charge = await api.lire<ChargeDocumentGed>(
    `/ged/documents/${documentId}/`,
    undefined,
    signal,
  );
  return versDocumentGed(charge);
}

/** Dépose un nouveau document GED (version initiale v1) en `multipart/form-data`. */
export async function deposerDocumentGed(
  saisie: SaisieDepotDocumentGed,
): Promise<DocumentGed> {
  const corps = new FormData();
  corps.append("projet", saisie.projetId);
  corps.append("categorie", saisie.categorie);
  corps.append("nom", saisie.nom.trim());
  if (saisie.description.trim()) {
    corps.append("description", saisie.description.trim());
  }
  if (saisie.commentaire.trim()) {
    corps.append("commentaire", saisie.commentaire.trim());
  }
  corps.append("est_reference", saisie.estReference ? "true" : "false");
  corps.append("fichier", saisie.fichier, saisie.fichier.name);

  const charge = await api.creer<ChargeDocumentGed>("/ged/documents/", corps);
  return versDocumentGed(charge);
}

/** Met à jour un document GED (épinglage référence, ou nom/description sur document manuel). */
export async function modifierDocumentGed(
  documentId: string,
  modification: { estReference?: boolean; nom?: string; description?: string },
): Promise<DocumentGed> {
  const corps: Record<string, unknown> = {};
  if (modification.estReference !== undefined) {
    corps.est_reference = modification.estReference;
  }
  if (modification.nom !== undefined) {
    corps.nom = modification.nom.trim();
  }
  if (modification.description !== undefined) {
    corps.description = modification.description.trim();
  }
  const charge = await api.modifier<ChargeDocumentGed>(`/ged/documents/${documentId}/`, corps);
  return versDocumentGed(charge);
}

/** Supprime logiquement un document manuel (motif facultatif tracé au journal d'audit). */
export async function supprimerDocumentGed(
  documentId: string,
  motif?: string,
): Promise<void> {
  const motifPropre = motif?.trim();
  if (motifPropre) {
    await appeler<void>(`/ged/documents/${documentId}/`, {
      methode: "DELETE",
      corps: { motif: motifPropre },
    });
    return;
  }
  await api.supprimer(`/ged/documents/${documentId}/`);
}

/** Liste toutes les versions d'un document GED (`numeroVersion DESC`). */
export async function listerVersionsDocumentGed(
  documentId: string,
  signal?: AbortSignal,
): Promise<VersionDocumentGed[]> {
  const charge = await api.lire<ChargeVersionDocument[] | ChargeListe<ChargeVersionDocument>>(
    `/ged/documents/${documentId}/versions/`,
    undefined,
    signal,
  );
  return aPlat(charge)
    .map(versVersionDocument)
    .sort((a, b) => b.numeroVersion - a.numeroVersion);
}

/** Ajoute une nouvelle version (`vN+1`) sans perte à un document manuel existant. */
export async function ajouterVersionDocumentGed(
  documentId: string,
  saisie: SaisieNouvelleVersionGed,
): Promise<VersionDocumentGed> {
  const corps = new FormData();
  corps.append("fichier", saisie.fichier, saisie.fichier.name);
  corps.append("commentaire", saisie.commentaire.trim());
  if (saisie.estReference !== undefined) {
    corps.append("est_reference", saisie.estReference ? "true" : "false");
  }
  const charge = await api.creer<ChargeVersionDocument>(
    `/ged/documents/${documentId}/versions/`,
    corps,
  );
  return versVersionDocument(charge);
}

/** Télécharge la version active d'un document GED (binaire) et trace la consultation. */
export async function telechargerDocumentGed(
  documentId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  return api.telecharger(`/ged/documents/${documentId}/telecharger/`, undefined, signal);
}

/** Télécharge une version précise d'un document GED (binaire) et trace la consultation. */
export async function telechargerVersionDocumentGed(
  documentId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  return api.telecharger(
    `/ged/documents/${documentId}/versions/${versionId}/telecharger/`,
    undefined,
    signal,
  );
}

/** Lit le journal d'audit (consultations, téléchargements, dépôts, partages, suppressions). */
export async function listerHistoriqueDocumentGed(
  documentId: string,
  signal?: AbortSignal,
): Promise<EvenementAuditGed[]> {
  const charge = await api.lire<ChargeEvenementAudit[] | ChargeListe<ChargeEvenementAudit>>(
    `/ged/documents/${documentId}/historique/`,
    undefined,
    signal,
  );
  return aPlat(charge).map(versEvenementAudit);
}

/** Liste les liens de partage externe 72 h d'un document. */
export async function listerPartagesDocumentGed(
  documentId: string,
  signal?: AbortSignal,
): Promise<LienPartageGed[]> {
  const charge = await api.lire<ChargeLienPartage[] | ChargeListe<ChargeLienPartage>>(
    `/ged/documents/${documentId}/partages/`,
    undefined,
    signal,
  );
  return aPlat(charge).map(versLienPartage);
}

/** Génère un lien de partage externe expirant exactement à +72 h. */
export async function creerPartageDocumentGed(
  documentId: string,
  saisie: SaisiePartageExterneGed,
): Promise<LienPartageGed> {
  const corps: Record<string, string> = {};
  if (saisie.destinataire.trim()) corps.destinataire = saisie.destinataire.trim();
  if (saisie.note.trim()) corps.note = saisie.note.trim();

  const charge = await api.creer<ChargeLienPartage>(
    `/ged/documents/${documentId}/partages/`,
    corps,
  );
  return versLienPartage(charge);
}

/** Révoque immédiatement un lien de partage externe (`DELETE /ged/partages/{partageId}/`). */
export async function revoquerPartageDocumentGed(partageId: string): Promise<void> {
  await api.supprimer(`/ged/partages/${partageId}/`);
}

/** Consultation publique sans compte d'un document partagé (`apiPlateforme`, sans JWT). */
export async function lireDocumentPartagePublic(
  jeton: string,
  signal?: AbortSignal,
): Promise<DocumentPartagePublic> {
  const charge = await apiPlateforme.lire<ChargeDocumentPartagePublic>(
    `/public/partages/${encodeURIComponent(jeton)}/`,
    undefined,
    signal,
  );
  return versDocumentPartagePublic(charge);
}

/** Téléchargement public anonyme d'un document partagé (sans JWT, incrémente les consultations). */
export async function telechargerDocumentPartagePublic(
  jeton: string,
  signal?: AbortSignal,
): Promise<Blob> {
  return appelerBlob(`/public/partages/${encodeURIComponent(jeton)}/telecharger/`, {
    methode: "GET",
    base: basePlateforme(),
    sansJeton: true,
    sansRenouvellement: true,
    signal,
  });
}

/** Déclenche le téléchargement navigateur d'un `Blob` avec libération propre de l'URL objet. */
export function declencherTelechargementBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier || "document";
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
