/**
 * L'accès aux données du tableau de bord — plan de refonte, lot 4, couche 4.
 *
 * Même contrat que `features/projets/adaptateur.ts` : les charges utiles sont
 * privées, et rien au-dessus ne connaît la forme HTTP.
 *
 * **La route n'est pas encore fournie sous cette forme.** Le contrat
 * ci-dessous est celui de la vue DG (docs/PLAN_INTERFACES_DG.md §1) ; tant
 * que Django ne le sert pas, `NEXT_PUBLIC_API_SIMULE` aiguille vers
 * `simulationTableauDeBord`. Les noms de champs sont **à confirmer** avec le
 * backend : c'est ici, et seulement ici, qu'il faudra les corriger.
 */

import type { StatutProjet } from "@/features/projets/types";
import { api } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";

import { simulationTableauDeBord } from "./simulationTableauDeBord";
import type {
  AlertePilotage,
  Echeance,
  ElementAValider,
  GraviteAlerte,
  LigneChantier,
  ResultatValidation,
  SyntheseQhse,
  TableauDeBord,
  TypeAlerte,
  TypeEcheance,
  TypeValidation,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur.
 * ------------------------------------------------------------------ */

interface ChargeLigneChantier {
  id: string;
  reference: string;
  nom: string;
  client_nom?: string;
  ville: string;
  quartier?: string;
  statut: StatutProjet;
  chef_projet_nom?: string;
  avancement_reel: number;
  avancement_theorique: number;
  ecart: number;
  budget_initial_montant: number | null;
  budget_consomme_montant?: number;
  montant_marche?: number | null;
  marge_previsionnelle?: number | null;
  date_fin_prevue?: string | null;
  indice_sante: number;
}

interface ChargeValidation {
  id: string;
  type: TypeValidation;
  reference: string;
  objet: string;
  projet_nom: string;
  montant: number;
  demandeur: string;
  demande_le: string;
}

interface ChargeAlerte {
  id: string;
  type: TypeAlerte;
  gravite: GraviteAlerte;
  projet_id?: string | null;
  projet_nom?: string | null;
  sujet: string;
  montant?: number | null;
  jours?: number | null;
  survenue_le: string;
}

interface ChargeEcheance {
  id: string;
  type: TypeEcheance;
  libelle: string;
  projet_id?: string | null;
  projet_nom: string;
  date: string;
}

interface ChargeQhse {
  jours_sans_accident: number;
  accidents_mois: number;
  presque_accidents_mois: number;
  non_conformites_ouvertes: number;
  non_conformites_en_retard: number;
}

interface ChargeTableauDeBord {
  projets: ChargeLigneChantier[];
  validations?: ChargeValidation[];
  alertes?: ChargeAlerte[];
  echeances?: ChargeEcheance[];
  qhse?: ChargeQhse;
}

interface ChargeSignature {
  succes: boolean;
  id: string;
  statut: string;
  signe_le?: string;
}

/* ------------------------------------------------------------------ *
 * Traductions.
 * ------------------------------------------------------------------ */

function versLigneChantier(charge: ChargeLigneChantier): LigneChantier {
  return {
    id: charge.id,
    reference: charge.reference,
    nom: charge.nom,
    clientNom: charge.client_nom ?? "",
    ville: charge.ville,
    quartier: charge.quartier ?? "",
    statut: charge.statut,
    chefProjetNom: charge.chef_projet_nom ?? "",
    avancementReel: charge.avancement_reel ?? 0,
    avancementTheorique: charge.avancement_theorique ?? 0,
    ecart: charge.ecart ?? 0,
    budgetInitial: charge.budget_initial_montant ?? null,
    budgetConsomme: charge.budget_consomme_montant ?? 0,
    montantMarche: charge.montant_marche ?? null,
    margePrevisionnelle: charge.marge_previsionnelle ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    indiceSante: charge.indice_sante ?? 0,
  };
}

function versValidation(charge: ChargeValidation): ElementAValider {
  return {
    id: charge.id,
    type: charge.type,
    reference: charge.reference,
    objet: charge.objet,
    chantierNom: charge.projet_nom,
    montant: charge.montant,
    demandeur: charge.demandeur,
    demandeLe: charge.demande_le,
  };
}

function versAlerte(charge: ChargeAlerte): AlertePilotage {
  return {
    id: charge.id,
    type: charge.type,
    gravite: charge.gravite,
    chantierId: charge.projet_id ?? null,
    chantierNom: charge.projet_nom ?? null,
    sujet: charge.sujet,
    montant: charge.montant ?? null,
    jours: charge.jours ?? null,
    survenueLe: charge.survenue_le,
  };
}

function versEcheance(charge: ChargeEcheance): Echeance {
  return {
    id: charge.id,
    type: charge.type,
    libelle: charge.libelle,
    chantierId: charge.projet_id ?? null,
    chantierNom: charge.projet_nom,
    date: charge.date,
  };
}

/** Sans données QHSE, tout est à zéro — sauf les jours sans accident, qu'on ignore. */
function versQhse(charge: ChargeQhse | undefined): SyntheseQhse {
  return {
    joursSansAccident: charge?.jours_sans_accident ?? 0,
    accidentsMois: charge?.accidents_mois ?? 0,
    presqueAccidentsMois: charge?.presque_accidents_mois ?? 0,
    nonConformitesOuvertes: charge?.non_conformites_ouvertes ?? 0,
    nonConformitesEnRetard: charge?.non_conformites_en_retard ?? 0,
  };
}

function versTableauDeBord(charge: ChargeTableauDeBord): TableauDeBord {
  return {
    chantiers: (charge.projets ?? []).map(versLigneChantier),
    validations: (charge.validations ?? []).map(versValidation),
    alertes: (charge.alertes ?? []).map(versAlerte),
    echeances: (charge.echeances ?? []).map(versEcheance),
    qhse: versQhse(charge.qhse),
  };
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

export async function lireTableauDeBord(signal?: AbortSignal): Promise<TableauDeBord> {
  if (SIMULATION_ACTIVE) return simulationTableauDeBord.lire();
  return versTableauDeBord(
    await api.lire<ChargeTableauDeBord>("/tableau-de-bord/", undefined, signal),
  );
}

/**
 * La route de validation de chaque type d'élément.
 *
 * Seule celle des bons de paiement existe aujourd'hui ; les deux autres sont
 * **pressenties** (modules Achats et Contrats) et à confirmer avec le backend.
 */
const ROUTE_VALIDATION: Record<TypeValidation, (id: string) => string> = {
  BON_PAIEMENT: (id) => `/finance/bons-paiement/${id}/signer/`,
  DEMANDE_ACHAT: (id) => `/achats/demandes/${id}/valider/`,
  AVENANT: (id) => `/contrats/avenants/${id}/valider/`,
};

export async function validerElement(element: ElementAValider): Promise<ResultatValidation> {
  if (SIMULATION_ACTIVE) return simulationTableauDeBord.valider(element.id);
  const charge = await api.creer<ChargeSignature>(ROUTE_VALIDATION[element.type](element.id), {
    commentaire: "",
  });
  return { id: charge.id, valideLe: charge.signe_le ?? null };
}
