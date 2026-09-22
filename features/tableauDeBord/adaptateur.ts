/**
 * L'accès aux données du tableau de bord — plan de refonte, lot 4, couche 4.
 *
 * Même contrat que `features/projets/adaptateur.ts` : les charges utiles sont
 * privées, et rien au-dessus ne connaît la forme HTTP.
 */

import { versAlerteIntemperies } from "@/features/projets/adaptateur";
import { api } from "@/lib/api";

import type {
  BonAPayer,
  LigneChantier,
  MeteoPilotage,
  MetriquesPilotage,
  ReceptionMateriau,
  SignatureBon,
  TableauDeBord,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur.
 * ------------------------------------------------------------------ */

interface ChargeMetriques {
  chantiers_actifs: number;
  chantiers_conformes: number;
  chantiers_en_retard: number;
  sante_globale: number;
  sante_details: { securite: number; delais: number; budget: number };
  budget_total_montant: number;
  budget_engage_montant: number;
  bons_a_signer_count: number;
  bons_a_signer_montant: number;
  effectifs_sur_site: { total: number; regie: number; tacherons: number };
  rapports_journaliers: { soumis: number; attendus: number };
}

interface ChargeLigneChantier {
  id: string;
  reference: string;
  nom: string;
  description?: string;
  client_nom?: string;
  ville: string;
  quartier?: string;
  statut: string;
  avancement_reel: number;
  avancement_theorique: number;
  ecart: number;
  budget_initial_montant: number | null;
  budget_consomme_montant?: number;
  rapport_jour_statut?: string;
  indice_sante: number;
  chef_projet_nom?: string;
  conducteur_travaux_nom?: string;
}

interface ChargeBon {
  id: string;
  reference: string;
  beneficiaire: string;
  corps_etat?: string;
  montant: number;
  statut: string;
}

interface ChargeReception {
  id: string;
  projet: string;
  description: string;
  conforme: boolean;
  date_reception?: string;
}

interface ChargeMeteo {
  ville: string;
  temperature: number;
  description: string;
  praticable: boolean;
  alerte_intemperies: ChargeAlerteIntemperies | null;
}

interface ChargeAlerteIntemperies {
  projet: string;
  description: string;
  ville?: string;
  condition?: string;
}

interface ChargeTableauDeBord {
  metriques: ChargeMetriques;
  projets: ChargeLigneChantier[];
  bons_paiement_a_valider: ChargeBon[];
  receptions_materiaux: ChargeReception[];
  meteo: ChargeMeteo;
  alerte_intemperies?: ChargeAlerteIntemperies | null;
  aucun_chantier?: boolean;
}

interface ChargeSignature {
  succes: boolean;
  message: string;
  id: string;
  numero?: string;
  statut: string;
  signe_le?: string;
}

/* ------------------------------------------------------------------ *
 * Traductions.
 * ------------------------------------------------------------------ */

function versMetriques(charge: ChargeMetriques): MetriquesPilotage {
  return {
    chantiersActifs: charge.chantiers_actifs,
    chantiersConformes: charge.chantiers_conformes,
    chantiersEnRetard: charge.chantiers_en_retard,
    santeGlobale: charge.sante_globale,
    santeDetails: charge.sante_details,
    budgetTotal: charge.budget_total_montant,
    budgetEngage: charge.budget_engage_montant,
    bonsASignerNombre: charge.bons_a_signer_count,
    bonsASignerMontant: charge.bons_a_signer_montant,
    effectifsSurSite: charge.effectifs_sur_site,
    rapportsJournaliers: charge.rapports_journaliers,
  };
}

function versLigneChantier(charge: ChargeLigneChantier): LigneChantier {
  return {
    id: charge.id,
    reference: charge.reference,
    nom: charge.nom,
    description: charge.description ?? "",
    clientNom: charge.client_nom ?? "",
    ville: charge.ville,
    quartier: charge.quartier ?? "",
    statut: charge.statut,
    avancementReel: charge.avancement_reel ?? 0,
    avancementTheorique: charge.avancement_theorique ?? 0,
    ecart: charge.ecart ?? 0,
    budgetInitial: charge.budget_initial_montant ?? null,
    budgetConsomme: charge.budget_consomme_montant ?? 0,
    rapportJourStatut: charge.rapport_jour_statut ?? "EN_ATTENTE",
    indiceSante: charge.indice_sante ?? 0,
    chefProjetNom: charge.chef_projet_nom ?? "",
    conducteurTravauxNom: charge.conducteur_travaux_nom ?? "",
  };
}

function versBon(charge: ChargeBon): BonAPayer {
  return {
    id: charge.id,
    reference: charge.reference,
    beneficiaire: charge.beneficiaire,
    corpsEtat: charge.corps_etat ?? "",
    montant: charge.montant,
    statut: charge.statut,
  };
}

function versReception(charge: ChargeReception): ReceptionMateriau {
  return {
    id: charge.id,
    projet: charge.projet,
    description: charge.description,
    conforme: charge.conforme,
    dateReception: charge.date_reception ?? null,
  };
}

function versMeteo(charge: ChargeMeteo): MeteoPilotage {
  return {
    ville: charge.ville,
    temperature: charge.temperature,
    description: charge.description,
    praticable: charge.praticable,
    alerteIntemperies: versAlerteIntemperies(charge.alerte_intemperies),
  };
}

export function versTableauDeBord(charge: ChargeTableauDeBord): TableauDeBord {
  const chantiers = (charge.projets ?? []).map(versLigneChantier);
  return {
    metriques: versMetriques(charge.metriques),
    chantiers,
    bonsAPayer: (charge.bons_paiement_a_valider ?? []).map(versBon),
    receptionsMateriaux: (charge.receptions_materiaux ?? []).map(versReception),
    meteo: versMeteo(charge.meteo),
    alerteIntemperies: versAlerteIntemperies(charge.alerte_intemperies),
    /**
     * Le serveur peut ne pas trancher ; dans ce cas, l'absence de chantier se
     * déduit de la liste. La déduction est faite **ici**, pas dans l'écran,
     * pour qu'il n'existe qu'une façon de répondre à la question.
     */
    aucunChantier: Boolean(charge.aucun_chantier) || chantiers.length === 0,
  };
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

export async function lireTableauDeBord(): Promise<TableauDeBord> {
  return versTableauDeBord(await api.lire<ChargeTableauDeBord>("/tableau-de-bord/"));
}

export async function signerBonPaiement(
  id: string,
  commentaire?: string,
): Promise<SignatureBon> {
  const charge = await api.creer<ChargeSignature>(`/finance/bons-paiement/${id}/signer/`, {
    commentaire: commentaire ?? "",
  });
  return {
    succes: charge.succes,
    id: charge.id,
    numero: charge.numero ?? null,
    statut: charge.statut,
    signeLe: charge.signe_le ?? null,
  };
}
