/**
 * Client d'API pour l'abonnement, catalogue des forfaits BTP et paiements CinetPay — T-025 §8.
 */

import { api } from "@/lib/api";
import {
  FORFAITS_BTP,
  ForfaitBTP,
  MoyenPaiementId,
  OptionPaiement,
  TransactionPaiement,
  MOYENS_PAIEMENT,
} from "./mockData";

export const EVENEMENT_ABONNEMENT_MODIFIE = "ccd:abonnement-modifie";
const STORAGE_KEY_ABONNEMENT = "ccd_abonnement_actif";

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

export interface PlanApiCatalogue {
  id: string;
  code: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  libelle: string;
  prix_mensuel_montant: number;
  prix_mensuel_fcfa: number;
  prix_annuel_montant: number;
  prix_annuel_fcfa: number;
  limite_projets: number | null;
  limite_utilisateurs: number | null;
  limite_stockage_mo: number | null;
  acces_ia: boolean;
  est_actif: boolean;
}

export interface InitiationPaiementPayload {
  planCode: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  cycle: "MENSUEL" | "ANNUEL";
  moyenPaiementId: MoyenPaiementId;
  telephone?: string;
  nomTitulaire?: string;
  numeroCarte?: string;
  dateExp?: string;
  cvv?: string;
  nomEntreprise?: string;
  emailFacturation?: string;
}

export async function lireAbonnement(): Promise<Abonnement> {
  // 1. Vérification si un abonnement réel actif a été souscrit et stocké localement
  if (typeof window !== "undefined") {
    const sauv = localStorage.getItem(STORAGE_KEY_ABONNEMENT);
    if (sauv) {
      try {
        const aboActif = JSON.parse(sauv) as Abonnement;
        return aboActif;
      } catch {
        // En cas d'erreur de parsing, continuer vers l'API ou fallback
      }
    }
  }

  // 2. Appel API distante si disponible
  try {
    const distant = await api.lire<Abonnement>("/abonnement/");
    if (distant && distant.statut) return distant;
  } catch {
    // API hors ligne
  }

  // 3. Fallback d'essai par défaut (compte fraîchement créé)
  const dateJour = new Date();
  const dateFin = new Date();
  dateFin.setDate(dateJour.getDate() + 14);

  return {
    id: "abo-mock-001",
    statut: "ESSAI",
    plan: {
      code: "MAITRE_OEUVRE",
      libelle: "Maître d'Œuvre (Essai 14j)",
      limite_projets: 50,
      limite_utilisateurs: 25,
      limite_stockage_mo: 20000,
      acces_ia: true,
    },
    date_debut: dateJour.toISOString().split("T")[0],
    date_fin: dateFin.toISOString().split("T")[0],
    fin_essai: dateFin.toISOString().split("T")[0],
    jours_essai_restants: 11,
    est_expire: false,
    lecture_seule: false,
    renouvellement_auto: false,
  };
}

/**
 * Active officiellement le forfait payé :
 * L'entreprise n'est PLUS en période d'essai (statut: ACTIF, fin_essai: null, jours_essai_restants: null).
 */
export function activerNouvelAbonnement(forfait: ForfaitBTP, cycle: "MENSUEL" | "ANNUEL"): Abonnement {
  const dateDebut = new Date();
  const dateFin = new Date();
  if (cycle === "ANNUEL") {
    dateFin.setFullYear(dateFin.getFullYear() + 1);
  } else {
    dateFin.setMonth(dateFin.getMonth() + 1);
  }

  const abonnementActif: Abonnement = {
    id: `abo-actif-${Date.now()}`,
    statut: "ACTIF", // Plus d'essai ! L'abonnement est payé et actif.
    plan: {
      code: forfait.code,
      libelle: forfait.libelle,
      limite_projets: forfait.limiteChantiers,
      limite_utilisateurs: forfait.limiteUtilisateurs,
      limite_stockage_mo: forfait.limiteStockageGo ? forfait.limiteStockageGo * 1000 : null,
      acces_ia: forfait.accesIA,
    },
    date_debut: dateDebut.toISOString().split("T")[0],
    date_fin: dateFin.toISOString().split("T")[0],
    fin_essai: null, // Plus d'essai
    jours_essai_restants: null, // Plus de décompte de jours
    est_expire: false,
    lecture_seule: false,
    renouvellement_auto: true,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_ABONNEMENT, JSON.stringify(abonnementActif));
    window.dispatchEvent(new Event(EVENEMENT_ABONNEMENT_MODIFIE));
    window.dispatchEvent(new Event("storage"));
  }

  return abonnementActif;
}

export function reinitialiserAbonnementPourTest(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_ABONNEMENT);
    window.dispatchEvent(new Event(EVENEMENT_ABONNEMENT_MODIFIE));
    window.dispatchEvent(new Event("storage"));
  }
}

export async function obtenirCataloguePlans(): Promise<ForfaitBTP[]> {
  try {
    const plansApi = await api.lire<PlanApiCatalogue[]>("/billing/plans/");
    if (plansApi && plansApi.length > 0) {
      return FORFAITS_BTP.map((forfait) => {
        const distant = plansApi.find((p) => p.code === forfait.code);
        if (distant) {
          return {
            ...forfait,
            prixMensuelFcfa: distant.prix_mensuel_fcfa || forfait.prixMensuelFcfa,
            prixAnnuelFcfa: distant.prix_annuel_fcfa || forfait.prixAnnuelFcfa,
            limiteChantiers: distant.limite_projets,
            limiteUtilisateurs: distant.limite_utilisateurs,
            limiteStockageGo: distant.limite_stockage_mo ? Math.round(distant.limite_stockage_mo / 1000) : null,
            accesIA: distant.acces_ia,
          };
        }
        return forfait;
      });
    }
  } catch {
    // Repli maquette
  }
  return FORFAITS_BTP;
}

export async function simulerPaiement(payload: InitiationPaiementPayload): Promise<TransactionPaiement> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const forfait = FORFAITS_BTP.find((f) => f.code === payload.planCode) || FORFAITS_BTP[1];
  const moyen = MOYENS_PAIEMENT.find((m) => m.id === payload.moyenPaiementId) || MOYENS_PAIEMENT[0];

  const montantFcfa = payload.cycle === "ANNUEL" ? forfait.prixAnnuelFcfa : forfait.prixMensuelFcfa;
  const tvaFcfa = 0;
  const montantTotalFcfa = montantFcfa + tvaFcfa;

  const refId = Math.floor(10000 + Math.random() * 90000);
  const now = new Date();

  const transaction: TransactionPaiement = {
    idTransaction: `TRX-2026-CCD-${refId}`,
    referenceFacture: `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    datePaiement: now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    forfait,
    cycle: payload.cycle,
    montantFcfa,
    tvaFcfa,
    montantTotalFcfa,
    moyenPaiement: moyen,
    coordonneesPaiement: {
      telephone: payload.telephone,
      nomTitulaire: payload.nomTitulaire,
      derniersChiffresCarte: payload.numeroCarte ? payload.numeroCarte.slice(-4) : undefined,
      nomEntreprise: payload.nomEntreprise || "SOUMAFE BTP & Construction",
    },
    statut: "SUCCES",
  };

  // Activation immédiate de l'abonnement
  activerNouvelAbonnement(forfait, payload.cycle);

  return transaction;
}
