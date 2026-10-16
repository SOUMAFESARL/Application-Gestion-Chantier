/**
 * API pour la gestion dynamique des rôles et des habilitations par module.
 *
 * Écriture : le client envoie la liste complète des permissions (`permissions: string[]`).
 * Le serveur recalcule les niveaux de chaque module et enregistre les droits.
 */

import { api } from "@/lib/api";
import type {
  ModuleCatalogue,
  ModuleRole,
  NiveauAcces,
  PermissionCatalogue,
  PorteeRole,
  RoleItem,
} from "./types";

export interface CreationRolePayload {
  code: string;
  libelle: string;
  description: string;
  portee: PorteeRole; // F5 le fait choisir ; ici, toujours "PROJET"
  permissions: string[];
}

export interface ModificationRolePayload {
  libelle?: string;
  description?: string;
  /** La liste complète : elle remplace toute la matrice. Absente : la matrice ne change pas. */
  permissions?: string[];
  portee?: PorteeRole; // F5
  confirmer?: boolean; // F5
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
  niveau?: number;
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
      const niv =
        typeof m.niveau === "number" && m.niveau >= 0 && m.niveau <= 3
          ? (m.niveau as NiveauAcces)
          : 0;
      return {
        moduleId: m.module_id,
        code: (m.module_code || "").toLowerCase(),
        libelle: m.module_libelle,
        description: m.module_description ?? "",
        icone: m.module_icone ?? "box",
        ordre: m.module_ordre ?? 0,
        niveau: niv,
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
