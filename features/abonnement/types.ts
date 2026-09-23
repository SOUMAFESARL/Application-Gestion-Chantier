/**
 * Types du domaine Abonnement — catalogue de vente et paiement (T-025).
 *
 * **Les libellés n'y figurent jamais.** Un plan n'a ici qu'un `code` : son nom,
 * son accroche et sa liste de fonctionnalités vivent dans `messages/fr.json`
 * sous `abonnement.plan.<code>`, comme `administration.plan` le fait déjà pour
 * le plan en cours. Un prix, une limite ou un taux de TVA n'est pas une phrase
 * française — seul un libellé l'est, et c'est lui que la règle i18n interdit
 * d'écrire ici.
 */

export type CodePlan = "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";

export type Periodicite = "MENSUELLE" | "ANNUELLE";

export interface DefinitionPlan {
  code: CodePlan;
  prix_mensuel_centimes: number;
  prix_annuel_centimes: number;
  limite_chantiers: number | null;
  limite_utilisateurs: number | null;
  limite_stockage_go: number;
  acces_ia: boolean;
  etiquette?: "POPULAIRE" | "GRANDS_COMPTES";
}

/** Le catalogue de vente — trois forfaits, T-025 §4. */
export const PLANS_DISPONIBLES: DefinitionPlan[] = [
  {
    code: "BATISSEUR",
    prix_mensuel_centimes: 2_900_000,
    prix_annuel_centimes: 34_800_000,
    limite_chantiers: 5,
    limite_utilisateurs: 5,
    limite_stockage_go: 5,
    acces_ia: false,
  },
  {
    code: "MAITRE_OEUVRE",
    prix_mensuel_centimes: 7_900_000,
    prix_annuel_centimes: 94_800_000,
    limite_chantiers: 50,
    limite_utilisateurs: 25,
    limite_stockage_go: 20,
    acces_ia: true,
    etiquette: "POPULAIRE",
  },
  {
    code: "PROMOTEUR",
    prix_mensuel_centimes: 18_900_000,
    prix_annuel_centimes: 226_800_000,
    limite_chantiers: null,
    limite_utilisateurs: null,
    limite_stockage_go: 100,
    acces_ia: true,
    etiquette: "GRANDS_COMPTES",
  },
];

/**
 * Les pays fiscaux couverts par la passerelle CinetPay — mêmes zones que
 * l'inscription (UEMOA/CEMAC), avec le taux de TVA applicable à la facture.
 */
export interface PaysFiscal {
  code: string;
  taux_tva: number;
  zone: "UEMOA" | "CEMAC";
}

export const PAYS_FISCAUX: PaysFiscal[] = [
  { code: "CI", taux_tva: 18, zone: "UEMOA" },
  { code: "SN", taux_tva: 18, zone: "UEMOA" },
  { code: "CM", taux_tva: 19.25, zone: "CEMAC" },
];

export type ModePaiement = "WAVE" | "ORANGE_MONEY" | "MTN_MOMO" | "CARTE_BANCAIRE";

/** Un mode mobile money exige un numéro ; la carte passe par la page CinetPay. */
export const MODES_MOBILE_MONEY: ModePaiement[] = ["WAVE", "ORANGE_MONEY", "MTN_MOMO"];

export interface InformationsFacturation {
  raison_sociale: string;
  email: string;
  pays_fiscal: string;
  adresse: string;
  rccm?: string;
  nif: string;
}

export interface DemandeSouscription {
  plan: CodePlan;
  periodicite: Periodicite;
  mode_paiement: ModePaiement;
  /** Numéro international, requis pour les trois modes mobile money. */
  telephone_paiement?: string;
  facturation: InformationsFacturation;
}

export type StatutPaiement = "REUSSI" | "ECHOUE";

export interface RecuPaiement {
  id: string;
  reference_transaction: string;
  numero_facture: string;
  /** Horodatage ISO 8601. */
  date_heure: string;
  plan: CodePlan;
  periodicite: Periodicite;
  mode_paiement: ModePaiement;
  entreprise: string;
  montant_centimes: number;
  statut: StatutPaiement;
}

/** Une ligne de l'historique — le même reçu, vu depuis la liste. */
export type LignePaiement = RecuPaiement;
