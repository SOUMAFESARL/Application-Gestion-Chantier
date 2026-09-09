/**
 * Erreurs d'API — miroir du catalogue défini dans les conventions §5.1.
 *
 * Le client branche son comportement sur `code`, **jamais** sur `message` :
 * le code est un contrat, le message est fait pour l'œil humain et sera
 * reformulé un jour.
 */

import { texte } from "@/i18n/horsReact";

/** Codes techniques, dérivés du statut HTTP. */
export const CODES_TECHNIQUES = [
  "validation",
  "non_authentifie",
  "acces_refuse",
  "introuvable",
  "methode_non_autorisee",
  "conflit",
  "fichier_trop_volumineux",
  "regle_metier",
  "trop_de_requetes",
  "erreur_interne",
] as const;

/** Codes métier — une règle de gestion précise a refusé l'opération. */
export const CODES_METIER = [
  // Authentification. Les cinq causes d'échec de la connexion produisent ce
  // seul code : `compte_bloque`, `compte_desactive` et `compte_non_active` ont
  // été retirés de la réponse pour ne plus révéler quelles adresses existent
  // (contrat d'API §6.1). L'écran de blocage vient d'un compteur client.
  "identifiants_invalides",
  // Métier BTP
  "rapport_deja_existant",
  "mode_execution_verrouille",
  "bordereau_verrouille",
  "rapport_non_modifiable",
  "quantites_non_validees",
  "signature_niveau_insuffisant",
  "quota_plan_atteint",
  "abonnement_suspendu",
  "photos_max_atteint",
  "justification_requise",
  // Renouvellement des jetons — T-008 §4.2
  "jeton_invalide",
  "jeton_revoque",
  "service_indisponible",
  // Inscription d'une entreprise — T-021
  "slug_indisponible",
  "inscription_deja_activee",
  "jeton_expire",
  // Configuration initiale — T-024 §5
  "etape_precedente_non_franchie",
  "etape_non_facultative",
  "etapes_manquantes",
  "configuration_terminee",
  // Essai gratuit — T-025 §4.2
  "essai_expire",
] as const;

export type CodeErreur =
  | (typeof CODES_TECHNIQUES)[number]
  | (typeof CODES_METIER)[number]
  | "reseau_indisponible"
  | (string & {});

export interface CorpsErreur {
  erreur: {
    code: CodeErreur;
    message: string;
    details: Record<string, string[] | string>;
    trace_id: string | null;
  };
}

export class ErreurApi extends Error {
  readonly code: CodeErreur;
  readonly statut: number;
  readonly details: Record<string, string[] | string>;
  readonly traceId: string | null;

  constructor(
    code: CodeErreur,
    message: string,
    statut: number,
    details: Record<string, string[] | string> = {},
    traceId: string | null = null,
  ) {
    super(message);
    this.name = "ErreurApi";
    this.code = code;
    this.statut = statut;
    this.details = details;
    this.traceId = traceId;
  }

  /** Erreurs de validation, prêtes à être injectées dans un formulaire. */
  get erreursParChamp(): Record<string, string> {
    const resultat: Record<string, string> = {};
    for (const [champ, valeur] of Object.entries(this.details)) {
      resultat[champ] = Array.isArray(valeur) ? valeur[0] : String(valeur);
    }
    return resultat;
  }

  /** Vrai si l'erreur vient d'une règle de gestion et non d'un champ mal saisi. */
  get estRegleMetier(): boolean {
    return (CODES_METIER as readonly string[]).includes(this.code);
  }

  /** Vrai si réessayer a une chance d'aboutir. */
  get estTemporaire(): boolean {
    return (
      this.code === "reseau_indisponible" ||
      this.code === "erreur_interne" ||
      this.code === "trop_de_requetes" ||
      this.code === "service_indisponible"
    );
  }
}

/** Construit une ErreurApi depuis une réponse HTTP, quel qu'en soit le corps. */
export async function depuisReponse(reponse: Response): Promise<ErreurApi> {
  let corps: Partial<CorpsErreur> | null = null;
  try {
    corps = (await reponse.json()) as CorpsErreur;
  } catch {
    // Une réponse sans JSON exploitable — proxy, passerelle, coupure.
    corps = null;
  }

  const erreur = corps?.erreur;
  return new ErreurApi(
    erreur?.code ?? "erreur_interne",
    erreur?.message ?? texte("erreurs.generique"),
    reponse.status,
    erreur?.details ?? {},
    erreur?.trace_id ?? null,
  );
}
