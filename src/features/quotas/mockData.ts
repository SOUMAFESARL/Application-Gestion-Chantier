/**
 * Données et scénarios de simulation pour les quotas et le surclassement de formule.
 */

import { InfoSurclassement, ScenarioSimulationQuota } from "./types";

export const RECOMMANDATIONS_SURCLASSEMENT: Record<string, InfoSurclassement> = {
  BATISSEUR: {
    forfaitActuelCode: "BATISSEUR",
    forfaitActuelLibelle: "Bâtisseur",
    forfaitCibleCode: "MAITRE_OEUVRE",
    forfaitCibleLibelle: "Maître d'Œuvre",
    prixCibleMensuelFcfa: 79000,
    prixCibleAnnuelFcfa: 790000,
    titreIncitation: "Votre activité grandit ! Passez à la vitesse supérieure avec Maître d'Œuvre",
    argumentaire:
      "Ne laissez aucun plafond freiner le développement de vos chantiers. Débloquez 50 chantiers, 25 collaborateurs et l'Intelligence Artificielle d'assistance aux comptes-rendus.",
    beneficesDebloques: [
      {
        ressource: "Chantiers actifs",
        avant: "5 chantiers",
        apres: "50 chantiers",
        gainCle: "x10 chantiers supplémentaires",
      },
      {
        ressource: "Collaborateurs & Chefs de chantier",
        avant: "5 membres",
        apres: "25 membres",
        gainCle: "+20 accès inclus",
      },
      {
        ressource: "Stockage plans & photos de preuve",
        avant: "5 Go",
        apres: "20 Go",
        gainCle: "Stockage quadruplé",
      },
      {
        ressource: "Assistant IA Chantier",
        avant: "Non inclus",
        apres: "Inclus en illimité",
        gainCle: "Comptes-rendus & résumés auto",
      },
    ],
    estMeilleureOffre: true,
  },
  MAITRE_OEUVRE: {
    forfaitActuelCode: "MAITRE_OEUVRE",
    forfaitActuelLibelle: "Maître d'Œuvre",
    forfaitCibleCode: "PROMOTEUR",
    forfaitCibleLibelle: "Promoteur",
    prixCibleMensuelFcfa: 189000,
    prixCibleAnnuelFcfa: 1890000,
    titreIncitation: "Passez à l'échelle supérieure avec le forfait Promoteur",
    argumentaire:
      "Pour les grands projets, promoteurs immobiliers et bureaux d'études. Profitez de chantiers et collaborateurs illimités, d'une personnalisation marque blanche et d'un support dédié.",
    beneficesDebloques: [
      {
        ressource: "Chantiers actifs",
        avant: "50 chantiers",
        apres: "Illimité",
        gainCle: "Aucune limite de projets",
      },
      {
        ressource: "Collaborateurs",
        avant: "25 membres",
        apres: "Illimité",
        gainCle: "Équipes et sous-traitants illimités",
      },
      {
        ressource: "Stockage haute performance",
        avant: "20 Go",
        apres: "100 Go",
        gainCle: "+80 Go cloud ultra-rapide",
      },
      {
        ressource: "Marque blanche & Support",
        avant: "Support standard",
        apres: "Logo personnalisé & VIP 24/7",
        gainCle: "Chargé de compte dédié",
      },
    ],
    estMeilleureOffre: false,
  },
};

export const SCENARIOS_SIMULATION: ScenarioSimulationQuota[] = [
  {
    id: "batisseur-bloque-chantiers",
    nom: "Blocage 100% Chantiers (Bâtisseur)",
    description: "5 chantiers atteints sur 5. La création d'un nouveau chantier est immédiatement bloquée avec incitation directe au surclassement.",
    forfaitCode: "BATISSEUR",
    chantiers: { actuel: 5, limite: 5 },
    collaborateurs: { actuel: 3, limite: 5 },
    stockageGo: { actuel: 2.1, limite: 5 },
    accesIA: false,
  },
  {
    id: "batisseur-alerte-80",
    nom: "Alerte Préventive 80% Chantiers (Bâtisseur)",
    description: "4 chantiers sur 5 (80%). Bannière d'avertissement ambre invitant à anticiper le passage à Maître d'Œuvre.",
    forfaitCode: "BATISSEUR",
    chantiers: { actuel: 4, limite: 5 },
    collaborateurs: { actuel: 4, limite: 5 },
    stockageGo: { actuel: 3.4, limite: 5 },
    accesIA: false,
  },
  {
    id: "batisseur-bloque-collaborateurs",
    nom: "Blocage 100% Collaborateurs (Bâtisseur)",
    description: "5 collaborateurs sur 5. Impossible d'inviter un nouveau chef de chantier sans passer à Maître d'Œuvre (25 membres).",
    forfaitCode: "BATISSEUR",
    chantiers: { actuel: 3, limite: 5 },
    collaborateurs: { actuel: 5, limite: 5 },
    stockageGo: { actuel: 1.8, limite: 5 },
    accesIA: false,
  },
  {
    id: "batisseur-alerte-stockage",
    nom: "Stockage Proche Saturation (96%)",
    description: "4.8 Go utilisés sur 5 Go. Alerte sur le téléversement de nouvelles photos haute résolution.",
    forfaitCode: "BATISSEUR",
    chantiers: { actuel: 4, limite: 5 },
    collaborateurs: { actuel: 3, limite: 5 },
    stockageGo: { actuel: 4.8, limite: 5 },
    accesIA: false,
  },
  {
    id: "batisseur-bloque-ia",
    nom: "Tentative d'accès IA Chantier (Non inclus)",
    description: "L'artisan tente de générer un compte-rendu avec l'IA. Dialogue explicatif valorisant l'IA intégrée au forfait Maître d'Œuvre.",
    forfaitCode: "BATISSEUR",
    chantiers: { actuel: 2, limite: 5 },
    collaborateurs: { actuel: 2, limite: 5 },
    stockageGo: { actuel: 1.2, limite: 5 },
    accesIA: false,
  },
  {
    id: "maitre-oeuvre-confort",
    nom: "Forfait Maître d'Œuvre (Quotas confortables)",
    description: "8 chantiers sur 50, 11 collaborateurs sur 25, IA active. Tout est au vert avec marge de manœuvre.",
    forfaitCode: "MAITRE_OEUVRE",
    chantiers: { actuel: 8, limite: 50 },
    collaborateurs: { actuel: 11, limite: 25 },
    stockageGo: { actuel: 6.5, limite: 20 },
    accesIA: true,
  },
];
