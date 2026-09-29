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
 * `GET /parametres/roles/` — branché sur le serveur, **hors simulation** : la
 * route existe, la liste lue est donc toujours la vraie, drapeau
 * `NEXT_PUBLIC_API_SIMULE` ou non. Le serveur renvoie un tableau nu (pas de
 * pagination), déjà à la forme de `RoleItem`.
 */
export async function listerRoles(): Promise<RoleItem[]> {
  return api.lire<RoleItem[]>("/parametres/roles/");
}

export async function obtenirRole(roleId: string): Promise<RoleDetailItem> {
  if (SIMULATION_ACTIVE) return simulationRoles.obtenir(roleId);
  return api.lire<RoleDetailItem>(`/roles/${roleId}/`);
}

/**
 * `POST /parametres/roles/` — branché sur le serveur, hors simulation, comme la
 * lecture : un rôle créé en simulation n'apparaîtrait jamais dans la liste
 * réelle. La réponse n'est typée qu'en `RoleItem` — rien ne garantit encore
 * qu'elle porte le `comptage` du détail, et l'écran ne la lit pas.
 */
export async function creerRole(payload: CreationRolePayload): Promise<RoleItem> {
  return api.creer<RoleItem>("/parametres/roles/", payload);
}

/**
 * `PATCH /parametres/roles/{id}/` — branché sur le serveur, hors simulation :
 * les identifiants viennent de la liste réelle, la simulation ne les connaît
 * pas. Sert à la fois à l'intitulé/description et à la matrice des droits.
 */
export async function modifierRole(
  roleId: string,
  payload: ModificationRolePayload,
): Promise<RoleItem> {
  return api.modifier<RoleItem>(`/parametres/roles/${roleId}/`, payload);
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
