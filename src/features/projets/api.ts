/**
 * Client d'API pour le domaine Projets / Chantiers — Sprint 1.
 * Conforme aux contrats de 04_Conception/plan_technique/definition_api/contrats_refonte_sprint1.md
 */

import { api } from "@/lib/api";

export interface ChefProjetEncart {
  id: string;
  nom: string;
  prenom: string;
  nom_complet?: string;
  email: string;
  telephone: string;
  statut?: "INVITE" | "ACTIF";
  lien_whatsapp: string;
}

export interface ProjetDetail {
  id: string;
  reference: string;
  nom: string;
  description: string;
  client: {
    id: string;
    raison_sociale: string;
    telephone?: string;
    email?: string;
    ville?: string;
  };
  ville: string;
  quartier: string;
  statut: "EN_ATTENTE" | "EN_COURS" | "EN_RETARD" | "CRITIQUE" | "SUSPENDU" | "TERMINE" | "ARCHIVE";
  avancement_reel: number;
  avancement_theorique: number;
  budget_initial_montant: number | null;
  budget_consomme_montant?: number;
  date_debut_prevue: string;
  date_fin_prevue: string;
  date_debut_reelle?: string | null;
  date_fin_reelle?: string | null;
  chef_projet: ChefProjetEncart;
  conducteur_travaux?: ChefProjetEncart;
}

export interface CreationProjetPayload {
  nom: string;
  client: string; // UUID du tiers
  ville: string;
  quartier?: string;
  date_debut_prevue: string;
  date_fin_prevue: string;
  budget_initial_montant?: number | null;
  description?: string;
  chef_projet_id?: string;
  chef_projet_invite?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
  };
  conducteur_travaux_id?: string;
  conducteur_travaux_invite?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
  };
}

export type PorteeMeteo = "ENTREPRISE" | "CHANTIER";

export type ConditionMeteo =
  | "DEGAGE"
  | "ECLAIRCIES"
  | "NUAGEUX"
  | "COUVERT"
  | "BROUILLARD"
  | "BRUINE"
  | "PLUIE"
  | "AVERSES"
  | "ORAGE"
  | "VARIABLE";

export type AlerteMeteo = "VIGILANCE_PLUIE" | "INTEMPERIES" | "ORAGE";

export type RaisonMeteoIndisponible =
  | "VILLE_ABSENTE"
  | "PAYS_NON_COUVERT"
  | "VILLE_INCONNUE"
  | "SERVICE_INDISPONIBLE";

export interface MeteoProjet {
  disponible: boolean;
  ville: string;
  temperature: number | null;
  portee?: PorteeMeteo;
  condition?: ConditionMeteo | string | null;
  code_wmo?: number | null;
  praticable: boolean;
  alerte?: AlerteMeteo | string | null;
  releve_le?: string | null;
  raison?: RaisonMeteoIndisponible | string | null;
  description?: string;
  alerte_intemperies?: {
    projet: string;
    description: string;
  } | null;
  message?: string;
}

export async function listerProjets(): Promise<ProjetDetail[]> {
  return api.lire<ProjetDetail[]>("/projets/");
}

export async function obtenirMeteo(params?: {
  projet_id?: string;
  ville?: string;
  pays?: string;
}): Promise<MeteoProjet> {
  const query = new URLSearchParams();
  if (params?.projet_id) query.set("projet_id", params.projet_id);
  if (params?.ville) query.set("ville", params.ville);
  if (params?.pays) query.set("pays", params.pays);
  const qs = query.toString();
  return api.lire<MeteoProjet>(`/projets/meteo/${qs ? `?${qs}` : ""}`);
}

export async function creerProjet(payload: CreationProjetPayload): Promise<ProjetDetail> {
  return api.creer<ProjetDetail>("/projets/", payload);
}

export async function lireProjetDetail(id: string): Promise<ProjetDetail> {
  return api.lire<ProjetDetail>(`/projets/${id}/`);
}

export async function modifierBudgetProjet(id: string, budgetInitialCentimes: number): Promise<ProjetDetail> {
  return api.modifier<ProjetDetail>(`/projets/${id}/`, {
    budget_initial_montant: budgetInitialCentimes,
  });
}
