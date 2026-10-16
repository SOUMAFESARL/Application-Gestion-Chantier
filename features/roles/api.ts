/**
 * API pour la gestion dynamique des rôles et des habilitations par module.
 */

import { api } from "@/lib/api";
import { permissionsNormalisees } from "./regles";
import type {
  AccesModule,
  ModuleRole,
  NiveauAcces,
  PermissionCatalogue,
  PermissionsModules,
  PorteeRole,
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

export interface ChargeModuleRole {
  module_id: string;
  module_code: string;
  module_libelle: string;
  module_description?: string;
  module_icone?: string;
  module_ordre?: number;
  niveau?: number;
  permissions?: PermissionCatalogue[];
}

type ChargeRole<T extends RoleItem> = Omit<
  T,
  "permissions_modules" | "portee" | "avertissements" | "modules"
> & {
  permissions_modules?: Record<string, ChargeAcces> | null;
  portee?: PorteeRole;
  avertissements?: string[];
  modules?: ChargeModuleRole[];
};

function versRole<T extends RoleItem>(charge: ChargeRole<T>): T {
  const modulesBruts = charge.modules ?? [];
  const modules: ModuleRole[] = modulesBruts
    .filter((m) => (m.module_code || "").toLowerCase() !== "administration")
    .map((m) => {
      const niv =
        typeof m.niveau === "number" && m.niveau >= 0 && m.niveau <= 3
          ? (m.niveau as NiveauAcces)
          : 0;
      return {
        moduleId: m.module_id,
        code: m.module_code,
        libelle: m.module_libelle,
        description: m.module_description ?? "",
        icone: m.module_icone ?? "box",
        ordre: m.module_ordre ?? 0,
        niveau: niv,
        permissions: m.permissions ?? [],
      };
    })
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));

  return {
    ...charge,
    portee: charge.portee ?? "PROJET",
    avertissements: charge.avertissements ?? [],
    modules,
    permissions_modules: permissionsNormalisees(charge.permissions_modules),
  } as T;
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
  return api.creer<ResultatSuppressionRole>(`/roles/${roleId}/supprimer/`, payload);
}
