/**
 * API pour la gestion dynamique des rôles et des habilitations par module.
 */

import { api, appeler } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import { simulationRoles } from "./simulationRoles";
import type {
  NiveauAcces,
  ProjetRoleMatrice,
  RoleDetailItem,
  RoleItem,
} from "./types";

export interface CreationRolePayload {
  code: string;
  libelle: string;
  description?: string;
  permissions_modules?: Record<string, NiveauAcces>;
}

export interface ModificationRolePayload {
  libelle?: string;
  description?: string;
  permissions_modules?: Record<string, NiveauAcces>;
}

export interface SuppressionRolePayload {
  role_substitution_id: string;
  reassigner_vers_role_id?: string | null;
}

export interface ResultatSuppressionRole {
  message: string;
  role_supprime: string;
  utilisateurs_reassignes: number;
  affectations_reassignees: number;
}

/**
 * `GET /roles/` n'est pas encore accessible depuis ce poste — voir
 * `simulationRoles.ts`. Sous `NEXT_PUBLIC_API_SIMULE`, la lecture vient du jeu
 * de démonstration du domaine. L'appel réel est déjà à sa place définitive :
 * le jour où le drapeau passe à `0`, aucun écran ne bouge.
 */
export async function listerRoles(): Promise<RoleItem[]> {
  if (SIMULATION_ACTIVE) return simulationRoles.lister();
  return api.lire<RoleItem[]>("/roles/");
}

export async function obtenirRole(roleId: string): Promise<RoleDetailItem> {
  if (SIMULATION_ACTIVE) return simulationRoles.obtenir(roleId);
  return api.lire<RoleDetailItem>(`/roles/${roleId}/`);
}

export async function creerRole(payload: CreationRolePayload): Promise<RoleDetailItem> {
  if (SIMULATION_ACTIVE) return simulationRoles.creer(payload);
  return api.creer<RoleDetailItem>("/roles/", payload);
}

export async function modifierRole(
  roleId: string,
  payload: ModificationRolePayload,
): Promise<RoleDetailItem> {
  if (SIMULATION_ACTIVE) return simulationRoles.modifier(roleId, payload);
  return api.modifier<RoleDetailItem>(`/roles/${roleId}/`, payload);
}

export async function supprimerRole(
  roleId: string,
  payload: SuppressionRolePayload,
): Promise<ResultatSuppressionRole> {
  if (SIMULATION_ACTIVE) return simulationRoles.supprimer(roleId, payload);
  return api.creer<ResultatSuppressionRole>(`/roles/${roleId}/supprimer/`, payload);
}

export async function obtenirMatriceProjet(projetId: string): Promise<ProjetRoleMatrice[]> {
  if (SIMULATION_ACTIVE) return simulationRoles.obtenirMatriceProjet(projetId);
  return api.lire<ProjetRoleMatrice[]>(`/projets/${projetId}/permissions-roles/`);
}

export async function sauvegarderMatriceProjet(
  projetId: string,
  surcharges: { role_id: string; module: string; niveau: NiveauAcces | null }[],
): Promise<ProjetRoleMatrice[]> {
  if (SIMULATION_ACTIVE) return simulationRoles.sauvegarderMatriceProjet(projetId, surcharges);
  return appeler<ProjetRoleMatrice[]>(`/projets/${projetId}/permissions-roles/`, {
    methode: "PUT",
    corps: { surcharges },
  });
}
