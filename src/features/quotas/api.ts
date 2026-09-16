/**
 * Service de gestion et vérification des quotas avec calcul des alertes et surclassements.
 */

import { lireAbonnement } from "../abonnement/api";
import { RECOMMANDATIONS_SURCLASSEMENT, SCENARIOS_SIMULATION } from "./mockData";
import {
  MetriqueQuota,
  ResumeQuotas,
  ScenarioSimulationQuota,
  StatutNiveauQuota,
} from "./types";

export const EVENEMENT_QUOTAS_MODIFIE = "ccd:quotas-modifie";
const STORAGE_KEY_SCENARIO_QUOTA = "ccd_scenario_quota_actif";

function calculerPourcentageEtStatut(
  actuel: number,
  limite: number | null
): { pourcentage: number; statut: StatutNiveauQuota } {
  if (limite === null) {
    return { pourcentage: 0, statut: "ILLIMITE" };
  }
  const ratio = Math.min(100, Math.round((actuel / limite) * 100));
  if (actuel >= limite) {
    return { pourcentage: 100, statut: "BLOQUANT" };
  }
  if (ratio >= 80) {
    return { pourcentage: ratio, statut: "AVERTISSEMENT" };
  }
  return { pourcentage: ratio, statut: "NORMAL" };
}

export async function obtenirQuotasActuels(): Promise<ResumeQuotas> {
  // 1. Vérification si un scénario de simulation est actif dans localStorage
  if (typeof window !== "undefined") {
    const scenarioSauv = localStorage.getItem(STORAGE_KEY_SCENARIO_QUOTA);
    if (scenarioSauv) {
      try {
        const scenario = JSON.parse(scenarioSauv) as ScenarioSimulationQuota;
        return construireResumeDepuisScenario(scenario);
      } catch {
        // Fallback
      }
    }
  }

  // 2. Synchronisation avec l'abonnement réel ou d'essai
  const abonnement = await lireAbonnement();
  const plan = abonnement.plan;
  const planCode = (plan.code as "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR") || "MAITRE_OEUVRE";

  // Valeurs de consommation adaptées au plan actif
  let chantiersActuel = 3;
  let collabActuel = 5;
  let stockageActuelGo = 1.2;

  if (planCode === "BATISSEUR") {
    chantiersActuel = 5; // Par défaut Bâtisseur au plafond pour illustrer l'alerte
    collabActuel = 4;
    stockageActuelGo = 4.2;
  } else if (planCode === "PROMOTEUR") {
    chantiersActuel = 24;
    collabActuel = 42;
    stockageActuelGo = 34.5;
  }

  const limiteChantiers = plan.limite_projets;
  const limiteCollaborateurs = plan.limite_utilisateurs;
  const limiteStockageGo = plan.limite_stockage_mo ? Math.round(plan.limite_stockage_mo / 1000) : null;
  const accesIA = plan.acces_ia;

  const statChantier = calculerPourcentageEtStatut(chantiersActuel, limiteChantiers);
  const statCollab = calculerPourcentageEtStatut(collabActuel, limiteCollaborateurs);
  const statStockage = calculerPourcentageEtStatut(stockageActuelGo, limiteStockageGo);

  const ressourceChantiers: MetriqueQuota = {
    type: "CHANTIERS",
    libelle: "Chantiers actifs",
    actuel: chantiersActuel,
    limite: limiteChantiers,
    unite: "chantiers",
    pourcentage: statChantier.pourcentage,
    statut: statChantier.statut,
    messageAlerte:
      statChantier.statut === "BLOQUANT"
        ? `Plafond atteint (${chantiersActuel}/${limiteChantiers} chantiers). Vous ne pouvez plus créer de nouveau chantier.`
        : statChantier.statut === "AVERTISSEMENT"
        ? `Attention : ${chantiersActuel}/${limiteChantiers} chantiers utilisés (${statChantier.pourcentage}%).`
        : undefined,
  };

  const ressourceCollaborateurs: MetriqueQuota = {
    type: "COLLABORATEURS",
    libelle: "Collaborateurs & Utilisateurs",
    actuel: collabActuel,
    limite: limiteCollaborateurs,
    unite: "utilisateurs",
    pourcentage: statCollab.pourcentage,
    statut: statCollab.statut,
    messageAlerte:
      statCollab.statut === "BLOQUANT"
        ? `Plafond d'équipe atteint (${collabActuel}/${limiteCollaborateurs} membres).`
        : statCollab.statut === "AVERTISSEMENT"
        ? `Équipe presque complète (${collabActuel}/${limiteCollaborateurs} membres).`
        : undefined,
  };

  const ressourceStockage: MetriqueQuota = {
    type: "STOCKAGE",
    libelle: "Stockage cloud sécurisé",
    actuel: stockageActuelGo,
    limite: limiteStockageGo,
    unite: "Go",
    pourcentage: statStockage.pourcentage,
    statut: statStockage.statut,
    messageAlerte:
      statStockage.statut === "BLOQUANT"
        ? `Espace saturé (${stockageActuelGo} Go / ${limiteStockageGo} Go).`
        : statStockage.statut === "AVERTISSEMENT"
        ? `Espace presque saturé (${stockageActuelGo} Go / ${limiteStockageGo} Go).`
        : undefined,
  };

  const ressourceIA: MetriqueQuota = {
    type: "IA",
    libelle: "Assistant IA Chantier",
    actuel: accesIA ? 1 : 0,
    limite: accesIA ? null : 0,
    unite: "module",
    pourcentage: accesIA ? 100 : 0,
    statut: accesIA ? "ILLIMITE" : "BLOQUANT",
    messageAlerte: accesIA
      ? undefined
      : "L'assistant IA de rédaction de comptes-rendus n'est pas inclus dans votre formule actuelle.",
  };

  const aAuMoinsUnAvertissement =
    ressourceChantiers.statut === "AVERTISSEMENT" ||
    ressourceCollaborateurs.statut === "AVERTISSEMENT" ||
    ressourceStockage.statut === "AVERTISSEMENT";

  const aAuMoinsUnBlocage =
    ressourceChantiers.statut === "BLOQUANT" ||
    ressourceCollaborateurs.statut === "BLOQUANT" ||
    ressourceStockage.statut === "BLOQUANT" ||
    ressourceIA.statut === "BLOQUANT";

  return {
    forfaitCode: planCode,
    forfaitLibelle: plan.libelle || "Forfait BTP",
    estEnEssai: abonnement.statut === "ESSAI",
    joursEssaiRestants: abonnement.jours_essai_restants,
    aAuMoinsUnAvertissement,
    aAuMoinsUnBlocage,
    ressources: {
      chantiers: ressourceChantiers,
      collaborateurs: ressourceCollaborateurs,
      stockage: ressourceStockage,
      ia: ressourceIA,
    },
    recommandationSurclassement: RECOMMANDATIONS_SURCLASSEMENT[planCode] || null,
  };
}

