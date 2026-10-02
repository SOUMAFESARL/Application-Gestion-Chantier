/**
 * API pour la gestion dynamique des rôles et des habilitations par module.
 */

import { api, appeler } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import { accesNormalises, permissionsNormalisees } from "./regles";
import { simulationRoles } from "./simulationRoles";
import type {
  AccesModule,
  NiveauAcces,
  PermissionsModules,
  ProjetRoleMatrice,
  RoleDetailItem,
  RoleItem,
} from "./types";

/**
 * **Écriture** : chaque module part en liste d'accès indépendants (`[]` =
 * aucun) — un rôle peut valider sans saisir. Le serveur doit accepter ce
 * format ; il stocke aujourd'hui un seul niveau cumulatif par module.
 *
 * **Lecture** : tant que le serveur renvoie des niveaux, `versRole` les
 * traduit en accès équivalents ; il accepte déjà les listes, pour que le jour
 * où Django bascule, aucun écran ne change.
 */
export interface CreationRolePayload {
  code: string;
  libelle: string;
  description?: string;
  permissions_modules?: PermissionsModules;
}

export interface ModificationRolePayload {
  libelle?: string;
  description?: string;
  permissions_modules?: PermissionsModules;
}

/** Un module tel que le serveur le renvoie : un niveau aujourd'hui, une liste demain. */
type ChargeAcces = NiveauAcces | AccesModule[];

type ChargeRole<T extends RoleItem> = Omit<T, "permissions_modules"> & {
  permissions_modules?: Record<string, ChargeAcces> | null;
};

interface ChargeProjetRoleMatrice extends Omit<ProjetRoleMatrice, "modules"> {
  modules: Record<string, { niveau?: NiveauAcces; acces?: AccesModule[]; est_surcharge: boolean }>;
}

function versRole<T extends RoleItem>(charge: ChargeRole<T>): T {
  return { ...charge, permissions_modules: permissionsNormalisees(charge.permissions_modules) } as T;
}

function versMatriceProjet(charge: ChargeProjetRoleMatrice[]): ProjetRoleMatrice[] {
  return charge.map((role) => ({
    ...role,
    modules: Object.fromEntries(
      Object.entries(role.modules).map(([code, m]) => [
        code,
        { acces: accesNormalises(m.acces ?? m.niveau), est_surcharge: m.est_surcharge },
      ]),
    ),
  }));
}

/** `acces: null` retire la surcharge : le module revient aux droits du rôle. */
export interface SurchargeAccesProjet {
  role_id: string;
  module: string;
  acces: AccesModule[] | null;
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
  const charge = await api.lire<ChargeRole<RoleItem>[]>("/parametres/roles/");
  return charge.map(versRole);
}

export async function obtenirRole(roleId: string): Promise<RoleDetailItem> {
  if (SIMULATION_ACTIVE) return simulationRoles.obtenir(roleId);
  return versRole(await api.lire<ChargeRole<RoleDetailItem>>(`/roles/${roleId}/`));
}

/**
 * `POST /parametres/roles/` — branché sur le serveur, hors simulation, comme la
 * lecture : un rôle créé en simulation n'apparaîtrait jamais dans la liste
 * réelle. La réponse n'est typée qu'en `RoleItem` — rien ne garantit encore
 * qu'elle porte le `comptage` du détail, et l'écran ne la lit pas.
 */
export async function creerRole(payload: CreationRolePayload): Promise<RoleItem> {
  return versRole(await api.creer<ChargeRole<RoleItem>>("/parametres/roles/", payload));
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
  return versRole(await api.modifier<ChargeRole<RoleItem>>(`/parametres/roles/${roleId}/`, payload));
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
  return versMatriceProjet(
    await api.lire<ChargeProjetRoleMatrice[]>(`/projets/${projetId}/permissions-roles/`),
  );
}

export async function sauvegarderMatriceProjet(
  projetId: string,
  surcharges: SurchargeAccesProjet[],
): Promise<ProjetRoleMatrice[]> {
  if (SIMULATION_ACTIVE) return simulationRoles.sauvegarderMatriceProjet(projetId, surcharges);
  const charge = await appeler<ChargeProjetRoleMatrice[]>(`/projets/${projetId}/permissions-roles/`, {
    methode: "PUT",
    corps: { surcharges },
  });
  return versMatriceProjet(charge);
}
