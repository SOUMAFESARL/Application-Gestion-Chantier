/**
 * L'accès aux données du domaine Tiers — couche 4.
 *
 * Seul fichier du domaine Tiers qui connaît les routes HTTP `/tiers/`.
 */

import { api } from "@/lib/api";

import { CLES_TIERS } from "./cles";
import {
  ROLES_TIERS,
  type DemandeTiers,
  type ProjetLieTiers,
  type RoleTiers,
  type Tiers,
  type TypeTiers,
} from "./types";

interface ChargeRoleTiers {
  id?: string;
  role: string;
  libelle?: string;
}

interface ChargeProjetLieTiers {
  id: string;
  reference?: string;
  nom: string;
  statut?: string;
  ville?: string;
  relations?: string[];
}

interface ChargeTiers {
  id: string;
  type_tiers?: string;
  raison_sociale: string;
  rccm?: string | null;
  nif?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  ville?: string | null;
  note_evaluation?: string | number | null;
  est_actif?: boolean;
  roles?: (ChargeRoleTiers | string)[];
  roles_codes?: string[];
  nombre_projets?: number;
  nombre_projets_lies?: number;
  est_reference?: boolean;
  projets_lies?: ChargeProjetLieTiers[];
}

function normaliserRoles(
  roles?: (ChargeRoleTiers | string)[],
  rolesCodes?: string[],
): RoleTiers[] {
  const source =
    Array.isArray(rolesCodes) && rolesCodes.length > 0
      ? rolesCodes
      : Array.isArray(roles)
        ? roles
        : [];
  const connus = new Set<string>(ROLES_TIERS);
  const resultat: RoleTiers[] = [];
  for (const item of source) {
    const code = typeof item === "string" ? item : item?.role;
    if (code && connus.has(code) && !resultat.includes(code as RoleTiers)) {
      resultat.push(code as RoleTiers);
    }
  }
  return resultat;
}

function versProjetLie(charge: ChargeProjetLieTiers): ProjetLieTiers {
  return {
    id: charge.id,
    reference: charge.reference ?? "",
    nom: charge.nom,
    statut: charge.statut ?? "",
    ville: charge.ville ?? "",
    relations: Array.isArray(charge.relations) ? charge.relations : [],
  };
}

function versTiers(charge: ChargeTiers): Tiers {
  const noteBrute = charge.note_evaluation;
  const noteNombre =
    noteBrute === null || noteBrute === undefined || noteBrute === ""
      ? null
      : Number(noteBrute);

  const projetsLies = Array.isArray(charge.projets_lies)
    ? charge.projets_lies.map(versProjetLie)
    : [];

  return {
    id: charge.id,
    typeTiers: charge.type_tiers === "PERSONNE" ? "PERSONNE" : "ENTREPRISE",
    raisonSociale: charge.raison_sociale,
    rccm: charge.rccm ?? "",
    nif: charge.nif ?? "",
    telephone: charge.telephone ?? "",
    email: charge.email ?? "",
    adresse: charge.adresse ?? "",
    ville: charge.ville ?? "",
    noteEvaluation:
      noteNombre !== null && !Number.isNaN(noteNombre) ? noteNombre : null,
    estActif: charge.est_actif ?? true,
    roles: normaliserRoles(charge.roles, charge.roles_codes),
    nombreProjetsLies:
      charge.nombre_projets ?? charge.nombre_projets_lies ?? projetsLies.length,
    estReference: Boolean(charge.est_reference) || projetsLies.length > 0,
    projetsLies,
  };
}

function versChargeTiers(demande: Partial<DemandeTiers>): Record<string, unknown> {
  const charge: Record<string, unknown> = {};
  if (demande.typeTiers !== undefined) charge.type_tiers = demande.typeTiers;
  if (demande.raisonSociale !== undefined) {
    charge.raison_sociale = demande.raisonSociale.trim();
  }
  if (demande.roles !== undefined) charge.roles = demande.roles;
  if (demande.telephone !== undefined) charge.telephone = demande.telephone.trim();
  if (demande.email !== undefined) charge.email = demande.email.trim();
  if (demande.rccm !== undefined) charge.rccm = demande.rccm.trim();
  if (demande.nif !== undefined) charge.nif = demande.nif.trim();
  if (demande.adresse !== undefined) charge.adresse = demande.adresse.trim();
  if (demande.ville !== undefined) charge.ville = demande.ville.trim();
  if (demande.noteEvaluation !== undefined) {
    charge.note_evaluation = demande.noteEvaluation;
  }
  if (demande.estActif !== undefined) charge.est_actif = demande.estActif;
  return charge;
}