function construireResumeDepuisScenario(scenario: ScenarioSimulationQuota): ResumeQuotas {
  const statChantier = calculerPourcentageEtStatut(scenario.chantiers.actuel, scenario.chantiers.limite);
  const statCollab = calculerPourcentageEtStatut(scenario.collaborateurs.actuel, scenario.collaborateurs.limite);
  const statStockage = calculerPourcentageEtStatut(scenario.stockageGo.actuel, scenario.stockageGo.limite);

  const ressourceChantiers: MetriqueQuota = {
    type: "CHANTIERS",
    libelle: "Chantiers actifs",
    actuel: scenario.chantiers.actuel,
    limite: scenario.chantiers.limite,
    unite: "chantiers",
    pourcentage: statChantier.pourcentage,
    statut: statChantier.statut,
    messageAlerte:
      statChantier.statut === "BLOQUANT"
        ? `Plafond de chantiers atteint (${scenario.chantiers.actuel}/${scenario.chantiers.limite} chantiers).`
        : statChantier.statut === "AVERTISSEMENT"
        ? `Attention : ${scenario.chantiers.actuel}/${scenario.chantiers.limite} chantiers utilisés (${statChantier.pourcentage}%).`
        : undefined,
  };

  const ressourceCollaborateurs: MetriqueQuota = {
    type: "COLLABORATEURS",
    libelle: "Collaborateurs & Utilisateurs",
    actuel: scenario.collaborateurs.actuel,
    limite: scenario.collaborateurs.limite,
    unite: "utilisateurs",
    pourcentage: statCollab.pourcentage,
    statut: statCollab.statut,
    messageAlerte:
      statCollab.statut === "BLOQUANT"
        ? `Plafond d'équipe atteint (${scenario.collaborateurs.actuel}/${scenario.collaborateurs.limite} membres).`
        : statCollab.statut === "AVERTISSEMENT"
        ? `Équipe presque complète (${scenario.collaborateurs.actuel}/${scenario.collaborateurs.limite} membres).`
        : undefined,
  };

  const ressourceStockage: MetriqueQuota = {
    type: "STOCKAGE",
    libelle: "Stockage cloud sécurisé",
    actuel: scenario.stockageGo.actuel,
    limite: scenario.stockageGo.limite,
    unite: "Go",
    pourcentage: statStockage.pourcentage,
    statut: statStockage.statut,
    messageAlerte:
      statStockage.statut === "BLOQUANT"
        ? `Espace saturé (${scenario.stockageGo.actuel} Go / ${scenario.stockageGo.limite} Go).`
        : statStockage.statut === "AVERTISSEMENT"
        ? `Espace presque saturé (${scenario.stockageGo.actuel} Go / ${scenario.stockageGo.limite} Go).`
        : undefined,
  };

  const ressourceIA: MetriqueQuota = {
    type: "IA",
    libelle: "Assistant IA Chantier",
    actuel: scenario.accesIA ? 1 : 0,
    limite: scenario.accesIA ? null : 0,
    unite: "module",
    pourcentage: scenario.accesIA ? 100 : 0,
    statut: scenario.accesIA ? "ILLIMITE" : "BLOQUANT",
    messageAlerte: scenario.accesIA
      ? undefined
      : "L'assistant IA de rédaction de comptes-rendus n'est pas inclus dans votre formule actuelle.",
  };

  return {
    forfaitCode: scenario.forfaitCode,
    forfaitLibelle:
      scenario.forfaitCode === "BATISSEUR"
        ? "Bâtisseur"
        : scenario.forfaitCode === "MAITRE_OEUVRE"
        ? "Maître d'Œuvre"
        : "Promoteur",
    estEnEssai: false,
    joursEssaiRestants: null,
    aAuMoinsUnAvertissement:
      ressourceChantiers.statut === "AVERTISSEMENT" ||
      ressourceCollaborateurs.statut === "AVERTISSEMENT" ||
      ressourceStockage.statut === "AVERTISSEMENT",
    aAuMoinsUnBlocage:
      ressourceChantiers.statut === "BLOQUANT" ||
      ressourceCollaborateurs.statut === "BLOQUANT" ||
      ressourceStockage.statut === "BLOQUANT" ||
      ressourceIA.statut === "BLOQUANT",
    ressources: {
      chantiers: ressourceChantiers,
      collaborateurs: ressourceCollaborateurs,
      stockage: ressourceStockage,
      ia: ressourceIA,
    },
    recommandationSurclassement: RECOMMANDATIONS_SURCLASSEMENT[scenario.forfaitCode] || null,
  };
}

