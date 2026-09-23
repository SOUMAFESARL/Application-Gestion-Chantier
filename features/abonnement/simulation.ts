/**
 * Serveur simulé de la souscription et de l'historique de paiement — T-025.
 *
 * Même contrat que `lib/api/simulation.ts` (latence, `SIMULATION_ACTIVE`,
 * bandeau) : ce module rejoue ce que `POST /abonnement/souscription/` et
 * `GET /abonnement/paiements/` rendront le jour où ils existent, pour que
 * l'écran de tarifs et l'historique puissent être parcourus dès maintenant.
 */

import { decomposerTva, planParCode, prixPeriode } from "./regles";
import { PAYS_FISCAUX, PLANS_DISPONIBLES } from "./types";
import type { DemandeSouscription, LignePaiement, RecuPaiement } from "./types";

const LATENCE = 700;
const CLE_HISTORIQUE = "ccd.simulation.abonnement.paiements";

function attendre<T>(valeur: T, delai = LATENCE): Promise<T> {
  return new Promise((resoudre) => setTimeout(() => resoudre(valeur), delai));
}

function reference(): string {
  return `CPY-TX-${Math.floor(100_000 + Math.random() * 900_000)}`;
}

function numeroFacture(date: Date, sequence: number): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  return `FAC-${annee}-${mois}-${String(sequence).padStart(4, "0")}`;
}

function ilYA(joursAvant: number): string {
  const date = new Date();
  date.setDate(date.getDate() - joursAvant);
  return date.toISOString();
}

/** Trois paiements de démonstration, pour que l'historique ne s'ouvre jamais vide. */
function historiqueInitial(): LignePaiement[] {
  const planMaitreOeuvre = planParCode(PLANS_DISPONIBLES, "MAITRE_OEUVRE");
  const montant = planMaitreOeuvre ? prixPeriode(planMaitreOeuvre, "MENSUELLE") : 7_900_000;

  return [
    {
      id: "sim-hist-1",
      reference_transaction: "CPY-TX-984128",
      numero_facture: numeroFacture(new Date(ilYA(6)), 42),
      date_heure: ilYA(6),
      plan: "MAITRE_OEUVRE",
      periodicite: "MENSUELLE",
      mode_paiement: "WAVE",
      entreprise: "SOUMAFE BTP Sarl",
      montant_centimes: montant,
      statut: "REUSSI",
    },
    {
      id: "sim-hist-2",
      reference_transaction: "CPY-TX-971054",
      numero_facture: numeroFacture(new Date(ilYA(36)), 31),
      date_heure: ilYA(36),
      plan: "MAITRE_OEUVRE",
      periodicite: "MENSUELLE",
      mode_paiement: "ORANGE_MONEY",
      entreprise: "SOUMAFE BTP Sarl",
      montant_centimes: montant,
      statut: "REUSSI",
    },
    {
      id: "sim-hist-3",
      reference_transaction: "CPY-TX-958211",
      numero_facture: numeroFacture(new Date(ilYA(66)), 18),
      date_heure: ilYA(66),
      plan: "MAITRE_OEUVRE",
      periodicite: "MENSUELLE",
      mode_paiement: "MTN_MOMO",
      entreprise: "SOUMAFE BTP Sarl",
      montant_centimes: montant,
      statut: "REUSSI",
    },
  ];
}

function lireHistorique(): LignePaiement[] {
  if (typeof window === "undefined") return historiqueInitial();
  try {
    const brut = window.sessionStorage.getItem(CLE_HISTORIQUE);
    return brut ? (JSON.parse(brut) as LignePaiement[]) : historiqueInitial();
  } catch {
    return historiqueInitial();
  }
}

function ecrireHistorique(lignes: LignePaiement[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_HISTORIQUE, JSON.stringify(lignes));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

export async function simulerSouscription(demande: DemandeSouscription): Promise<RecuPaiement> {
  const plan = planParCode(PLANS_DISPONIBLES, demande.plan);
  const paysFiscal = PAYS_FISCAUX.find((pays) => pays.code === demande.facturation.pays_fiscal);
  const montant = plan ? prixPeriode(plan, demande.periodicite) : 0;
  // Le taux ne sert qu'à décomposer HT/TVA à l'écran : il n'affecte jamais
  // le montant TTC débité, fixé par le plan.
  if (paysFiscal) decomposerTva(montant, paysFiscal.taux_tva);

  const date = new Date();
  const historique = lireHistorique();

  const recu: RecuPaiement = {
    id: `sim-${date.getTime()}`,
    reference_transaction: reference(),
    numero_facture: numeroFacture(date, historique.length + 1),
    date_heure: date.toISOString(),
    plan: demande.plan,
    periodicite: demande.periodicite,
    mode_paiement: demande.mode_paiement,
    entreprise: demande.facturation.raison_sociale,
    montant_centimes: montant,
    statut: "REUSSI",
  };

  ecrireHistorique([recu, ...historique]);
  return attendre(recu);
}

export async function historiquePaiementsSimule(): Promise<LignePaiement[]> {
  return attendre(lireHistorique());
}
