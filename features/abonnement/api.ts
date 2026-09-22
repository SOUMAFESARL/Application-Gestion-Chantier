/**
 * Client d'API pour l'abonnement et l'essai gratuit — T-025 §8.
 */

import { api } from "@/lib/api";

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
