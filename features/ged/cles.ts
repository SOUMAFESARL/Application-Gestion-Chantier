/**
 * Clés de cache React Query du domaine Gestion Documentaire (GED / F6).
 *
 * Hiérarchie cohérente : invalider `cleListeDocumentsGed()` rafraîchit toutes
 * les listes (globale et par projet), et invalider `cleDetailDocumentGed(id)`
 * rafraîchit le détail, ses versions, son journal et ses liens de partage.
 */

export const CLE_RACINE_GED = ["ged"] as const;

/** Liste des documents GED (globale ou pré-filtrée sur un projet). */
export function cleListeDocumentsGed(projetId?: string) {
  return projetId
    ? (["ged", "documents", "liste", projetId] as const)
    : (["ged", "documents", "liste"] as const);
}

/** Préfixe commun pour invalider toutes les listes de documents GED. */
export const CLE_TOUTES_LISTES_DOCUMENTS_GED = ["ged", "documents", "liste"] as const;

/** Fiche détail d'un document GED (inclut ses versions). */
export function cleDetailDocumentGed(documentId: string) {
  return ["ged", "documents", "detail", documentId] as const;
}

/** Historique complet des versions d'un document GED. */
export function cleVersionsDocumentGed(documentId: string) {
  return ["ged", "documents", "detail", documentId, "versions"] as const;
}

/** Journal d'audit (consultations, téléchargements, dépôts, partages, suppressions). */
export function cleHistoriqueDocumentGed(documentId: string) {
  return ["ged", "documents", "detail", documentId, "historique"] as const;
}

/** Liens de partage externe 72 h d'un document GED. */
export function clePartagesDocumentGed(documentId: string) {
  return ["ged", "documents", "detail", documentId, "partages"] as const;
}

/** Consultation publique d'un document partagé sans authentification. */
export function clePartagePublicGed(jeton: string) {
  return ["ged", "public", "partages", jeton] as const;
}
