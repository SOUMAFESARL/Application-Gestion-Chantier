/**
 * Client d'API pour le tableau de bord de pilotage BTP — Maquette M10.
 */

import { api } from "@/lib/api";

export interface MetriquesDashboard {
  chantiers_actifs: number;
  chantiers_conformes: number;
  chantiers_en_retard: number;
  sante_globale: number;
  sante_details: {
    securite: number;
    delais: number;
    budget: number;
  };
  budget_total_montant: number;
  budget_engage_montant: number;
  bons_a_signer_count: number;
  bons_a_signer_montant: number;
  effectifs_sur_site: {
    total: number;
    regie: number;
    tacherons: number;
  };
  rapports_journaliers: {
    soumis: number;
    attendus: number;
  };
}

export interface ProjetDashboard {
  id: string;
  reference: string;
  nom: string;
  description: string;
  client_nom: string;
  ville: string;
  quartier: string;
  statut: string;
  avancement_reel: number;
  avancement_theorique: number;
  ecart: number;
  budget_initial_montant: number | null;
  budget_consomme_montant: number;
  rapport_jour_statut: string;
  indice_sante: number;
  chef_projet_nom: string;
  conducteur_travaux_nom?: string;
}

export interface BonPaiementDashboard {
  id: string;
  reference: string;
  beneficiaire: string;
  corps_etat: string;
  montant: number;
  statut: string;
}

export interface ReceptionMateriauDashboard {
  id: string;
  projet: string;
  description: string;
  conforme: boolean;
  date_reception?: string;
}

export interface MeteoDashboard {
  ville: string;
  temperature: number;
  description: string;
  praticable: boolean;
  alerte_intemperies: {
    projet: string;
    description: string;
  } | null;
}

export interface TableauDeBordData {
  metriques: MetriquesDashboard;
  projets: ProjetDashboard[];
  bons_paiement_a_valider: BonPaiementDashboard[];
  receptions_materiaux: ReceptionMateriauDashboard[];
  meteo: MeteoDashboard;
  alerte_intemperies?: {
    projet: string;
    ville?: string;
    description: string;
  } | null;
  aucun_chantier?: boolean;
}

export interface ReponseSignatureBon {
  succes: boolean;
  message: string;
  id: string;
  numero?: string;
  statut: string;
  signe_le?: string;
}

export async function lireTableauDeBord(): Promise<TableauDeBordData> {
  return api.lire<TableauDeBordData>("/tableau-de-bord/");
}

export async function signerBonPaiement(
  id: string,
  commentaire?: string,
): Promise<ReponseSignatureBon> {
  return api.creer<ReponseSignatureBon>(`/finance/bons-paiement/${id}/signer/`, {
    commentaire: commentaire || "",
  });
}