/** Clé de cache historique conservée pour les sélecteurs (`ComboboxTiers`). */
export const cleTiers = CLES_TIERS.parRole;

/**
 * Les tiers actifs, filtrés par rôle si `role` est donné — utilisé par
 * `ComboboxTiers` et le registre de main-d'œuvre.
 */
export async function listerTiers(
  role?: RoleTiers,
  signal?: AbortSignal,
): Promise<Tiers[]> {
  const reponse = await api.lire<ChargeTiers[] | { results: ChargeTiers[] }>(
    "/tiers/",
    role ? { role } : undefined,
    signal,
  );
  const charges = Array.isArray(reponse) ? reponse : (reponse?.results ?? []);
  return charges.map(versTiers);
}

/**
 * Catalogue complet des tiers pour l'écran `/tiers` (y compris les inactifs
 * lorsque `inclureInactifs` est vrai).
 */
export async function listerCatalogueTiers(
  filtres?: {
    role?: RoleTiers;
    typeTiers?: TypeTiers;
    estActif?: boolean;
    inclureInactifs?: boolean;
    recherche?: string;
  },
  signal?: AbortSignal,
): Promise<Tiers[]> {
  const params: Record<string, string | number | boolean> = {};
  if (filtres?.role) params.role = filtres.role;
  if (filtres?.typeTiers) params.type_tiers = filtres.typeTiers;
  if (filtres?.estActif !== undefined) {
    params.est_actif = filtres.estActif;
  } else if (filtres?.inclureInactifs) {
    params.est_actif = "all";
  }
  if (filtres?.recherche?.trim()) params.recherche = filtres.recherche.trim();

  const reponse = await api.lire<ChargeTiers[] | { results: ChargeTiers[] }>(
    "/tiers/",
    Object.keys(params).length > 0 ? params : undefined,
    signal,
  );
  const charges = Array.isArray(reponse) ? reponse : (reponse?.results ?? []);
  return charges.map(versTiers);
}

/** Lecture détaillée d'un tiers (`GET /tiers/{id}/`). */
export async function lireTiers(id: string, signal?: AbortSignal): Promise<Tiers> {
  const charge = await api.lire<ChargeTiers>(`/tiers/${id}/`, undefined, signal);
  return versTiers(charge);
}

/**
 * Crée un tiers — accepte aussi bien l'ajout rapide (`{ raisonSociale, telephone, role }`)
 * que la création complète depuis `/tiers`.
 */
export async function creerTiers(
  saisie:
    | DemandeTiers
    | { raisonSociale: string; telephone: string; role: RoleTiers },
): Promise<Tiers> {
  const corps =
    "role" in saisie
      ? {
          raison_sociale: saisie.raisonSociale.trim(),
          telephone: saisie.telephone,
          roles: [saisie.role],
        }
      : versChargeTiers(saisie);

  const charge = await api.creer<ChargeTiers>("/tiers/", corps);
  return versTiers(charge);
}

/** Modifie un tiers existant (`PATCH /tiers/{id}/`). */
export async function modifierTiers(
  id: string,
  demande: Partial<DemandeTiers>,
): Promise<Tiers> {
  const charge = await api.modifier<ChargeTiers>(
    `/tiers/${id}/`,
    versChargeTiers(demande),
  );
  return versTiers(charge);
}

/** Active ou désactive un tiers (`PATCH /tiers/{id}/`). */
export async function basculerStatutTiers(
  id: string,
  estActif: boolean,
): Promise<Tiers> {
  return modifierTiers(id, { estActif });
}

/** Supprime un tiers (`DELETE /tiers/{id}/`). */
export async function supprimerTiers(id: string): Promise<void> {
  await api.supprimer(`/tiers/${id}/`);
}
