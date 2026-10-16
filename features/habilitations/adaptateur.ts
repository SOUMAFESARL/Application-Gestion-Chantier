/**
 * D'où viennent les droits — le seul fichier du domaine qui connaisse la forme
 * du profil serveur et celle d'un rôle.
 *
 * Deux sources, un seul résultat (`Droits`) :
 * - le **profil** de la personne connectée (`GET /auth/profil/`) ;
 * - un **rôle** de l'entreprise (`GET /parametres/roles/`), quand un poste de
 *   développement l'incarne pour tester l'interface (voir `ContexteDroits`).
 */

import type { ProfilUtilisateur } from "@/features/auth/api";
import { accesNormalises, permissionsNormalisees } from "@/features/roles/regles";
import type { AccesModule, CodeModule, RoleItem } from "@/features/roles/types";
import { MODULES_CCD } from "@/features/roles/types";

import { accesDepuisCodes, droitsDirection } from "./regles";
import type { Droits, PorteeProjets } from "./types";

/**
 * Une habilitation du profil arrive au format `{ libelle, niveau }` (niveau
 * cumulatif 0-3) ; le format cible est la liste d'accès des rôles. Les deux
 * se lisent, comme dans `features/roles`.
 */
function accesHabilitation(valeur: unknown): unknown {
  if (valeur && typeof valeur === "object" && !Array.isArray(valeur)) {
    const { acces, niveau } = valeur as { acces?: unknown; niveau?: unknown };
    return acces ?? niveau;
  }
  return valeur;
}

/**
 * Les droits de la personne connectée.
 *
 * `role_global === "DG"` est le seul code de rôle lu dans tout le domaine :
 * c'est la direction, que le serveur signale aussi par `is_dg`. Tout autre
 * rôle est une donnée — ses accès, rien de plus.
 */
export function versDroits(profil: ProfilUtilisateur): Droits {
  if (profil.is_dg || profil.role_global === "DG") return droitsDirection();

  const codes = (profil.permissions ?? []).map((c) => c.toLowerCase());

  // Le serveur écrit les modules en capitales (`CHANTIER`), le domaine en
  // minuscules (`chantier`, `MODULES_CCD`). Sans cette traduction, aucun
  // module n'était reconnu : tout rôle hors direction se voyait refuser
  // chaque écran, sans erreur, sur la seule casse d'une clé.
  const brutes: Record<string, unknown> = {};
  for (const [module, valeur] of Object.entries(profil.habilitations ?? {})) {
    brutes[module.toLowerCase()] = accesNormalises(accesHabilitation(valeur));
  }
  const permissionsNiveau = permissionsNormalisees(brutes);

  // Accès par module : accesDepuisCodes(module, codes) ?? accès du niveau
  const permissionsParModule: Record<string, AccesModule[]> = {};
  const tousModules = new Set([...MODULES_CCD, ...Object.keys(brutes)]);
  for (const mod of tousModules) {
    const depuisCodes = codes.length > 0 ? accesDepuisCodes(mod, codes) : null;
    const acces = depuisCodes ?? permissionsNiveau[mod as CodeModule] ?? [];
    if (acces.length > 0) {
      permissionsParModule[mod] = acces;
    }
  }

  const portee: PorteeProjets =
    profil.portee === "ENTREPRISE"
      ? { type: "TOUS" }
      : { type: "PERSONNE", collaborateurId: profil.id };

  return {
    estDirection: false,
    codes,
    permissions: permissionsNormalisees(permissionsParModule),
    portee,
  };
}

/** Les droits d'un rôle, portés par une personne donnée (ses chantiers). */
export function droitsDuRole(role: RoleItem, collaborateurId: string | null): Droits {
  const codes: string[] = [];
  for (const mod of role.modules ?? []) {
    for (const perm of mod.permissions ?? []) {
      if (perm.code) {
        codes.push(perm.code.toLowerCase());
      }
    }
  }

  const permissionsNiveau = permissionsNormalisees(role.permissions_modules);
  const permissionsParModule: Record<string, AccesModule[]> = {};
  const tousModules = new Set([...MODULES_CCD, ...Object.keys(role.permissions_modules ?? {})]);
  for (const mod of tousModules) {
    const depuisCodes = codes.length > 0 ? accesDepuisCodes(mod, codes) : null;
    const acces = depuisCodes ?? permissionsNiveau[mod as CodeModule] ?? [];
    if (acces.length > 0) {
      permissionsParModule[mod] = acces;
    }
  }

  const portee: PorteeProjets =
    role.portee === "ENTREPRISE"
      ? { type: "TOUS" }
      : { type: "PERSONNE", collaborateurId: collaborateurId ?? "" };

  return {
    estDirection: false,
    codes,
    permissions: permissionsNormalisees(permissionsParModule),
    portee,
  };
}
