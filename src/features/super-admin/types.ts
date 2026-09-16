/**
 * Types pour le tableau de bord Super Admin (entreprises clientes & abonnements)
 */

export type StatutEntrepriseClient = "ACTIF" | "ESSAI" | "IMPAYE" | "SUSPENDU";
export type CodePlanSuperAdmin = "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR" | "ESSAI";

export interface EntrepriseCliente {
  id: string;
  raisonSociale: string;
  nomCommercial: string;
  pays: string;
  ville: string;
  dateInscription: string;
  contactNom: string;
  contactEmail: string;
  contactTel: string;
  planActuel: {
    code: CodePlanSuperAdmin;
    libelle: string;
    cycle: "MENSUEL" | "ANNUEL";
    montantFcfa: number;
  };
  statut: StatutEntrepriseClient;
  joursEssaiRestants?: number;
  prochaineEcheance: string;
  nombreChantiers: number;
  nombreUtilisateurs: number;
  stockageUtiliseMo: number;
  derniereConnexion: string;
  derniereFactureRef?: string;
}

export interface StatsSuperAdmin {
  totalEntreprises: number;
  entreprisesActives: number;
  entreprisesEssai: number;
  entreprisesImpayees: number;
  mrrFcfa: number; // Monthly Recurring Revenue
  arrFcfa: number; // Annual Recurring Revenue
  totalChantiersPlateforme: number;
  totalUtilisateursPlateforme: number;
  tauxConversionEssai: number; // En %
}