export function appliquerScenarioSimulation(scenarioId: string): void {
  const scenario = SCENARIOS_SIMULATION.find((s) => s.id === scenarioId);
  if (!scenario || typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY_SCENARIO_QUOTA, JSON.stringify(scenario));
  window.dispatchEvent(new Event(EVENEMENT_QUOTAS_MODIFIE));
}

export function reinitialiserQuotasParDefaut(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_SCENARIO_QUOTA);
  window.dispatchEvent(new Event(EVENEMENT_QUOTAS_MODIFIE));
}

export async function verifierActionQuota(
  action: "CREER_CHANTIER" | "AJOUTER_COLLABORATEUR" | "UTILISER_IA" | "TELEVERSER_FICHIER"
): Promise<{
  autorise: boolean;
  ressource?: MetriqueQuota;
  message?: string;
  recommandation?: ResumeQuotas["recommandationSurclassement"];
}> {
  const quotas = await obtenirQuotasActuels();

  if (action === "CREER_CHANTIER") {
    if (quotas.ressources.chantiers.statut === "BLOQUANT") {
      return {
        autorise: false,
        ressource: quotas.ressources.chantiers,
        message: quotas.ressources.chantiers.messageAlerte,
        recommandation: quotas.recommandationSurclassement,
      };
    }
  } else if (action === "AJOUTER_COLLABORATEUR") {
    if (quotas.ressources.collaborateurs.statut === "BLOQUANT") {
      return {
        autorise: false,
        ressource: quotas.ressources.collaborateurs,
        message: quotas.ressources.collaborateurs.messageAlerte,
        recommandation: quotas.recommandationSurclassement,
      };
    }
  } else if (action === "UTILISER_IA") {
    if (quotas.ressources.ia.statut === "BLOQUANT") {
      return {
        autorise: false,
        ressource: quotas.ressources.ia,
        message: quotas.ressources.ia.messageAlerte,
        recommandation: quotas.recommandationSurclassement,
      };
    }
  } else if (action === "TELEVERSER_FICHIER") {
    if (quotas.ressources.stockage.statut === "BLOQUANT") {
      return {
        autorise: false,
        ressource: quotas.ressources.stockage,
        message: quotas.ressources.stockage.messageAlerte,
        recommandation: quotas.recommandationSurclassement,
      };
    }
  }

  return { autorise: true };
}
