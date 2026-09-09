/**
 * API pour la gestion dynamique des rôles et des habilitations par module.
 */

import { api, appeler } from "@/lib/api";
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

export async function listerRoles(): Promise<RoleItem[]> {
  return api.lire<RoleItem[]>("/roles/");
}

export async function obtenirRole(roleId: string): Promise<RoleDetailItem> {
  return api.lire<RoleDetailItem>(`/roles/${roleId}/`);
}

export async function creerRole(payload: CreationRolePayload): Promise<RoleDetailItem> {
  return api.creer<RoleDetailItem>("/roles/", payload);
}

export async function modifierRole(
  roleId: string,
  payload: ModificationRolePayload,
): Promise<RoleDetailItem> {
  return api.modifier<RoleDetailItem>(`/roles/${roleId}/`, payload);
}

export async function supprimerRole(
  roleId: string,
  payload: SuppressionRolePayload,
): Promise<ResultatSuppressionRole> {
  return api.creer<ResultatSuppressionRole>(`/roles/${roleId}/supprimer/`, payload);
}

export async function obtenirMatriceProjet(projetId: string): Promise<ProjetRoleMatrice[]> {
  return api.lire<ProjetRoleMatrice[]>(`/projets/${projetId}/permissions-roles/`);
}

export async function sauvegarderMatriceProjet(
  projetId: string,
  surcharges: { role_id: string; module: string; niveau: NiveauAcces | null }[],
): Promise<ProjetRoleMatrice[]> {
  return appeler<ProjetRoleMatrice[]>(`/projets/${projetId}/permissions-roles/`, {
    methode: "PUT",
    corps: { surcharges },
  });
}
