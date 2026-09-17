/**
 * Types pour les factures légales aux normes OHADA / SYSCOHADA.
 */

export interface LigneFactureOHADA {
  code: string;
  designation: string;
  descriptionDetaillee?: string;
  quantite: number;
  prixUnitaireHtFcfa: number;
  remisePourcent?: number;
  totalHtFcfa: number;
}

export interface EmetteurOHADA {
  nom: string;
  sigle?: string;
  formeJuridique: string;
  capitalFcfa: string;
  rccm: string;
  nif: string; // NIF / NCC
  regimeFiscal?: string;
  centreImpots?: string;
  adresse: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  siteWeb?: string;
  coordonneesBancaires?: {
    banque: string;
    titulaire: string;
    ibanUemoa: string;
    bicSwift?: string;
  };
}

export interface ClientOHADA {
  raisonSociale: string;
  nomCommercial?: string;
  rccm?: string;
  nif?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  codePays?: string;
  emailContact?: string;
  telephoneContact?: string;
}

export interface FactureLegaleData {
  numero: string; // ex: FAC-2026-09-0042
  dateEmission: string; // "17 septembre 2026"
  dateEcheance: string; // "17 septembre 2026" ou "Comptant"
  periodeDebut?: string;
  periodeFin?: string;
  statut: "ACQUITTEE" | "EN_ATTENTE" | "ANNULEE";
  referenceTransaction?: string;
  moyenPaiementNom?: string; // ex: "Wave Money", "Orange Money", "Carte Bancaire"
  datePaiementEffectif?: string;
  lignes: LigneFactureOHADA[];
  sousTotalHtFcfa: number;
  remiseGlobaleFcfa?: number;
  tauxTvaPourcent: number; // ex: 18.0
  libelleTva?: string;
  montantTvaFcfa: number;
  totalTtcFcfa: number;
}

export const EMETTEUR_CCD_DIGITAL_PAR_DEFAUT: EmetteurOHADA = {
  nom: "SOUMAFE SARL",
  sigle: "CCD DIGITAL",
  formeJuridique: "Société à Responsabilité Limitée",
  capitalFcfa: "10 000 000 FCFA",
  rccm: "CI-ABJ-2024-B-04812",
  nif: "2412890 A",
  regimeFiscal: "Régime Réel Normal",
  centreImpots: "Direction des Grandes Entreprises (DGE)",
  adresse: "Cocody Riviera Bonoumin, Immeuble Horizon BTP, 3ème étage",
  ville: "Abidjan",
  pays: "Côte d'Ivoire",
  telephone: "+225 27 22 49 10 00",
  email: "facturation@soumafe.ci",
  siteWeb: "https://soumafe.ci",
  coordonneesBancaires: {
    banque: "Banque Nationale d'Investissement (BNI Côte d'Ivoire)",
    titulaire: "SOUMAFE SARL",
    ibanUemoa: "CI092 01001 002345678901 45",
    bicSwift: "BNIICIAB",
  },
};
