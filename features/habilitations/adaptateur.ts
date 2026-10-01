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
import type { RoleItem } from "@/features/roles/types";

import { droitsDirection } from "./regles";
import type { Droits } from "./types";

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

  const brutes: Record<string, unknown> = {};
  for (const [module, valeur] of Object.entries(profil.habilitations ?? {})) {
    brutes[module] = accesNormalises(accesHabilitation(valeur));
  }
  return {
    estDirection: false,
    permissions: permissionsNormalisees(brutes),
    portee: { type: "PERSONNE", collaborateurId: profil.id },
  };
}

/** Les droits d'un rôle, portés par une personne donnée (ses chantiers). */
export function droitsDuRole(role: RoleItem, collaborateurId: string | null): Droits {
  return {
    estDirection: false,
    permissions: permissionsNormalisees(role.permissions_modules),
    // Sans personne, aucun chantier : la portée ne s'accorde pas par défaut.
    portee: { type: "PERSONNE", collaborateurId: collaborateurId ?? "" },
  };
}
