/**
 * API des rôles : un rôle est une liste de codes de permission.
 *
 * Écriture : le client envoie la liste complète des codes (`permissions: string[]`).
 * Le serveur sert encore un `niveau` et des alias par module : ils ne sont pas lus.
 */

import { api } from "@/lib/api";
import type {
  ModuleCatalogue,
  ModuleRole,
  PermissionCatalogue,
  PorteeRole,
  RoleItem,
} from "./types";

export interface CreationRolePayload {
  code: string;
  libelle: string;
  description: string;
  portee: PorteeRole;
  permissions: string[];
}

export interface ModificationRolePayload {
  libelle?: string;
  description?: string;
  /** La liste complète : elle remplace toute la matrice. Absente : la matrice ne change pas. */
  permissions?: string[];
  portee?: PorteeRole;
  /** Confirme un changement de portée que le serveur a fait confirmer (409). */
  confirmer?: boolean;
}

interface ChargePermissionCatalogue {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre?: number;
}

interface ChargeModuleCatalogue {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre?: number;
  icone?: string;
  permissions?: ChargePermissionCatalogue[];
}

function versModuleCatalogue(charge: ChargeModuleCatalogue): ModuleCatalogue {
  const permissions: PermissionCatalogue[] = (charge.permissions ?? [])
    .map((p) => ({
      id: p.id,
      code: p.code.toLowerCase(),
      libelle: p.libelle,
      description: p.description ?? "",
      ordre: p.ordre ?? 0,
    }))
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));

  return {
    id: charge.id,
    code: charge.code.toLowerCase(),
    libelle: charge.libelle,
    description: charge.description ?? "",
    ordre: charge.ordre ?? 0,
    icone: charge.icone ?? "box",
    permissions,
  };
}

/** `GET /modules/` — le catalogue de celui qui demande (voir README §3). */
export async function listerModulesEntreprise(signal?: AbortSignal): Promise<ModuleCatalogue[]> {
  const charge = await api.lire<ChargeModuleCatalogue[]>("/modules/", undefined, signal);
  return charge
    .filter((m) => (m.code || "").toLowerCase() !== "administration")
    .map(versModuleCatalogue)
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));
}

export interface ChargeModuleRole {
  module_id: string;
  module_code: string;
  module_libelle: string;
  module_description?: string;
  module_icone?: string;
  module_ordre?: number;
  permissions?: PermissionCatalogue[];
}

type ChargeRole<T extends RoleItem> = Omit<
  T,
  "portee" | "avertissements" | "modules"
> & {
  portee?: PorteeRole;
  avertissements?: string[];
  modules?: ChargeModuleRole[];
};

function versRole<T extends RoleItem>(charge: ChargeRole<T>): T {
  const modulesBruts = charge.modules ?? [];
  const modules: ModuleRole[] = modulesBruts
    .filter((m) => (m.module_code || "").toLowerCase() !== "administration")
    .map((m) => {
      return {
        moduleId: m.module_id,
        code: (m.module_code || "").toLowerCase(),
        libelle: m.module_libelle,
        description: m.module_description ?? "",
        icone: m.module_icone ?? "box",
        ordre: m.module_ordre ?? 0,
        permissions: (m.permissions ?? []).map((p) => ({
          ...p,
          code: p.code.toLowerCase(),
        })),
      };
    })
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));

  return {
    ...charge,
    portee: charge.portee ?? "PROJET",
    avertissements: charge.avertissements ?? [],
    modules,
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
 * `GET /parametres/roles/?attribuables=1` — seulement les rôles que l'utilisateur
 * connecté peut attribuer à un collaborateur (le serveur applique les règles
 * DG, AD et « on ne donne que ce qu'on possède »).
 */
export async function listerRolesAttribuables(): Promise<RoleItem[]> {
  const charge = await api.lire<ChargeRole<RoleItem>[]>("/parametres/roles/", {
    attribuables: "1",
  });
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
