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

export interface UtilisateurCibleAssistance {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role_global: string;
  role_libelle: string;
  is_owner: boolean;
  is_dg: boolean;
  statut: string;
}

export interface EntreeJournalPlateforme {
  id: number;
  utilisateur_id: string | null;
  utilisateur_nom: string;
  entreprise_id: string | null;
  entreprise_nom: string;
  action: string;
  detail: Record<string, unknown> | null;
  adresse_ip: string | null;
  appareil: string;
  horodatage: string;
}

export interface ReponseSessionAssistance {
  access: string;
  expire_dans: number;
  impersonation: {
    actif: boolean;
    mode: "LECTURE_SEULE";
    super_admin: {
      id: string;
      email: string;
      nom: string;
    };
    entreprise: {
      id: string;
      raison_sociale: string;
      nom_commercial: string;
      schema_name: string;
    };
    utilisateur: {
      id: string;
      nom: string;
      prenom: string;
      email: string;
      role_global: string;
      role_libelle: string;
    };
    motif: string;
  };
  utilisateur: {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    role_global: string;
    role_libelle?: string;
    is_dg: boolean;
    is_owner: boolean;
    langue?: string;
    doit_changer_mot_de_passe?: boolean;
    schema?: string;
  };
  url_redirection: string;
}

export interface SessionAssistanceLocale {
  actif: boolean;
  debut: number; // Horodatage en ms
  expireA: number; // Horodatage d'expiration en ms
  entrepriseId: string;
  entrepriseNom: string;
  utilisateurId: string;
  utilisateurNom: string;
  utilisateurEmail: string;
  motif: string;
}

