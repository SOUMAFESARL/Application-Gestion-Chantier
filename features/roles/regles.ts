/**
 * Règles pures du domaine Rôles — zéro React.
 *
 * Un rôle, c'est une liste de **codes de permission** (`projets.creer`…), rien
 * d'autre : ni niveau, ni accès lecture / saisie / validation.
 */

import { ErreurApi } from "@/lib/api";
import type { ModuleCatalogue, PermissionCatalogue, RoleItem } from "./types";

/** Les codes accordés au rôle, tous modules confondus, triés, sans doublon. */
export function codesDuRole(role: RoleItem): string[] {
  const codes = new Set<string>();
  for (const mod of role.modules ?? []) {
    for (const perm of mod.permissions ?? []) {
      if (perm.code) codes.add(perm.code.toLowerCase());
    }
  }
  return Array.from(codes).sort();
}

/** Les permissions accordées au rôle sur ce module (vide si aucune), dans l'ordre du serveur. */
export function permissionsDuModule(role: RoleItem, codeModule: string): PermissionCatalogue[] {
  const trouve = role.modules.find((m) => m.code.toLowerCase() === codeModule.toLowerCase());
  return trouve?.permissions ?? [];
}

/** Coche ou décoche une permission. Triée, sans doublon. */
export function basculerCode(codes: string[], code: string, coche: boolean): string[] {
  const c = code.toLowerCase();
  const ensemble = new Set(codes.map((x) => x.toLowerCase()));
  if (coche) {
    ensemble.add(c);
  } else {
    ensemble.delete(c);
  }
  return Array.from(ensemble).sort();
}

/** Les codes du rôle absents du catalogue (D1 : un AD devant un rôle qui dépasse son périmètre). */
export function codesHorsCatalogue(codes: string[], catalogue: ModuleCatalogue[]): string[] {
  const codesCatalogue = new Set<string>();
  for (const mod of catalogue) {
    for (const p of mod.permissions) {
      codesCatalogue.add(p.code.toLowerCase());
    }
  }
  return codes
    .map((c) => c.toLowerCase())
    .filter((c) => !codesCatalogue.has(c))
    .sort();
}

/**
 * Ce que ce compte peut faire de ce rôle — les règles du serveur (`apps/accounts/views/role.py`) :
 * - rôle `DG` : rien, pour personne (`modification_dg_interdite`) ;
 * - rôle système (`est_systeme`) : le DG seul (`modification_role_systeme_interdite`) ;
 * - matrice : pas si le compte n'est pas DG et que le rôle porte un code hors de son catalogue (D1) ;
 * - suppression : jamais un rôle système, jamais le DG.
 * `raison` est la clé du message qui explique une lecture seule (sous `roles.lectureSeule.*`).
 */
export function gestesSurRole(
  role: RoleItem | null | undefined,
  compte: { estDirection: boolean },
  catalogue: ModuleCatalogue[],
): {
  modifiable: boolean; // intitulé, description
  matriceModifiable: boolean;
  supprimable: boolean;
  raison: "roleDg" | "roleSysteme" | "horsPerimetre" | null;
} {
  if (!role) {
    return { modifiable: false, matriceModifiable: false, supprimable: false, raison: null };
  }

  const isDgRole = role.code.toUpperCase() === "DG";
  if (isDgRole) {
    return {
      modifiable: false,
      matriceModifiable: false,
      supprimable: false,
      raison: "roleDg",
    };
  }

  if (role.est_systeme && !compte.estDirection) {
    return {
      modifiable: false,
      matriceModifiable: false,
      supprimable: false,
      raison: "roleSysteme",
    };
  }

  const codes = codesDuRole(role);
  const hors = !compte.estDirection && codesHorsCatalogue(codes, catalogue).length > 0;

  return {
    modifiable: true,
    matriceModifiable: !hors,
    supprimable: !role.est_systeme,
    raison: hors ? "horsPerimetre" : null,
  };
}

export interface ColonneMatrice {
  code: string;
  libelle: string;
  description: string;
  ordre: number;
}

/**
 * Union des colonnes de modules du catalogue et des rôles existants.
 */
export function colonnesDeMatrice(
  roles: RoleItem[],
  catalogue: ModuleCatalogue[],
): ColonneMatrice[] {
  const carte = new Map<string, ColonneMatrice>();

  for (const mod of catalogue) {
    const code = mod.code.toLowerCase();
    carte.set(code, {
      code,
      libelle: mod.libelle,
      description: mod.description,
      ordre: mod.ordre,
    });
  }

  for (const role of roles) {
    for (const mod of role.modules ?? []) {
      const code = mod.code.toLowerCase();
      if (!carte.has(code)) {
        carte.set(code, {
          code,
          libelle: mod.libelle,
          description: mod.description,
          ordre: mod.ordre,
        });
      }
    }
  }

  return Array.from(carte.values()).sort(
    (a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code),
  );
}

/**
 * Le nombre de personnes touchées si l'erreur est la demande de confirmation d'un changement de
 * portée ; `null` pour toute autre erreur. Le serveur l'envoie en nombre, `ErreurApi.details` le
 * type en chaîne : `Number(...)`.
 */
export function personnesTouchees(erreur: unknown): number | null {
  if (!(erreur instanceof ErreurApi)) return null;
  if (erreur.code !== "confirmation_requise") return null;

  const brute = (erreur.details as Record<string, unknown> | undefined)?.personnes_touchees;
  if (brute === undefined || brute === null) return 0;
  const n = Number(Array.isArray(brute) ? brute[0] : brute);
  return Number.isNaN(n) ? 0 : n;
}

/** Changer la portée de ce rôle : la direction seule, jamais le rôle DG. */
export function peutChangerPortee(
  role: RoleItem | null | undefined,
  compte: { estDirection: boolean },
): boolean {
  if (!role) return false;
  if (role.code.toUpperCase() === "DG") return false;
  return compte.estDirection;
}

