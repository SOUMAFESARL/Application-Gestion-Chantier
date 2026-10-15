/**
 * Les paramètres publics de la plateforme (tarifs), rejoués sans serveur pour
 * l'**espace entreprise** en mode démonstration — `GET /plateforme/tarifs/`.
 *
 * Extraits de l'ancienne simulation du back-office, supprimée au lot 2 : le back-office
 * appelle toujours le serveur. Ce fichier disparaîtra avec la simulation de l'abonnement
 * (lot 6).
 */

import { PLANS_DISPONIBLES } from "@/features/abonnement/types";

import { attendre } from "./simulation";

export interface ChargeAvantagePlan {
  libelle: string;
  inclus: boolean;
}

export interface ChargeTarifPlan {
  plan_code: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  libelle: string;
  prix_mensuel_centimes: number;
  prix_annuel_centimes: number;
  remise_annuelle_pourcent: number;
  limite_chantiers: number | null;
  limite_utilisateurs: number | null;
  limite_stockage_go: number;
  avantages: ChargeAvantagePlan[];
}

interface ParametresPlateforme {
  tarifs: ChargeTarifPlan[];
}

const CLE_PARAMETRES = "ccd.simulation.plateforme.parametres.v1";

const LIBELLES_INITIAUX: Record<ChargeTarifPlan["plan_code"], string> = {
  BATISSEUR: "Bâtisseur",
  MAITRE_OEUVRE: "Maître d'Œuvre",
  PROMOTEUR: "Promoteur",
};

const AVANTAGES_INITIAUX: Record<ChargeTarifPlan["plan_code"], ChargeAvantagePlan[]> = {
  BATISSEUR: [
    { libelle: "Journal de chantier quotidien", inclus: true },
    { libelle: "Suivi météo connectée", inclus: true },
    { libelle: "Suivi présences ouvriers", inclus: true },
    { libelle: "Export PDF rapports de base", inclus: true },
    { libelle: "Support standard par email (24h)", inclus: true },
    { libelle: "Suivi d'avancement & photos géolocalisées", inclus: false },
    { libelle: "Gestion budgétaire & bons de paiement", inclus: false },
    { libelle: "Gestion des stocks & achats", inclus: false },
    { libelle: "Assistant IA illimité (analyse risques, résumés auto)", inclus: false },
  ],
  MAITRE_OEUVRE: [
    { libelle: "Suivi d'avancement & photos géolocalisées", inclus: true },
    { libelle: "Gestion budgétaire & bons de paiement", inclus: true },
    { libelle: "Gestion des stocks & achats", inclus: true },
    { libelle: "Alertes automatiques de quotas & dépassements", inclus: true },
    { libelle: "Rapports QHSE et sécurité", inclus: true },
    { libelle: "Support prioritaire sous 2h (WhatsApp & Téléphone)", inclus: true },
    { libelle: "Assistant IA illimité (analyse risques, résumés auto)", inclus: false },
    { libelle: "Multi-filiales & gestion consolidée", inclus: false },
    { libelle: "Personnalisation marque blanche (logo, charte client)", inclus: false },
  ],
  PROMOTEUR: [
    { libelle: "Assistant IA illimité (analyse risques, résumés auto)", inclus: true },
    { libelle: "Multi-filiales & gestion consolidée", inclus: true },
    { libelle: "Personnalisation marque blanche (logo, charte client)", inclus: true },
    { libelle: "Rapprochement bancaire & exports comptables", inclus: true },
    { libelle: "Intégrations API & webhooks", inclus: true },
    { libelle: "Sauvegardes quotidiennes externalisées", inclus: true },
    { libelle: "Chargé de compte dédié + formation sur site", inclus: true },
  ],
};

function remiseDeduite(mensuelCentimes: number, annuelCentimes: number): number {
  const douzeMois = mensuelCentimes * 12;
  if (douzeMois === 0) return 0;
  return Math.max(0, Math.round(((douzeMois - annuelCentimes) / douzeMois) * 100));
}

function parametresInitiaux(): ParametresPlateforme {
  return {
    tarifs: PLANS_DISPONIBLES.map((plan) => ({
      plan_code: plan.code,
      libelle: LIBELLES_INITIAUX[plan.code],
      prix_mensuel_centimes: plan.prix_mensuel_centimes,
      prix_annuel_centimes: plan.prix_annuel_centimes,
      remise_annuelle_pourcent: remiseDeduite(plan.prix_mensuel_centimes, plan.prix_annuel_centimes),
      limite_chantiers: plan.limite_chantiers,
      limite_utilisateurs: plan.limite_utilisateurs,
      limite_stockage_go: plan.limite_stockage_go,
      avantages: AVANTAGES_INITIAUX[plan.code],
    })),
  };
}

function lireParametres(): ParametresPlateforme {
  if (typeof window === "undefined") return parametresInitiaux();
  try {
    const brut = window.localStorage.getItem(CLE_PARAMETRES);
    if (brut) {
      const parametres = JSON.parse(brut) as ParametresPlateforme;
      parametres.tarifs = (parametres.tarifs ?? []).map((tarif) => {
        const catalogue = PLANS_DISPONIBLES.find((plan) => plan.code === tarif.plan_code);
        return {
          ...tarif,
          libelle: tarif.libelle ?? LIBELLES_INITIAUX[tarif.plan_code],
          remise_annuelle_pourcent:
            tarif.remise_annuelle_pourcent ??
            remiseDeduite(tarif.prix_mensuel_centimes, tarif.prix_annuel_centimes),
          limite_chantiers:
            tarif.limite_chantiers === undefined
              ? (catalogue?.limite_chantiers ?? null)
              : tarif.limite_chantiers,
          limite_utilisateurs:
            tarif.limite_utilisateurs === undefined
              ? (catalogue?.limite_utilisateurs ?? null)
              : tarif.limite_utilisateurs,
          limite_stockage_go: tarif.limite_stockage_go ?? catalogue?.limite_stockage_go ?? 0,
          avantages: tarif.avantages ?? AVANTAGES_INITIAUX[tarif.plan_code],
        };
      });
      return parametres;
    }
  } catch {
    // On repart des valeurs du catalogue.
  }
  return parametresInitiaux();
}

/**
 * Les paramètres publics de la plateforme, lus sans jeton par l'espace
 * entreprise — `GET /plateforme/tarifs/`.
 */
export const simulationParametresPublics = {
  async lireTarifs(): Promise<ChargeTarifPlan[]> {
    return attendre(lireParametres().tarifs, 300);
  },

  /** Lecture synchrone, pour la souscription simulée qui facture le prix affiché. */
  tarifsCourants(): ChargeTarifPlan[] {
    return lireParametres().tarifs;
  },
};
