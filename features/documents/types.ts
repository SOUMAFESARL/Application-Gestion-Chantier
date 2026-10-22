/**
 * Les types du domaine Documents — le réglage de l'en-tête et du pied des PDF.
 *
 * Aucun type du transport ici : la forme du serveur reste dans l'adaptateur.
 */

/**
 * Les mentions que l'entreprise peut imprimer, dans l'ordre où l'écran les
 * propose. Ce sont les codes de `CODES_MENTIONS` côté serveur
 * (`apps/projets/models/parametres_documents.py`) : un code inconnu y est refusé.
 */
export const CODES_MENTIONS = [
  "raison_sociale",
  "nom_commercial",
  "rccm",
  "nif",
  "adresse",
  "ville",
  "telephone",
  "email",
  "site_web",
] as const;

export type CodeMention = (typeof CODES_MENTIONS)[number];

/** Le réglage tel que l'entreprise l'a choisi. L'ordre des mentions est l'ordre d'impression. */
export interface ReglageDocuments {
  afficherLogo: boolean;
  mentionsEntete: CodeMention[];
  texteLibreEntete: string;
  mentionsPied: CodeMention[];
  texteLibrePied: string;
}

/** Le réglage et ce qu'il donne aujourd'hui, avec les valeurs de l'entreprise. */
export interface DocumentsResolus {
  reglage: ReglageDocuments;
  entete: {
    /** `null` : pas de logo à imprimer (masqué par le réglage, ou l'entreprise n'en a pas). */
    logoUrl: string | null;
    lignes: string[];
  };
  pied: {
    lignes: string[];
  };
}
