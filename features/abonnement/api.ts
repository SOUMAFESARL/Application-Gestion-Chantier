/**
 * Client d'API pour l'abonnement et l'essai gratuit — T-025 §8.
 */

import { api } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";

import { historiquePaiementsSimule, simulerSouscription } from "./simulation";
import type { DemandeSouscription, LignePaiement, RecuPaiement } from "./types";

export type {
  CodePlan,
  DefinitionPlan,
  DemandeSouscription,
  InformationsFacturation,
  LignePaiement,
  ModePaiement,
  PaysFiscal,
  Periodicite,
  RecuPaiement,
  StatutPaiement,
} from "./types";
export { MODES_MOBILE_MONEY, PAYS_FISCAUX, PLANS_DISPONIBLES } from "./types";

export interface PlanResume {
  code: string;
  libelle: string;
  limite_projets: number | null;
  limite_utilisateurs: number | null;
  limite_stockage_mo: number | null;
  acces_ia: boolean;
}

export interface Abonnement {
  id: string;
  statut: "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "RESILIE";
  plan: PlanResume;
  date_debut: string;
  date_fin: string;
  fin_essai: string | null;
  jours_essai_restants: number | null;
  est_expire: boolean;
  lecture_seule: boolean;
  renouvellement_auto: boolean;
}

export async function lireAbonnement(): Promise<Abonnement> {
  return api.lire<Abonnement>("/abonnement/");
}

/**
 * Souscrit au forfait choisi via la passerelle CinetPay.
 *
 * `POST /abonnement/souscription/` n'est pas encore écrit côté Django : sous
 * `NEXT_PUBLIC_API_SIMULE`, la réponse vient de `simulation.ts`, qui rejoue
 * le même reçu qu'un paiement réel (référence, facture, montant décomposé
 * HT/TVA). L'appel réel est déjà à sa place définitive.
 */
export async function souscrireAbonnement(demande: DemandeSouscription): Promise<RecuPaiement> {
  if (SIMULATION_ACTIVE) return simulerSouscription(demande);
  return api.creer<RecuPaiement>("/abonnement/souscription/", demande);
}

/** `GET /abonnement/paiements/` — les reçus de l'entreprise, du plus récent au plus ancien. */
export async function listerHistoriquePaiements(): Promise<LignePaiement[]> {
  if (SIMULATION_ACTIVE) return historiquePaiementsSimule();
  return api.lire<LignePaiement[]>("/abonnement/paiements/");
}
